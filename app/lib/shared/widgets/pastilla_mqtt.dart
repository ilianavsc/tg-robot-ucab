import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';

/// Texto y color del estado **real** de `MqttService` para la pastilla
/// `MQTT: Estado (broker)`. Entre paréntesis va el broker cuando hay enlace y
/// `--` cuando no lo hay: nunca se muestra un dato que no exista.
({String texto, Color color}) resumenMqtt(MqttService s) {
  if (s.simulando) {
    return (texto: 'MQTT: Demo (sin red)', color: CockpitColors.secondary);
  }
  switch (s.conexion) {
    case EstadoConexion.conectado:
      return (
        texto: 'MQTT: Conectado (${s.nombreBroker})',
        color: s.recibiendoDatos ? CockpitColors.ok : CockpitColors.warning,
      );
    case EstadoConexion.conectando:
      return (texto: 'MQTT: Conectando (--)', color: CockpitColors.warning);
    case EstadoConexion.error:
      return (texto: 'MQTT: Error (--)', color: CockpitColors.hazard);
    case EstadoConexion.desconectado:
      return (texto: 'MQTT: Desconectado (--)', color: CockpitColors.outline);
  }
}

/// Pastilla con el estado del enlace MQTT; se actualiza sola.
class PastillaMqtt extends StatelessWidget {
  const PastillaMqtt({super.key});

  @override
  Widget build(BuildContext context) {
    final ({String texto, Color color}) r = resumenMqtt(
      context.watch<MqttService>(),
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: r.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              r.texto,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: CockpitText.telemetrySm.copyWith(
                color: CockpitColors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
