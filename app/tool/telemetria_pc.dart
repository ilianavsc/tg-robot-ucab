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
  final secuencia = args.contains('--secuencia');
  final vueltas = _vueltas(args);
  // Con --secuencia el guion dura vueltas * 6 mensajes * 3 s; se escucha un poco más.
  final segundos = secuencia ? (vueltas * 6 * 3 + 6) : _segundos(args);

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

  if (secuencia) {
    unawaited(_publicarSecuencia(cliente, topico, vueltas));
  } else if (simular) {
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

int _vueltas(List<String> args) {
  for (final a in args) {
    if (a.startsWith('--vueltas=')) {
      return int.tryParse(a.substring('--vueltas='.length)) ?? 4;
    }
  }
  return 4;
}

/// Perfiles de prueba: cada uno ejercita un estado distinto de la pantalla.
const List<Map<String, Object>> _perfiles = <Map<String, Object>>[
  // batería llena, autónomo, línea centrada
  {'estado': 'autonomo', 'bateria': 100, 'bateria_v': 12.60, 'linea_mm': 0.0, 'v_izq': 0.41, 'v_der': 0.41},
  // batería baja, manual, línea a la izquierda
  {'estado': 'manual', 'bateria': 15, 'bateria_v': 10.35, 'linea_mm': 27.0, 'v_izq': 0.30, 'v_der': 0.55},
  // línea perdida (error máximo negativo) y robot casi parado
  {'estado': 'autonomo', 'bateria': 45, 'bateria_v': 11.20, 'linea_mm': -32.4, 'v_izq': 0.05, 'v_der': 0.05},
  // batería crítica, autonomo, línea a la derecha
  {'estado': 'autonomo', 'bateria': 5, 'bateria_v': 9.95, 'linea_mm': -27.0, 'v_izq': 0.55, 'v_der': 0.30},
  // manual con ruedas opuestas (giro en el sitio)
  {'estado': 'manual', 'bateria': 60, 'bateria_v': 11.50, 'linea_mm': 9.0, 'v_izq': -0.40, 'v_der': 0.40},
  // autónomo rápido
  {'estado': 'autonomo', 'bateria': 90, 'bateria_v': 12.10, 'linea_mm': 0.5, 'v_izq': 0.52, 'v_der': 0.52},
];

/// Publica el guion completo `vueltas` veces, un mensaje cada 3 s.
Future<void> _publicarSecuencia(
  MqttServerClient cliente,
  String topico,
  int vueltas,
) async {
  await Future<void>.delayed(const Duration(seconds: 1));
  var n = 5000;
  for (var vuelta = 1; vuelta <= vueltas; vuelta++) {
    for (var i = 0; i < _perfiles.length; i++) {
      n++;
      final carga = <String, dynamic>{
        ..._perfiles[i],
        'n': n,
        'ordenes': n - 5000,
        't': 1000 * n,
      };
      final constructor = MqttClientPayloadBuilder()
        ..addString(jsonEncode(carga));
      cliente.publishMessage(topico, MqttQos.atMostOnce, constructor.payload!);
      print('>> [vuelta $vuelta/$vueltas · perfil ${i + 1}] ${jsonEncode(carga)}');
      await Future<void>.delayed(const Duration(seconds: 3));
    }
  }
  print('>> secuencia terminada');
}
