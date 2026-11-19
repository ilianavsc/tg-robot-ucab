import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:robot_ucab_app/core/mqtt/mqtt_service.dart';
import 'package:robot_ucab_app/core/theme/cockpit_theme.dart';
import 'package:robot_ucab_app/features/telemetria/telemetria_screen.dart';

/// Carga las fuentes reales del Cockpit: sin esto, `flutter test` usa Ahem
/// (glifos cuadrados) y los anchos no se parecen a los de la app.
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
}) async {
  t.view.physicalSize = Size(ancho * 2, alto * 2);
  t.view.devicePixelRatio = 2;
  addTearDown(t.view.reset);
  final MqttService servicio = MqttService();
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
  // El Modo Demo confirma cada orden a los 300 ms (ACK simulado): se deja pasar.
  await t.pump(const Duration(milliseconds: 400));
  await t.pumpWidget(
    const SizedBox(),
  ); // desmonta la pantalla (cancela sus timers)
  s.dispose();
}

Future<void> _ir(WidgetTester t, String seccion) async {
  await t.tap(
    find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text(seccion),
    ),
  );
  await t.pump(const Duration(milliseconds: 400));
}

Future<void> _tocar(WidgetTester t, String texto) async {
  final Finder f = find.text(texto);
  await t.ensureVisible(f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
  await t.pump(const Duration(milliseconds: 100));
}

void main() {
  setUpAll(_cargarFuentes);

  testWidgets('barra de navegación con las 4 secciones y Freno Remoto', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t);
    expect(find.byType(NavigationDestination), findsNWidgets(4));
    for (final String n in <String>[
      'DASHBOARD',
      'CONTROLES',
      'RADAR',
      'ALERTAS',
    ]) {
      expect(
        find.descendant(of: find.byType(NavigationBar), matching: find.text(n)),
        findsOneWidget,
      );
    }
    expect(find.text('Freno Remoto'), findsOneWidget);
    expect(t.takeException(), isNull);
    await _cerrar(t, s);
  });

  for (final (String nombre, double ancho, double alto)
      in <(String, double, double)>[
        ('móvil 390', 390, 844),
        ('móvil pequeño 360', 360, 740),
        ('escritorio 1100', 1100, 800),
      ]) {
    testWidgets('las 4 pantallas con el Modo Demo no desbordan ($nombre)', (
      WidgetTester t,
    ) async {
      final MqttService s = await _montar(t, ancho: ancho, alto: alto);
      s.iniciarSimulacion();
      await t.pump(const Duration(milliseconds: 100));
      // Los 7 perfiles del demo: obstáculo, fallo de eco, batería crítica...
      for (int paso = 0; paso < 7; paso++) {
        if (paso > 0) s.debugEmitirPasoDemo();
        for (final String seccion in <String>[
          'DASHBOARD',
          'CONTROLES',
          'RADAR',
          'ALERTAS',
        ]) {
          await _ir(t, seccion);
          expect(t.takeException(), isNull, reason: 'paso $paso · $seccion');
        }
      }
      await _cerrar(t, s);
    });
  }

  testWidgets(
    'sin telemetría las 4 pantallas muestran el estado vacío sin errores',
    (WidgetTester t) async {
      final MqttService s = await _montar(t);
      expect(find.textContaining('ESPERANDO TELEMETRÍA'), findsOneWidget);
      for (final String seccion in <String>[
        'CONTROLES',
        'RADAR',
        'ALERTAS',
        'DASHBOARD',
      ]) {
        await _ir(t, seccion);
        expect(t.takeException(), isNull, reason: seccion);
      }
      await _cerrar(t, s);
    },
  );

  testWidgets('cada control envía la misma orden de siempre (QoS 1)', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t);
    s.iniciarSimulacion(); // en demo se pueden enviar órdenes sin broker
    await t.pump(const Duration(milliseconds: 100));

    await _tocar(t, 'Freno Remoto');
    expect(s.ultimoComando, 'frenar');

    await _ir(t, 'CONTROLES');
    for (final (String boton, String orden) in <(String, String)>[
      ('AVANZAR', 'adelante'),
      ('GIRAR IZQ', 'izquierda'),
      ('GIRAR DER', 'derecha'),
      ('RETROCESO', 'atras'),
      ('ALTO', 'frenar'),
      ('AUTO NAV', 'auto'),
    ]) {
      await _tocar(t, boton);
      expect(s.ultimoComando, orden, reason: boton);
    }
    expect(t.takeException(), isNull);
    await _cerrar(t, s);
  });

  testWidgets(
    'sin conexión los controles quedan inactivos y Freno Remoto avisa',
    (WidgetTester t) async {
      final MqttService s = await _montar(t);
      await _ir(t, 'CONTROLES');
      await _tocar(t, 'AVANZAR'); // deshabilitado: no envía nada
      expect(s.ultimoComando, isNull);
      await _tocar(
        t,
        'Freno Remoto',
      ); // siempre intenta; sin conexión muestra el error
      expect(find.byType(SnackBar), findsOneWidget);
      expect(s.ultimoError, contains('no está conectada'));
      await _cerrar(t, s);
    },
  );

  testWidgets('P11: banner de alerta y badge de la barra; reconocer lo cierra', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t);
    s.iniciarSimulacion();
    // El demo físico hace aparecer un obstáculo a los ~12 s y frena a < 20 cm.
    for (int i = 0; i < 20 && !(s.pista?.frenteBloqueado ?? false); i++) {
      s.debugEmitirPasoDemo();
    }
    expect(s.pista!.frenteBloqueado, isTrue);
    await t.pump(const Duration(milliseconds: 300));

    expect(find.text('PARADA POR OBSTÁCULO FRONTAL'), findsWidgets);
    expect(find.byType(Badge), findsOneWidget);
    final int antes = s.centroAlertas.pendientes;
    expect(antes, greaterThan(0));

    await t.tap(find.text('RECONOCER').first);
    await t.pump(const Duration(milliseconds: 300));
    expect(s.centroAlertas.pendientes, lessThan(antes));
    expect(t.takeException(), isNull);
    await _cerrar(t, s);
  });

  testWidgets('P12: la analítica se exporta y se reinicia desde el Dashboard', (
    WidgetTester t,
  ) async {
    final MqttService s = await _montar(t);
    s.iniciarSimulacion();
    s.debugEmitirPasoDemo();
    await t.pump(const Duration(milliseconds: 200));
    final Finder exportar = find.text('EXPORTAR REPORTE CSV');
    // El Mapa de Pista ocupa el inicio del Dashboard: se baja hasta la tarjeta.
    await t.scrollUntilVisible(
      exportar,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(exportar, findsOneWidget);
    expect(s.analitica.totalPaquetes, greaterThan(0));
    await _tocar(t, 'REINICIAR');
    expect(s.analitica.totalPaquetes, 0);
    await _cerrar(t, s);
  });
}
