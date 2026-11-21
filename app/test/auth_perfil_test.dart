import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:robot_ucab_app/core/mqtt/mqtt_service.dart';
import 'package:robot_ucab_app/core/theme/cockpit_theme.dart';
import 'package:robot_ucab_app/features/auth/registro_usuarios.dart';
import 'package:robot_ucab_app/features/auth/sesion_local.dart';
import 'package:robot_ucab_app/features/perfil/aprendizaje_ruta.dart';
import 'package:robot_ucab_app/features/perfil/pantalla_perfil.dart';
import 'package:robot_ucab_app/main.dart' show PuertaAcceso;
import 'package:robot_ucab_app/shared/widgets/pastilla_mqtt.dart';

Future<void> _cargarFuentes() async {
  Future<ByteData> f(String ruta) async =>
      ByteData.sublistView(await File(ruta).readAsBytes());
  final FontLoader inter = FontLoader('Inter')
    ..addFont(f('assets/fonts/Inter-Regular.otf'))
    ..addFont(f('assets/fonts/Inter-SemiBold.otf'))
    ..addFont(f('assets/fonts/Inter-Bold.otf'));
  final FontLoader mono = FontLoader('JetBrainsMono')
    ..addFont(f('assets/fonts/JetBrainsMono-Regular.ttf'))
    ..addFont(f('assets/fonts/JetBrainsMono-Medium.ttf'))
    ..addFont(f('assets/fonts/JetBrainsMono-SemiBold.ttf'))
    ..addFont(f('assets/fonts/JetBrainsMono-Bold.ttf'));
  await inter.load();
  await mono.load();
}

class _Entorno {
  _Entorno(this.servicio, this.sesion, this.registro);
  final MqttService servicio;
  final SesionLocal sesion;
  final RegistroUsuarios registro;
}

/// Monta la app desde la puerta de acceso (Login o Telemetría según la sesión).
Future<_Entorno> _montar(
  WidgetTester t, {
  double ancho = 390,
  double alto = 844,
}) async {
  t.view.physicalSize = Size(ancho * 2, alto * 2);
  t.view.devicePixelRatio = 2;
  addTearDown(t.view.reset);
  final MqttService servicio = MqttService();
  final SesionLocal sesion = SesionLocal();
  final RegistroUsuarios registro = RegistroUsuarios();
  await t.pumpWidget(
    MultiProvider(
      providers: <ChangeNotifierProvider<ChangeNotifier>>[
        ChangeNotifierProvider<MqttService>.value(value: servicio),
        ChangeNotifierProvider<SesionLocal>.value(value: sesion),
        ChangeNotifierProvider<RegistroUsuarios>.value(value: registro),
        ChangeNotifierProvider<AprendizajeRuta>(
          create: (_) => AprendizajeRuta(),
        ),
      ],
      child: MaterialApp(
        theme: buildCockpitTheme(),
        home: const PuertaAcceso(),
      ),
    ),
  );
  await t.pump(const Duration(milliseconds: 100));
  return _Entorno(servicio, sesion, registro);
}

Future<void> _cerrar(WidgetTester t, _Entorno e) async {
  await t.pump(const Duration(milliseconds: 400)); // ACK simulado del demo
  await t.pumpWidget(const SizedBox());
  e.servicio.dispose();
  e.sesion.dispose();
  e.registro.dispose();
}

/// Desplaza la lista del Perfil hasta que [f] esté construido y a la vista.
Future<void> _mostrar(WidgetTester t, Finder f) async {
  await t.scrollUntilVisible(
    f,
    300,
    scrollable: find
        .descendant(
          of: find.byType(PantallaPerfil),
          matching: find.byType(Scrollable),
        )
        .first,
  );
}

