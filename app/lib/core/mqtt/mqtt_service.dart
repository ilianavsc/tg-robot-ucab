import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:uuid/uuid.dart';

import '../alertas/centro_alertas.dart';
import '../analitica/analitica_sesion.dart';
import '../config/brokers.dart';
import '../models/estado.dart';
import '../models/orden_ack.dart';
import '../models/ultrasonido.dart';
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
  MqttService({
    this.topicoEstado = 'ucab-tg-sf/robot/estado',
    this.topicoOrdenes = 'ucab-tg-sf/robot/ordenes',
    this.topicoAck = 'ucab-tg-sf/robot/ordenes/ack',
    this.topicoUltrasonido = 'ucab-tg-sf/robot/ultrasonido',
    this.topicoAlertas = 'ucab-tg-sf/robot/alertas',
  });

  /// Tópico de telemetría del robot (QoS 0, cada 2 s).
  final String topicoEstado;

  /// Tópico donde la app publica las órdenes al robot (QoS 1).
  final String topicoOrdenes;

  /// Tópico donde el robot confirma cada orden (QoS 1).
  final String topicoAck;

  /// Tópico de los 2 sensores ultrasónicos: `frente_cm` y `atras_cm` (QoS 0).
  final String topicoUltrasonido;

  /// Tópico de alertas del robot (QoS 2): `{"n","tipo","prueba","valor","t"}`.
  final String topicoAlertas;

  /// Centro de Alertas (P11): alertas activas y registro reciente.
  final CentroAlertas centroAlertas = CentroAlertas();

  /// Analítica de la sesión (P12): se reinicia al detener el demo o a mano.
  final AnaliticaSesion analitica = AnaliticaSesion();

  /// Órdenes recientes enviadas por esta app, por id (para medir la latencia).
  static const int _maxOrdenesGuardadas = 50;

  static const Duration _esperaMinima = Duration(seconds: 1);
  static const Duration _esperaMaxima = Duration(seconds: 30);

  /// Si no llega telemetría en este tiempo, se considera el enlace caído.
  static const Duration _limiteSinDatos = Duration(seconds: 8);

  /// Intentos contra un mismo broker antes de saltar al de respaldo (1 para fallback ágil en web).
  static const int _intentosPorBroker = 1;

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
  Ultrasonido? _ultimoUltrasonido;
  DateTime? _ultimoMensaje;
  String? _ultimoError;

  final Map<String, _OrdenEnviada> _ordenes = <String, _OrdenEnviada>{};
  OrdenAck? _ultimoAck;
  String? _ultimaOrdenId;
  String? _ultimoComando;

  // ------------------------------------------------------------- getters

  EstadoConexion get conexion => _conexion;

  /// Broker que se está usando ahora mismo.
  BrokerEndpoint get broker => brokers[_indiceBroker];

  /// Índice del broker activo (0..N).
  int get indiceBroker => _indiceBroker;

  /// Lista inmutable de brokers configurados para la UI.
  List<BrokerEndpoint> get listaBrokers => brokers;

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

  /// Últimas distancias de los ultrasónicos (null hasta el primer mensaje).
  Ultrasonido? get ultimoUltrasonido => _ultimoUltrasonido;

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

  /// Última confirmación recibida en `ordenes/ack` (null hasta la primera).
  OrdenAck? get ultimoAck => _ultimoAck;

  /// Comando de la última orden que envió esta app.
  String? get ultimoComando => _ultimoComando;

  /// `true` si la última orden de esta app todavía no tiene confirmación.
  bool get esperandoAck {
    final id = _ultimaOrdenId;
    if (id == null) return false;
    return _ordenes[id]?.confirmada == null;
  }

  /// `true` si se pueden enviar órdenes (conectado al broker o en Modo Demo).
  bool get puedeEnviarOrdenes => _simulando || conectado;

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
      cliente.subscribe(topicoAck, MqttQos.atLeastOnce);
      cliente.subscribe(topicoUltrasonido, MqttQos.atMostOnce);
      cliente.subscribe(topicoAlertas, MqttQos.exactlyOnce);
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

  /// Publica una orden en [topicoOrdenes] con QoS 1, como JSON compacto
  /// `{"id":"<uuid>","cmd":"<comando>"}`. El robot la confirma en [topicoAck].
  ///
  /// Comandos que entiende el firmware: `adelante`, `atras`, `izquierda`,
  /// `derecha`, `frenar` y `auto`.
  ///
  /// Devuelve `false` (y deja el motivo en [ultimoError]) si no hay conexión.
  /// En Modo Demo no usa la red: simula la confirmación a los 300 ms.
  bool publicarOrden(String comando) {
    if (_descartado) return false;
    final id = const Uuid().v4();
    final json = jsonEncode(<String, String>{'id': id, 'cmd': comando});

    if (_simulando) {
      _guardarOrden(id, comando);
      Timer(const Duration(milliseconds: 300), () => _confirmarDemo(id));
      return true;
    }

    final cliente = _cliente;
    if (cliente == null ||
        cliente.connectionStatus?.state != MqttConnectionState.connected) {
      _ultimoError =
          'No se envió "$comando": la app no está conectada al broker.';
      notifyListeners();
      return false;
    }

    try {
      final contenido = MqttClientPayloadBuilder()..addString(json);
      cliente.publishMessage(
        topicoOrdenes,
        MqttQos.atLeastOnce,
        contenido.payload!,
      );
    } catch (e) {
      _ultimoError = 'No se envió "$comando": $e';
      notifyListeners();
      return false;
    }
    _guardarOrden(id, comando);
    return true;
  }

  /// Cambia el broker seleccionado (HiveMQ, EMQX o Mosquitto) cuando no hay una
  /// conexión activa o en curso, actualizando el host y puerto de inmediato.
  void seleccionarBroker(int indice) {
    if (indice < 0 || indice >= brokers.length) return;
    if (_conexion == EstadoConexion.conectado ||
        _conexion == EstadoConexion.conectando) {
      return;
    }
    _temporizadorReintento?.cancel();
    _cliente = null;
    _suscripcion?.cancel();
    _suscripcion = null;
    _indiceBroker = indice;
    _intentosEnBroker = 0;
    _esperaActual = _esperaMinima;
    _ultimoError = null;
    if (!_descartado) notifyListeners();
  }

  // ------------------------------------------- P11 alertas · P12 analítica

  /// El operador reconoce una alerta (sale del banner).
  void reconocerAlerta(String clave) {
    centroAlertas.reconocer(clave);
    if (!_descartado) notifyListeners();
  }

  /// Reconoce todas las alertas pendientes.
  void reconocerTodasLasAlertas() {
    centroAlertas.reconocerTodas();
    if (!_descartado) notifyListeners();
  }

  /// Pone la analítica y el Centro de Alertas a cero (botón "Reiniciar").
  void reiniciarSesion() {
    analitica.reiniciar();
    centroAlertas.reiniciar();
    if (!_descartado) notifyListeners();
  }

  /// Reporte CSV de la sesión (P12).
  String reporteCsv() =>
      analitica.toCsv(origen: _simulando ? 'Modo Demo' : 'MQTT ${broker.nombre}');

  /// Revisa la telemetría con el Centro de Alertas y cuenta las paradas de
  /// emergencia nuevas para la analítica.
  void _evaluarAlertas() {
    final nuevas = centroAlertas.evaluar(
      estado: _ultimoEstado,
      ultrasonido: _ultimoUltrasonido,
    );
    _contarParadas(nuevas);
  }

  void _contarParadas(Iterable<String> claves) {
    for (final c in claves) {
      if (CentroAlertas.clavesParadaEmergencia.contains(c)) {
        analitica.registrarParadaEmergencia();
      }
    }
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
    analitica.reiniciar();       // sesión nueva: las métricas empiezan en 0
    centroAlertas.reiniciar();
    _simulando = true;
    _pasoDemo = 0;
    _tDemo = 0;
    _emitirPasoDemo();    // primer dato inmediato, sin esperar 2 s
    _temporizadorDemo = Timer.periodic(_periodoDemo, (_) => _emitirPasoDemo());
  }

  /// Detiene el Modo Demo y reinicia explícitamente los valores de telemetría y
  /// ultrasonidos a un estado base en cero (0 %, 0.00 V, 0.0 mm, 0.00 m/s,
  /// #0, 00:00 y 0 cm 'Sin señal'), sin dejar datos residuales de la simulación.
  void detenerSimulacion() {
    _temporizadorDemo?.cancel();
    _temporizadorDemo = null;
    final bool estabaSimulando = _simulando;
    _simulando = false;
    _pasoDemo = 0;
    _tDemo = 0;
    if (estabaSimulando) {
      _ultimoEstado = const Estado(
        numero: 0,
        modo: 'manual',
        bateria: 0,
        bateriaV: 0.0,
        ordenes: 0,
        lineaMm: 0.0,
        vIzq: 0.0,
        vDer: 0.0,
        t: 0,
      );
      _ultimoUltrasonido = Ultrasonido(
        frenteCm: 0,
        atrasCm: 0,
        llegada: DateTime.fromMillisecondsSinceEpoch(0),
        t: 0,
      );
      _ultimoMensaje = null;
      // P11/P12: la sesión simulada termina con todo en cero.
      analitica.reiniciar();
      centroAlertas.reiniciar();
      if (_ultimoAck?.simulada ?? false) {
        _ultimoAck = null;
        _ultimaOrdenId = null;
        _ultimoComando = null;
        _ordenes.clear();
      }
      if (!_descartado) notifyListeners();
    }
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
    cliente.connectTimeoutPeriod = 4000;
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
    _cliente = null; // Limpiar para que el siguiente intento cree un cliente e ID nuevo

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
      if (evento.topic != topicoEstado &&
          evento.topic != topicoAck &&
          evento.topic != topicoUltrasonido &&
          evento.topic != topicoAlertas) {
        continue;
      }
      if (evento.payload is! MqttPublishMessage) continue;
      final publicacion = evento.payload as MqttPublishMessage;
      final texto =
          MqttPublishPayload.bytesToStringAsString(publicacion.payload.message);
      if (evento.topic == topicoEstado) {
        _decodificarEstado(texto);
      } else if (evento.topic == topicoUltrasonido) {
        _decodificarUltrasonido(texto);
      } else if (evento.topic == topicoAlertas) {
        _decodificarAlerta(texto);
      } else {
        _decodificarAck(texto);
      }
    }
  }

  void _guardarOrden(String id, String comando) {
    _ordenes[id] = _OrdenEnviada(comando: comando, envio: DateTime.now());
    while (_ordenes.length > _maxOrdenesGuardadas) {
      _ordenes.remove(_ordenes.keys.first);
    }
    _ultimaOrdenId = id;
    _ultimoComando = comando;
    _ultimoError = null;
    notifyListeners();
  }

  /// Lee una confirmación. Si la orden salió de esta app, calcula la latencia.
  void _decodificarAck(String texto) {
    try {
      final mapa = jsonDecode(texto);
      if (mapa is! Map<String, dynamic>) {
        throw const FormatException('el payload no es un objeto JSON');
      }
      final ahora = DateTime.now();
      final orden = _ordenes[mapa['id']?.toString()];
      final repetida = orden != null && orden.confirmada != null;
      if (orden != null && orden.confirmada == null) orden.confirmada = ahora;
      _ultimoAck = OrdenAck.fromJson(
        mapa,
        llegada: ahora,
        comando: orden?.comando,
        latencia: orden == null || repetida ? null : ahora.difference(orden.envio),
        propia: orden != null,
        repetida: repetida,
      );
    } catch (e) {
      _ultimoError = 'JSON inválido en $topicoAck: $e';
    }
    if (!_descartado) notifyListeners();
  }

  /// En Modo Demo, el "robot" confirma solo (sin red).
  void _confirmarDemo(String id) {
    if (_descartado) return;
    final orden = _ordenes[id];
    if (orden == null || orden.confirmada != null) return;
    final ahora = DateTime.now();
    orden.confirmada = ahora;
    _ultimoAck = OrdenAck(
      id: id,
      llegada: ahora,
      recibidas: _ordenes.values.where((o) => o.confirmada != null).length,
      t: _tDemo,
      comando: orden.comando,
      latencia: ahora.difference(orden.envio),
      propia: true,
      simulada: true,
    );
    notifyListeners();
  }

  /// Genera un [Estado] falso del siguiente perfil y avisa a la UI.
  ///
  /// Aplica la MISMA regla de seguridad del firmware y del P10: con obstáculo
  /// frontal < 20 cm o el sensor delantero en fallo, las ruedas quedan en 0 y
  /// el estado lleva el motivo en `parada`.
  void _emitirPasoDemo() {
    if (_descartado || !_simulando) return;
    final perfil = _perfilesDemo[_pasoDemo % _perfilesDemo.length];
    _pasoDemo++;
    _tDemo += _periodoDemo.inMilliseconds;
    final ahora = DateTime.now();

    final bool frenteBloqueado = !perfil.frenteOk ||
        (perfil.frenteCm > 0 && perfil.frenteCm < CentroAlertas.umbralParadaCm);
    final String parada = !perfil.frenteOk
        ? 'fallo_sensor_frente'
        : (frenteBloqueado ? 'obstaculo_frente' : 'ninguna');
    _ultimoEstado = Estado(
      numero: 9000 + _pasoDemo,
      modo: perfil.modo,
      bateria: perfil.bateria,
      bateriaV: perfil.bateriaV,
      ordenes: _pasoDemo,
      lineaMm: perfil.lineaMm,
      vIzq: frenteBloqueado ? 0.0 : perfil.vIzq,
      vDer: frenteBloqueado ? 0.0 : perfil.vDer,
      t: _tDemo,
      parada: parada,
    );
    _ultimoUltrasonido = Ultrasonido(
      frenteCm: perfil.frenteOk ? perfil.frenteCm : 0,
      atrasCm: perfil.atrasCm,
      frenteOk: perfil.frenteOk,
      llegada: ahora,
      t: _tDemo,
    );
    analitica.registrarUltrasonido(_ultimoUltrasonido!, ahora: ahora);
    analitica.registrarEstado(_ultimoEstado!, ahora: ahora);
    _evaluarAlertas();
    _ultimoMensaje = ahora;
    _ultimoError = null;
    notifyListeners();
  }

  /// Solo para pruebas: emite el siguiente paso del Modo Demo sin esperar 2 s.
  @visibleForTesting
  void debugEmitirPasoDemo() => _emitirPasoDemo();

  /// Lee una alerta del robot (`robot/alertas`, QoS 2) y la pasa al Centro de
  /// Alertas (P11). Si activa una parada de emergencia, la cuenta (P12).
  void _decodificarAlerta(String texto) {
    try {
      final mapa = jsonDecode(texto);
      if (mapa is! Map<String, dynamic>) {
        throw const FormatException('el payload no es un objeto JSON');
      }
      analitica.registrarAlerta();
      final clave = centroAlertas.registrarDelRobot(mapa);
      if (clave != null) _contarParadas(<String>[clave]);
    } catch (e) {
      _ultimoError = 'JSON inválido en $topicoAlertas: $e';
    }
    if (!_descartado) notifyListeners();
  }

  /// Guarda las últimas distancias de los ultrasónicos. No toca el Modo Demo
  /// ni el estado general: es un tópico aparte.
  void _decodificarUltrasonido(String texto) {
    try {
      final mapa = jsonDecode(texto);
      if (mapa is! Map<String, dynamic>) {
        throw const FormatException('el payload no es un objeto JSON');
      }
      _ultimoUltrasonido = Ultrasonido.fromJson(mapa);
      analitica.registrarUltrasonido(_ultimoUltrasonido!);
      _evaluarAlertas();
    } catch (e) {
      _ultimoError = 'JSON inválido en $topicoUltrasonido: $e';
    }
    if (!_descartado) notifyListeners();
  }

  void _decodificarEstado(String texto) {
    // Al recibir telemetría real en el tópico, desactiva automáticamente el Modo Demo
    if (_simulando) {
      detenerSimulacion();
    }
    try {
      final mapa = jsonDecode(texto);
      if (mapa is! Map<String, dynamic>) {
        throw const FormatException('el payload no es un objeto JSON');
      }
      _ultimoEstado = Estado.fromJson(mapa);
      _ultimoMensaje = DateTime.now();
      _ultimoError = null;
      analitica.registrarEstado(_ultimoEstado!);
      _evaluarAlertas();
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

/// Orden enviada por esta app, esperando (o ya con) su confirmación.
class _OrdenEnviada {
  _OrdenEnviada({required this.comando, required this.envio});

  final String comando;
  final DateTime envio;
  DateTime? confirmada;
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
    required this.frenteCm,
    required this.atrasCm,
    this.frenteOk = true,
  });

  final String modo;
  final int bateria;
  final double bateriaV;
  final double lineaMm;
  final double vIzq;
  final double vDer;
  final double frenteCm;
  final double atrasCm;
  final bool frenteOk;
}

