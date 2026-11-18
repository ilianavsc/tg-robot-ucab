/// Lecturas de los 2 sensores ultrasónicos HC-SR04P que publica el robot en
/// `ucab-tg-sf/robot/ultrasonido` (QoS 0).
///
/// ```json
/// {"frente_cm":84.0,"atras_cm":151.5,"t":29452}
/// ```
///
/// `frente_cm` es el sensor que mira hacia adelante y `atras_cm` el que mira
/// hacia atrás. Si un sensor no recibe eco, su valor puede faltar o ir en
/// `null`: en ese caso queda en `null` aquí y la pantalla muestra "sin eco".
///
/// Dart puro (no importa Flutter) para poder probarlo con `flutter test`.
class Ultrasonido {
  const Ultrasonido({
    this.frenteCm,
    this.atrasCm,
    required this.llegada,
    this.t,
  });

  /// Distancia al frente, en centímetros (`frente_cm`). `null` si no hubo eco.
  final double? frenteCm;

  /// Distancia atrás, en centímetros (`atras_cm`). `null` si no hubo eco.
  final double? atrasCm;

  /// Hora del teléfono en que llegó el mensaje.
  final DateTime llegada;

  /// Milisegundos desde que arrancó el robot (`t`), si el mensaje lo trae.
  final int? t;

  /// Lee el JSON del robot. Lanza [FormatException] si no trae ninguna de las
  /// dos distancias, para no mostrar ceros inventados.
  factory Ultrasonido.fromJson(Map<String, dynamic> json, {DateTime? llegada}) {
    final Object? frente = json['frente_cm'];
    final Object? atras = json['atras_cm'];
    if (frente is! num && atras is! num) {
      throw const FormatException('faltan frente_cm y atras_cm');
    }
    final Object? t = json['t'];
    return Ultrasonido(
      frenteCm: frente is num ? frente.toDouble() : null,
      atrasCm: atras is num ? atras.toDouble() : null,
      llegada: llegada ?? DateTime.now(),
      t: t is num ? t.toInt() : null,
    );
  }
}