Future<void> _tocar(WidgetTester t, Finder f) async {
  if (f.evaluate().isEmpty) await _mostrar(t, f);
  await t.ensureVisible(f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
  await t.pump(); // arranca la transición de ruta o de la hoja
  await t.pump(const Duration(milliseconds: 400));
}

/// Escribe usuario y contraseña en el Login y pulsa "Iniciar Sesión".
Future<void> _entrarCon(WidgetTester t, String usuario, String clave) async {
  await t.enterText(find.byKey(const Key('login-usuario')), usuario);
  await t.enterText(find.byKey(const Key('login-clave')), clave);
  await _tocar(t, find.byKey(const Key('login-entrar')));
}

Future<void> _abrirPerfil(WidgetTester t) async {
  await _tocar(t, find.byKey(const Key('boton-perfil')));
}

void main() {
  setUpAll(_cargarFuentes);

  group('SesionLocal (mock)', () {
    test('empieza sin sesión y guarda rol, usuario, nombre y modo demo', () {
      final SesionLocal s = SesionLocal();
      expect(s.activa, isFalse);
      expect(s.rol, isNull);
      s.iniciar(
        RolUsuario.administrador,
        usuario: '  admin ',
        nombre: ' Administrador demo ',
        ahora: DateTime(2026, 11, 19, 10),
      );
      expect(s.activa, isTrue);
      expect(s.rol, RolUsuario.administrador);
      expect(s.usuario, 'admin');
      expect(s.nombre, 'Administrador demo');
      expect(s.demo, isFalse);
      expect(
        s.duracion(DateTime(2026, 11, 19, 10, 42, 5)),
        const Duration(minutes: 42, seconds: 5),
      );
      s.cerrar();
      expect(s.activa, isFalse);
      expect(s.usuario, '');
      expect(s.nombre, '');
      expect(s.duracion(), Duration.zero);
    });

    test('notifica solo cuando cambia', () {
      final SesionLocal s = SesionLocal();
      int n = 0;
      s.addListener(() => n++);
      s.cerrar(); // ya estaba cerrada
      expect(n, 0);
      s.iniciar(RolUsuario.operador, usuario: 'a');
      s.cerrar();
      expect(n, 2);
    });

    test('formatoDuracion', () {
      expect(formatoDuracion(const Duration(hours: 3, minutes: 42)), '03h 42m');
      expect(
        formatoDuracion(const Duration(minutes: 5, seconds: 9)),
        '05m 09s',
      );
      expect(formatoDuracion(Duration.zero), '00m 00s');
    });
  });

  group('estado MQTT real', () {
    test('desconectado muestra "--" y el demo se rotula como demo', () {
      final MqttService s = MqttService();
      expect(resumenMqtt(s).texto, 'MQTT: Desconectado (--)');
      s.iniciarSimulacion();
      expect(resumenMqtt(s).texto, 'MQTT: Demo (sin red)');
      s.detenerSimulacion();
      s.dispose();
    });
  });

  group('Login', () {
    testWidgets('muestra marca, botón Demo en esquina, Acceso rápido modal y MQTT real', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      expect(find.text('Autonomous Laboratory AGV'), findsOneWidget);
      expect(find.text('USUARIO'), findsOneWidget);
      expect(find.text('CONTRASEÑA'), findsOneWidget);
      expect(find.text('Iniciar Sesión'), findsOneWidget);
      expect(find.byKey(const Key('login-demo')), findsOneWidget);
      expect(find.text('Demo'), findsOneWidget);
      expect(find.text('Modo Demo (Offline)'), findsNothing);
      // Cuerpo limpio: sin botones grandes ni párrafo largo visibles por defecto
      expect(find.byKey(const Key('acceso-operador')), findsNothing);
      expect(find.byKey(const Key('acceso-admin')), findsNothing);
      expect(find.byKey(const Key('login-aviso-local')), findsNothing);
      // Abrir modal Acceso rápido muestra las credenciales demo y nota local
      await _tocar(t, find.byKey(const Key('login-acceso-rapido')));
      final String aviso = t
          .widget<Text>(find.byKey(const Key('login-aviso-local')))
          .data!;
      expect(aviso, contains('Demo local sin backend'));
      expect(aviso, contains('usuario / usuario'));
      expect(aviso, contains('admin / admin'));
      expect(aviso, contains('No hay registro público'));
      await _tocar(t, find.text('Cerrar'));
      // Sin registro público ni selector de rol
      expect(find.textContaining('Registrarse'), findsNothing);
      expect(find.textContaining('Crear cuenta'), findsNothing);
      expect(find.text('ACCEDER COMO'), findsNothing);
      expect(find.text('MQTT: Desconectado (--)'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(t.takeException(), isNull);
      await _cerrar(t, e);
    });

    testWidgets('usuario / usuario entra como Operador', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      await _entrarCon(t, 'usuario', 'usuario');
      expect(e.sesion.rol, RolUsuario.operador);
      expect(e.sesion.usuario, 'usuario');
      expect(e.sesion.demo, isFalse);
      expect(e.servicio.simulando, isFalse);
      expect(find.byType(NavigationBar), findsOneWidget);
      await _cerrar(t, e);
    });

    testWidgets(
      'admin / admin entra como Administrador (usuario sin distinguir mayúsculas)',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _entrarCon(t, '  ADMIN ', 'admin');
        expect(e.sesion.rol, RolUsuario.administrador);
        expect(e.sesion.usuario, 'admin');
        await _cerrar(t, e);
      },
    );

    testWidgets('el acceso rápido rellena las credenciales demo', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      await _tocar(t, find.byKey(const Key('login-acceso-rapido')));
      await _tocar(t, find.byKey(const Key('acceso-admin')));
      TextField campo(String k) => t.widget<TextField>(find.byKey(Key(k)));
      expect(campo('login-usuario').controller!.text, 'admin');
      expect(campo('login-clave').controller!.text, 'admin');
      await _tocar(t, find.byKey(const Key('login-acceso-rapido')));
      await _tocar(t, find.byKey(const Key('acceso-operador')));
      expect(campo('login-usuario').controller!.text, 'usuario');
      expect(campo('login-clave').controller!.text, 'usuario');
      expect(
        e.sesion.activa,
        isFalse,
        reason: 'solo rellena: no inicia sesión',
      );
      await _cerrar(t, e);
    });

    testWidgets('credenciales incorrectas no inician sesión', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      for (final (String u, String c) in <(String, String)>[
        ('admin', 'Admin'), // la contraseña distingue mayúsculas
        ('admin', ''),
        ('admin', 'usuario'),
        ('', ''),
        ('nadie', 'nadie'),
      ]) {
        await _entrarCon(t, u, c);
        expect(e.sesion.activa, isFalse, reason: '$u / $c');
        expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget);
      }
      await _cerrar(t, e);
    });

    testWidgets('el ojo muestra y oculta la contraseña', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      TextField clave() =>
          t.widget<TextField>(find.byKey(const Key('login-clave')));
      expect(clave().obscureText, isTrue);
      await _tocar(t, find.byTooltip('Mostrar contraseña'));
      expect(clave().obscureText, isFalse);
      await _cerrar(t, e);
    });

    testWidgets(
      'Modo Demo (Offline) entra como Operador y arranca la simulación',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _tocar(t, find.byKey(const Key('login-demo')));
        expect(e.servicio.simulando, isTrue);
        expect(e.sesion.rol, RolUsuario.operador);
        expect(e.sesion.demo, isTrue);
        expect(
          find.text('MODO DEMO · datos simulados, sin red ni robot'),
          findsOneWidget,
        );
        await _cerrar(t, e);
      },
    );

    testWidgets('no desborda en pantalla pequeña (360×640)', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t, ancho: 360, alto: 640);
      expect(t.takeException(), isNull);
      await _cerrar(t, e);
    });
  });

  group('Perfil · Operador', () {
    testWidgets('el botón de Perfil de la barra abre la vista del Operador', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      await _entrarCon(t, 'usuario', 'usuario');
      // Las 4 pestañas siguen intactas
      expect(find.byType(NavigationDestination), findsNWidgets(4));
      await _abrirPerfil(t);
      expect(find.text('PERFIL · OPERADOR'), findsOneWidget);
      expect(find.text('@usuario'), findsOneWidget);
      expect(find.text('Operador demo'), findsOneWidget);
      expect(find.text('SESIÓN ACTUAL'), findsOneWidget);
      expect(find.text('ENLACE MQTT'), findsOneWidget);
      // Solo Admin: Fail-Safe, gestión de usuarios y CSV
      expect(find.byKey(const Key('perfil-failsafe')), findsNothing);
      expect(find.text('Gestión de Usuarios'), findsNothing);
      expect(find.byKey(const Key('perfil-exportar')), findsNothing);
      // Datos reales o "--": sin conexión no hay broker ni latencia
      expect(find.text('MQTT: Desconectado (--)'), findsOneWidget);
      expect(t.widget<Text>(find.byKey(const Key('perfil-broker'))).data, '--');
      expect(
        t.widget<Text>(find.byKey(const Key('perfil-latencia'))).data,
        '--',
      );
      expect(t.takeException(), isNull);
      await _cerrar(t, e);
    });

    testWidgets('Cerrar Sesión vuelve al Login', (WidgetTester t) async {
      final _Entorno e = await _montar(t);
      await _entrarCon(t, 'usuario', 'usuario');
      await _abrirPerfil(t);
      await _tocar(t, find.byKey(const Key('perfil-cerrar')));
      await t.pump(const Duration(milliseconds: 400)); // termina el pop
      expect(e.sesion.activa, isFalse);
      expect(find.text('Iniciar Sesión'), findsOneWidget);
      expect(find.byType(PantallaPerfil), findsNothing);
      await _cerrar(t, e);
    });

    testWidgets('Cerrar Sesión desde el Modo Demo detiene la simulación', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      await _tocar(t, find.byKey(const Key('login-demo')));
      await _abrirPerfil(t);
      // Datos del demo: paquetes reales de la analítica P12
      expect(e.servicio.analitica.totalPaquetes, greaterThan(0));
      await _tocar(t, find.byKey(const Key('perfil-cerrar')));
      expect(e.servicio.simulando, isFalse);
      expect(e.sesion.activa, isFalse);
      expect(find.byKey(const Key('login-demo')), findsOneWidget);
      await _cerrar(t, e);
    });
  });

  group('Perfil · Administrador', () {
    Future<_Entorno> entrarAdmin(WidgetTester t, {double ancho = 390}) async {
      final _Entorno e = await _montar(t, ancho: ancho);
      await _entrarCon(t, 'admin', 'admin');
      await _abrirPerfil(t);
      return e;
    }

    testWidgets('Fail-Safe es de solo lectura, con candado y umbrales reales', (
      WidgetTester t,
    ) async {
      final _Entorno e = await entrarAdmin(t);
      expect(find.text('PERFIL · ADMIN'), findsOneWidget);
      final Finder tarjeta = find.byKey(const Key('perfil-failsafe'));
      expect(tarjeta, findsOneWidget);
      expect(
        find.descendant(of: tarjeta, matching: find.byIcon(Icons.lock_outline)),
        findsWidgets,
      );
      expect(find.text('Parada crítica frontal'), findsOneWidget);
      expect(find.text('Zona de precaución'), findsOneWidget);
      expect(find.text('< 20 cm'), findsOneWidget);
      expect(find.text('20–50 cm'), findsOneWidget);
      expect(find.textContaining('Solo lectura'), findsWidgets);
      // Ningún control editable dentro de la tarjeta
      for (final Type tipo in <Type>[
        TextField,
        Switch,
        Slider,
        Checkbox,
        Radio<int>,
        IconButton,
        TextButton,
        ElevatedButton,
        OutlinedButton,
        FilledButton,
        InkWell,
      ]) {
        expect(
          find.descendant(of: tarjeta, matching: find.byType(tipo)),
          findsNothing,
          reason: '$tipo no debe existir en la tarjeta Fail-Safe',
        );
      }
      expect(t.takeException(), isNull);
      await _cerrar(t, e);
    });

    testWidgets('Exportar Sesión (CSV) usa el reporte real de P12', (
      WidgetTester t,
    ) async {
      String? copiado;
      t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (MethodCall c) async {
          if (c.method == 'Clipboard.setData') {
            copiado = (c.arguments as Map<Object?, Object?>)['text'] as String?;
          }
          return null;
        },
      );
      addTearDown(
        () => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      final _Entorno e = await entrarAdmin(t);

      // Sin datos de sesión: botón deshabilitado y aviso
      final Finder boton = find.byKey(const Key('perfil-exportar'));
      await _mostrar(t, boton);
      expect(t.widget<OutlinedButton>(boton).onPressed, isNull);
      expect(find.textContaining('Sin datos de sesión'), findsOneWidget);

      // Con datos (Modo Demo): se habilita y exporta el CSV de P12
      e.servicio.iniciarSimulacion();
      await t.pump(const Duration(milliseconds: 100));
      expect(t.widget<OutlinedButton>(boton).onPressed, isNotNull);
      await _tocar(t, boton);
      expect(copiado, isNotNull);
      expect(copiado, startsWith('# Reporte de sesion'));
      expect(copiado, contains('paquetes_total;'));
      expect(copiado, contains('origen;Modo Demo;'));
      await _cerrar(t, e);
    });

    for (final (String n, double w) in <(String, double)>[
      ('360', 360),
      ('1100', 1100),
    ]) {
      testWidgets('la vista de Admin no desborda ($n px)', (
        WidgetTester t,
      ) async {
        final _Entorno e = await entrarAdmin(t, ancho: w);
        e.servicio.iniciarSimulacion();
        await t.pump(const Duration(milliseconds: 100));
        expect(t.takeException(), isNull);
        await _cerrar(t, e);
      });
    }
  });

  testWidgets('la barra de app con el botón de Perfil no desborda a 360 px', (
    WidgetTester t,
  ) async {
    final _Entorno e = await _montar(t, ancho: 360, alto: 740);
    await _tocar(t, find.byKey(const Key('login-demo')));
    expect(find.byKey(const Key('boton-perfil')), findsOneWidget);
    expect(
      find.byTooltip('Perfil'),
      findsNothing,
    ); // sin tooltip nativo: usa Semantics
    expect(t.takeException(), isNull);
    await _cerrar(t, e);
  });
}
