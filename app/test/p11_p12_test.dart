import 'package:flutter_test/flutter_test.dart';
import 'package:robot_ucab_app/core/alertas/centro_alertas.dart';
import 'package:robot_ucab_app/core/analitica/analitica_sesion.dart';
import 'package:robot_ucab_app/core/models/estado.dart';
import 'package:robot_ucab_app/core/models/ultrasonido.dart';
import 'package:robot_ucab_app/core/mqtt/mqtt_service.dart';

Estado _estado({
  double v = 0.4,
  double bat = 11.5,
  double linea = 3.0,
  String parada = 'ninguna',
  int n = 1,
}) =>
    Estado(
      numero: n,
      modo: 'autonomo',
      bateria: 50,
      bateriaV: bat,
      ordenes: 0,
      lineaMm: linea,
      vIzq: v,
      vDer: v,
      t: 0,
      parada: parada,
    );

Ultrasonido _ultra(double f, double a, {bool fOk = true, bool aOk = true}) =>
    Ultrasonido(
      frenteCm: f,
      atrasCm: a,
      frenteOk: fOk,
      atrasOk: aOk,
      llegada: DateTime(2026, 11, 18),
    );

void main() {
  final t0 = DateTime(2026, 11, 18, 3, 0, 0);

  group('Modelos (contrato JSON firmware / P10)', () {
    test('Ultrasonido lee frente_ok / atras_ok y es compatible sin ellos', () {
      final u = Ultrasonido.fromJson(<String, dynamic>{
        'frente_cm': 0.0,
        'atras_cm': 120.0,
        'frente_ok': false,
        'atras_ok': true,
      });
      expect(u.frenteOk, isFalse);
      expect(u.frenteValido, isNull);
      expect(u.atrasValido, 120.0);
      final viejo = Ultrasonido.fromJson(<String, dynamic>{'frente_cm': 84.0});
      expect(viejo.frenteOk, isTrue);
    });

    test('Estado lee parada y no marca crítica con 0.00 V', () {
      final e = Estado.fromJson(<String, dynamic>{
        'n': 3,
        'estado': 'manual',
        'bateria_v': 0.0,
        'parada': 'timeout',
      });
      expect(e.parada, 'timeout');
      expect(e.bateriaCritica, isFalse);
      expect(_estado(bat: 10.05).bateriaCritica, isTrue);
      expect(_estado(bat: 10.35).bateriaCritica, isFalse);
    });
  });

  group('P11 · CentroAlertas', () {
    test('obstáculo frontal < 20 cm es crítico y se despeja solo', () {
      final c = CentroAlertas();
      final nuevas = c.evaluar(ultrasonido: _ultra(14, 100), ahora: t0);
      expect(nuevas, contains('obstaculo_frente'));
      expect(c.principal!.nivel, NivelAlerta.critica);
      // Dentro de la gracia no se despeja
      c.evaluar(ultrasonido: _ultra(100, 100), ahora: t0.add(const Duration(milliseconds: 500)));
      expect(c.activas, isNotEmpty);
      c.evaluar(ultrasonido: _ultra(100, 100), ahora: t0.add(const Duration(seconds: 3)));
      expect(c.activas, isEmpty);
      expect(c.eventos.first.accion, AccionAlerta.despejada);
    });

    test('proximidad 20–50 cm es aviso; fallo sin eco es crítico', () {
      final c = CentroAlertas();
      c.evaluar(ultrasonido: _ultra(35, 100), ahora: t0);
      expect(c.principal!.clave, 'proximidad_frente');
      expect(c.principal!.nivel, NivelAlerta.aviso);
      final c2 = CentroAlertas();
      c2.evaluar(ultrasonido: _ultra(0, 100, fOk: false), ahora: t0);
      expect(c2.principal!.clave, 'fallo_sensor_frente');
      expect(c2.principal!.nivel, NivelAlerta.critica);
    });

    test('0 cm con sensor válido = nada en rango, no es obstáculo', () {
      final c = CentroAlertas();
      c.evaluar(ultrasonido: _ultra(0, 0), ahora: t0);
      expect(c.activas, isEmpty);
    });

    test('batería crítica ≤ 10,3 V; 0,00 V en reposo se ignora', () {
      final c = CentroAlertas();
      c.evaluar(estado: _estado(bat: 0.0), ahora: t0);
      expect(c.activas, isEmpty);
      c.evaluar(estado: _estado(bat: 10.05), ahora: t0);
      expect(c.principal!.clave, 'bateria_critica');
    });

    test('corte por batería: parada del estado y alerta del robot', () {
      final c = CentroAlertas();
      final nuevas = c.evaluar(
          estado: _estado(bat: 9.85, parada: 'corte_bateria'), ahora: t0);
      expect(nuevas, contains('corte_bateria'));
      expect(CentroAlertas.clavesParadaEmergencia, contains('corte_bateria'));
      // El robot confirma con su alerta "bateria_critica" (= corte)
      expect(
          c.registrarDelRobot(<String, dynamic>{'tipo': 'bateria_critica', 'valor': 9.85}, ahora: t0),
          isNull);
      expect(c.activas.firstWhere((AlertaActiva a) => a.clave == 'corte_bateria').confirmadaPorRobot,
          isTrue);
      // "bateria_baja" del robot es el aviso preventivo de 10,30 V
      final c2 = CentroAlertas();
      expect(c2.registrarDelRobot(<String, dynamic>{'tipo': 'bateria_baja', 'valor': 10.2}, ahora: t0),
          'bateria_critica');
    });

    test('la crítica gana el banner y reconocer la saca de él', () {
      final c = CentroAlertas();
      c.evaluar(estado: _estado(parada: 'timeout'), ultrasonido: _ultra(14, 100), ahora: t0);
      expect(c.principal!.clave, 'obstaculo_frente');
      c.reconocer('obstaculo_frente', ahora: t0);
      expect(c.principal!.clave, 'timeout_manual');
      expect(c.activas.length, 2);
      expect(c.pendientes, 1);
    });

    test('alerta del robot confirma la deducida; antirrobo persiste hasta reconocer', () {
      final c = CentroAlertas();
      c.evaluar(ultrasonido: _ultra(14, 100), ahora: t0);
      expect(c.registrarDelRobot(<String, dynamic>{'tipo': 'obstaculo', 'valor': 14}, ahora: t0), isNull);
      expect(c.principal!.confirmadaPorRobot, isTrue);
      final clave = c.registrarDelRobot(<String, dynamic>{'tipo': 'antirrobo', 'prueba': false}, ahora: t0);
      expect(clave, 'antirrobo');
      c.evaluar(ultrasonido: _ultra(150, 150), ahora: t0.add(const Duration(seconds: 10)));
      expect(c.activas.map((AlertaActiva a) => a.clave), <String>['antirrobo']);
      c.reconocer('antirrobo');
      expect(c.activas, isEmpty);
    });
  });

  group('P12 · AnaliticaSesion', () {
    test('acumula métricas y exporta CSV', () {
      final a = AnaliticaSesion();
      a.registrarUltrasonido(_ultra(150, 100), ahora: t0);
      a.registrarEstado(_estado(v: 0.40, linea: 4), ahora: t0);
      a.registrarUltrasonido(_ultra(18, 100), ahora: t0);
      a.registrarEstado(_estado(v: 0.0, linea: -2), ahora: t0);
      a.registrarUltrasonido(_ultra(0, 100, fOk: false), ahora: t0);
      a.registrarEstado(_estado(v: 0.50, linea: -32.4), ahora: t0);
      a.registrarParadaEmergencia();
      expect(a.velocidadMedia, closeTo(0.30, 1e-9));
      expect(a.velocidadMaxima, 0.50);
      expect(a.distanciaFrontalMinima, 18); // ignora 0 cm y el sensor en fallo
      expect(a.errorMedioLinea, closeTo(3.0, 1e-9)); // ignora la línea perdida
      expect(a.totalPaquetes, 6);
      expect(a.paradasEmergencia, 1);
      final csv = a.toCsv(ahora: t0);
      expect(csv, contains('velocidad_media;0.300;m/s'));
      expect(csv, contains('distancia_frontal_minima;18.0;cm'));
      expect(csv, contains('paradas_emergencia;1;'));
      expect(csv.split('\n').where((String l) => l.endsWith(';ninguna')).length, 3);
      a.reiniciar();
      expect(a.totalPaquetes, 0);
      expect(a.distanciaFrontalMinima, isNull);
    });
  });

  group('MqttService · Modo Demo con P11/P12', () {
    test('el demo aplica la regla de seguridad, alerta y reinicia a 0 al detener', () {
      final s = MqttService();
      s.iniciarSimulacion();
      // Recorre los 7 perfiles a mano (sin esperar el temporizador de 2 s)
      final claves = <String>{};
      var bloqueos = 0;
      for (var i = 0; i < 7; i++) {
        if (i > 0) s.debugEmitirPasoDemo();
        final e = s.ultimoEstado!;
        final u = s.ultimoUltrasonido!;
        if (!u.frenteOk || (u.frenteValido != null && u.frenteValido! < 20)) {
          expect(e.vIzq, 0.0);
          expect(e.vDer, 0.0);
          expect(e.parada, isNot('ninguna'));
          bloqueos++;
        }
        claves.addAll(s.centroAlertas.activas.map((AlertaActiva a) => a.clave));
      }
      expect(bloqueos, 2);
      expect(claves, containsAll(<String>[
        'obstaculo_frente',
        'proximidad_frente',
        'bateria_critica',
        'fallo_sensor_frente',
      ]));
      expect(s.analitica.paradasEmergencia, 2);
      expect(s.analitica.totalPaquetes, 14);
      s.detenerSimulacion();
      expect(s.analitica.totalPaquetes, 0);
      expect(s.analitica.paradasEmergencia, 0);
      expect(s.centroAlertas.activas, isEmpty);
      s.dispose();
    });
  });
}
