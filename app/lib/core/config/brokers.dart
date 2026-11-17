/// Catálogo de brokers para las pruebas y telemetría en vivo.
///
/// **Orden de intento:** sincronizado exactamente con P10 (HiveMQ → EMQX → Mosquitto → Local).
/// En celular y web sobre HTTPS, los brokers seguros (WSS) van primero para evitar
/// que el navegador móvil bloquee la conexión por Mixed Content (ws://).
class BrokerEndpoint {
  const BrokerEndpoint({
    required this.nombre,
    required this.host,
    required this.puertoNativo,
    required this.puertoWeb,
    this.seguroWeb = true,
  });

  /// Nombre corto para mostrar en logs.
  final String nombre;

  /// Host TCP/WS.
  final String host;

  /// Puerto TCP plano (Android, iOS, desktop, y terminal de pruebas).
  final int puertoNativo;

  /// Puerto WebSocket (Chrome).
  final int puertoWeb;

  /// `true` = `wss://` (TLS), `false` = `ws://` (sin cifrar).
  final bool seguroWeb;

  /// Esquema del WebSocket según el broker.
  String get esquemaWeb => seguroWeb ? 'wss' : 'ws';

  /// URL completa que espera `MqttBrowserClient`.
  String get urlWeb => '$esquemaWeb://$host:$puertoWeb/mqtt';
}

/// Orden de intento sincronizado con P10: HiveMQ → EMQX → Mosquitto → Local.
const List<BrokerEndpoint> brokers = <BrokerEndpoint>[
  BrokerEndpoint(
    nombre: 'HiveMQ',
    host: 'broker.hivemq.com',
    puertoNativo: 1883,
    puertoWeb: 8884,
    seguroWeb: true,
  ),
  BrokerEndpoint(
    nombre: 'EMQX',
    host: 'broker.emqx.io',
    puertoNativo: 1883,
    puertoWeb: 8084,
    seguroWeb: true,
  ),
  BrokerEndpoint(
    nombre: 'Mosquitto',
    host: 'test.mosquitto.org',
    puertoNativo: 1883,
    puertoWeb: 8081,
    seguroWeb: true,
  ),
  // Mosquitto local: TCP 1883 y WebSocket 9001 sin TLS (al final).
  BrokerEndpoint(
    nombre: 'Local',
    host: 'localhost',
    puertoNativo: 1883,
    puertoWeb: 9001,
    seguroWeb: false,
  ),
];
