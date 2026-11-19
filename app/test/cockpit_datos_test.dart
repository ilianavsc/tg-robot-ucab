import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:robot_ucab_app/core/alertas/centro_alertas.dart';
import 'package:robot_ucab_app/core/models/estado.dart';
import 'package:robot_ucab_app/features/telemetria/cockpit_datos.dart';

Estado _e({
  double bat = 11.5,
  String parada = 'ninguna',
  int n = 5,
  int pct = 50,
}) => Estado(
  numero: n,
  modo: 'autonomo',
  bateria: pct,
  bateriaV: bat,
  ordenes: 0,
  lineaMm: 0,
  vIzq: 0.4,
  vDer: 0.4,
  t: 0,
  parada: parada,
);

void main() {
  final t0 = DateTime(2026, 11, 19, 12);

  group('Cálculos derivados del Cockpit', () {
    test('RPM estimadas a partir de m/s con la rueda de 65 mm', () {
      expect(
        rpmDeVelocidad(0.41),
        closeTo(0.41 * 60 / (math.pi * 0.065), 1e-9),
      );
      expect(rpmDeVelocidad(-0.41), lessThan(0));
      expect(rpmDeVelocidad(0), 0);
    });

    test('sensores IR activos según linea_mm (4× TCRT5000 a 18 mm)', () {
      expect(canalesIr(0), <bool>[
        false,
        true,
        true,
        false,
      ]); // centrado: S2 y S3
      expect(canalesIr(27), <bool>[true, false, false, false]);
      expect(canalesIr(-27), <bool>[false, false, false, true]);
      expect(canalesIr(18), <bool>[true, true, false, false]);
    });

    test('la pista dibuja la línea del lado correcto (+ = izquierda)', () {
      expect(fraccionPistaLinea(0), 0.5);
      expect(fraccionPistaLinea(27), lessThan(0.5)); // línea a la izquierda
      expect(fraccionPistaLinea(-27), greaterThan(0.5)); // línea a la derecha
      expect(fraccionPistaLinea(99), 0); // saturada en el extremo izquierdo
      expect(fraccionPistaLinea(-99), 1);
    });

    test('línea perdida (±32,4 mm) no enciende ningún sensor', () {
      expect(canalesIr(-32.4), <bool>[false, false, false, false]);
      expect(canalesIr(32.4), <bool>[false, false, false, false]);
    });

    test('celdas estimadas = pack / 3 y fracción 3,30–4,20 V', () {
      expect(celdaEstimadaV(11.7), closeTo(3.9, 1e-9));
      expect(fraccionCelda(3.30), 0);
      expect(fraccionCelda(4.20), 1);
      expect(fraccionCelda(2.0), 0);
    });

    test('estado en cero o nulo se considera sin señal', () {
      expect(estadoSinSenal(null), isTrue);
      expect(estadoSinSenal(_e(bat: 0, pct: 0, n: 0)), isTrue);
      expect(estadoSinSenal(_e()), isFalse);
    });

    test(
      'zonas del sonar: 20 cm parada, 50 cm aviso, 0 cm sano = despejado',
      () {
        ZonaSonar z(
          double? cm, {
          bool ok = true,
          DateTime? llegada,
          DateTime? ahora,
        }) => zonaSonar(
          cm: cm,
          ok: ok,
          llegada: llegada ?? t0,
          ahora: ahora ?? t0,
        );
        expect(z(150), ZonaSonar.libre);
        expect(z(35), ZonaSonar.precaucion);
        expect(z(19.9), ZonaSonar.parada);
        expect(z(0), ZonaSonar.libre);
        expect(z(0, ok: false), ZonaSonar.fallo);
        expect(z(null), ZonaSonar.sinDatos);
        expect(
          z(100, ahora: t0.add(const Duration(seconds: 4))),
          ZonaSonar.sinSenal,
        );
        expect(
          CentroAlertas.umbralParadaCm,
          20,
        ); // mismos umbrales del firmware
      },
    );

    test('motivos de parada del firmware', () {
      expect(describirParada('ninguna').detenido, isFalse);
      expect(describirParada('obstaculo_frente').nivel, NivelAlerta.critica);
      expect(describirParada('corte_bateria').nivel, NivelAlerta.critica);
      expect(describirParada('timeout').nivel, NivelAlerta.aviso);
      expect(describirParada('algo_nuevo').detenido, isFalse);
    });

    test(
      'niveles de batería: corte ≤ 9,90 V, aviso ≤ 10,30 V, 0 V sin medida',
      () {
        expect(nivelBateria(null), NivelBateria.sinMedida);
        expect(nivelBateria(_e(bat: 0)), NivelBateria.sinMedida);
        expect(nivelBateria(_e(bat: 9.85)), NivelBateria.corte);
        expect(nivelBateria(_e(bat: 10.05)), NivelBateria.aviso);
        expect(nivelBateria(_e(bat: 10.31)), NivelBateria.nominal);
      },
    );

    test('formatos', () {
      expect(signo(1.234), '+1.2');
      expect(signo(-0.5, decimales: 2), '−0.50');
      expect(metros(145), '1.45');
      expect(horaCorta(DateTime(2026, 1, 1, 3, 4, 5)), '03:04:05');
    });
  });
}
