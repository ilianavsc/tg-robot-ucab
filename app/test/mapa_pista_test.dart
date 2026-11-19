import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:robot_ucab_app/core/demo/simulacion_pista.dart';
import 'package:robot_ucab_app/core/mqtt/mqtt_service.dart';
import 'package:robot_ucab_app/core/theme/cockpit_theme.dart';
import 'package:robot_ucab_app/features/telemetria/cockpit_ui.dart';
import 'package:robot_ucab_app/features/telemetria/mapa_pista.dart';
import 'package:robot_ucab_app/features/telemetria/telemetria_screen.dart';

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

Future<MqttService> _montar(
  WidgetTester t, {
  double ancho = 390,
  double alto = 844,
  bool demo = false,
}) async {
  t.view.physicalSize = Size(ancho * 2, alto * 2);
  t.view.devicePixelRatio = 2;
  addTearDown(t.view.reset);
  final MqttService servicio = MqttService();
  if (demo) servicio.iniciarSimulacion();
  await t.pumpWidget(
    ChangeNotifierProvider<MqttService>.value(
      value: servicio,
      child: MaterialApp(
        theme: buildCockpitTheme(),
        home: const TelemetriaScreen(),
      ),
    ),
  );
  await t.pump(const Duration(milliseconds: 100));
  return servicio;
}

Future<void> _cerrar(WidgetTester t, MqttService s) async {
  await t.pump(const Duration(milliseconds: 400));
  await t.pumpWidget(const SizedBox());
  s.dispose();
}

Future<void> _bajarHasta(WidgetTester t, Finder f) =>
    t.scrollUntilVisible(f, 300, scrollable: find.byType(Scrollable).first);

