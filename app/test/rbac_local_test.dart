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
import 'package:robot_ucab_app/features/perfil/gestion_usuarios.dart';
import 'package:robot_ucab_app/features/perfil/pantalla_perfil.dart';
import 'package:robot_ucab_app/main.dart' show PuertaAcceso;

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
  await t.pump(const Duration(milliseconds: 400));
  await t.pumpWidget(const SizedBox());
  e.servicio.dispose();
  e.sesion.dispose();
  e.registro.dispose();
}

Future<void> _tocar(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
  await t.pump();
  await t.pump(const Duration(milliseconds: 400));
}

Future<void> _entrarCon(WidgetTester t, String usuario, String clave) async {
  await t.enterText(find.byKey(const Key('login-usuario')), usuario);
  await t.enterText(find.byKey(const Key('login-clave')), clave);
  await _tocar(t, find.byKey(const Key('login-entrar')));
}

/// Baja la lista de la pantalla de usuarios hasta [f].
Future<void> _bajarUsuarios(WidgetTester t, Finder f) => t.scrollUntilVisible(
  f,
  200,
  scrollable: find
      .descendant(
        of: find.byType(PantallaGestionUsuarios),
        matching: find.byType(Scrollable),
      )
      .first,
);

Future<void> _abrirGestion(WidgetTester t) async {
  await _tocar(t, find.byKey(const Key('boton-perfil')));
  await t.scrollUntilVisible(
    find.byKey(const Key('perfil-usuarios')),
    300,
    scrollable: find
        .descendant(
          of: find.byType(PantallaPerfil),
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await _tocar(t, find.byKey(const Key('perfil-usuarios')));
}

Future<void> _crear(
  WidgetTester t, {
  required String nombre,
  required String usuario,
  required String clave,
}) async {
  await t.enterText(find.byKey(const Key('usuarios-nombre')), nombre);
  await t.enterText(find.byKey(const Key('usuarios-usuario')), usuario);
  await t.enterText(find.byKey(const Key('usuarios-clave')), clave);
  await _tocar(t, find.byKey(const Key('usuarios-crear')));
}

/// Vuelve del Perfil/Gestión y cierra la sesión.
Future<void> _cerrarSesion(WidgetTester t) async {
  t
      .state<NavigatorState>(find.byType(Navigator))
      .popUntil((Route<dynamic> r) => r.isFirst);
  await t.pump();
  await t.pump(const Duration(milliseconds: 400));
  await _tocar(t, find.byKey(const Key('boton-perfil')));
  await t.scrollUntilVisible(
    find.byKey(const Key('perfil-cerrar')),
    300,
    scrollable: find
        .descendant(
          of: find.byType(PantallaPerfil),
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await _tocar(t, find.byKey(const Key('perfil-cerrar')));
  await t.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(_cargarFuentes);

  group('RegistroUsuarios (RBAC local en memoria)', () {
    test('trae solo las dos cuentas demo: usuario/usuario y admin/admin', () {
      final RegistroUsuarios r = RegistroUsuarios();
      expect(r.cuentas.map((CuentaLocal c) => c.usuario), <String>[
        'usuario',
        'admin',
      ]);
      expect(r.autenticar('usuario', 'usuario')!.rol, RolUsuario.operador);
      expect(r.autenticar('admin', 'admin')!.rol, RolUsuario.administrador);
      expect(r.autenticar('  ADMIN ', 'admin'), isNotNull);
      expect(r.autenticar('admin', 'Admin'), isNull);
      expect(r.autenticar('admin', 'usuario'), isNull);
      expect(r.autenticar('x', 'x'), isNull);
      expect(r.operadoresCreados, isEmpty);
      expect(r.cuentas.every((CuentaLocal c) => c.demo), isTrue);
    });

    test(
      'solo un Administrador crea operadores, y siempre con rol Operador',
      () {
        final RegistroUsuarios r = RegistroUsuarios();
        for (final RolUsuario? actor in <RolUsuario?>[
          null,
          RolUsuario.operador,
        ]) {
          expect(
            r.crearOperador(
              actor: actor,
              nombre: 'Ana',
              usuario: 'ana',
              clave: 'ana123',
            ),
            ResultadoAlta.sinPermiso,
          );
        }
        expect(r.cuentas.length, 2);
        int avisos = 0;
        r.addListener(() => avisos++);
        expect(
          r.crearOperador(
            actor: RolUsuario.administrador,
            nombre: '  Ana Pérez ',
            usuario: ' Ana ',
            clave: 'ana123',
          ),
          ResultadoAlta.creado,
        );
        expect(avisos, 1);
        final CuentaLocal ana = r.buscar('ANA')!;
        expect(ana.usuario, 'ana');
        expect(ana.nombre, 'Ana Pérez');
        expect(ana.rol, RolUsuario.operador);
        expect(ana.demo, isFalse);
        expect(r.autenticar('ana', 'ana123'), isNotNull);
        expect(r.operadoresCreados.length, 1);
      },
    );

    test('valida nombre, usuario (largo, formato, repetido) y contraseña', () {
      final RegistroUsuarios r = RegistroUsuarios();
      ResultadoAlta alta(String n, String u, String c) => r.crearOperador(
        actor: RolUsuario.administrador,
        nombre: n,
        usuario: u,
        clave: c,
      );
      expect(alta('', 'ana', 'ana123'), ResultadoAlta.nombreVacio);
      expect(alta('   ', 'ana', 'ana123'), ResultadoAlta.nombreVacio);
      expect(alta('Ana', 'an', 'ana123'), ResultadoAlta.usuarioCorto);
      expect(alta('Ana', 'ana perez', 'ana123'), ResultadoAlta.usuarioInvalido);
      expect(alta('Ana', 'ana@ucab', 'ana123'), ResultadoAlta.usuarioInvalido);
      expect(alta('Ana', 'admin', 'ana123'), ResultadoAlta.usuarioRepetido);
      expect(alta('Ana', 'USUARIO', 'ana123'), ResultadoAlta.usuarioRepetido);
      expect(alta('Ana', 'ana', '123'), ResultadoAlta.claveCorta);
      expect(alta('Ana', 'ana', 'ana123'), ResultadoAlta.creado);
      expect(alta('Otra', 'ANA', 'otra123'), ResultadoAlta.usuarioRepetido);
      expect(r.cuentas.length, 3);
      for (final ResultadoAlta x in ResultadoAlta.values) {
        expect(x.mensaje, isNotEmpty);
      }
    });

    test('solo un Administrador elimina, y no las cuentas demo', () {
      final RegistroUsuarios r = RegistroUsuarios();
      r.crearOperador(
        actor: RolUsuario.administrador,
        nombre: 'Luis',
        usuario: 'luis',
        clave: 'luis123',
      );
      expect(
        r.eliminarOperador(actor: RolUsuario.operador, usuario: 'luis'),
        isFalse,
      );
      expect(r.eliminarOperador(actor: null, usuario: 'luis'), isFalse);
      expect(
        r.eliminarOperador(actor: RolUsuario.administrador, usuario: 'admin'),
        isFalse,
      );
      expect(
        r.eliminarOperador(actor: RolUsuario.administrador, usuario: 'usuario'),
        isFalse,
      );
      expect(
        r.eliminarOperador(actor: RolUsuario.administrador, usuario: 'nadie'),
        isFalse,
      );
      expect(r.buscar('luis'), isNotNull);
      expect(
        r.eliminarOperador(actor: RolUsuario.administrador, usuario: 'LUIS'),
        isTrue,
      );
      expect(r.buscar('luis'), isNull);
      expect(r.autenticar('luis', 'luis123'), isNull);
      expect(r.cuentas.length, 2);
    });
  });

  group('flujo: el Administrador da de alta y el operador entra', () {
    testWidgets(
      'crear Operador desde Admin, cerrar sesión e ingresar con esa cuenta',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _entrarCon(t, 'admin', 'admin');
        expect(e.sesion.rol, RolUsuario.administrador);
        await _abrirGestion(t);
        expect(find.byType(PantallaGestionUsuarios), findsOneWidget);
        expect(find.textContaining('No hay registro público'), findsOneWidget);

        await _crear(t, nombre: 'Ana Pérez', usuario: 'Ana', clave: 'ana123');
        expect(
          t.widget<Text>(find.byKey(const Key('usuarios-mensaje'))).data,
          'Operador @ana creado.',
        );
        await _bajarUsuarios(t, find.byKey(const Key('cuenta-ana')));
        expect(find.byKey(const Key('cuenta-ana')), findsOneWidget);
        expect(find.text('Ana Pérez'), findsOneWidget);
        expect(find.text('@ana'), findsOneWidget);
        expect(e.registro.buscar('ana'), isNotNull);
        // el formulario se limpia
        expect(
          t
              .widget<TextField>(find.byKey(const Key('usuarios-nombre')))
              .controller!
              .text,
          '',
        );

        await _cerrarSesion(t);
        expect(e.sesion.activa, isFalse);
        expect(find.text('Iniciar Sesión'), findsOneWidget);

        // La cuenta nueva entra como Operador
        await _entrarCon(t, 'ana', 'ana123');
        expect(e.sesion.rol, RolUsuario.operador);
        expect(e.sesion.usuario, 'ana');
        expect(e.sesion.nombre, 'Ana Pérez');
        await _tocar(t, find.byKey(const Key('boton-perfil')));
        expect(find.text('PERFIL · OPERADOR'), findsOneWidget);
        expect(find.text('Ana Pérez'), findsOneWidget);
        expect(find.text('@ana'), findsOneWidget);
        // y no ve nada de Administrador
        expect(find.byKey(const Key('perfil-failsafe')), findsNothing);
        expect(find.byKey(const Key('perfil-usuarios')), findsNothing);
        expect(find.byKey(const Key('perfil-exportar')), findsNothing);
        await _cerrar(t, e);
      },
    );

    testWidgets(
      'el formulario rechaza datos inválidos y repetidos con un mensaje',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _entrarCon(t, 'admin', 'admin');
        await _abrirGestion(t);
        String mensaje() =>
            t.widget<Text>(find.byKey(const Key('usuarios-mensaje'))).data!;

        await _crear(t, nombre: '', usuario: 'ana', clave: 'ana123');
        expect(mensaje(), ResultadoAlta.nombreVacio.mensaje);
        await _crear(t, nombre: 'Ana', usuario: 'ab', clave: 'ana123');
        expect(mensaje(), ResultadoAlta.usuarioCorto.mensaje);
        await _crear(t, nombre: 'Ana', usuario: 'a b c', clave: 'ana123');
        expect(mensaje(), ResultadoAlta.usuarioInvalido.mensaje);
        await _crear(t, nombre: 'Ana', usuario: 'admin', clave: 'ana123');
        expect(mensaje(), ResultadoAlta.usuarioRepetido.mensaje);
        await _crear(t, nombre: 'Ana', usuario: 'ana', clave: 'abc');
        expect(mensaje(), ResultadoAlta.claveCorta.mensaje);
        expect(e.registro.operadoresCreados, isEmpty);
        expect(t.takeException(), isNull);
        await _cerrar(t, e);
      },
    );

    testWidgets(
      'eliminar un operador creado le quita el acceso; las cuentas demo no se pueden eliminar',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _entrarCon(t, 'admin', 'admin');
        await _abrirGestion(t);
        await _crear(
          t,
          nombre: 'Luis Gómez',
          usuario: 'luis',
          clave: 'luis123',
        );
        await _bajarUsuarios(t, find.byKey(const Key('cuenta-luis')));
        // Las cuentas demo no tienen botón de eliminar
        expect(
          find.byKey(const Key('usuarios-eliminar-usuario')),
          findsNothing,
        );
        expect(find.byKey(const Key('usuarios-eliminar-admin')), findsNothing);
        expect(find.byKey(const Key('usuarios-eliminar-luis')), findsOneWidget);

        await _tocar(t, find.byKey(const Key('usuarios-eliminar-luis')));
        expect(find.byKey(const Key('cuenta-luis')), findsNothing);
        expect(e.registro.buscar('luis'), isNull);
        expect(
          t.widget<Text>(find.byKey(const Key('usuarios-mensaje'))).data,
          'Operador @luis eliminado.',
        );

        await _cerrarSesion(t);
        await _entrarCon(t, 'luis', 'luis123');
        expect(e.sesion.activa, isFalse);
        expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget);
        await _cerrar(t, e);
      },
    );

    testWidgets('un Operador no puede dar de alta aunque llegue a la pantalla', (
      WidgetTester t,
    ) async {
      // La pantalla se monta con una sesión de Operador (no accesible desde la
      // UI): el botón queda deshabilitado y el registro lo rechaza.
      t.view.physicalSize = const Size(780, 1688);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      final SesionLocal sesion = SesionLocal()
        ..iniciar(RolUsuario.operador, usuario: 'usuario');
      final RegistroUsuarios registro = RegistroUsuarios();
      await t.pumpWidget(
        MultiProvider(
          providers: <ChangeNotifierProvider<ChangeNotifier>>[
            ChangeNotifierProvider<SesionLocal>.value(value: sesion),
            ChangeNotifierProvider<RegistroUsuarios>.value(value: registro),
          ],
          child: MaterialApp(
            theme: buildCockpitTheme(),
            home: const PantallaGestionUsuarios(),
          ),
        ),
      );
      await t.pump(const Duration(milliseconds: 100));
      expect(
        t
            .widget<FilledButton>(find.byKey(const Key('usuarios-crear')))
            .onPressed,
        isNull,
      );
      expect(
        registro.crearOperador(
          actor: sesion.rol,
          nombre: 'X',
          usuario: 'xxx',
          clave: 'xxxx',
        ),
        ResultadoAlta.sinPermiso,
      );
      await t.pumpWidget(const SizedBox());
      sesion.dispose();
      registro.dispose();
    });

    for (final (String n, double w, double h) in <(String, double, double)>[
      ('360×640', 360, 640),
      ('390×844', 390, 844),
    ]) {
      testWidgets('la pantalla de usuarios no desborda ($n)', (
        WidgetTester t,
      ) async {
        final _Entorno e = await _montar(t, ancho: w, alto: h);
        await _entrarCon(t, 'admin', 'admin');
        await _abrirGestion(t);
        await _crear(
          t,
          nombre: 'María de los Ángeles Fernández Rodríguez',
          usuario: 'maria.fernandez',
          clave: 'clave1234',
        );
        await _bajarUsuarios(
          t,
          find.byKey(const Key('cuenta-maria.fernandez')),
        );
        expect(t.takeException(), isNull);
        await _cerrar(t, e);
      });
    }
  });
}
