import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:uuid/uuid.dart';

import '../config/brokers.dart';
import '../models/estado.dart';
import 'mqtt_client_platform_stub.dart'
    if (dart.library.io) 'mqtt_client_platform_io.dart'
    if (dart.library.js_interop) 'mqtt_client_platform_web.dart';

/// Estado del enlace con el broker, para que la UI muestre el semáforo.
enum EstadoConexion { desconectado, conectando, conectado, error }

/// Cliente MQTT de la app: conecta, se suscribe a la telemetría del robot y
/// decodifica el JSON en objetos [Estado].
///
/// Reglas de diseño (las mismas del firmware, para no bloquear la UI):
///  * Ningún `await` bloquea el hilo principal: todo pasa por `Future` y `Timer`.
///  * La reconexión la maneja un `Timer` con espera creciente 3 s → 6 s → 12 s →
///    24 s → 30 s (tope). Por eso `autoReconnect` del cliente queda **apagado**.
///  * **Respaldo de broker:** si un broker falla [_intentosPorBroker] veces
///    seguidas, se pasa al siguiente de la lista [brokers] (HiveMQ → EMQX →
///    Mosquitto → vuelta a empezar). Cada intento crea un cliente nuevo con un
///    `clientId` UUID distinto.
///  * El stream `updates` se crea dentro de `connect()`: se escucha **después**
///    de conectar y se reengancha en cada conexión, nunca en el constructor.
///
/// Limitación conocida: TCP plano 1883 en nativo; WebSocket `wss` en web.
class MqttService extends ChangeNotifier {
  MqttService({this.topicoEstado = 'ucab-tg-sf/robot/estado'});

  /// Tópico de telemetría del robot (QoS 0, cada 2 s).
  final String topicoEstado;

  static const Duration _esperaMinima = Duration(seconds: 3);
  static const Duration _esperaMaxima = Duration(seconds: 30);

  /// Si no llega telemetría en este tiempo, se considera el enlace caído.
  static const Duration _limiteSinDatos = Duration(seconds: 8);

  /// Intentos contra un mismo broker antes de saltar al de respaldo.
  static const int _intentosPorBroker = 2;

  MqttClient? _cliente;
  StreamSubscription<List<MqttReceivedMessage<MqttMessage>>>? _suscripcion;
  Timer? _temporizadorReintento;
  Duration _esperaActual = _esperaMinima;

  // Modo Demo (telemetría simulada, sin red)
  static const Duration _periodoDemo = Duration(seconds: 2);
  Timer? _temporizadorDemo;
  int _pasoDemo = 0;
  int _tDemo = 0;
  bool _simulando = false;

  int _indiceBroker = 0;
  int _intentosEnBroker = 0;

  bool _descartado = false;
  bool _desconexionManual = false;

  EstadoConexion _conexion = EstadoConexion.desconectado;
  Estado? _ultimoEstado;
  DateTime? _ultimoMensaje;
  String? _ultimoError;

  // ------------------------------------------------------------- getters

  EstadoConexion get conexion => _conexion;

  /// Broker que se está usando ahora mismo.
  BrokerEndpoint get broker => brokers[_indiceBroker];

  /// Nombre corto del broker activo (`HiveMQ`, `EMQX`, `Mosquitto`).
  String get nombreBroker => broker.nombre;

  /// Host del broker activo (la pantalla lo muestra sin cambios de UI).
  String get host => broker.host;

  /// Puerto real: 1883/8884 en HiveMQ, 1883/8084 en EMQX, 1883/8081 en Mosquitto.
  int get puertoEfectivo => kIsWeb ? broker.puertoWeb : broker.puertoNativo;

  /// Intentos fallidos contra el broker actual (0, 1 o 2).
  int get intentosEnBroker => _intentosEnBroker;

  /// Última telemetría válida recibida (null hasta el primer mensaje).
  Estado? get ultimoEstado => _ultimoEstado;

  /// Momento en que llegó el último mensaje (hora del teléfono).
  DateTime? get ultimoMensaje => _ultimoMensaje;

  /// Último error legible (conexión o JSON inválido).
  String? get ultimoError => _ultimoError;

  bool get conectado => _conexion == EstadoConexion.conectado;

  /// `true` si llegó telemetría hace menos de 8 s: el robot está vivo.
  bool get recibiendoDatos {
    final ultimo = _ultimoMensaje;
    if (ultimo == null) return false;
    return DateTime.now().difference(ultimo) < _limiteSinDatos;
  }

  /// Segundos desde el último mensaje (para mostrar "sin datos hace X s").
  int get segundosSinDatos {
    final ultimo = _ultimoMensaje;
    if (ultimo == null) return -1;
    return DateTime.now().difference(ultimo).inSeconds;
  }

  /// Espera del próximo reintento (para diagnóstico).
  Duration get esperaReintento => _esperaActual;

  // ------------------------------------------------------------ acciones

