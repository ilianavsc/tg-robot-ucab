import '../models/estado.dart';
import '../models/ultrasonido.dart';

/// Gravedad de una alerta: define el color del banner (rojo / ámbar).
enum NivelAlerta { critica, aviso }

/// De dónde salió la alerta.
///  * [telemetria]: la app la dedujo de `estado` / `ultrasonido`.
///  * [robot]: llegó publicada por el robot en `ucab-tg-sf/robot/alertas` (QoS 2).
enum OrigenAlerta { telemetria, robot }

/// Qué pasó con una alerta (para el registro de eventos).
enum AccionAlerta { activada, reconocida, despejada }

/// Una alerta activa del Centro de Alertas (P11).
class AlertaActiva {
  AlertaActiva({
    required this.clave,
    required this.nivel,
    required this.titulo,
    required this.detalle,
    required this.desde,
    required this.origen,
    this.persistente = false,
  });

  /// Identificador estable de la condición (`obstaculo_frente`, `bateria_critica`...).
  final String clave;
  NivelAlerta nivel;
  String titulo;
  String detalle;

  /// Hora del teléfono en que se activó.
  final DateTime desde;
  OrigenAlerta origen;

  /// `true` = alerta de evento (antirrobo, timeout...): se queda hasta que el
  /// operador la reconozca. `false` = de condición: se despeja sola.
  final bool persistente;

  /// El operador pulsó "Reconocer": deja de ocupar el banner, pero sigue en
  /// la lista mientras la condición dure.
  bool reconocida = false;

  /// El robot también la publicó por MQTT (confirma la deducción de la app).
  bool confirmadaPorRobot = false;
}

/// Entrada del registro reciente de eventos.
class EventoAlerta {
  const EventoAlerta({
    required this.hora,
    required this.clave,
    required this.nivel,
    required this.titulo,
    required this.accion,
    required this.origen,
  });

  final DateTime hora;
  final String clave;
  final NivelAlerta nivel;
  final String titulo;
  final AccionAlerta accion;
  final OrigenAlerta origen;
}

/// Motor del Centro de Alertas (P11). Dart puro: se prueba sin Flutter.
///
/// Detecta en tiempo real, con la MISMA regla del firmware y del P10:
///  * Parada por obstáculo frontal (`frente_cm < 20`) → crítica.
///  * Fallo de ultrasonido sin eco (`frente_ok` / `atras_ok = false`) → crítica.
///  * Proximidad frontal (`20 ≤ frente_cm < 50`) → aviso.
///  * Obstáculo trasero (`atras_cm < 20`) → aviso (solo bloquea el retroceso).
///  * Batería crítica (`≤ 10,3 V`, ignorando `0,00 V` en reposo) → crítica.
///  * Corte por batería del firmware (`parada = corte_bateria`, ≤ 9,90 V) → crítica.
///
/// Tipos de alerta del robot para la batería (firmware/robot_integrado.ino):
///  * `bateria_baja`    = aviso preventivo a ≤ 10,30 V (el robot sigue andando);
///    en la app es la misma condición que "Batería crítica".
///  * `bateria_critica` = CORTE a ≤ 9,90 V: motores bloqueados hasta > 10,10 V
///    y una orden nueva.
///  * Parada por inactividad del modo manual (`parada = timeout`) → aviso.
/// Y además registra las alertas que publica el robot en `robot/alertas`.
class CentroAlertas {
  static const double umbralParadaCm = 20.0;
  static const double umbralAvisoCm = 50.0;
  static const double bateriaCriticaV = 10.3;
  static const int maxEventos = 40;

  /// Tiempo mínimo que una alerta recién activada se mantiene aunque el dato
  /// siguiente ya no la confirme: evita parpadeos cuando la alerta del robot
  /// llega unos ms antes que su lectura de ultrasonido.
  static const Duration gracia = Duration(milliseconds: 1500);

  /// Claves que cuentan como **parada de emergencia** para la analítica (P12).
  static const Set<String> clavesParadaEmergencia = <String>{
    'obstaculo_frente',
    'obstaculo_atras',
    'fallo_sensor_frente',
    'fallo_sensor_atras',
    'corte_bateria',
  };

