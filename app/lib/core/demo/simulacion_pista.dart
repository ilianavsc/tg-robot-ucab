import 'dart:math' as math;

import '../alertas/centro_alertas.dart';
import '../models/estado.dart';
import '../models/ultrasonido.dart';

/// Destinos de la pista de demostración.
enum DestinoPista {
  base('BASE / CARGA', 'BASE'),
  estacionA('ESTACIÓN A', 'ESTACIÓN A'),
  estacionB('ESTACIÓN B', 'ESTACIÓN B');

  const DestinoPista(this.nombre, this.corto);

  /// Nombre completo (etiqueta del nodo en el mapa).
  final String nombre;

  /// Nombre breve (botones).
  final String corto;
}

/// Fase de la misión que muestra la tarjeta del Mapa de Pista.
enum FaseMision { enRuta, enDestino, pausada, bloqueada, manual }

/// Evento de la simulación (llegadas, obstáculos y órdenes recibidas).
class EventoSim {
  const EventoSim(this.t, this.texto);

  /// Segundos de simulación desde el arranque del Modo Demo.
  final double t;
  final String texto;
}

/// **Modo Demo físico**: máquina de estados continua de UN robot sobre un
/// circuito cerrado. Dart puro y determinista (sin `Random`, sin reloj): se
/// avanza con `avanzar(dt)` y se prueba con `flutter test`.
///
/// Qué modela (todo es simulación, no telemetría del robot real):
///  * **Marcha autónoma** hacia el destino elegido a ≈ 0,40 m/s, con un lazo
///    PD de línea: `linea_mm` oscila suave alrededor de 0 y la diferencia
///    entre ruedas lo corrige (`v_izq`/`v_der` oscilan cerca de 0,40 m/s).
///  * **Batería 3S Li-Ion** con descarga lineal y lenta (12,60 V → 9,90 V).
///  * **Ciclo de obstáculo**: aparece un objeto delante, la distancia frontal
///    baja de forma continua (> 50 cm → 20–50 cm → < 20 cm), el robot reduce
///    la velocidad en la zona de aviso y se detiene a < 20 cm (parada crítica
///    como en el firmware); tras unos segundos el objeto se retira y retoma.
///    En el firmware real la zona 20–50 cm solo AVISA; la reducción gradual de
///    velocidad es propia del demo.
///  * **Órdenes**: `frenar`, `auto`, `adelante`, `atras`, `izquierda` y
///    `derecha` actúan al instante. El avance y los giros se bloquean con el
///    frente a < 20 cm (solo se permite retroceder); en manual, 5 s sin
///    órdenes detienen al robot (`parada = timeout`).
///
/// Lo que NO modela, porque el robot no lo tiene: LiDAR, brújula/rumbo ni
/// localización absoluta. La posición sobre el mapa es la odometría simulada.
class SimulacionPista {
  SimulacionPista() {
    _tramoTotal = distanciaAlDestino;
  }

  // --------------------------------------------------------- constantes

  /// Longitud del circuito simulado (m). No es una medida del laboratorio.
  static const double longitudM = 10.0;

  /// Posición de cada nodo sobre el circuito (m desde la base, en el sentido
  /// de marcha).
  static const Map<DestinoPista, double> posiciones = <DestinoPista, double>{
    DestinoPista.base: 0.0,
    DestinoPista.estacionA: 4.2,
    DestinoPista.estacionB: 7.0,
  };

  static const double velocidadCrucero = 0.40;
  static const double velocidadManual = 0.40;
  static const double velocidadGiro = 0.20;
  static const double aceleracion = 0.5; // m/s²
  static const double deceleracion = 1.0; // m/s²

  /// Lectura frontal cuando no hay nada cerca (cm).
  static const double libreCm = 150;

  /// Distancia a la que aparece el obstáculo (cm): igual a [libreCm], así la
  /// lectura baja de forma continua.
  static const double apareceACm = libreCm;
  static const double alejaObstaculoMs = 0.60; // m/s al retirarse

  /// Segundos de marcha libre entre obstáculos y de espera con el robot parado.
  static const double intervaloObstaculoS = 20;
  static const double esperaBloqueoS = 4;
  static const double esperaEnDestinoS = 4;

  /// Segundos sin órdenes en manual antes de detenerse (`timeout`).
  static const double tiempoSinOrdenesS = 5;

  static const double bateriaInicialV = 12.60;
  static const double bateriaCorteV = 9.90;
  static const double descargaVps = 0.0010; // V/s (lineal)

  // -------------------------------------------------------------- estado

