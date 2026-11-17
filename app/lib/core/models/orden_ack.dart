/// Confirmación (ack) que el robot publica en `ucab-tg-sf/robot/ordenes/ack`.
///
/// El robot real (`firmware/robot_integrado.ino`) y el ESP32 virtual (P10)
/// responden cada orden con el mismo JSON:
///
/// ```json
/// {"id":"<id de la orden>","recibidas":3,"t":29452}
/// ```
class OrdenAck {
  const OrdenAck({
    required this.id,
    required this.llegada,
    this.recibidas,
    this.t,
    this.comando,
    this.latencia,
    this.propia = false,
    this.repetida = false,
    this.simulada = false,
  });

  /// Id de la orden que se confirma.
  final String id;

  /// Hora del teléfono en que llegó la confirmación.
  final DateTime llegada;

  /// Cuántas órdenes lleva recibidas el robot (`recibidas`).
  final int? recibidas;

  /// Milisegundos desde que arrancó el robot (`t`).
  final int? t;

  /// Comando que se había enviado (solo si la orden salió de esta app).
  final String? comando;

  /// Tiempo entre enviar la orden y recibir su confirmación.
  final Duration? latencia;

  /// `true` si la orden la envió esta app (y no el banco P01 u otra pestaña).
  final bool propia;

  /// `true` si ya había llegado una confirmación para el mismo id (QoS 1 puede repetir).
  final bool repetida;

  /// `true` si la generó el Modo Demo (sin red).
  final bool simulada;

  /// Lee el JSON del robot. Los números pueden venir como int o double.
  factory OrdenAck.fromJson(
    Map<String, dynamic> json, {
    required DateTime llegada,
    String? comando,
    Duration? latencia,
    bool propia = false,
    bool repetida = false,
  }) {
    final dynamic recibidas = json['recibidas'];
    final dynamic t = json['t'];
    return OrdenAck(
      id: json['id']?.toString() ?? 'sin-id',
      llegada: llegada,
      recibidas: recibidas is num ? recibidas.toInt() : null,
      t: t is num ? t.toInt() : null,
      comando: comando,
      latencia: latencia,
      propia: propia,
      repetida: repetida,
    );
  }
}
