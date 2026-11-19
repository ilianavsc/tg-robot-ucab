import 'package:flutter_test/flutter_test.dart';
import 'package:robot_ucab_app/core/demo/simulacion_pista.dart';

/// Modo Demo físico: máquina de estados de un robot sobre un circuito cerrado.
/// Dart puro: sin widgets ni reloj (se avanza con `avanzar(dt)`).
void main() {
  /// Avanza [segundos] en pasos de 50 ms llamando a [alPaso] tras cada uno.
  void correr(
    SimulacionPista s,
    double segundos, [
    void Function(SimulacionPista)? alPaso,
  ]) {
    final int pasos = (segundos / 0.05).round();
    for (int i = 0; i < pasos; i++) {
      s.avanzar(0.05);
      alPaso?.call(s);
    }
  }

  group('marcha autónoma (PID suave)', () {
    test('arranca en la base rumbo a la Estación A', () {
      final SimulacionPista s = SimulacionPista();
      expect(s.destino, DestinoPista.estacionA);
      expect(s.autonomo, isTrue);
      expect(s.fase, FaseMision.enRuta);
      expect(s.posicionM, 0);
      expect(s.progresoTramo, lessThan(0.05));
    });

    test(
      'las ruedas oscilan suavemente cerca de 0,40 m/s y la línea cerca de 0',
      () {
        final SimulacionPista s = SimulacionPista();
        correr(s, 3); // rampa de aceleración
        double minV = 9, maxV = -9, maxX = 0, maxSalto = 0;
        double previa = s.vIzq;
        correr(s, 5, (SimulacionPista p) {
          minV = [minV, p.vIzq, p.vDer].reduce((a, b) => a < b ? a : b);
          maxV = [maxV, p.vIzq, p.vDer].reduce((a, b) => a > b ? a : b);
          if (p.lineaMm.abs() > maxX) maxX = p.lineaMm.abs();
          final double salto = (p.vIzq - previa).abs();
          if (salto > maxSalto) maxSalto = salto;
          previa = p.vIzq;
        });
        expect(minV, greaterThan(0.32));
        expect(maxV, lessThan(0.48));
        expect(s.velocidad, closeTo(0.40, 0.02));
        expect(
          maxX,
          lessThan(15),
          reason: 'el lazo de línea no se descontrola',
        );
        expect(
          maxSalto,
          lessThan(0.02),
          reason: 'sin saltos bruscos de velocidad',
        );
      },
    );

    test('el robot avanza por el circuito y sigue la dirección de marcha', () {
      final SimulacionPista s = SimulacionPista();
      correr(s, 5);
      expect(s.posicionM, greaterThan(1.2));
      expect(s.fraccion, inInclusiveRange(0, 1));
    });
  });

  group('batería 3S Li-Ion', () {
    test('descarga lineal y lenta, sin saltos', () {
      final SimulacionPista s = SimulacionPista();
      expect(s.bateriaV, 12.60);
      expect(s.bateriaPct, 100);
      double previa = s.bateriaV;
      double? paso;
      for (int i = 0; i < 400; i++) {
        s.avanzar(0.25);
        final double d = previa - s.bateriaV;
        expect(d, greaterThan(0), reason: 'monótona decreciente');
        paso ??= d;
        expect(d, closeTo(paso, 1e-9), reason: 'tasa constante (lineal)');
        previa = s.bateriaV;
      }
      expect(s.bateriaV, closeTo(12.60 - 0.0010 * 100, 1e-6));
      expect(s.bateriaPct, inInclusiveRange(96, 100));
    });

    test('nunca baja del corte de 9,90 V', () {
      final SimulacionPista s = SimulacionPista();
      s.avanzar(4000); // más de lo que dura la carga (2 700 s)
      expect(s.bateriaV, greaterThanOrEqualTo(9.90));
      expect(s.bateriaPct, greaterThanOrEqualTo(0));
    });
  });

  group('ciclo de obstáculo', () {
    test('la distancia baja de forma continua por las 3 zonas, para a < 20 cm y se reanuda', () {
      final SimulacionPista s = SimulacionPista();
      bool libre = false, aviso = false, parada = false, reanuda = false;
      double previa = s.frenteCm;
      double maxSalto = 0;
      double velAviso = 9;
      correr(s, 60, (SimulacionPista p) {
        final double d = p.frenteCm;
        if ((d - previa).abs() > maxSalto) maxSalto = (d - previa).abs();
        previa = d;
        if (d > 50) libre = true;
        if (d >= 20 && d <= 50 && p.velocidad > 0) {
          aviso = true;
          if (p.velocidad < velAviso) velAviso = p.velocidad;
        }
        if (p.frenteBloqueado) {
          parada = true;
          expect(p.velocidad, 0.0, reason: 'parada crítica: 0,00 m/s');
          expect(p.vIzq, 0.0);
          expect(p.vDer, 0.0);
          expect(p.parada, 'obstaculo_frente');
          expect(p.fase, FaseMision.bloqueada);
          expect(d, lessThan(20));
          expect(d, greaterThan(14), reason: 'frena unos cm por debajo de 20');
        } else if (parada && p.velocidad > 0.05) {
          reanuda = true;
        }
      });
      expect(libre, isTrue);
      expect(aviso, isTrue);
      expect(parada, isTrue);
      expect(reanuda, isTrue, reason: 'retoma la marcha al despejarse');
      expect(velAviso, lessThan(0.25), reason: 'reduce velocidad en 20–50 cm');
      expect(
        maxSalto,
        lessThan(4.5),
        reason: 'sin saltos en la lectura (cm por 50 ms)',
      );
    });

    test('el ciclo se repite', () {
      final SimulacionPista s = SimulacionPista();
      int paradas = 0;
      bool estabaBloqueado = false;
      correr(s, 140, (SimulacionPista p) {
        if (p.frenteBloqueado && !estabaBloqueado) paradas++;
        estabaBloqueado = p.frenteBloqueado;
      });
      expect(paradas, greaterThanOrEqualTo(2));
    });

    test('registra eventos de la secuencia', () {
      final SimulacionPista s = SimulacionPista();
      correr(s, 40);
      final String todos = s.eventos.map((EventoSim e) => e.texto).join('|');
      expect(todos, contains('Obstáculo detectado'));
      expect(todos, contains('Parada crítica'));
      expect(todos, contains('Llegó a ESTACIÓN A'));
    });
  });

  group('respuesta a las órdenes', () {
    test('frenar detiene al instante en manual y auto reanuda', () {
      final SimulacionPista s = SimulacionPista();
      correr(s, 3);
      expect(s.velocidad, greaterThan(0.3));
      expect(s.aplicarOrden('frenar'), isTrue);
      correr(s, 1);
      expect(s.velocidad, 0);
      expect(s.autonomo, isFalse);
      expect(s.fase, FaseMision.pausada);
      expect(s.estado(numero: 1, ordenes: 1).modo, 'manual');
      s.aplicarOrden('auto');
      correr(s, 2);
      expect(s.autonomo, isTrue);
      expect(s.velocidad, greaterThan(0.25));
      expect(s.fase, FaseMision.enRuta);
      expect(s.ultimoEvento!.texto, contains('Orden auto'));
    });

    test('D-pad: adelante, atrás y giros; a los 5 s sin órdenes se detiene (timeout)', () {
      final SimulacionPista s = SimulacionPista();
      s.aplicarOrden('frenar');
      correr(s, 0.5);
      s.aplicarOrden('adelante');
      correr(s, 2);
      expect(s.vIzq, closeTo(0.40, 0.03));
      expect(s.vDer, closeTo(0.40, 0.03));
      expect(s.fase, FaseMision.manual);
      correr(s, 3.5); // pasan los 5 s
      expect(s.velocidad, 0);
      expect(s.parada, 'timeout');

      final double antes = s.posicionM;
      s.aplicarOrden('atras');
      correr(s, 1.5);
      expect(s.velocidad, lessThan(-0.2));
      final double retroceso =
          (antes - s.posicionM) % SimulacionPista.longitudM;
      expect(retroceso, inInclusiveRange(0.2, 2.0), reason: 'va hacia atrás');

      s.aplicarOrden('izquierda');
      correr(s, 1.5);
      expect(s.vIzq, lessThan(0));
      expect(s.vDer, greaterThan(0));
      s.aplicarOrden('derecha');
      correr(s, 1.5);
      expect(s.vIzq, greaterThan(0));
      expect(s.vDer, lessThan(0));
    });

    test('con el frente a < 20 cm el avance y los giros se bloquean y solo se permite retroceder', () {
      final SimulacionPista s = SimulacionPista();
      correr(s, 40, (SimulacionPista p) {});
      // Avanza hasta quedar bloqueado por el obstáculo
      int guardia = 0;
      while (!s.frenteBloqueado && guardia++ < 4000) {
        s.avanzar(0.05);
      }
      expect(s.frenteBloqueado, isTrue);
      s.aplicarOrden('adelante');
      correr(s, 1);
      expect(s.velocidad, 0);
      expect(s.parada, 'obstaculo_frente');
      s.aplicarOrden('izquierda');
      correr(s, 1);
      expect(s.vIzq, 0);
      expect(s.vDer, 0);
      s.aplicarOrden('atras');
      correr(s, 1.5);
      expect(s.velocidad, lessThan(-0.2), reason: 'retroceder sí se permite');
      expect(s.frenteBloqueado, isFalse);
    });

    test('orden desconocida se rechaza', () {
      expect(SimulacionPista().aplicarOrden('volar'), isFalse);
    });
  });

  group('destinos y misión', () {
    test(
      'elegir un destino lo alcanza, lo registra y marca 100 % de avance',
      () {
        final SimulacionPista s = SimulacionPista();
        s.elegirDestino(DestinoPista.estacionB);
        expect(s.destino, DestinoPista.estacionB);
        expect(s.ultimoEvento!.texto, 'Destino: ESTACIÓN B');
        bool llego = false;
        correr(s, 80, (SimulacionPista p) {
          if (p.fase == FaseMision.enDestino &&
              p.destino == DestinoPista.estacionB) {
            llego = true;
            expect(p.progresoTramo, 1.0);
          }
        });
        expect(llego, isTrue);
        expect(
          s.eventos.map((EventoSim e) => e.texto),
          contains('Llegó a ESTACIÓN B'),
        );
      },
    );

    test('el avance del tramo crece de forma monótona hacia el destino', () {
      final SimulacionPista s = SimulacionPista();
      s.elegirDestino(DestinoPista.estacionB);
      double previo = s.progresoTramo;
      correr(s, 12, (SimulacionPista p) {
        if (p.fase == FaseMision.enRuta) {
          expect(p.progresoTramo, greaterThanOrEqualTo(previo - 1e-9));
          previo = p.progresoTramo;
        }
      });
      expect(previo, greaterThan(0.5));
    });

    test(
      'tras esperar en una estación pasa a la siguiente (demo continuo)',
      () {
        final SimulacionPista s = SimulacionPista();
        correr(s, 25);
        expect(s.destino, isNot(DestinoPista.estacionA));
      },
    );
  });

  group('telemetría simulada', () {
    test('el Estado usa el contrato del firmware y la escala de batería 9,90–12,60 V', () {
      final SimulacionPista s = SimulacionPista();
      correr(s, 3);
      final e = s.estado(numero: 9001, ordenes: 2);
      expect(e.modo, 'autonomo');
      expect(e.bateria, inInclusiveRange(0, 100));
      expect(e.bateriaV, inInclusiveRange(9.9, 12.6));
      expect(e.lineaMm.abs(), lessThanOrEqualTo(32));
      expect(e.parada, 'ninguna');
      final u = s.ultrasonido(llegada: DateTime(2026, 11, 19));
      expect(u.frenteOk, isTrue);
      expect(u.atrasOk, isTrue);
    });
  });
}
