import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:robot_ucab_app/core/demo/simulacion_pista.dart';
import 'package:robot_ucab_app/core/mqtt/mqtt_service.dart';
import 'package:robot_ucab_app/core/theme/cockpit_theme.dart';
import 'package:robot_ucab_app/features/auth/registro_usuarios.dart';
import 'package:robot_ucab_app/features/auth/sesion_local.dart';
import 'package:robot_ucab_app/features/perfil/aprendizaje_ruta.dart';
import 'package:robot_ucab_app/features/perfil/pantalla_aprendizaje_ruta.dart';
import 'package:robot_ucab_app/features/perfil/pantalla_perfil.dart';
import 'package:robot_ucab_app/features/telemetria/mapa_pista.dart';
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
  _Entorno(this.servicio, this.sesion, this.registro, this.ruta);
  final MqttService servicio;
  final SesionLocal sesion;
  final RegistroUsuarios registro;
  final AprendizajeRuta ruta;
}

Future<_Entorno> _montar(
  WidgetTester t, {
  double ancho = 390,
  double alto = 844,
  Widget? home,
  RolUsuario? rol,
}) async {
  t.view.physicalSize = Size(ancho * 2, alto * 2);
  t.view.devicePixelRatio = 2;
  addTearDown(t.view.reset);
  final MqttService servicio = MqttService();
  final SesionLocal sesion = SesionLocal();
  if (rol != null) sesion.iniciar(rol, usuario: 'x');
  final RegistroUsuarios registro = RegistroUsuarios();
  final AprendizajeRuta ruta = AprendizajeRuta();
  await t.pumpWidget(
    MultiProvider(
      providers: <ChangeNotifierProvider<ChangeNotifier>>[
        ChangeNotifierProvider<MqttService>.value(value: servicio),
        ChangeNotifierProvider<SesionLocal>.value(value: sesion),
        ChangeNotifierProvider<RegistroUsuarios>.value(value: registro),
        ChangeNotifierProvider<AprendizajeRuta>.value(value: ruta),
      ],
      child: MaterialApp(
        theme: buildCockpitTheme(),
        home: home ?? const PuertaAcceso(),
      ),
    ),
  );
  await t.pump(const Duration(milliseconds: 100));
  return _Entorno(servicio, sesion, registro, ruta);
}

Future<void> _cerrar(WidgetTester t, _Entorno e) async {
  await t.pump(const Duration(milliseconds: 400));
  await t.pumpWidget(const SizedBox());
  e.servicio.dispose();
  e.sesion.dispose();
  e.registro.dispose();
  e.ruta.dispose();
}

Future<void> _tocar(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
  await t.pump();
  await t.pump(const Duration(milliseconds: 400));
}

Future<void> _entrarCon(
  WidgetTester t,
  String u,
  String c, {
  bool admin = false,
}) async {
  await _tocar(
    t,
    find.byKey(Key(admin ? 'rol-administrador' : 'rol-operador')),
  );
  await t.enterText(find.byKey(const Key('login-usuario')), u);
  await t.enterText(find.byKey(const Key('login-clave')), c);
  await _tocar(t, find.byKey(const Key('login-entrar')));
}

Future<void> _bajarPerfil(WidgetTester t, Finder f) => t.scrollUntilVisible(
  f,
  300,
  scrollable: find
      .descendant(
        of: find.byType(PantallaPerfil),
        matching: find.byType(Scrollable),
      )
      .first,
);

Future<void> _bajarRuta(WidgetTester t, Finder f) => t.scrollUntilVisible(
  f,
  250,
  scrollable: find
      .descendant(
        of: find.byType(PantallaAprendizajeRuta),
        matching: find.byType(Scrollable),
      )
      .first,
);

Future<void> _abrirAprendizaje(WidgetTester t) async {
  await _tocar(t, find.byKey(const Key('boton-perfil')));
  await _bajarPerfil(t, find.byKey(const Key('perfil-aprendizaje')));
  await _tocar(t, find.byKey(const Key('perfil-aprendizaje')));
}

