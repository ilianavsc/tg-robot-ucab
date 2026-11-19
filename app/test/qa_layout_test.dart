import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:robot_ucab_app/core/mqtt/mqtt_service.dart';
import 'package:robot_ucab_app/core/theme/cockpit_theme.dart';
import 'package:robot_ucab_app/features/auth/registro_usuarios.dart';
import 'package:robot_ucab_app/features/auth/sesion_local.dart';
import 'package:robot_ucab_app/features/perfil/pantalla_perfil.dart';
import 'package:robot_ucab_app/features/telemetria/cockpit_ui.dart';
import 'package:robot_ucab_app/main.dart' show PuertaAcceso;

/// Regresión del QA a 390×844: cuatro defectos visuales que no deben volver.

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

Future<(MqttService, SesionLocal)> _montar(
  WidgetTester t, {
  bool conSesion = false,
  Widget? hijo,
  double ancho = 390,
  double alto = 844,
}) async {
  t.view.physicalSize = Size(ancho * 2, alto * 2);
  t.view.devicePixelRatio = 2;
  addTearDown(t.view.reset);
  final MqttService servicio = MqttService();
  final SesionLocal sesion = SesionLocal();
  if (conSesion) {
    sesion.iniciar(RolUsuario.operador, usuario: 'usuario');
  }
  await t.pumpWidget(
    MultiProvider(
      providers: <ChangeNotifierProvider<ChangeNotifier>>[
        ChangeNotifierProvider<MqttService>.value(value: servicio),
        ChangeNotifierProvider<SesionLocal>.value(value: sesion),
        ChangeNotifierProvider<RegistroUsuarios>(
          create: (_) => RegistroUsuarios(),
        ),
      ],
      child: MaterialApp(
        theme: buildCockpitTheme(),
        home: hijo ?? const PuertaAcceso(),
      ),
    ),
  );
  await t.pump(const Duration(milliseconds: 100));
  return (servicio, sesion);
}

Future<void> _cerrar(WidgetTester t, MqttService s, SesionLocal ses) async {
  await t.pump(const Duration(milliseconds: 400));
  await t.pumpWidget(const SizedBox());
  s.dispose();
  ses.dispose();
}

