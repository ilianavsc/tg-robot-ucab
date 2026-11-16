import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import 'package:uuid/uuid.dart';

import '../models/estado.dart';

/// Estado del enlace con el broker, para que la UI muestre el semáforo.
enum EstadoConexion { desconectado, conectando, conectado, error }

/// Cliente MQTT de la app: conecta, se suscribe a la telemetría del robot y
/// decodifica el JSON en objetos [Estado].
///
/// Reglas de diseño (las mismas del firmware, para no bloquear la UI):
///  * Ningún `await` bloquea el hilo principal: todo pasa por `Future` y `Timer`.
///  * La reconexión la maneja un `Timer` con espera creciente 3 s → 6 s → 12 s →
///    24 s → 30 s (tope). Por eso `autoReconnect` del cliente queda **apagado**:
///    si estuviera encendido habría dos reintentos compitiendo.
///  * El `clientId` es único (UUID) para que dos teléfonos no se expulsen entre sí.
///
/// Limitación conocida: esto usa TCP plano 1883, que sirve en Android, iOS,
/// Windows y macOS. Para Flutter **web** (Chrome) hace falta WebSocket
/// (`wss://broker.hivemq.com:8884/mqtt`) con `MqttBrowserClient`; se resuelve
/// cuando la app tenga que correr en navegador.
class MqttService extends ChangeNotifier {
  MqttService({
    this.host = 'broker.hivemq.com',
    this.puerto = 1883,
    this.topicoEstado = 'ucab-tg-sf/robot/estado',
  }) {
    // Una sola escucha para toda la vida del servicio: el stream `updates`
    // es único y escucharlo dos veces duplicaría los mensajes.
    _suscripcion = _cliente.updates!.listen(_procesarMensajes);
  }

  /// Broker público de desarrollo (el mismo que usa el ESP32).
  final String host;
  final int puerto;

  /// Tópico de telemetría del robot (QoS 0, cada 2 s).
  final String topicoEstado;

  static const Duration _esperaMinima = Duration(seconds: 3);
  static const Duration _esperaMaxima = Duration(seconds: 30);

  /// Si no llega telemetría en este tiempo, se considera el enlace caído.
  static const Duration _limiteSinDatos = Duration(seconds: 8);

  late final MqttServerClient _cliente = _crearCliente();
  StreamSubscription<List<MqttReceivedMessage<MqttMessage>>>? _suscripcion;
  Timer? _temporizadorReintento;
  Duration _esperaActual = _esperaMinima;

  bool _descartado = false;
  bool _desconexionManual = false;

  EstadoConexion _conexion = EstadoConexion.desconectado;
  Estado? _ultimoEstado;
  DateTime? _ultimoMensaje;
  String? _ultimoError;

  // ------------------------------------------------------------- getters

  EstadoConexion get conexion => _conexion;

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

  /// Segundos del temporizador de reconexión actual (para mostrarlo en la UI).
  Duration get esperaReintento => _esperaActual;

  // ------------------------------------------------------------ acciones

  /// Conecta con el broker y se suscribe a la telemetría.
  ///
  /// No lanza excepciones: cualquier fallo deja [_conexion] en
  /// [EstadoConexion.error], guarda el motivo en [ultimoError] y programa un
  /// reintento automático.
  Future<void> conectar() async {
    if (_descartado) return;
    _desconexionManual = false;
    if (_conexion == EstadoConexion.conectando) return;
    if (_cliente.connectionStatus?.state == MqttConnectionState.connected) return;

    _temporizadorReintento?.cancel();
    _cambiarConexion(EstadoConexion.conectando);

    try {
      await _cliente.connect();
      if (_cliente.connectionStatus?.state != MqttConnectionState.connected) {
        throw StateError('el broker no confirmó la conexión');
      }
      _cliente.subscribe(topicoEstado, MqttQos.atMostOnce);
      _esperaActual = _esperaMinima;
      _ultimoError = null;
      _cambiarConexion(EstadoConexion.conectado);
    } catch (e) {
      _ultimoError = 'No se pudo conectar: $e';
      try {
        _cliente.disconnect();
      } catch (_) {
        // el cliente podía no estar conectado; el error no aporta nada
      }
      _cambiarConexion(EstadoConexion.error);
      _programarReintento();
    }
  }

  /// Cierra la conexión y desactiva los reintentos hasta el próximo [conectar].
  void desconectar() {
    _desconexionManual = true;
    _temporizadorReintento?.cancel();
    _esperaActual = _esperaMinima;
    try {
      _cliente.disconnect();
    } catch (_) {
      // cerrar una conexión ya cerrada no es un fallo
    }
    _cambiarConexion(EstadoConexion.desconectado);
  }

  @override
  void dispose() {
    _descartado = true;
    _temporizadorReintento?.cancel();
    _suscripcion?.cancel();
    try {
      _cliente.disconnect();
    } catch (_) {
      // nada que hacer al liberar
    }
    super.dispose();
  }

  // ------------------------------------------------------------ internos

  MqttServerClient _crearCliente() {
    final idCliente = 'ucab-app-${const Uuid().v4().substring(0, 8)}';
    final cliente = MqttServerClient.withPort(host, idCliente, puerto);
    cliente.logging(on: false);
    cliente.keepAlivePeriod = 20;
    cliente.connectTimeoutPeriod = 5000;
    cliente.autoReconnect = false; // los reintentos los maneja _programarReintento
    cliente.onConnected = _alConectar;
    cliente.onDisconnected = _alDesconectar;
    return cliente;
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
      final publicacion = evento.payload as MqttPublishMessage;
      final texto =
          MqttPublishPayload.bytesToStringAsString(publicacion.payload.message);
      _decodificarEstado(texto);
    }
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
