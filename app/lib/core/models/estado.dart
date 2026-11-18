/// Modelo de la telemetría que publica el robot en `ucab-tg-sf/robot/estado`.
///
/// Las claves JSON son **exactamente** las del firmware
/// `firmware/robot_integrado.ino` (función `publicarEstado()`):
///
///   n · estado · bateria · bateria_v · ordenes · linea_mm · v_izq · v_der ·
///   parada · t
///
/// `parada` (opcional) es el motivo por el que el firmware tiene los motores en
/// 0: `ninguna`, `obstaculo_frente`, `obstaculo_atras`, `fallo_sensor_frente`,
/// `fallo_sensor_atras`, `corte_bateria`, `timeout`, `red` o `arranque`. Los robots anteriores
/// a este campo no lo mandan: queda en `ninguna`.
///
/// Ojo con dos nombres: el firmware usa `n` (contador de estados), **no** `id`,
/// y `estado` ("autonomo" | "manual"), **no** `modo`. Usar otros nombres haría
/// que el parser devolviera valores por defecto sin lanzar ningún error.
///
/// Ejemplo real capturado del monitor serie:
/// ```json
/// {"n":42,"estado":"autonomo","bateria":87,"bateria_v":11.94,"ordenes":3,
///  "linea_mm":-2.1,"v_izq":0.41,"v_der":0.52,"t":118340}
/// ```
///
/// Este archivo es Dart puro (no importa Flutter) para poder probarlo con
/// `flutter test` sin levantar la UI.
class Estado {
  /// Contador de estados que lleva el robot (`n`). Sirve para detectar
  /// mensajes repetidos o perdidos.
  final int numero;

  /// Modo de operación del robot (`estado`): `autonomo` o `manual`.
  final String modo;

  /// Batería en porcentaje 0-100 (`bateria`). 9,9 V = 0 %, 12,6 V = 100 %.
  final int bateria;

  /// Tensión medida en la batería, en voltios (`bateria_v`).
  final double bateriaV;

  /// Cuántas órdenes lleva recibidas el robot (`ordenes`).
  final int ordenes;

  /// Posición de la línea respecto al centro, en mm (`linea_mm`).
  /// Positivo = la línea está a la izquierda.
  final double lineaMm;

  /// Velocidad de la rueda izquierda en m/s, con signo (`v_izq`).
  final double vIzq;

  /// Velocidad de la rueda derecha en m/s, con signo (`v_der`).
  final double vDer;

  /// `millis()` del robot en el momento de publicar (`t`). Es el reloj del
  /// ESP32, no el del teléfono.
  final int t;

  /// Motivo de la parada activa (`parada`), o `ninguna`.
  final String parada;

  const Estado({
    required this.numero,
    required this.modo,
    required this.bateria,
    required this.bateriaV,
    required this.ordenes,
    required this.lineaMm,
    required this.vIzq,
    required this.vDer,
    required this.t,
    this.parada = 'ninguna',
  });

  /// Construye el modelo a partir del JSON recibido.
  ///
  /// Tolera campos ausentes o de otro tipo numérico (el firmware manda
  /// `11.94` como decimal y `87` como entero) sin lanzar excepciones:
  /// si un campo falta, queda en su valor por defecto.
  factory Estado.fromJson(Map<String, dynamic> json) {
    return Estado(
      numero: _entero(json['n']),
      modo: json['estado'] is String ? json['estado'] as String : 'desconocido',
      bateria: _entero(json['bateria']),
      bateriaV: _decimal(json['bateria_v']),
      ordenes: _entero(json['ordenes']),
      lineaMm: _decimal(json['linea_mm']),
      vIzq: _decimal(json['v_izq']),
      vDer: _decimal(json['v_der']),
      t: _entero(json['t']),
      parada: json['parada'] is String ? json['parada'] as String : 'ninguna',
    );
  }

  /// Vuelve a JSON (útil para depurar o para reenviar el estado).
  Map<String, dynamic> toJson() => <String, dynamic>{
        'n': numero,
        'estado': modo,
        'bateria': bateria,
        'bateria_v': bateriaV,
        'ordenes': ordenes,
        'linea_mm': lineaMm,
        'v_izq': vIzq,
        'v_der': vDer,
        'parada': parada,
        't': t,
      };

  // ---------------------------------------------------------------- ayudas

  /// `true` si el robot va siguiendo la línea con el PD.
  bool get esAutonomo => modo == 'autonomo';

  /// `true` si el robot obedece órdenes manuales.
  bool get esManual => modo == 'manual';

  /// Umbral de aviso de batería baja: 20 % (≈ 10,4 V en una 3S).
  bool get bateriaBaja => bateria <= 20;

  /// `true` si hay una tensión medida (> 1 V). Un `0.00 V` es el robot en
  /// reposo / sin batería conectada (o la telemetría en cero): no es alarma.
  bool get hayBateriaMedida => bateriaV > 1.0;

  /// Batería crítica (P11): ≤ 10,3 V con batería medida.
  bool get bateriaCritica => hayBateriaMedida && bateriaV <= 10.3;

  /// `true` si el firmware informa que los motores están parados por seguridad.
  bool get detenidoPorSeguridad => parada != 'ninguna' && parada != 'arranque';

  /// Velocidad media de las dos ruedas (m/s). En recta = velocidad real.
  double get velocidadMedia => (vIzq + vDer) / 2;

  /// `true` si los sensores están viendo la línea (error dentro de la regleta).
  /// Con 4 sensores separados 18 mm, el error máximo es ±32 mm cuando la pierde.
  bool get veLaLinea => lineaMm.abs() < 32;

  /// `t` convertido a segundos, para mostrar en la UI.
  double get segundosEncendido => t / 1000.0;

  /// Segundos desde que el robot arrancó según su propio reloj.
  String get tiempoEncendido {
    final total = (t / 1000).floor();
    final m = (total ~/ 60).toString().padLeft(2, '0');
    final s = (total % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  static int _entero(dynamic v) {
    if (v is int) return v;
    if (v is double) return v.round();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  static double _decimal(dynamic v) {
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }

  @override
  String toString() =>
      'Estado(n=$numero, modo=$modo, bateria=$bateria%, ${bateriaV.toStringAsFixed(2)} V, '
      'ordenes=$ordenes, linea=${lineaMm.toStringAsFixed(1)} mm, '
      'v=$vIzq/$vDer m/s, parada=$parada, t=$t)';
}