/// Baja hasta el control y lo toca (el mapa ocupa el inicio del Dashboard).
Future<void> _tocar(WidgetTester t, Key k) async {
  final Finder f = find.byKey(k);
  await _bajarHasta(t, f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
  await t.pump(const Duration(milliseconds: 100));
}

void main() {
  setUpAll(_cargarFuentes);

  group('geometría del circuito', () {
    test(
      'la pista es un lazo cerrado y los 3 nodos caen dentro del lienzo',
      () {
        const Size tam = Size(358, 358);
        final PistaGeometria g = PistaGeometria(tam);
        expect(g.longitud, greaterThan(500));
        for (final DestinoPista d in DestinoPista.values) {
          final Offset p = g.puntoEn(fraccionDeDestino(d));
          expect(p.dx, inInclusiveRange(0, tam.width), reason: d.nombre);
          expect(p.dy, inInclusiveRange(0, tam.height), reason: d.nombre);
        }
        // Cierra el lazo: fracción 0 y 1 coinciden
        expect((g.puntoEn(0) - g.puntoEn(1)).distance, lessThan(1));
        // El orden de marcha es BASE → A → B (sentido horario)
        expect(
          fraccionDeDestino(DestinoPista.estacionA),
          lessThan(fraccionDeDestino(DestinoPista.estacionB)),
        );
      },
    );

    test('el ángulo de avance varía de forma continua', () {
      final PistaGeometria g = PistaGeometria(const Size(358, 358));
      double previo = g.anguloEn(0);
      for (double f = 0.005; f < 1; f += 0.005) {
        final double a = g.anguloEn(f);
        double d = (a - previo).abs();
        if (d > 3.14159) d = 2 * 3.14159265 - d;
        expect(d, lessThan(0.35), reason: 'fracción $f');
        previo = a;
      }
    });
  });

  testWidgets(
    'Dashboard: el Mapa de Pista abre la vista con la misión del demo',
    (WidgetTester t) async {
      final MqttService s = await _montar(t, demo: true);
      // 4 pestañas intactas y mapa como primera tarjeta
      expect(find.byType(NavigationDestination), findsNWidgets(4));
      expect(find.text('MAPA DE PISTA'), findsOneWidget);
      expect(find.byKey(const Key('mapa-pista-lienzo')), findsOneWidget);
      expect(find.text('EN RUTA → ESTACIÓN A'), findsOneWidget);
      expect(find.text('PUNTO DE DESTINO'), findsOneWidget);
      expect(find.text('PAUSAR MISIÓN'), findsOneWidget);
      expect(find.text('BASE'), findsWidgets);
      expect(find.text('ESTACIÓN A'), findsWidgets);
      expect(find.text('ESTACIÓN B'), findsWidgets);
      // No hay rumbo/brújula: el robot no tiene magnetómetro
      expect(find.textContaining('RUMBO'), findsNothing);
      expect(find.textContaining('LIDAR'), findsNothing);
      // Valores sincronizados con el estado activo
      s.debugEmitirPasoDemo();
      await t.pump(const Duration(milliseconds: 100));
      final MqttService sv = s;
      expect(sv.ultimoEstado!.bateria, inInclusiveRange(95, 100));
      expect(find.text('${sv.ultimoEstado!.bateria}'), findsWidgets);
      expect(t.takeException(), isNull);
      await _cerrar(t, s);
    },
  );

  testWidgets('los destinos cambian la misión y el avance se sincroniza', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t, demo: true);
    await _tocar(t, const Key('destino-b'));
    expect(s.pista!.destino, DestinoPista.estacionB);
    expect(find.text('EN RUTA → ESTACIÓN B'), findsOneWidget);
    expect(find.textContaining('Destino: ESTACIÓN B'), findsOneWidget);
    await _tocar(t, const Key('destino-base'));
    expect(s.pista!.destino, DestinoPista.base);
    expect(
      t.widget<Text>(find.byKey(const Key('mision-fase'))).data,
      contains('BASE / CARGA'),
    );
    await _cerrar(t, s);
  });

  testWidgets('Pausar misión envía frenar; Reanudar envía auto', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t, demo: true);
    // Tras 3 s el robot ya va a su velocidad de crucero
    for (int i = 0; i < 12; i++) {
      s.debugEmitirPasoDemo();
    }
    await t.pump(const Duration(milliseconds: 100));
    await _tocar(t, const Key('mision-pausa'));
    expect(s.pista!.autonomo, isFalse);
    expect(s.ultimoEstado!.modo, 'manual');
    expect(find.text('REANUDAR MISIÓN'), findsOneWidget);
    expect(find.text('MISIÓN PAUSADA'), findsOneWidget);
    expect(s.ultimoComando, 'frenar');
    await t.pump(const Duration(milliseconds: 400)); // ACK simulado
    await _tocar(t, const Key('mision-pausa'));
    expect(s.pista!.autonomo, isTrue);
    expect(s.ultimoComando, 'auto');
    expect(find.text('PAUSAR MISIÓN'), findsOneWidget);
    await _cerrar(t, s);
  });

  testWidgets('el obstáculo se ve en el mapa: zona de aviso, parada y alerta', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t, demo: true);
    bool aviso = false;
    for (int i = 0; i < 20 && !s.pista!.frenteBloqueado; i++) {
      s.debugEmitirPasoDemo();
      await t.pump(const Duration(milliseconds: 50));
      if (find.textContaining('SEGURIDAD: PRECAUCIÓN').evaluate().isNotEmpty)
        aviso = true;
    }
    expect(s.pista!.frenteBloqueado, isTrue);
    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('DETENIDO · OBSTÁCULO'), findsOneWidget);
    expect(find.textContaining('SEGURIDAD: PARADA'), findsOneWidget);
    expect(s.ultimoEstado!.velocidadMedia, 0.0);
    expect(
      s.centroAlertas.activas.map((a) => a.clave),
      contains('obstaculo_frente'),
    );
    expect(aviso || s.centroAlertas.eventos.isNotEmpty, isTrue);
    await _cerrar(t, s);
  });

  testWidgets('con el robot real no se inventa posición ni destinos', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t); // sin demo, sin conexión
    expect(find.text('SIN POSICIÓN'), findsOneWidget);
    expect(find.textContaining('no hay localización absoluta'), findsOneWidget);
    expect(find.text('SOLO EN DEMO'), findsOneWidget);
    for (final String k in <String>['destino-base', 'destino-a', 'destino-b']) {
      expect(
        t.widget<InkWell>(find.byKey(Key(k))).onTap,
        isNull,
        reason: '$k deshabilitado sin Modo Demo',
      );
    }
    expect(
      t.widget<OutlinedButton>(find.byKey(const Key('mision-pausa'))).onPressed,
      isNull,
      reason: 'sin conexión no se pueden enviar órdenes',
    );
    expect(t.takeException(), isNull);
    await _cerrar(t, s);
  });

  testWidgets('Pausar y los destinos nunca quedan bajo el E-STOP', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t, demo: true);
    await _bajarHasta(t, find.byKey(const Key('mision-pausa')));
    await t.pump(const Duration(milliseconds: 100));
    final Rect estop = t.getRect(find.byType(EstopButton));
    final Rect pausa = t.getRect(find.byKey(const Key('mision-pausa')));
    expect(pausa.overlaps(estop), isFalse);
    expect(pausa.bottom, lessThanOrEqualTo(estop.top));
    final Rect destino = t.getRect(find.byKey(const Key('destino-b')));
    expect(destino.overlaps(estop), isFalse);
    await _cerrar(t, s);
  });

  for (final (String n, double w, double h) in <(String, double, double)>[
    ('390×844', 390, 844),
    ('360×740', 360, 740),
    ('1100×800', 1100, 800),
  ]) {
    testWidgets('el Mapa de Pista no desborda durante todo el ciclo ($n)', (
      WidgetTester t,
    ) async {
      final MqttService s = await _montar(t, ancho: w, alto: h, demo: true);
      for (int i = 0; i < 25; i++) {
        s.debugEmitirPasoDemo();
        await t.pump(const Duration(milliseconds: 60));
        expect(t.takeException(), isNull, reason: 'paso $i');
      }
      await _cerrar(t, s);
    });
  }
}
