import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/exportar/descarga_csv.dart';
import '../../core/mqtt/mqtt_service.dart';

/// **P12 · Analítica de Sesión.** Resume la sesión actual (MQTT/P10 o Modo
/// Demo) y exporta el reporte CSV para el análisis estadístico de la Fase VII.
class TarjetaAnaliticaSesion extends StatelessWidget {
  const TarjetaAnaliticaSesion({super.key});

  static const Color _acento = Color(0xFF2563EB);

  @override
  Widget build(BuildContext context) {
    final servicio = context.watch<MqttService>();
    final a = servicio.analitica;
    final double? frenteMin = a.distanciaFrontalMinima;
    final int seg = a.duracion().inSeconds;
    final String duracion =
        '${(seg ~/ 60).toString().padLeft(2, '0')}:${(seg % 60).toString().padLeft(2, '0')}';

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Row(
              children: <Widget>[
                Icon(Icons.query_stats, color: _acento, size: 24),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Analítica de Sesión (P12)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              a.muestras == 0
                  ? 'Sin datos: conecta al robot / P10 o activa el Modo Demo.'
                  : 'Sesión de $duracion · ${a.muestras} muestras de estado'
                      '${servicio.simulando ? ' (Modo Demo)' : ''}.',
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: <Widget>[
                _Metrica(
                  icono: Icons.speed,
                  etiqueta: 'Velocidad media',
                  valor: '${a.velocidadMedia.toStringAsFixed(2)} m/s',
                ),
                _Metrica(
                  icono: Icons.rocket_launch_outlined,
                  etiqueta: 'Velocidad máxima',
                  valor: '${a.velocidadMaxima.toStringAsFixed(2)} m/s',
                ),
                _Metrica(
                  icono: Icons.straighten,
                  etiqueta: 'Distancia frontal mínima',
                  valor: frenteMin == null ? '— cm' : '${frenteMin.toStringAsFixed(0)} cm',
                ),
                _Metrica(
                  icono: Icons.timeline,
                  etiqueta: 'Error medio abs. de línea',
                  valor: '${a.errorMedioLinea.toStringAsFixed(1)} mm',
                ),
                _Metrica(
                  icono: Icons.inventory_2_outlined,
                  etiqueta: 'Paquetes recibidos',
                  valor: '${a.totalPaquetes}',
                ),
                _Metrica(
                  icono: Icons.front_hand_outlined,
                  etiqueta: 'Paradas de emergencia',
                  valor: '${a.paradasEmergencia}',
                  resaltar: a.paradasEmergencia > 0,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: <Widget>[
                FilledButton.icon(
                  onPressed: a.muestras == 0 ? null : () => _exportar(context, servicio),
                  style: FilledButton.styleFrom(backgroundColor: _acento),
                  icon: const Icon(Icons.download, size: 18),
                  label: const Text('Exportar Reporte CSV'),
                ),
                OutlinedButton.icon(
                  onPressed: servicio.reiniciarSesion,
                  icon: const Icon(Icons.restart_alt, size: 18),
                  label: const Text('Reiniciar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportar(BuildContext context, MqttService servicio) async {
    final mensajero = ScaffoldMessenger.of(context);
    final csv = servicio.reporteCsv();
    final ahora = DateTime.now();
    String dos(int n) => n.toString().padLeft(2, '0');
    final nombre = 'sesion_robot_${ahora.year}${dos(ahora.month)}${dos(ahora.day)}_'
        '${dos(ahora.hour)}${dos(ahora.minute)}${dos(ahora.second)}.csv';
    final descargado = await descargarCsv(nombre, csv);
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

class _Metrica extends StatelessWidget {
  const _Metrica({
    required this.icono,
    required this.etiqueta,
    required this.valor,
    this.resaltar = false,
  });

  final IconData icono;
  final String etiqueta;
  final String valor;
  final bool resaltar;

  @override
  Widget build(BuildContext context) {
    final Color color = resaltar ? const Color(0xFFE11D48) : const Color(0xFF0F172A);
    return Container(
      width: 240,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: resaltar ? const Color(0xFFFECDD3) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        children: <Widget>[
          Icon(icono, size: 20, color: const Color(0xFF475569)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  etiqueta,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                Text(
                  valor,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
