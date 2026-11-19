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
        // El orden de marcha es Cuarto de Componentes → Punto de Control → Laboratorio 1 (sentido horario)
        expect(
          fraccionDeDestino(DestinoPista.puntoControl),
          lessThan(fraccionDeDestino(DestinoPista.laboratorio1)),
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

  group('mapa: borrado progresivo y legibilidad', () {
    test(
      'tramoDelCircuito mide recorrido y pendiente, también al dar la vuelta',
      () {
        final PistaGeometria g = PistaGeometria(const Size(358, 308));
        double largo(Path p) =>
            p.computeMetrics().fold(0.0, (double a, m) => a + m.length);
        final double l = g.longitud;
        expect(
          largo(tramoDelCircuito(g.metrica, 0.1, 0.4)),
          closeTo(0.3 * l, 1),
        );
        // Pasa por el cuarto (0.9 → 0.2): 30 % del circuito
        expect(
          largo(tramoDelCircuito(g.metrica, 0.9, 0.2)),
          closeTo(0.3 * l, 1),
        );
        // Recorrido + pendiente = tramo completo hacia el destino
        const double ini = 0.0, robot = 0.18, dest = 0.42;
        expect(
          largo(tramoDelCircuito(g.metrica, ini, robot)) +
              largo(tramoDelCircuito(g.metrica, robot, dest)),
          closeTo(largo(tramoDelCircuito(g.metrica, ini, dest)), 1),
        );
      },
    );

    test('el pintor se repinta cuando avanza el robot o cambia el tramo', () {
      const PintorPista a = PintorPista(
        destino: DestinoPista.puntoControl,
        fraccionRobot: 0.1,
        fraccionInicioTramo: 0,
      );
      expect(
        a.shouldRepaint(
          const PintorPista(
            destino: DestinoPista.puntoControl,
            fraccionRobot: 0.1,
            fraccionInicioTramo: 0,
          ),
        ),
        isFalse,
      );
      expect(
        a.shouldRepaint(
          const PintorPista(
            destino: DestinoPista.puntoControl,
            fraccionRobot: 0.2,
            fraccionInicioTramo: 0,
          ),
        ),
        isTrue,
      );
      expect(
        a.shouldRepaint(
          const PintorPista(
            destino: DestinoPista.puntoControl,
            fraccionRobot: 0.1,
            fraccionInicioTramo: 0.05,
          ),
        ),
        isTrue,
      );
    });

    for (final Size tam in const <Size>[
      Size(358, 308),
      Size(326, 280),
      Size(560, 330),
    ]) {
      test(
        'el cono nunca pisa una etiqueta de estación (${tam.width.toInt()}×${tam.height.toInt()})',
        () {
          final PistaGeometria g = PistaGeometria(tam);
          final List<Rect> etiquetas = <Rect>[
            for (final DestinoPista d in DestinoPista.values)
              rectEtiquetaNodo(g, d),
          ];
          for (final Rect e in etiquetas) {
            expect(e.left, greaterThanOrEqualTo(0));
            expect(e.right, lessThanOrEqualTo(tam.width));
            expect(e.top, greaterThanOrEqualTo(0));
            expect(e.bottom, lessThanOrEqualTo(tam.height));
          }
          for (int i = 0; i < etiquetas.length; i++) {
            for (int j = i + 1; j < etiquetas.length; j++) {
              expect(etiquetas[i].overlaps(etiquetas[j]), isFalse);
            }
          }
          // Recorre el circuito con el cono al máximo (frente libre)
          int solapes = 0;
          for (double f = 0; f < 1; f += 0.004) {
            final List<Offset> v = triangulosCono(
              g.puntoEn(f),
              g.anguloEn(f),
              150,
            );
            for (double a = 0; a <= 1; a += 0.1) {
              for (double b = 0; a + b <= 1; b += 0.1) {
                final Offset p = v[0] * (1 - a - b) + v[1] * a + v[2] * b;
                if (etiquetas.any((Rect e) => e.inflate(1).contains(p))) {
                  solapes++;
                }
              }
            }
          }
          expect(solapes, 0, reason: 'el cono invade una etiqueta de estación');
        },
      );
    }
  });

  testWidgets(
    'Freno Remoto: sustituye al E-STOP en todas las secciones y envía frenar',
    (WidgetTester t) async {
      final MqttService s = await _montar(t, demo: true);
      for (final String seccion in <String>[
        'DASHBOARD',
        'CONTROLES',
        'RADAR',
        'ALERTAS',
      ]) {
        await t.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.text(seccion),
          ),
        );
        await t.pump(const Duration(milliseconds: 400));
        expect(find.text('Freno Remoto'), findsOneWidget, reason: seccion);
        expect(find.textContaining('E-STOP'), findsNothing, reason: seccion);
        expect(find.textContaining('PARADA DE EMERGENCIA'), findsNothing);
      }
      await t.tap(find.text('Freno Remoto'));
      await t.pump(const Duration(milliseconds: 100));
      expect(s.ultimoComando, 'frenar');
      await _cerrar(t, s);
    },
  );

  testWidgets(
    'Dashboard: el Mapa de Pista abre la vista con la misión del demo',
    (WidgetTester t) async {
      final MqttService s = await _montar(t, demo: true);
      // 4 pestañas intactas y mapa como primera tarjeta
      expect(find.byType(NavigationDestination), findsNWidgets(4));
      expect(find.text('MAPA DE PISTA'), findsOneWidget);
      expect(find.byKey(const Key('mapa-pista-lienzo')), findsOneWidget);
      expect(find.text('EN RUTA → PUNTO DE CONTROL'), findsOneWidget);
      expect(find.text('PUNTO DE DESTINO'), findsOneWidget);
      expect(find.text('PAUSAR MISIÓN'), findsOneWidget);
      expect(find.text('CUARTO'), findsWidgets);
      expect(find.text('CONTROL'), findsWidgets);
      expect(find.text('LAB. 1'), findsWidgets);
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
    await _tocar(t, const Key('destino-lab1'));
    expect(s.pista!.destino, DestinoPista.laboratorio1);
    expect(find.text('EN RUTA → LABORATORIO 1'), findsOneWidget);
    expect(find.textContaining('Destino: LABORATORIO 1'), findsOneWidget);
    await _tocar(t, const Key('destino-cuarto'));
    expect(s.pista!.destino, DestinoPista.cuartoComponentes);
    expect(
      t.widget<Text>(find.byKey(const Key('mision-fase'))).data,
      contains('CUARTO DE COMPONENTES'),
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
    for (final String k in <String>[
      'destino-cuarto',
      'destino-control',
      'destino-lab1',
    ]) {
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

  testWidgets('Pausar y los destinos nunca quedan bajo el Freno Remoto', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t, demo: true);
    await _bajarHasta(t, find.byKey(const Key('mision-pausa')));
    await t.pump(const Duration(milliseconds: 100));
    final Rect estop = t.getRect(find.byType(FrenoRemotoButton));
    final Rect pausa = t.getRect(find.byKey(const Key('mision-pausa')));
    expect(pausa.overlaps(estop), isFalse);
    expect(pausa.bottom, lessThanOrEqualTo(estop.top));
    final Rect destino = t.getRect(find.byKey(const Key('destino-lab1')));
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