Future<void> _irA(WidgetTester t, String seccion) async {
  await t.tap(
    find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text(seccion),
    ),
  );
  await t.pump();
  await t.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(_cargarFuentes);

  testWidgets(
    'Controles: la lista termina encima del Freno Remoto (no tapa la matriz)',
    (WidgetTester t) async {
      final (MqttService s, SesionLocal ses) = await _montar(
        t,
        conSesion: true,
      );
      await _irA(t, 'CONTROLES');
      final Rect estop = t.getRect(find.byType(FrenoRemotoButton));
      final Finder lista = find.byKey(
        const PageStorageKey<String>('controles'),
      );
      expect(lista, findsOneWidget);
      // Recorre toda la lista: ningún punto de ella llega a la franja del Freno Remoto.
      for (final double desplazar in <double>[0, 200, 200, 200, 400, 800]) {
        if (desplazar > 0) {
          await t.drag(lista, Offset(0, -desplazar));
          await t.pump(const Duration(milliseconds: 100));
        }
        expect(
          t.getRect(lista).bottom,
          lessThanOrEqualTo(estop.top),
          reason: 'el viewport de Controles debe acabar sobre el Freno Remoto',
        );
      }
      // Los botones de la matriz táctil quedan siempre dentro del viewport
      // (por encima del Freno Remoto), nunca debajo.
      for (final String texto in <String>[
        'AVANZAR',
        'GIRAR DER',
        'RETROCESO',
      ]) {
        final Finder boton = find.text(texto);
        if (boton.evaluate().isEmpty) continue; // fuera de la ventana de render
        expect(t.getRect(boton).bottom, lessThanOrEqualTo(estop.top));
      }
      expect(t.takeException(), isNull);
      await _cerrar(t, s, ses);
    },
  );

  testWidgets('Dashboard reserva la franja del Freno Remoto; Radar no', (
    WidgetTester t,
  ) async {
    final (MqttService s, SesionLocal ses) = await _montar(t, conSesion: true);
    final Rect estop = t.getRect(find.byType(FrenoRemotoButton));
    final double navTop = t.getRect(find.byType(NavigationBar)).top;
    // Dashboard (misión, destinos y pausa): la lista acaba sobre el Freno Remoto.
    final Rect lista = t.getRect(
      find.byKey(const PageStorageKey<String>('dashboard')),
    );
    expect(lista.bottom, lessThanOrEqualTo(estop.top));
    await _irA(t, 'RADAR');
    expect(t.getRect(find.byType(ListView).first).bottom, closeTo(navTop, 1));
    expect(find.byType(FrenoRemotoButton), findsOneWidget);
    await _cerrar(t, s, ses);
  });

  testWidgets(
    'Radar: "Evitación de colisiones" cabe sin cortarse con puntos suspensivos',
    (WidgetTester t) async {
      final (MqttService s, SesionLocal ses) = await _montar(
        t,
        conSesion: true,
      );
      await _irA(t, 'RADAR');
      final Finder titulo = find.text('EVITACIÓN DE COLISIONES');
      await t.scrollUntilVisible(
        titulo,
        300,
        scrollable: find.byType(Scrollable).last,
      );
      final RenderParagraph p = t.renderObject<RenderParagraph>(titulo);
      expect(p.didExceedMaxLines, isFalse);
      // Cabe entero: dos líneas como mucho, y todo el texto se pinta.
      expect(
        p.size.height,
        lessThanOrEqualTo(2 * (CockpitText.labelMd.fontSize! * 1.5)),
      );
      expect(t.takeException(), isNull);
      await _cerrar(t, s, ses);
    },
  );

  testWidgets('Perfil: el broker largo se muestra completo, sin "..."', (
    WidgetTester t,
  ) async {
    final (MqttService s, SesionLocal ses) = await _montar(
      t,
      hijo: const Scaffold(
        body: Padding(
          padding: EdgeInsets.all(16),
          child: DatoPerfil(
            apilado: true,
            etiqueta: 'Broker',
            valor: 'broker.hivemq.com:1883',
            clave: Key('dato-broker'),
          ),
        ),
      ),
    );
    final Finder valor = find.byKey(const Key('dato-broker'));
    final RenderParagraph p = t.renderObject<RenderParagraph>(valor);
    expect(p.didExceedMaxLines, isFalse);
    expect(t.widget<Text>(valor).overflow, isNot(TextOverflow.ellipsis));
    expect(t.widget<Text>(valor).softWrap, isTrue);
    // Va debajo de la etiqueta y a todo el ancho disponible
    expect(
      t.getTopLeft(valor).dy,
      greaterThan(t.getTopLeft(find.text('Broker')).dy),
    );
    expect(t.getSize(valor).width, greaterThanOrEqualTo(150));
    expect(t.takeException(), isNull);
    await _cerrar(t, s, ses);
  });

  for (final (String n, double w) in <(String, double)>[
    ('390', 390),
    ('360', 360),
  ]) {
    testWidgets('Login ($n px): el pie respeta el margen y salta de línea', (
      WidgetTester t,
    ) async {
      final (MqttService s, SesionLocal ses) = await _montar(t, ancho: w);
      final Finder pie = find.byKey(const Key('login-pie'));
      final Rect r = t.getRect(pie);
      expect(t.widget<Text>(pie).softWrap, isTrue);
      expect(r.left, greaterThanOrEqualTo(24), reason: 'margen izquierdo');
      expect(r.right, lessThanOrEqualTo(w - 24), reason: 'margen derecho');
      expect(t.renderObject<RenderParagraph>(pie).didExceedMaxLines, isFalse);
      expect(t.takeException(), isNull);
      await _cerrar(t, s, ses);
    });
  }
}