/// Siete perfiles que rotan cada 2 s, alineados con los del P10. Cubren los
/// cuatro casos del Centro de Alertas (P11): proximidad (45 cm), parada por
/// obstáculo (18 cm) + batería crítica (9,95 V) y fallo de sensor sin eco.
const List<_PerfilDemo> _perfilesDemo = <_PerfilDemo>[
  _PerfilDemo(modo: 'autonomo', bateria: 100, bateriaV: 12.60, lineaMm: 0.0, vIzq: 0.41, vDer: 0.41, frenteCm: 150, atrasCm: 160),
  _PerfilDemo(modo: 'manual', bateria: 17, bateriaV: 10.35, lineaMm: 27.0, vIzq: 0.30, vDer: 0.55, frenteCm: 90, atrasCm: 160),
  _PerfilDemo(modo: 'autonomo', bateria: 48, bateriaV: 11.20, lineaMm: -32.4, vIzq: 0.05, vDer: 0.05, frenteCm: 45, atrasCm: 110),
  _PerfilDemo(modo: 'autonomo', bateria: 2, bateriaV: 9.95, lineaMm: -27.0, vIzq: 0.55, vDer: 0.30, frenteCm: 18, atrasCm: 60),
  _PerfilDemo(modo: 'manual', bateria: 59, bateriaV: 11.50, lineaMm: 9.0, vIzq: -0.40, vDer: 0.40, frenteCm: 70, atrasCm: 25),
  _PerfilDemo(modo: 'autonomo', bateria: 81, bateriaV: 12.10, lineaMm: 0.5, vIzq: 0.52, vDer: 0.52, frenteCm: 120, atrasCm: 90),
  _PerfilDemo(modo: 'autonomo', bateria: 78, bateriaV: 12.00, lineaMm: 1.2, vIzq: 0.45, vDer: 0.45, frenteCm: 0, atrasCm: 95, frenteOk: false),
];