  double _t = 0;
  double _odo = 0; // metros recorridos (con signo), sin dar la vuelta
  double _v = 0; // velocidad lineal (m/s)
  double _vIzq = 0;
  double _vDer = 0;
  double _x = 0; // error de línea (mm)
  double _dx = 0;
  double _bateriaV = bateriaInicialV;

  bool _autonomo = true;
  DestinoPista _destino = DestinoPista.estacionA;
  double _tramoTotal = 0;
  double _esperaDestino = 0;
  bool _enDestino = false;

  // manual
  double _manualVIzq = 0;
  double _manualVDer = 0;
  double _manualRestante = 0;
  bool _timeout = false;
  bool _ordenDeMovimiento = false;

  // obstáculo
  double? _obsOdo; // posición del obstáculo (m, mismo eje que _odo)
  bool _obsSeRetira = false;
  double _tSinObstaculo = 8; // el primero aparece a los 12 s de marcha libre
  double _tBloqueado = 0;
  double _tBajoUmbral = 0; // s con el frente a < 20 cm
  bool _bloqueado = false;

  final List<EventoSim> _eventos = <EventoSim>[];

  // ------------------------------------------------------------- lecturas

  double get tiempoS => _t;
  bool get autonomo => _autonomo;
  DestinoPista get destino => _destino;
  double get bateriaV => _bateriaV;

  /// Batería en % con la escala del firmware (9,90 V = 0 %, 12,60 V = 100 %).
  int get bateriaPct =>
      ((_bateriaV - bateriaCorteV) / (bateriaInicialV - bateriaCorteV) * 100)
          .round()
          .clamp(0, 100);

  /// Posición sobre el circuito (m, 0 ≤ s < [longitudM]).
  double get posicionM => _mod(_odo, longitudM);

  /// Posición como fracción del circuito (0 = base).
  double get fraccion => posicionM / longitudM;

  /// Velocidad lineal (m/s).
  double get velocidad => _v;
  double get vIzq => _vIzq;
  double get vDer => _vDer;
  double get lineaMm => _x;

  /// Lectura del HC-SR04P frontal (cm). 150 = camino libre.
  double get frenteCm {
    final double? o = _obsOdo;
    if (o == null) return libreCm;
    return ((o - _odo) * 100).clamp(0.0, libreCm);
  }

  /// Lectura del HC-SR04P trasero (cm): siempre despejado en el demo.
  double get atrasCm => 160;

  /// Posición del obstáculo como fracción del circuito, o `null`.
  double? get obstaculoFraccion {
    final double? o = _obsOdo;
    if (o == null) return null;
    return _mod(o, longitudM) / longitudM;
  }

  /// Tiempo de reacción del sensor + firmware antes de cortar los motores
  /// (lectura alternada cada 100 ms y confirmación): el robot frena unos
  /// centímetros por debajo de los 20 cm.
  static const double reaccionS = 0.20;

  /// `true` si el frente lleva [reaccionS] a < 20 cm: avance y giros
  /// bloqueados y motores cortados.
  bool get frenteBloqueado => _bloqueado;

  /// Distancia que falta hasta el destino siguiendo el sentido de marcha (m).
  double get distanciaAlDestino {
    final double d = _mod(posiciones[_destino]! - posicionM, longitudM);
    return d > longitudM - 0.05 ? 0 : d;
  }

  /// Avance del tramo actual (0..1).
  double get progresoTramo => _enDestino || _tramoTotal <= 0.05
      ? 1.0
      : (1 - distanciaAlDestino / _tramoTotal).clamp(0.0, 1.0);

  FaseMision get fase {
    if (frenteBloqueado && (_autonomo || _ordenDeMovimiento)) {
      return FaseMision.bloqueada;
    }
    if (!_autonomo) {
      return _manualRestante > 0 && (_manualVIzq != 0 || _manualVDer != 0)
          ? FaseMision.manual
          : FaseMision.pausada;
    }
    return _enDestino ? FaseMision.enDestino : FaseMision.enRuta;
  }

  /// Motivo de parada del campo `parada` del estado.
  String get parada {
    if (frenteBloqueado && (_autonomo || _ordenDeMovimiento)) {
      return 'obstaculo_frente';
    }
    if (_timeout) return 'timeout';
    return 'ninguna';
  }

  List<EventoSim> get eventos => List<EventoSim>.unmodifiable(_eventos);
  EventoSim? get ultimoEvento => _eventos.isEmpty ? null : _eventos.last;

  // -------------------------------------------------------------- órdenes

