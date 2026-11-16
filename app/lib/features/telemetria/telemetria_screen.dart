import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/estado.dart';
import '../../core/mqtt/mqtt_service.dart';

/// Pantalla mínima de telemetría: solo texto y dos botones.
///
/// El diseño se hará en la Fase V; aquí lo único que importa es que se vea
/// llegar la telemetría real del ESP32 y que los botones de conexión funcionen.
class TelemetriaScreen extends StatelessWidget {
  const TelemetriaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final servicio = context.watch<MqttService>();
    final estado = servicio.ultimoEstado;

    return Scaffold(
      appBar: AppBar(title: const Text('Telemetría del robot')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          _Fila(
            'Conexión',
            servicio.simulando
                ? 'modo demo (sin red)'
                : _textoConexion(servicio.conexion),
          ),
          _Fila('Broker', '${servicio.host}:${servicio.puertoEfectivo}'),
          _Fila('Tópico', servicio.topicoEstado),
          _Fila(
            'Datos',
            servicio.recibiendoDatos
                ? 'recibiendo (hace ${servicio.segundosSinDatos} s)'
                : servicio.ultimoMensaje == null
                    ? 'esperando el primer mensaje'
                    : 'sin datos hace ${servicio.segundosSinDatos} s',
          ),
          if (servicio.ultimoError != null) _Fila('Último error', servicio.ultimoError!),
          const Divider(height: 32),
          if (estado == null)
            const Text('Esperando telemetría del robot…')
          else
            ..._filasEstado(estado),
          const SizedBox(height: 24),
          Row(
            children: <Widget>[
              Expanded(
                child: FilledButton.icon(
                  onPressed: servicio.conectar,
                  icon: const Icon(Icons.link),
                  label: const Text('Conectar'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: servicio.desconectar,
                  icon: const Icon(Icons.link_off),
                  label: const Text('Desconectar'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              Expanded(
                child: FilledButton.icon(
                  onPressed: servicio.iniciarSimulacion,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.play_circle_outline),
                  label: const Text('Iniciar Modo Demo'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: servicio.detenerSimulacion,
                  icon: const Icon(Icons.stop_circle_outlined),
                  label: const Text('Detener Demo'),
                ),
              ),
            ],
          ),
          if (servicio.simulando) ...<Widget>[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                border: Border.all(color: Colors.green.shade400),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'MODO DEMO ACTIVO · telemetría simulada cada 2 s, sin red',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _textoConexion(EstadoConexion c) {
    switch (c) {
      case EstadoConexion.desconectado:
        return 'desconectado';
      case EstadoConexion.conectando:
        return 'conectando…';
      case EstadoConexion.conectado:
        return 'conectado';
      case EstadoConexion.error:
        return 'error';
    }
  }

  static List<Widget> _filasEstado(Estado e) {
    return <Widget>[
      _Fila('Modo', e.modo),
      _Fila('Batería', '${e.bateria} %  (${e.bateriaV.toStringAsFixed(2)} V)'),
      _Fila('Línea', '${e.lineaMm.toStringAsFixed(1)} mm'),
      _Fila('Velocidad izq. / der.', '${e.vIzq.toStringAsFixed(2)} / ${e.vDer.toStringAsFixed(2)} m/s'),
      _Fila('Órdenes recibidas', '${e.ordenes}'),
      _Fila('Estado nº', '${e.numero}'),
      _Fila('Encendido', e.tiempoEncendido),
    ];
  }
}

/// Etiqueta + valor en una línea.
class _Fila extends StatelessWidget {
  const _Fila(this.etiqueta, this.valor);

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 150,
            child: Text(
              etiqueta,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(valor)),
        ],
      ),
    );
  }
}