  /// Conecta con el broker activo y se suscribe a la telemetría.
  ///
  /// No lanza excepciones: cualquier fallo deja [_conexion] en
  /// [EstadoConexion.error], guarda el motivo en [ultimoError] y programa un
  /// reintento; al segundo fallo cambia de broker.
  Future<void> conectar() async {
    if (_descartado) return;
    if (_simulando) detenerSimulacion(); // pulsar Conectar apaga el demo
    _desconexionManual = false;
    if (_conexion == EstadoConexion.conectando) return;

    final cliente = _cliente ??= _crearCliente();
    if (cliente.connectionStatus?.state == MqttConnectionState.connected) return;

    _temporizadorReintento?.cancel();
    _cambiarConexion(EstadoConexion.conectando);

    try {
      await cliente.connect();
      if (cliente.connectionStatus?.state != MqttConnectionState.connected) {
        throw StateError('${broker.nombre} no confirmó la conexión');
      }
      cliente.subscribe(topicoEstado, MqttQos.atMostOnce);
      // El stream `updates` se crea dentro de connect(): hay que escucharlo
      // aquí y no en el constructor, donde todavía es null. En cada conexión
      // el gestor de suscripciones es nuevo, así que se cancela el anterior.
      _suscripcion?.cancel();
      _suscripcion = cliente.updates!.listen(_procesarMensajes);
      _esperaActual = _esperaMinima;
      _intentosEnBroker = 0;
      _ultimoError = null;
      _cambiarConexion(EstadoConexion.conectado);
    } catch (e) {
      _registrarFallo(e);
    }
  }

  /// Cierra la conexión y desactiva los reintentos hasta el próximo [conectar].
  void desconectar() {
    _desconexionManual = true;
    _temporizadorReintento?.cancel();
    _esperaActual = _esperaMinima;
    try {
      _cliente?.disconnect();
    } catch (_) {
      // cerrar una conexión ya cerrada no es un fallo
    }
    _cambiarConexion(EstadoConexion.desconectado);
  }

  // ------------------------------------------------------- Modo Demo

  /// `true` mientras la pantalla muestra datos simulados.
  bool get simulando => _simulando;

  /// Arranca el **Modo Demo**: corta el MQTT real y emite telemetría falsa
  /// cada 2 s. Sirve para mostrar la UI sin internet (demostración al jurado).
  ///
  /// Es idempotente: si ya estaba activo, lo reinicia desde el primer perfil.
  void iniciarSimulacion() {
    if (_descartado) return;
    detenerSimulacion();  // limpia temporizador previo
    desconectar();        // apaga MQTT y desactiva los reintentos
    _simulando = true;
    _pasoDemo = 0;
    _tDemo = 0;
    _emitirPasoDemo();    // primer dato inmediato, sin esperar 2 s
    _temporizadorDemo = Timer.periodic(_periodoDemo, (_) => _emitirPasoDemo());
  }

  /// Detiene el Modo Demo. No reconecta: para volver a MQTT, pulsar Conectar.
  void detenerSimulacion() {
    _temporizadorDemo?.cancel();
    _temporizadorDemo = null;
    if (!_simulando) return;
    _simulando = false;
    if (!_descartado) notifyListeners();
  }

  @override
  void dispose() {
    _descartado = true;
    _temporizadorDemo?.cancel();
    _temporizadorReintento?.cancel();
    _suscripcion?.cancel();
    try {
      _cliente?.disconnect();
    } catch (_) {
      // nada que hacer al liberar
    }
    super.dispose();
  }

  // ------------------------------------------------------------ internos

  MqttClient _crearCliente() {
    final actual = broker;
    // clientId nuevo en cada cliente: dos pestañas o dos intentos nunca chocan.
    final idCliente = 'ucab-app-${const Uuid().v4().substring(0, 8)}';
    final cliente = crearClienteMqtt(
      host: actual.host,
      puerto: kIsWeb ? actual.puertoWeb : actual.puertoNativo,
      id: idCliente,
      // 1 intento interno: los dos intentos por broker los cuenta el servicio.
      maxIntentos: 1,
      // wss:// normalmente; ws:// solo en el broker marcado como no seguro.
      seguro: actual.seguroWeb,
    );
    cliente.logging(on: false);
    cliente.keepAlivePeriod = 20;
    cliente.connectTimeoutPeriod = 6000;
    cliente.autoReconnect = false; // los reintentos los maneja _programarReintento
    cliente.onConnected = _alConectar;
    cliente.onDisconnected = _alDesconectar;
    return cliente;
  }

  /// Cuenta el fallo y, al segundo, salta al broker de respaldo.
  void _registrarFallo(Object e) {
    _intentosEnBroker++;
    final fallido = broker;
    final avanzar = _intentosEnBroker >= _intentosPorBroker;

    try {
      _cliente?.disconnect();
    } catch (_) {
      // el cliente podía no estar conectado
    }

    if (avanzar) {
      _reemplazarCliente();
      _ultimoError = '${fallido.nombre}: sin respuesta tras '
          '$_intentosPorBroker intentos. Paso a ${broker.nombre}. Detalle: $e';
    } else {
      _ultimoError = '${fallido.nombre}: intento $_intentosEnBroker de '
          '$_intentosPorBroker falló. Detalle: $e';
    }

    _cambiarConexion(EstadoConexion.error);
    _programarReintento();
  }