  /// Aplica una orden del firmware: `adelante`, `atras`, `izquierda`,
  /// `derecha`, `frenar` o `auto`. Devuelve `false` si no la reconoce.
  bool aplicarOrden(String comando) {
    switch (comando) {
      case 'frenar':
        _autonomo = false;
        _manualVIzq = 0;
        _manualVDer = 0;
        _manualRestante = 0;
        _timeout = false;
        _ordenDeMovimiento = false;
        _registrar('Orden frenar · robot detenido (manual)');
        return true;
      case 'auto':
        _autonomo = true;
        _manualRestante = 0;
        _timeout = false;
        _ordenDeMovimiento = false;
        _enDestino = false;
        _tramoTotal = distanciaAlDestino;
        _registrar('Orden auto · marcha autónoma hacia ${_destino.nombre}');
        return true;
      case 'adelante':
        return _manual(velocidadManual, velocidadManual, comando);
      case 'atras':
        return _manual(-velocidadManual, -velocidadManual, comando);
      case 'izquierda':
        return _manual(-velocidadGiro, velocidadGiro, comando);
      case 'derecha':
        return _manual(velocidadGiro, -velocidadGiro, comando);
    }
    return false;
  }

  bool _manual(double izq, double der, String comando) {
    _autonomo = false;
    _manualVIzq = izq;
    _manualVDer = der;
    _manualRestante = tiempoSinOrdenesS;
    _timeout = false;
    _ordenDeMovimiento = true;
    _registrar('Orden $comando (manual)');
    return true;
  }

  /// Cambia el destino. Si ya estaba en marcha autónoma, sigue hacia el nuevo.
  void elegirDestino(DestinoPista d) {
    _destino = d;
    _enDestino = false;
    _esperaDestino = 0;
    _tramoTotal = distanciaAlDestino;
    _registrar('Destino: ${d.nombre}');
  }

  // ---------------------------------------------------------- simulación

  /// Avanza la simulación [dt] segundos (en pasos de ≤ 50 ms).
  void avanzar(double dt) {
    double resto = dt;
    while (resto > 1e-9) {
      final double paso = math.min(resto, 0.05);
      _paso(paso);
      resto -= paso;
    }
  }

  void _paso(double dt) {
    _t += dt;
    _bateriaV = math.max(bateriaCorteV, _bateriaV - descargaVps * dt);

    // ---- obstáculo: aparece, se espera y se retira
    _gestionarObstaculo(dt);
    if (frenteCm < CentroAlertas.umbralParadaCm) {
      _tBajoUmbral += dt;
    } else {
      _tBajoUmbral = 0;
    }
    _bloqueado = _tBajoUmbral >= reaccionS;

    // ---- objetivo de velocidad de cada rueda
    final bool bloqueo = frenteBloqueado;
    double objIzq;
    double objDer;
    if (_autonomo) {
      _gestionarDestino(dt);
      double vObj = _enDestino ? 0 : _velocidadHaciaDestino();
      final double d = frenteCm;
      if (d < CentroAlertas.umbralAvisoCm) {
        // Zona de aviso del demo: reduce con la distancia (mínimo 25 %).
        final double f =
            ((d - CentroAlertas.umbralParadaCm) /
                    (CentroAlertas.umbralAvisoCm -
                        CentroAlertas.umbralParadaCm))
                .clamp(0.25, 1.0);
        vObj *= f;
      }
      if (bloqueo) vObj = 0;
      objIzq = vObj;
      objDer = vObj;
    } else {
      if (_manualRestante > 0) {
        _manualRestante -= dt;
        if (_manualRestante <= 0) {
          _manualRestante = 0;
          if (_ordenDeMovimiento) _timeout = true; // 5 s sin órdenes
          _manualVIzq = 0;
          _manualVDer = 0;
        }
      }
      objIzq = _manualVIzq;
      objDer = _manualVDer;
      // Con el frente a < 20 cm solo se permite retroceder.
      if (bloqueo) {
        if (objIzq > 0) objIzq = 0;
        if (objDer > 0) objDer = 0;
        if (_manualVIzq != _manualVDer) {
          objIzq = 0;
          objDer = 0; // giros bloqueados
        }
      }
    }

    // ---- dinámica de las ruedas (rampa de aceleración)
    _vIzq = _acercar(_vIzq, objIzq, dt, bloqueo && objIzq <= 0);
    _vDer = _acercar(_vDer, objDer, dt, bloqueo && objDer <= 0);
    _v = (_vIzq + _vDer) / 2;
    _odo += _v * dt;

    // ---- lazo PD de línea (solo en marcha autónoma)
    _lazoLinea(dt);
  }

  double _acercar(double v, double obj, double dt, bool paroSeco) {
    // Parada de seguridad (< 20 cm): el firmware corta los motores al instante.
    if (paroSeco && obj == 0 && v > 0) return 0;
    final double dv = obj - v;
    final double tope = (obj.abs() < v.abs() ? deceleracion : aceleracion) * dt;
    return v + dv.clamp(-tope, tope);
  }

