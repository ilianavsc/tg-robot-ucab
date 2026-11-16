/// Catálogo de brokers para las pruebas.
///
/// **Orden de intento:** el servicio prueba el primero de la lista y, si falla
/// dos veces, pasa al siguiente. Ahora **Local es el primero** para poder
/// probar sin internet (el ISP bloquea los WebSockets externos).
///
/// ⚠️ Para la prueba con el robot real: el ESP32 publica en HiveMQ, así que hay
/// que dejar `HiveMQ` como primera entrada (mover el bloque "Local" al final) o
/// reflashear el firmware con `MQTT_BROKER` apuntando al broker local.
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

/// Orden de intento: local primero (sin internet), luego los públicos.
const List<BrokerEndpoint> brokers = <BrokerEndpoint>[
  // Mosquitto instalado en esta PC: TCP 1883 y WebSocket 9001 sin TLS.
  BrokerEndpoint(
    nombre: 'Local',
    host: 'localhost',
    puertoNativo: 1883,
    puertoWeb: 9001,
    seguroWeb: false,
  ),
  BrokerEndpoint(
    nombre: 'HiveMQ',
    host: 'broker.hivemq.com',
    puertoNativo: 1883,
    puertoWeb: 8884,
  ),
  // WebSocket SIN cifrar de EMQX: sirve para diagnosticar bloqueos de WSS.
  BrokerEndpoint(
    nombre: 'EMQX',
    host: 'broker.emqx.io',
    puertoNativo: 1883,
    puertoWeb: 8083,
    seguroWeb: false,
  ),
  BrokerEndpoint(
    nombre: 'Mosquitto',
    host: 'test.mosquitto.org',
    puertoNativo: 1883,
    puertoWeb: 8081,
  ),
];