  /// Descarta el cliente actual y avanza al siguiente broker de la lista.
  void _reemplazarCliente() {
    _suscripcion?.cancel();
    _suscripcion = null;
    _cliente = null;
    _indiceBroker = (_indiceBroker + 1) % brokers.length;
    _intentosEnBroker = 0;
    _esperaActual = _esperaMinima;
  }

  void _alConectar() {
    _esperaActual = _esperaMinima;
    _cambiarConexion(EstadoConexion.conectado);
  }

  void _alDesconectar() {
    _cambiarConexion(EstadoConexion.desconectado);
    // Si la caída no fue pedida por el usuario, se reintenta solo.
    if (!_desconexionManual) _programarReintento();
  }

  /// Programa el próximo intento con espera creciente (3 s → 30 s).
  void _programarReintento() {
    if (_descartado || _desconexionManual) return;
    _temporizadorReintento?.cancel();

    final espera = _esperaActual;
    _esperaActual = Duration(
      milliseconds: math.min(
        _esperaActual.inMilliseconds * 2,
        _esperaMaxima.inMilliseconds,
      ),
    );

    _temporizadorReintento = Timer(espera, conectar);
  }

  void _procesarMensajes(List<MqttReceivedMessage<MqttMessage>> eventos) {
    for (final evento in eventos) {
      if (evento.topic != topicoEstado) continue;
      if (evento.payload is! MqttPublishMessage) continue;
      final publicacion = evento.payload as MqttPublishMessage;
      final texto =
          MqttPublishPayload.bytesToStringAsString(publicacion.payload.message);
      _decodificarEstado(texto);
    }
  }

  /// Genera un [Estado] falso del siguiente perfil y avisa a la UI.
  void _emitirPasoDemo() {
    if (_descartado || !_simulando) return;
    final perfil = _perfilesDemo[_pasoDemo % _perfilesDemo.length];
    _pasoDemo++;
    _tDemo += _periodoDemo.inMilliseconds;
    _ultimoEstado = Estado(
      numero: 9000 + _pasoDemo,
      modo: perfil.modo,
      bateria: perfil.bateria,
      bateriaV: perfil.bateriaV,
      ordenes: _pasoDemo,
      lineaMm: perfil.lineaMm,
      vIzq: perfil.vIzq,
      vDer: perfil.vDer,
      t: _tDemo,
    );
    _ultimoMensaje = DateTime.now();
    _ultimoError = null;
    notifyListeners();
  }

  void _decodificarEstado(String texto) {
    try {
      final mapa = jsonDecode(texto);
      if (mapa is! Map<String, dynamic>) {
        throw const FormatException('el payload no es un objeto JSON');
      }
      _ultimoEstado = Estado.fromJson(mapa);
      _ultimoMensaje = DateTime.now();
      _ultimoError = null;
    } catch (e) {
      _ultimoError = 'JSON inválido en $topicoEstado: $e';
    }
    if (!_descartado) notifyListeners();
  }

  void _cambiarConexion(EstadoConexion nuevo) {
    if (_conexion == nuevo) return;
    _conexion = nuevo;
    if (!_descartado) notifyListeners();
  }
}

/// Perfil de telemetría simulada para el Modo Demo.
class _PerfilDemo {
  const _PerfilDemo({
    required this.modo,
    required this.bateria,
    required this.bateriaV,
    required this.lineaMm,
    required this.vIzq,
    required this.vDer,
  });

  final String modo;
  final int bateria;
  final double bateriaV;
  final double lineaMm;
  final double vIzq;
  final double vDer;
}

/// Seis perfiles que rotan cada 2 s: batería alta/baja, línea centrada y
/// perdida, ruedas opuestas. Mismo guion que `tool/telemetria_pc.dart`.
const List<_PerfilDemo> _perfilesDemo = <_PerfilDemo>[
  _PerfilDemo(modo: 'autonomo', bateria: 100, bateriaV: 12.60, lineaMm: 0.0, vIzq: 0.41, vDer: 0.41),
  _PerfilDemo(modo: 'manual', bateria: 15, bateriaV: 10.35, lineaMm: 27.0, vIzq: 0.30, vDer: 0.55),
  _PerfilDemo(modo: 'autonomo', bateria: 45, bateriaV: 11.20, lineaMm: -32.4, vIzq: 0.05, vDer: 0.05),
  _PerfilDemo(modo: 'autonomo', bateria: 5, bateriaV: 9.95, lineaMm: -27.0, vIzq: 0.55, vDer: 0.30),
  _PerfilDemo(modo: 'manual', bateria: 60, bateriaV: 11.50, lineaMm: 9.0, vIzq: -0.40, vDer: 0.40),
  _PerfilDemo(modo: 'autonomo', bateria: 90, bateriaV: 12.10, lineaMm: 0.5, vIzq: 0.52, vDer: 0.52),
];