  double _velocidadHaciaDestino() {
    // Frena suave al acercarse a la estación (mínimo 0,06 m/s).
    return math.min(velocidadCrucero, math.max(0.06, 0.8 * distanciaAlDestino));
  }

  void _gestionarDestino(double dt) {
    if (_enDestino) {
      _esperaDestino -= dt;
      if (_esperaDestino <= 0) {
        // Demo continuo: tras esperar, pasa a la siguiente estación.
        final DestinoPista siguiente = DestinoPista
            .values[(_destino.index + 1) % DestinoPista.values.length];
        _destino = siguiente;
        _enDestino = false;
        _tramoTotal = distanciaAlDestino;
        _registrar('Rumbo a ${siguiente.nombre}');
      }
      return;
    }
    if (distanciaAlDestino < 0.03 && _v.abs() < 0.12) {
      _enDestino = true;
      _esperaDestino = esperaEnDestinoS;
      _registrar('Llegó a ${_destino.nombre}');
    }
  }

  void _gestionarObstaculo(double dt) {
    final double? o = _obsOdo;
    if (o == null) {
      final bool enMarcha = _autonomo && !_enDestino && _v > 0.2;
      if (enMarcha) _tSinObstaculo += dt;
      if (_tSinObstaculo >= intervaloObstaculoS && enMarcha) {
        _obsOdo = _odo + apareceACm / 100;
        _obsSeRetira = false;
        _tBloqueado = 0;
        _registrar('Obstáculo detectado al frente');
      }
      return;
    }
    if (_obsSeRetira) {
      _obsOdo = o + alejaObstaculoMs * dt;
      if ((_obsOdo! - _odo) * 100 >= libreCm) {
        _obsOdo = null;
        _obsSeRetira = false;
        _tSinObstaculo = 0;
        _registrar('Camino despejado');
      }
      return;
    }
    if (frenteBloqueado) {
      if (_tBloqueado == 0) {
        _registrar(
          'Parada crítica: obstáculo a ${frenteCm.toStringAsFixed(0)} cm',
        );
      }
      _tBloqueado += dt;
      if (_tBloqueado >= esperaBloqueoS) {
        _obsSeRetira = true;
        _registrar('Obstáculo retirado: se reanuda la marcha');
      }
    }
  }

  void _lazoLinea(double dt) {
    final double marcha = (_v.abs() / velocidadCrucero).clamp(0.0, 1.0);
    if (!_autonomo || marcha < 0.05) {
      // Sin seguir la línea: el error se relaja a 0 de forma suave.
      _x *= math.max(0.0, 1 - 2.0 * dt);
      _dx = 0;
      return;
    }
    // Perturbación suave (curvatura y holguras), en mm/s.
    final double d =
        marcha * (14 * math.sin(0.7 * _t) + 7 * math.sin(1.9 * _t + 0.8));
    const double kp = 3.0;
    const double kd = 0.35;
    final double u = kp * _x + kd * _dx;
    _dx = d - u;
    _x += _dx * dt;
    // Corrección diferencial: línea a la izquierda (x > 0) → gira a la izquierda.
    final double dv = (0.0012 * u).clamp(-0.08, 0.08);
    _vIzq = _v - dv;
    _vDer = _v + dv;
  }

  void _registrar(String texto) {
    _eventos.add(EventoSim(_t, texto));
    if (_eventos.length > 30) _eventos.removeAt(0);
  }

  static double _mod(double a, double m) {
    final double r = a % m;
    return r < 0 ? r + m : r;
  }

  // ------------------------------------------------- telemetría simulada

  /// El [Estado] que publicaría el robot en este instante.
  Estado estado({required int numero, required int ordenes, int? tMs}) {
    final bool bloqueado = parada == 'obstaculo_frente';
    return Estado(
      numero: numero,
      modo: _autonomo ? 'autonomo' : 'manual',
      bateria: bateriaPct,
      bateriaV: double.parse(_bateriaV.toStringAsFixed(3)),
      ordenes: ordenes,
      lineaMm: _x.clamp(-32.0, 32.0),
      vIzq: bloqueado ? 0.0 : _vIzq,
      vDer: bloqueado ? 0.0 : _vDer,
      t: tMs ?? (_t * 1000).round(),
      parada: parada,
    );
  }

  /// La lectura de los 2 HC-SR04P en este instante.
  Ultrasonido ultrasonido({required DateTime llegada, int? tMs}) => Ultrasonido(
    frenteCm: frenteCm,
    atrasCm: atrasCm,
    llegada: llegada,
    t: tMs ?? (_t * 1000).round(),
  );
}
