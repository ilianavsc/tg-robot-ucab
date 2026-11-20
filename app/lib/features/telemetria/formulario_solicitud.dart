import 'package:flutter/material.dart';

import '../../core/demo/simulacion_pista.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_ui.dart';
import 'solicitud_activa.dart';

/// Componentes típicos del laboratorio para el selector rápido de la solicitud.
const List<String> componentesTipo = <String>[
  'Kit ESP32 / Sensores',
  'Resistencias / Protoboard',
  'Cables / Multímetro',
];

/// Hoja "Nueva solicitud": elige componente y destino, y despacha el pedido.
class FormularioSolicitud extends StatefulWidget {
  const FormularioSolicitud({
    super.key,
    required this.servicio,
    required this.solicitud,
  });

  final MqttService servicio;
  final SolicitudActiva solicitud;

  @override
  State<FormularioSolicitud> createState() => _FormularioSolicitudState();
}

class _FormularioSolicitudState extends State<FormularioSolicitud> {
  String _componente = componentesTipo.first;
  DestinoPista _destino = DestinoPista.laboratorio1;

  void _enviar() {
    // 1) Registra la solicitud activa en estado local.
    widget.solicitud.crear(
      componente: _componente,
      destino: _destino.nombre,
    );
    // 2) Despacha: en el Modo Demo se fija el destino de la pista y la orden
    //    "auto" arranca la marcha (igual en MQTT real).
    widget.servicio.pista?.elegirDestino(_destino);
    enviarOrden(context, widget.servicio, 'auto');
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const SectionLabel(
                icono: Icons.inventory_2_outlined,
                etiqueta: 'Nueva solicitud',
              ),
              const SizedBox(height: 14),
              Text('Componente', style: CockpitText.labelMd),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  for (final String c in componentesTipo)
                    ChoiceChip(
                      label: Text(c),
                      selected: _componente == c,
                      onSelected: (_) => setState(() => _componente = c),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Text('Destino', style: CockpitText.labelMd),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  for (final DestinoPista d in DestinoPista.values)
                    ChoiceChip(
                      label: Text(d.nombre),
                      selected: _destino == d,
                      onSelected: (_) => setState(() => _destino = d),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                key: const Key('enviar-solicitud'),
                onPressed: _enviar,
                icon: const Icon(Icons.send),
                label: const Text('Enviar solicitud'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
