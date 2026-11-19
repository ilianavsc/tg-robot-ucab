import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/models/ultrasonido.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';
import 'radar_hud.dart';

/// **Radar**: HUD polar de los 2 HC-SR04P (frente y atrás), estado del arreglo
/// acústico y reglas de evitación de colisiones del firmware.
///
/// Solo se dibuja lo que el robot tiene: 2 sensores (no hay flancos ni cámara).
class PantallaRadar extends StatelessWidget {
  const PantallaRadar({super.key});

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final Ultrasonido? u = servicio.ultimoUltrasonido;
    final ZonaSonar zf = zonaFrente(u);
    final ZonaSonar za = zonaAtras(u);

    return ListView(
      key: const PageStorageKey<String>('radar'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: <Widget>[
        CockpitColumnas(
          children: <Widget>[
            _TarjetaRadar(u: u, zf: zf, za: za),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _EstadoArreglo(u: u, zf: zf, za: za),
                const SizedBox(height: 12),
                _EvitacionColisiones(zf: zf, za: za),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _TarjetaRadar extends StatelessWidget {
  const _TarjetaRadar({required this.u, required this.zf, required this.za});

  final Ultrasonido? u;
  final ZonaSonar zf;
  final ZonaSonar za;

  @override
  Widget build(BuildContext context) {
    final bool vigente = zf != ZonaSonar.sinSenal && zf != ZonaSonar.sinDatos;
    final bool peligro = zf == ZonaSonar.parada || za == ZonaSonar.parada;

    return CockpitCard(
      borde: peligro ? CockpitColors.hazard.withValues(alpha: 0.6) : null,
      resplandor: peligro ? CockpitColors.hazard : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.radar,
            etiqueta: 'Radar polar HUD',
            trailing: const StatusPill(
              texto: '40 kHz pulse',
              color: CockpitColors.onSurfaceVariant,
              punto: false,
              icono: Icons.settings_input_antenna,
            ),
          ),
          const SizedBox(height: 12),
          RadarHud(
            frenteCm: u?.frenteCm,
            atrasCm: u?.atrasCm,
            zonaFrente: zf,
            zonaAtras: za,
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: CockpitColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(CockpitRadius.md),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Icon(
                      vigente ? Icons.sync : Icons.sync_disabled,
                      size: 16,
                      color: vigente
                          ? CockpitColors.primary
                          : CockpitColors.outline,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      vigente ? 'BARRIDO ACTIVO' : 'BARRIDO EN PAUSA',
                      style: CockpitText.labelMd.copyWith(
                        fontSize: 11,
                        color: vigente
                            ? CockpitColors.primary
                            : CockpitColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
              Text.rich(
                TextSpan(
                  children: <InlineSpan>[
                    TextSpan(
                      text: 'RANGO: ',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                    TextSpan(text: '2.0 METROS', style: cifra(size: 14)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EstadoArreglo extends StatelessWidget {
  const _EstadoArreglo({required this.u, required this.zf, required this.za});

  final Ultrasonido? u;
  final ZonaSonar zf;
  final ZonaSonar za;

  @override
  Widget build(BuildContext context) {
    final bool fallo = zf == ZonaSonar.fallo || za == ZonaSonar.fallo;
    final bool vigente = zf != ZonaSonar.sinSenal && zf != ZonaSonar.sinDatos;
    final String resumen = fallo
        ? 'FALLO DE SENSOR'
        : (vigente ? '2 CANALES OK' : 'SIN SEÑAL');
    final Color color = fallo
        ? CockpitColors.error
        : (vigente ? CockpitColors.ok : CockpitColors.outline);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Flexible(
                child: Text(
                  'ARREGLO ACÚSTICO · 2× HC-SR04P',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: CockpitText.labelMd.copyWith(
                    fontSize: 11,
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                resumen,
                style: CockpitText.labelMd.copyWith(fontSize: 11, color: color),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: TileSonar(
                etiqueta: 'Frente',
                icono: Icons.arrow_upward,
                cm: u?.frenteCm,
                zona: zf,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TileSonar(
                etiqueta: 'Atrás',
                icono: Icons.arrow_downward,
                cm: u?.atrasCm,
                zona: za,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Reglas de evitación de colisiones del firmware (RF-05), con sus umbrales.
class _EvitacionColisiones extends StatelessWidget {
  const _EvitacionColisiones({required this.zf, required this.za});

  final ZonaSonar zf;
  final ZonaSonar za;

  @override
  Widget build(BuildContext context) {
    final bool fallo = zf == ZonaSonar.fallo || za == ZonaSonar.fallo;
    final bool vigente = zf != ZonaSonar.sinSenal && zf != ZonaSonar.sinDatos;
    final String estado = fallo
        ? 'DEGRADADA'
        : (vigente ? 'ACTIVA' : 'SIN DATOS');
    final Color color = fallo
        ? CockpitColors.hazard
        : (vigente ? CockpitColors.ok : CockpitColors.outline);

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.shield_outlined,
            etiqueta: 'Evitación de colisiones',
            trailing: StatusPill(texto: estado, color: color),
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Umbral de parada',
                  valor: CentroAlertas.umbralParadaCm.toStringAsFixed(0),
                  unidad: 'cm',
                  tamano: 18,
                  color: CockpitColors.error,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Umbral de aviso',
                  valor: CentroAlertas.umbralAvisoCm.toStringAsFixed(0),
                  unidad: 'cm',
                  tamano: 18,
                  color: CockpitColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Row(
            children: <Widget>[
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Lectura alternada',
                  valor: '200',
                  unidad: 'ms / sensor',
                  tamano: 18,
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Fallo de eco',
                  valor: '600',
                  unidad: 'ms',
                  tamano: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Con el frente a menos de 20 cm el robot se detiene; solo deja retroceder '
            'si atrás hay 20 cm o más y el sensor trasero es válido. Un sensor sin '
            'eco durante 600 ms se declara en fallo y se bloquea esa dirección.',
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
