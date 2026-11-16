import 'dart:async';
import 'dart:convert';

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import 'package:uuid/uuid.dart';

import '../lib/core/models/estado.dart';

/// Prueba de protocolo desde la PC, **sin Flutter**.
///
/// Por qué existe:
///  * `flutter run -d windows` necesita Visual Studio (no instalado).
///  * `flutter run -d chrome` no sirve: `mqtt_server_client` depende de
///    `dart:io`, que no existe en el navegador (haría falta WebSocket 8884).
///  * `MqttService` importa `ChangeNotifier` de Flutter y por eso solo puede
///    correr dentro de un motor Flutter (app o `flutter test`).
///
/// Este script valida lo que sí es independiente del motor y es donde se
/// rompen las cosas de verdad: que el broker responda, que el tópico sea el
/// correcto y que el JSON del firmware se decodifique en [Estado].
///
/// Uso:
///   dart run tool/telemetria_pc.dart                  # escucha 20 s
///   dart run tool/telemetria_pc.dart --simular        # publica un estado
///                                                     # falso y lo recibe
///   dart run tool/telemetria_pc.dart --seg=60         # otro tiempo
Future<void> main(List<String> args) async {
  const host = 'broker.hivemq.com';
  const puerto = 1883;
  const topico = 'ucab-tg-sf/robot/estado';

  final simular = args.contains('--simular');
  final segundos = _segundos(args);

  final cliente = MqttServerClient.withPort(
    host,
    'ucab-diag-${const Uuid().v4().substring(0, 8)}',
    puerto,
  );
  cliente.logging(on: false);
  cliente.keepAlivePeriod = 20;
  cliente.connectTimeoutPeriod = 5000;

  print('Conectando a $host:$puerto ...');
  try {
    await cliente.connect();
  } catch (e) {
    print('FALLO la conexión: $e');
    return;
  }

  if (cliente.connectionStatus?.state != MqttConnectionState.connected) {
    print('FALLO: el broker no confirmó la conexión '
        '(${cliente.connectionStatus?.returnCode})');
    return;
  }
  print('OK conexión establecida');

  cliente.subscribe(topico, MqttQos.atMostOnce);
  print('OK suscrito a $topico');

  var recibidos = 0;
  cliente.updates!.listen((eventos) {
    for (final evento in eventos) {
      final publicacion = evento.payload as MqttPublishMessage;
      final texto =
          MqttPublishPayload.bytesToStringAsString(publicacion.payload.message);
      recibidos++;
      print('[$recibidos] ${evento.topic} <- $texto');
      try {
        final estado = Estado.fromJson(jsonDecode(texto) as Map<String, dynamic>);
        print('    decodificado -> $estado');
      } catch (e) {
        print('    JSON NO DECODIFICA: $e');
      }
    }
  });

  if (simular) {
    unawaited(_publicarEstadoFalso(cliente, topico));
  }

  print('Escuchando $segundos s ...');
  await Future<void>.delayed(Duration(seconds: segundos));

  print('--- resumen ---');
  print('mensajes recibidos: $recibidos');
  cliente.disconnect();
}

int _segundos(List<String> args) {
  for (final a in args) {
    if (a.startsWith('--seg=')) {
      return int.tryParse(a.substring('--seg='.length)) ?? 20;
    }
  }
  return 20;
}

/// Publica un estado con la misma forma que `publicarEstado()` del firmware.
Future<void> _publicarEstadoFalso(MqttServerClient cliente, String topico) async {
  await Future<void>.delayed(const Duration(seconds: 2));
  final carga = jsonEncode(<String, dynamic>{
    'n': 9001,
    'estado': 'manual',
    'bateria': 64,
    'bateria_v': 11.37,
    'ordenes': 12,
    'linea_mm': 3.4,
    'v_izq': 0.38,
    'v_der': 0.44,
    't': 991234,
  });
  final constructor = MqttClientPayloadBuilder()..addString(carga);
  cliente.publishMessage(topico, MqttQos.atMostOnce, constructor.payload!);
  print('>> publicado estado de prueba en $topico');
}