  final Map<String, AlertaActiva> _activas = <String, AlertaActiva>{};
  final List<EventoAlerta> _eventos = <EventoAlerta>[];

  /// Alertas activas, la más grave y más nueva primero.
  List<AlertaActiva> get activas {
    final lista = _activas.values.toList()
      ..sort((AlertaActiva a, AlertaActiva b) {
        final n = a.nivel.index.compareTo(b.nivel.index);
        return n != 0 ? n : b.desde.compareTo(a.desde);
      });
    return lista;
  }

  /// La alerta que ocupa el banner: la más grave sin reconocer (o `null`).
  AlertaActiva? get principal {
    for (final a in activas) {
      if (!a.reconocida) return a;
    }
    return null;
  }

  /// Alertas sin reconocer.
  int get pendientes => _activas.values.where((a) => !a.reconocida).length;

  /// Registro reciente, el más nuevo primero.
  List<EventoAlerta> get eventos => List<EventoAlerta>.unmodifiable(_eventos);

  /// Revisa la telemetría y activa / despeja las alertas de condición.
  /// Devuelve las claves que se ACTIVARON en esta llamada.
  List<String> evaluar({
    Estado? estado,
    Ultrasonido? ultrasonido,
    DateTime? ahora,
  }) {
    final t = ahora ?? DateTime.now();
    final nuevas = <String>[];
    final condiciones = <String, _Condicion>{};

    final u = ultrasonido;
    if (u != null) {
      final f = u.frenteValido;
      final a = u.atrasValido;
      if (!u.frenteOk) {
        condiciones['fallo_sensor_frente'] = const _Condicion(
          NivelAlerta.critica,
          'Fallo de sensor frontal (sin eco)',
          'El HC-SR04P delantero no responde: avance, giros y autónomo bloqueados.',
        );
      } else if (f != null && f < umbralParadaCm) {
        condiciones['obstaculo_frente'] = _Condicion(
          NivelAlerta.critica,
          'Parada por obstáculo frontal',
          'Obstáculo a ${f.toStringAsFixed(0)} cm (< 20 cm): robot detenido. '
              'Solo se permite retroceder.',
        );
      } else if (f != null && f < umbralAvisoCm) {
        condiciones['proximidad_frente'] = _Condicion(
          NivelAlerta.aviso,
          'Proximidad frontal',
          'Objeto a ${f.toStringAsFixed(0)} cm (zona de aviso 20–50 cm).',
        );
      }
      if (!u.atrasOk) {
        condiciones['fallo_sensor_atras'] = const _Condicion(
          NivelAlerta.critica,
          'Fallo de sensor trasero (sin eco)',
          'El HC-SR04P trasero no responde: retroceso bloqueado.',
        );
      } else if (a != null && a < umbralParadaCm) {
        condiciones['obstaculo_atras'] = _Condicion(
          NivelAlerta.aviso,
          'Obstáculo trasero',
          'Objeto a ${a.toStringAsFixed(0)} cm detrás: retroceso bloqueado.',
        );
      }
    }

    final e = estado;
    if (e != null) {
      if (e.bateriaCritica) {
        condiciones['bateria_critica'] = _Condicion(
          NivelAlerta.critica,
          'Batería crítica',
          '${e.bateriaV.toStringAsFixed(2)} V (≤ 10,30 V). Volver a la base a cargar.',
        );
      }
      if (e.parada == 'corte_bateria') {
        condiciones['corte_bateria'] = _Condicion(
          NivelAlerta.critica,
          'Corte por batería (≤ 9,90 V)',
          'Motores bloqueados con ${e.bateriaV.toStringAsFixed(2)} V. Se libera '
              'por encima de 10,10 V y con una orden nueva.',
        );
      }
      if (e.parada == 'timeout') {
        condiciones['timeout_manual'] = const _Condicion(
          NivelAlerta.aviso,
          'Detenido por inactividad (5 s)',
          'Modo manual sin órdenes: el robot frenó y espera una orden nueva.',
        );
      }
    }

    // Activar o actualizar
    condiciones.forEach((String clave, _Condicion c) {
      final existente = _activas[clave];
      if (existente == null) {
        _activas[clave] = AlertaActiva(
          clave: clave,
          nivel: c.nivel,
          titulo: c.titulo,
          detalle: c.detalle,
          desde: t,
          origen: OrigenAlerta.telemetria,
        );
        _registrar(clave, c.nivel, c.titulo, AccionAlerta.activada,
            OrigenAlerta.telemetria, t);
        nuevas.add(clave);
      } else {
        existente
          ..detalle = c.detalle
          ..titulo = c.titulo;
      }
    });

    // Despejar las de condición que ya no se cumplen (pasada la gracia)
    final aBorrar = <String>[];
    _activas.forEach((String clave, AlertaActiva a) {
      if (a.persistente || condiciones.containsKey(clave)) return;
      if (!_evaluable(clave, estado, ultrasonido)) return;
      if (t.difference(a.desde) < gracia) return;
      aBorrar.add(clave);
    });
    for (final clave in aBorrar) {
      final a = _activas.remove(clave)!;
      _registrar(clave, a.nivel, a.titulo, AccionAlerta.despejada, a.origen, t);
    }
    return nuevas;
  }