void main() {
  setUpAll(_cargarFuentes);

  group('AprendizajeRuta (modelo, solo Administrador)', () {
    test('ruta de fábrica: Cuarto de Componentes → Punto de Control → Laboratorio 1', () {
      final AprendizajeRuta a = AprendizajeRuta();
      expect(a.guardada.map((PuntoRuta p) => p.nombre), <String>[
        'CUARTO DE COMPONENTES',
        'PUNTO DE CONTROL',
        'LABORATORIO 1',
      ]);
      expect(a.puntosDeControl.length, 1);
      expect(a.tramos, 2);
      expect(a.aprendiendo, isFalse);
    });

    test('Operador y sin sesión no pueden usar ninguna función', () {
      final AprendizajeRuta a = AprendizajeRuta();
      for (final RolUsuario? actor in <RolUsuario?>[
        null,
        RolUsuario.operador,
      ]) {
        expect(a.iniciarPasada(actor), isFalse);
        expect(a.aprendiendo, isFalse);
        expect(a.marcarPunto(actor), isFalse);
        expect(a.finalizarYGuardar(actor), isFalse);
        expect(a.descartarPasada(actor), isFalse);
        expect(a.restablecer(actor), isFalse);
        expect(a.activarVistaReduccion(actor, true), isFalse);
        expect(a.vistaReduccion, isFalse);
        expect(a.fijarNivelReduccion(actor, 2), isFalse);
        expect(a.nivelReduccion, 0);
      }
      expect(a.guardada.length, 3);
    });

    test('pasada: avanza, marca puntos con separación mínima y guarda', () {
      final AprendizajeRuta a = AprendizajeRuta();
      const RolUsuario admin = RolUsuario.administrador;
      expect(a.marcarPunto(admin), isFalse, reason: 'sin pasada no se marca');
      expect(a.iniciarPasada(admin), isTrue);
      a.avanzar(5); // 2 m
      expect(a.posicionM, closeTo(2.0, 1e-9));
      expect(a.marcarPunto(admin), isTrue);
      expect(a.marcarPunto(admin), isFalse, reason: 'mismo lugar');
      a.avanzar(1); // +0,4 m < 0,5 m
      expect(a.marcarPunto(admin), isFalse, reason: 'muy cerca');
      a.avanzar(5); // 4 m
      expect(a.marcarPunto(admin, nombre: '  Pasillo B  '), isTrue);
      expect(a.borrador.map((PuntoRuta p) => p.nombre), <String>[
        'CUARTO DE COMPONENTES',
        'Punto de control 1',
        'Pasillo B',
      ]);
      a.avanzar(20);
      expect(a.pasadaCompleta, isTrue);
      expect(a.posicionM, AprendizajeRuta.longitudM);
      expect(a.finalizarYGuardar(admin), isTrue);
      expect(a.aprendiendo, isFalse);
      expect(a.guardada.map((PuntoRuta p) => p.nombre), <String>[
        'CUARTO DE COMPONENTES',
        'Punto de control 1',
        'Pasillo B',
        'LABORATORIO 1',
      ]);
      expect(a.guardada.first.metros, 0);
      expect(a.guardada.last.metros, AprendizajeRuta.longitudM);
      expect(a.fraccionesControl.length, 2);
      expect(a.tramos, 3);
    });

    test('no guarda sin puntos de control y descartar no toca la ruta', () {
      final AprendizajeRuta a = AprendizajeRuta();
      const RolUsuario admin = RolUsuario.administrador;
      a.iniciarPasada(admin);
      a.avanzar(30);
      expect(a.finalizarYGuardar(admin), isFalse);
      expect(a.aprendiendo, isTrue);
      expect(a.descartarPasada(admin), isTrue);
      expect(a.aprendiendo, isFalse);
      expect(a.guardada.length, 3);
    });

    test('máximo de puntos de control y restablecer', () {
      final AprendizajeRuta a = AprendizajeRuta();
      const RolUsuario admin = RolUsuario.administrador;
      a.iniciarPasada(admin);
      int marcados = 0;
      for (int i = 0; i < 12; i++) {
        a.avanzar(2); // 0,8 m
        if (a.marcarPunto(admin)) marcados++;
      }
      expect(marcados, AprendizajeRuta.maxPuntosControl);
      a.finalizarYGuardar(admin);
      expect(a.guardada.length, 2 + AprendizajeRuta.maxPuntosControl);
      expect(a.restablecer(admin), isTrue);
      expect(a.guardada.length, 3);
    });

    test('reducción progresiva de cinta: nivel acotado y tramos con cinta', () {
      final AprendizajeRuta a = AprendizajeRuta();
      const RolUsuario admin = RolUsuario.administrador;
      expect(a.activarVistaReduccion(admin, true), isTrue);
      expect(a.vistaReduccion, isTrue);
      a.fijarNivelReduccion(admin, 1);
      expect(a.tramoSinCinta(0), isTrue);
      expect(a.tramoSinCinta(1), isFalse);
      expect(a.tramosConCinta, 1);
      a.fijarNivelReduccion(admin, 99);
      expect(a.nivelReduccion, a.tramos);
      a.fijarNivelReduccion(admin, -3);
      expect(a.nivelReduccion, 0);
    });
  });

  group('Aprendizaje de Ruta: acceso exclusivo del Administrador (UI)', () {
    testWidgets('el Operador no ve la sección en su Perfil', (
      WidgetTester t,
    ) async {
      final _Entorno e = await _montar(t);
      await _entrarCon(t, 'usuario', 'usuario');
      await _tocar(t, find.byKey(const Key('boton-perfil')));
      expect(find.byKey(const Key('perfil-aprendizaje')), findsNothing);
      expect(find.textContaining('Aprendizaje de Ruta'), findsNothing);
      expect(find.byKey(const Key('perfil-usuarios')), findsNothing);
      await _cerrar(t, e);
    });

    testWidgets(
      'si un Operador llegara a la pantalla ve "Acceso restringido" y ningún control',
      (WidgetTester t) async {
        final _Entorno e = await _montar(
          t,
          home: const PantallaAprendizajeRuta(),
          rol: RolUsuario.operador,
        );
        expect(
          find.byKey(const Key('aprendizaje-restringido')),
          findsOneWidget,
        );
        expect(find.text('Acceso restringido'), findsOneWidget);
        for (final String k in <String>[
          'aprendizaje-iniciar',
          'aprendizaje-marcar',
          'aprendizaje-guardar',
          'aprendizaje-restablecer',
          'reduccion-switch',
        ]) {
          expect(find.byKey(Key(k)), findsNothing, reason: k);
        }
        await _cerrar(t, e);
      },
    );

    testWidgets(
      'el Administrador ve la tarjeta, la abre y recorre el flujo completo',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _entrarCon(t, 'administrador', 'administrador', admin: true);
        await _abrirAprendizaje(t);
        expect(find.byType(PantallaAprendizajeRuta), findsOneWidget);
        expect(find.byKey(const Key('aprendizaje-restringido')), findsNothing);
        expect(
          t.widget<Text>(find.byKey(const Key('aprendizaje-nota'))).data,
          contains('PENDIENTE DE INTEGRACIÓN EN FIRMWARE'),
        );

        // Iniciar → avanza sola → marcar → guardar
        await _tocar(t, find.byKey(const Key('aprendizaje-iniciar')));
        expect(e.ruta.aprendiendo, isTrue);
        await t.pump(const Duration(seconds: 6)); // 6 s × 0,40 = 2,4 m
        expect(e.ruta.posicionM, greaterThan(2.0));
        await _tocar(t, find.byKey(const Key('aprendizaje-marcar')));
        expect(e.ruta.borrador.length, 2);
        expect(find.textContaining('Punto de control 1'), findsWidgets);
        await _tocar(t, find.byKey(const Key('aprendizaje-guardar')));
        expect(e.ruta.aprendiendo, isFalse);
        expect(
          t.widget<Text>(find.byKey(const Key('aprendizaje-mensaje'))).data,
          startsWith('Ruta guardada'),
        );
        await _bajarRuta(t, find.byKey(const Key('aprendizaje-restablecer')));
        expect(find.text('Punto de control 1'), findsOneWidget);
        expect(e.ruta.puntosDeControl.length, 1);
        expect(e.ruta.guardada.length, 3);
        await _cerrar(t, e);
      },
    );

    testWidgets('guardar sin puntos avisa y no guarda', (WidgetTester t) async {
      final _Entorno e = await _montar(t);
      await _entrarCon(t, 'administrador', 'administrador', admin: true);
      await _abrirAprendizaje(t);
      await _tocar(t, find.byKey(const Key('aprendizaje-iniciar')));
      await _tocar(t, find.byKey(const Key('aprendizaje-guardar')));
      expect(
        t.widget<Text>(find.byKey(const Key('aprendizaje-mensaje'))).data,
        contains('al menos un punto'),
      );
      expect(e.ruta.aprendiendo, isTrue);
      await _tocar(t, find.byKey(const Key('aprendizaje-descartar')));
      expect(e.ruta.aprendiendo, isFalse);
      await _cerrar(t, e);
    });

    testWidgets(
      'la vista previa de reducción progresiva de cinta cambia con el control',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        await _entrarCon(t, 'administrador', 'administrador', admin: true);
        await _abrirAprendizaje(t);
        await _bajarRuta(t, find.byKey(const Key('reduccion-switch')));
        expect(
          t.widget<Text>(find.byKey(const Key('reduccion-titulo'))).data,
          'REDUCCIÓN PROGRESIVA DE CINTA',
        );
        expect(
          t
              .renderObject<RenderParagraph>(
                find.byKey(const Key('reduccion-titulo')),
              )
              .didExceedMaxLines,
          isFalse,
        );
        expect(find.byKey(const Key('reduccion-lienzo')), findsNothing);
        await _tocar(t, find.byKey(const Key('reduccion-switch')));
        expect(e.ruta.vistaReduccion, isTrue);
        await _bajarRuta(t, find.byKey(const Key('reduccion-texto')));
        expect(
          t.widget<Text>(find.byKey(const Key('reduccion-nivel'))).data,
          '0 de 2',
        );
        expect(
          t.widget<Text>(find.byKey(const Key('reduccion-texto'))).data,
          contains('Cinta completa'),
        );
        e.ruta.fijarNivelReduccion(RolUsuario.administrador, 1);
        await t.pump(const Duration(milliseconds: 100));
        expect(
          t.widget<Text>(find.byKey(const Key('reduccion-nivel'))).data,
          '1 de 2',
        );
        final String texto = t
            .widget<Text>(find.byKey(const Key('reduccion-texto')))
            .data!;
        expect(texto, contains('heading hold'));
        expect(texto, contains('MPU-6050'));
        expect(texto, contains('baliza BLE'));
        expect(texto, contains('Sin magnetómetro'));
        expect(texto, contains('PENDIENTE DE INTEGRACIÓN EN FIRMWARE'));
        await _cerrar(t, e);
      },
    );

    testWidgets(
      'el Operador usa la ruta guardada: sus puntos aparecen en el mapa',
      (WidgetTester t) async {
        final _Entorno e = await _montar(t);
        const RolUsuario admin = RolUsuario.administrador;
        e.ruta.iniciarPasada(admin);
        e.ruta.avanzar(7.5); // 3 m
        e.ruta.marcarPunto(admin);
        e.ruta.avanzar(5); // 5 m
        e.ruta.finalizarYGuardar(admin);
        await _entrarCon(t, 'usuario', 'usuario');
        final CustomPaint lienzo = t.widget<CustomPaint>(
          find.byKey(const Key('mapa-pista-lienzo')),
        );
        final PintorPista p = lienzo.painter! as PintorPista;
        expect(p.puntosRuta.length, 1);
        expect(
          p.puntosRuta.first,
          closeTo(3.0 / SimulacionPista.longitudM, 1e-6),
        );
        // Y no ve ninguna de las herramientas de aprendizaje
        expect(find.textContaining('Aprendizaje'), findsNothing);
        await _cerrar(t, e);
      },
    );

    for (final (String n, double w, double h) in <(String, double, double)>[
      ('360×640', 360, 640),
      ('390×844', 390, 844),
    ]) {
      testWidgets('la pantalla no desborda ($n)', (WidgetTester t) async {
        final _Entorno e = await _montar(t, ancho: w, alto: h);
        await _entrarCon(t, 'administrador', 'administrador', admin: true);
        await _abrirAprendizaje(t);
        await _tocar(t, find.byKey(const Key('aprendizaje-iniciar')));
        await t.pump(const Duration(seconds: 3));
        await _tocar(t, find.byKey(const Key('aprendizaje-marcar')));
        await _bajarRuta(t, find.byKey(const Key('reduccion-switch')));
        await _tocar(t, find.byKey(const Key('reduccion-switch')));
        e.ruta.fijarNivelReduccion(RolUsuario.administrador, 2);
        await t.pump(const Duration(milliseconds: 200));
        await _bajarRuta(t, find.byKey(const Key('reduccion-texto')));
        expect(t.takeException(), isNull);
        await _cerrar(t, e);
      });
    }
  });
}
