import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/exportar/descarga_csv.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_ui.dart';

/// **P12 · Analítica de Sesión.** Resume la sesión actual (MQTT/P10 o Modo
/// Demo) y exporta el reporte CSV para el análisis estadístico de la Fase VII.
///
/// Solo presentación: las métricas las acumula `MqttService.analitica`, y el
/// CSV lo arma `reporteCsv()`; no cambia nada de eso.
class TarjetaAnaliticaSesion extends StatelessWidget {
  const TarjetaAnaliticaSesion({super.key});

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final a = servicio.analitica;
    final double? frenteMin = a.distanciaFrontalMinima;
    final int seg = a.duracion().inSeconds;
    final String duracion =
        '${(seg ~/ 60).toString().padLeft(2, '0')}:${(seg % 60).toString().padLeft(2, '0')}';
    final bool hayDatos = a.muestras > 0;

    final List<Widget> celdas = <Widget>[
      CockpitCell(
        etiqueta: 'Velocidad media',
        valor: a.velocidadMedia.toStringAsFixed(2),
        unidad: 'm/s',
      ),
      CockpitCell(
        etiqueta: 'Velocidad máxima',
        valor: a.velocidadMaxima.toStringAsFixed(2),
        unidad: 'm/s',
      ),
      CockpitCell(
        etiqueta: 'Dist. frontal mínima',
        valor: frenteMin == null ? '—' : frenteMin.toStringAsFixed(0),
        unidad: 'cm',
      ),
      CockpitCell(
        etiqueta: 'Error medio línea',
        valor: a.errorMedioLinea.toStringAsFixed(1),
        unidad: 'mm',
      ),
      CockpitCell(etiqueta: 'Paquetes recibidos', valor: '${a.totalPaquetes}'),
      CockpitCell(
        etiqueta: 'Paradas de emergencia',
        valor: '${a.paradasEmergencia}',
        color: a.paradasEmergencia > 0
            ? CockpitColors.error
            : CockpitColors.onSurface,
      ),
    ];

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SectionLabel(
            icono: Icons.query_stats,
            etiqueta: 'Analítica de sesión (P12)',
            trailing: StatusPill(
              texto: hayDatos ? duracion : 'SIN DATOS',
              color: hayDatos ? CockpitColors.primary : CockpitColors.outline,
              punto: hayDatos,
              icono: hayDatos ? null : Icons.hourglass_empty,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            hayDatos
                ? '${a.muestras} muestras de estado${servicio.simulando ? ' · Modo Demo' : ''}. '
                      'Se reinicia al detener el demo o con Reiniciar.'
                : 'Conecta al robot o al P10, o activa el Modo Demo, para acumular métricas.',
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints c) {
              final int columnas = c.maxWidth >= 560 ? 3 : 2;
              const double espacio = 8;
              final double ancho =
                  (c.maxWidth - espacio * (columnas - 1)) / columnas;
              return Wrap(
                spacing: espacio,
                runSpacing: espacio,
                children: <Widget>[
                  for (final Widget celda in celdas)
                    SizedBox(width: ancho, child: celda),
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          Row(
            children: <Widget>[
              Expanded(
                flex: 3,
                child: Pressable(
                  habilitado: hayDatos,
                  child: FilledButton.icon(
                    onPressed: hayDatos
                        ? () => _exportar(context, servicio)
                        : null,
                    icon: const Icon(Icons.download, size: 18),
                    label: const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text('EXPORTAR REPORTE CSV'),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: OutlinedButton.icon(
                  onPressed: servicio.reiniciarSesion,
                  icon: const Icon(Icons.restart_alt, size: 18),
                  label: const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text('REINICIAR'),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _exportar(BuildContext context, MqttService servicio) async {
    final ScaffoldMessengerState mensajero = ScaffoldMessenger.of(context);
    final String csv = servicio.reporteCsv();
    final DateTime ahora = DateTime.now();
    String dos(int n) => n.toString().padLeft(2, '0');
    final String nombre =
        'sesion_robot_${ahora.year}${dos(ahora.month)}${dos(ahora.day)}_'
        '${dos(ahora.hour)}${dos(ahora.minute)}${dos(ahora.second)}.csv';
    final bool descargado = await descargarCsv(nombre, csv);
    if (!descargado) {
      await Clipboard.setData(ClipboardData(text: csv));
    }
    mensajero.showSnackBar(
      SnackBar(
        content: Text(
          descargado
              ? 'Reporte descargado: $nombre'
              : 'Sin descarga en esta plataforma: CSV copiado al portapapeles.',
        ),
      ),
    );
  }
}