  /// Registra una alerta publicada por el robot en `robot/alertas`:
  /// `{"n":7,"tipo":"obstaculo","prueba":false,"valor":14.2,"t":118340}`.
  /// Devuelve la clave si con esto se ACTIVÓ una alerta nueva.
  String? registrarDelRobot(Map<String, dynamic> json, {DateTime? ahora}) {
    final t = ahora ?? DateTime.now();
    final tipo = json['tipo'] is String ? json['tipo'] as String : 'desconocida';
    final prueba = json['prueba'] == true;
    final valor = json['valor'] is num ? (json['valor'] as num).toDouble() : null;
    final d = _describirTipoRobot(tipo, valor, prueba);

    final existente = _activas[d.clave];
    if (existente != null) {
      existente.confirmadaPorRobot = true;
      existente.origen = OrigenAlerta.robot;
      _registrar(d.clave, d.nivel, '${d.titulo} (robot)', AccionAlerta.activada,
          OrigenAlerta.robot, t);
      return null;
    }
    _activas[d.clave] = AlertaActiva(
      clave: d.clave,
      nivel: d.nivel,
      titulo: d.titulo,
      detalle: d.detalle,
      desde: t,
      origen: OrigenAlerta.robot,
      persistente: d.persistente,
    )..confirmadaPorRobot = true;
    _registrar(d.clave, d.nivel, d.titulo, AccionAlerta.activada,
        OrigenAlerta.robot, t);
    return d.clave;
  }

  /// El operador reconoce una alerta. Las persistentes (eventos) se cierran;
  /// las de condición quedan en la lista, fuera del banner, hasta despejarse.
  void reconocer(String clave, {DateTime? ahora}) {
    final a = _activas[clave];
    if (a == null || a.reconocida) return;
    final t = ahora ?? DateTime.now();
    a.reconocida = true;
    _registrar(clave, a.nivel, a.titulo, AccionAlerta.reconocida, a.origen, t);
    if (a.persistente) _activas.remove(clave);
  }

  /// Reconoce todas las alertas pendientes.
  void reconocerTodas({DateTime? ahora}) {
    for (final clave in _activas.keys.toList()) {
      reconocer(clave, ahora: ahora);
    }
  }

  /// Vacía alertas y registro (al detener el demo o reiniciar la sesión).
  void reiniciar() {
    _activas.clear();
    _eventos.clear();
  }

  // ------------------------------------------------------------ internos

  /// Solo se despeja una alerta si el dato que la decide está presente.
  bool _evaluable(String clave, Estado? e, Ultrasonido? u) {
    switch (clave) {
      case 'bateria_critica':
      case 'corte_bateria':
      case 'timeout_manual':
        return e != null;
      default:
        return u != null;
    }
  }

  void _registrar(String clave, NivelAlerta nivel, String titulo,
      AccionAlerta accion, OrigenAlerta origen, DateTime hora) {
    _eventos.insert(
      0,
      EventoAlerta(
        hora: hora,
        clave: clave,
        nivel: nivel,
        titulo: titulo,
        accion: accion,
        origen: origen,
      ),
    );
    if (_eventos.length > maxEventos) _eventos.removeLast();
  }

  static _DescripcionRobot _describirTipoRobot(
      String tipo, double? valor, bool prueba) {
    final sufijo = prueba ? ' (prueba)' : '';
    switch (tipo) {
      case 'obstaculo':
        return _DescripcionRobot(
          'obstaculo_frente',
          NivelAlerta.critica,
          'Parada por obstáculo frontal',
          valor != null
              ? 'El robot frenó: obstáculo a ${valor.toStringAsFixed(0)} cm.'
              : 'El robot frenó por un obstáculo frontal.',
        );
      case 'obstaculo_atras':
        return _DescripcionRobot(
          'obstaculo_atras',
          NivelAlerta.aviso,
          'Obstáculo trasero',
          valor != null
              ? 'Retroceso bloqueado: objeto a ${valor.toStringAsFixed(0)} cm.'
              : 'Retroceso bloqueado por un objeto detrás.',
        );
      case 'fallo_sensor_frente':
        return const _DescripcionRobot(
          'fallo_sensor_frente',
          NivelAlerta.critica,
          'Fallo de sensor frontal (sin eco)',
          'El robot reporta 600 ms sin eco delantero: avance bloqueado.',
        );
      case 'fallo_sensor_atras':
        return const _DescripcionRobot(
          'fallo_sensor_atras',
          NivelAlerta.critica,
          'Fallo de sensor trasero (sin eco)',
          'El robot reporta 600 ms sin eco trasero: retroceso bloqueado.',
        );
      case 'bateria_baja':
        // Aviso preventivo del robot (≤ 10,30 V): misma condición que la
        // "Batería crítica" que la app deduce de la telemetría.
        return _DescripcionRobot(
          'bateria_critica',
          NivelAlerta.critica,
          'Batería crítica',
          valor != null
              ? 'El robot avisa: ${valor.toStringAsFixed(2)} V (≤ 10,30 V). Volver a cargar.'
              : 'El robot avisa batería ≤ 10,30 V. Volver a cargar.',
        );
      case 'bateria_critica':
        // Corte de seguridad del firmware (≤ 9,90 V): motores bloqueados.
        return _DescripcionRobot(
          'corte_bateria',
          NivelAlerta.critica,
          'Corte por batería (≤ 9,90 V)',
          valor != null
              ? 'Motores bloqueados con ${valor.toStringAsFixed(2)} V. Se libera '
                  'por encima de 10,10 V y con una orden nueva.'
              : 'Motores bloqueados por batería. Se libera por encima de 10,10 V.',
        );
      case 'timeout_manual':
        return const _DescripcionRobot(
          'timeout_manual',
          NivelAlerta.aviso,
          'Detenido por inactividad (5 s)',
          'Modo manual sin órdenes: el robot frenó y espera una orden nueva.',
        );
      case 'antirrobo':
      case 'antirrobo_imu':
        return _DescripcionRobot(
          'antirrobo',
          prueba ? NivelAlerta.aviso : NivelAlerta.critica,
          'Alarma antirrobo$sufijo',
          prueba
              ? 'Alarma de prueba (botón BOOT o tecla t).'
              : 'Movimiento sin orden detectado por el robot.',
          persistente: true,
        );
      default:
        return _DescripcionRobot(
          'robot_$tipo',
          NivelAlerta.aviso,
          'Alerta del robot: $tipo$sufijo',
          valor != null ? 'Valor: $valor' : 'Sin detalle.',
          persistente: true,
        );
    }
  }
}

class _Condicion {
  const _Condicion(this.nivel, this.titulo, this.detalle);
  final NivelAlerta nivel;
  final String titulo;
  final String detalle;
}

class _DescripcionRobot {
  const _DescripcionRobot(
    this.clave,
    this.nivel,
    this.titulo,
    this.detalle, {
    this.persistente = false,
  });
  final String clave;
  final NivelAlerta nivel;
  final String titulo;
  final String detalle;
  final bool persistente;
}
