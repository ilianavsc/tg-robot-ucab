import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/models/estado.dart';
import '../../core/models/ultrasonido.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'analitica_p12.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';
import 'conexion_cockpit.dart';
import 'mapa_pista.dart';
import 'radar_hud.dart';

/// **Dashboard**: estado del robot, enlace MQTT, energía 3S, línea (4×
/// TCRT5000), motores, obstáculos y analítica de sesión.
///
/// Todo sale de `MqttService`. Lo que el robot no mide (corriente,
/// temperatura, RPM, celdas) no se inventa: o se calcula y se marca como
/// estimado (RPM, celdas ≈ V/3) o no se muestra.
class PantallaDashboard extends StatelessWidget {
  const PantallaDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final Estado? e = servicio.ultimoEstado;
    final Ultrasonido? u = servicio.ultimoUltrasonido;
    final bool sin = estadoSinSenal(e);

    return ListView(
      key: const PageStorageKey<String>('dashboard'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: <Widget>[
        if (sin) ...<Widget>[
          _TarjetaEspera(servicio: servicio),
          const SizedBox(height: 12),
        ],
        // Vista principal: Mapa de Pista con misión, destinos y pausa.
        const TarjetaMapaPista(),
        const SizedBox(height: 12),
        CockpitColumnas(
          children: <Widget>[
            _TarjetaEstadoRobot(estado: e, sin: sin),
            _TarjetaEnlace(servicio: servicio),
            _TarjetaEnergia(estado: e, sin: sin),
            _TarjetaIr(estado: e, sin: sin),
            _TarjetaMotores(estado: e, sin: sin),
            _TarjetaObstaculos(ultrasonido: u),
            _AccionesRapidas(servicio: servicio),
            const TarjetaAnaliticaSesion(),
          ],
        ),
      ],
    );
  }
}

/// Estado vacío: todavía no llegó telemetría.
class _TarjetaEspera extends StatelessWidget {
  const _TarjetaEspera({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    return CockpitCard(
      borde: CockpitColors.primary.withValues(alpha: 0.35),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(Icons.sensors, color: CockpitColors.primary, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'ESPERANDO TELEMETRÍA DEL ROBOT…',
                  style: CockpitText.labelMd.copyWith(
                    color: CockpitColors.primary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Enciende el ESP32, abre el simulador P10 o pulsa MODO DEMO '
                  'para ver los sensores en vivo.',
                  style: CockpitText.bodySm.copyWith(
                    color: CockpitColors.onSurfaceVariant,
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

/// "Misión activa" del robot: modo, motivo de parada, velocidad y error de línea.
class _TarjetaEstadoRobot extends StatelessWidget {
  const _TarjetaEstadoRobot({required this.estado, required this.sin});

  final Estado? estado;
  final bool sin;

  @override
  Widget build(BuildContext context) {
    final Estado? e = estado;
    final ParadaInfo parada = describirParada(e?.parada ?? 'ninguna');

    final String titulo;
    final String subtitulo;
    final String pildora;
    final Color colorPildora;
    final IconData icono;
    if (sin || e == null) {
      titulo = 'Sin telemetría';
      subtitulo = 'Esperando datos del robot';
      pildora = 'SIN SEÑAL';
      colorPildora = CockpitColors.outline;
      icono = Icons.signal_cellular_off;
    } else {
      titulo = e.esAutonomo ? 'Seguimiento de línea' : 'Control manual';
      subtitulo =
          'Paquete #${e.numero} · ${e.ordenes} órdenes · activo ${e.tiempoEncendido}';
      icono = e.esAutonomo
          ? Icons.navigation_outlined
          : Icons.sports_esports_outlined;
      if (parada.detenido) {
        pildora = parada.corta;
        colorPildora = parada.nivel == NivelAlerta.critica
            ? CockpitColors.hazard
            : CockpitColors.warning;
      } else {
        pildora = e.esAutonomo ? 'AUTÓNOMO' : 'MANUAL';
        colorPildora = e.esAutonomo
            ? CockpitColors.primary
            : CockpitColors.secondary;
      }
    }

    return CockpitCard(
      degradado: const LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.bottomRight,
        colors: <Color>[
          CockpitColors.surfaceLow,
          CockpitColors.surfaceLow,
          Color(0xFF12292E),
        ],
        stops: <double>[0, 0.55, 1],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SectionLabel(
            icono: Icons.flag_outlined,
            etiqueta: 'Estado del robot',
            trailing: StatusPill(texto: pildora, color: colorPildora),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(titulo, style: CockpitText.headlineSm),
                    const SizedBox(height: 2),
                    Text(
                      subtitulo,
                      style: CockpitText.bodySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(icono, color: CockpitColors.primary, size: 26),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: <Widget>[
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Vel. media',
                  valor: sin || e == null
                      ? '—'
                      : e.velocidadMedia.abs().toStringAsFixed(2),
                  unidad: 'm/s',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Error de línea',
                  valor: sin || e == null ? '—' : signo(e.lineaMm),
                  unidad: 'mm',
                  color: sin || e == null
                      ? CockpitColors.onSurface
                      : (e.veLaLinea ? CockpitColors.ok : CockpitColors.error),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Enlace MQTT: broker, QoS, latencia del último ACK y controles de conexión.
class _TarjetaEnlace extends StatelessWidget {
  const _TarjetaEnlace({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final enlace = estadoEnlace(servicio);
    final Duration? latencia = servicio.ultimoAck?.latencia;
    final int segundos = servicio.segundosSinDatos;
    final bool hayError = servicio.ultimoError != null && !servicio.simulando;

    return CockpitCard(
      borde: hayError ? CockpitColors.hazard.withValues(alpha: 0.6) : null,
      resplandor: enlace.color == CockpitColors.ok
          ? CockpitColors.primary
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(
                servicio.simulando
                    ? Icons.science_outlined
                    : Icons.hub_outlined,
                color: CockpitColors.primary,
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  servicio.simulando
                      ? 'Simulación local'
                      : '${servicio.host}:${servicio.puertoEfectivo}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: CockpitText.telemetryMd.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              StatusPill(texto: enlace.texto, color: enlace.color),
            ],
          ),
          const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const Expanded(
                  child: CockpitCell(
                    etiqueta: 'QoS órd.',
                    valor: 'QoS 1',
                    tamano: 16,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: CockpitCell(
                    etiqueta: 'Lat. ACK',
                    valor: latencia == null
                        ? '—'
                        : '${latencia.inMilliseconds}',
                    unidad: latencia == null ? null : 'ms',
                    tamano: 16,
                    color: CockpitColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: CockpitCell(
                    etiqueta: 'Último RX',
                    valor: segundos < 0 ? '—' : '$segundos',
                    unidad: segundos < 0 ? null : 's',
                    tamano: 16,
                    color: servicio.recibiendoDatos
                        ? CockpitColors.ok
                        : CockpitColors.warning,
                  ),
                ),
              ],
            ),
          ),
          if (hayError) ...<Widget>[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: CockpitColors.hazard.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(CockpitRadius.md),
                border: Border.all(
                  color: CockpitColors.hazard.withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Icon(
                    Icons.warning_amber_rounded,
                    color: CockpitColors.error,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      servicio.ultimoError!,
                      style: CockpitText.bodySm.copyWith(
                        color: CockpitColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          ConexionControles(servicio: servicio),
        ],
      ),
    );
  }
}

/// Batería Li-Ion 3S: % y tensión del pack, umbrales del firmware y celdas
/// estimadas (el robot mide solo el pack, no cada celda).
class _TarjetaEnergia extends StatelessWidget {
  const _TarjetaEnergia({required this.estado, required this.sin});

  final Estado? estado;
  final bool sin;

  @override
  Widget build(BuildContext context) {
    final Estado? e = sin ? null : estado;
    final NivelBateria nivel = nivelBateria(e);

    final Color color;
    final String estadoTexto;
    switch (nivel) {
      case NivelBateria.corte:
        color = CockpitColors.hazard;
        estadoTexto = 'CORTE ≤ 9.90 V';
      case NivelBateria.aviso:
        color = CockpitColors.warning;
        estadoTexto = 'AVISO ≤ 10.30 V';
      case NivelBateria.nominal:
        color = e != null && e.bateria <= 40
            ? CockpitColors.warning
            : CockpitColors.ok;
        estadoTexto = 'NOMINAL';
      case NivelBateria.sinMedida:
        color = CockpitColors.outline;
        estadoTexto = 'SIN MEDIDA';
    }
    final double vPack = e?.bateriaV ?? 0;
    final double vCelda = celdaEstimadaV(vPack);

    return CockpitCard(
      resplandor: nivel == NivelBateria.corte ? CockpitColors.hazard : null,
      borde: nivel == NivelBateria.corte
          ? CockpitColors.hazard.withValues(alpha: 0.6)
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: CockpitColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(CockpitRadius.md),
                ),
                child: Icon(
                  nivel == NivelBateria.corte || nivel == NivelBateria.aviso
                      ? Icons.battery_alert
                      : Icons.bolt,
                  color: CockpitColors.primary,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text(
                      'Matriz de energía 3S',
                      style: CockpitText.titleMd,
                    ),
                    Text(
                      'Li-Ion · 11.1 V nom. / 12.60 V máx.',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  Text(
                    e == null ? '—' : '${e.bateria}%',
                    style: cifra(size: 28, color: color),
                  ),
                  Text(
                    estadoTexto,
                    style: CockpitText.telemetrySm.copyWith(color: color),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          ProgressTrack(
            fraccion: e == null ? 0 : e.bateria / 100,
            color: nivel == NivelBateria.nominal
                ? CockpitColors.primary
                : color,
            alto: 10,
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                'Pack: ${e == null ? '—' : e.bateriaV.toStringAsFixed(2)} V',
                style: CockpitText.telemetrySm.copyWith(
                  color: CockpitColors.onSurface,
                ),
              ),
              Text(
                'Corte seguro: 9.90 V',
                style: CockpitText.telemetrySm.copyWith(
                  color: CockpitColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              for (int i = 1; i <= 3; i++) ...<Widget>[
                if (i > 1) const SizedBox(width: 8),
                Expanded(
                  child: CockpitCell(
                    etiqueta: 'Celda $i ≈',
                    valor: e == null ? '—' : vCelda.toStringAsFixed(2),
                    unidad: e == null ? null : 'V',
                    tamano: 16,
                    extra: ProgressTrack(
                      fraccion: e == null ? 0 : fraccionCelda(vCelda),
                      color: color == CockpitColors.outline
                          ? CockpitColors.outline
                          : CockpitColors.ok,
                      alto: 4,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Celdas estimadas (V del pack ÷ 3): el robot mide solo el pack.',
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

/// Matriz IR: 4 TCRT5000 y posición de la línea.
class _TarjetaIr extends StatelessWidget {
  const _TarjetaIr({required this.estado, required this.sin});

  final Estado? estado;
  final bool sin;

  @override
  Widget build(BuildContext context) {
    final Estado? e = sin ? null : estado;
    final List<bool> activos = e == null
        ? List<bool>.filled(4, false)
        : canalesIr(e.lineaMm);

    final String estadoTexto;
    final Color colorEstado;
    if (e == null) {
      estadoTexto = 'SIN SEÑAL';
      colorEstado = CockpitColors.outline;
    } else if (!e.veLaLinea) {
      estadoTexto = 'LÍNEA PERDIDA';
      colorEstado = CockpitColors.error;
    } else if (e.lineaMm.abs() <= 4.5) {
      estadoTexto = 'ALINEADO · CENTRADO';
      colorEstado = CockpitColors.ok;
    } else {
      estadoTexto = e.lineaMm > 0 ? 'DESVIADO A LA IZQ.' : 'DESVIADO A LA DER.';
      colorEstado = CockpitColors.warning;
    }

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.alt_route,
            etiqueta: 'Matriz IR · 4× TCRT5000',
            trailing: StatusPill(
              texto: e == null ? 'OFFSET —' : 'OFFSET ${signo(e.lineaMm)} mm',
              color: CockpitColors.primary,
              punto: false,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: CockpitColors.surfaceLowest,
              borderRadius: BorderRadius.circular(CockpitRadius.md),
            ),
            child: Column(
              children: <Widget>[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    Text(
                      'CH 1 (IZQ)',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                    Flexible(
                      child: Text(
                        estadoTexto,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: CockpitText.labelMd.copyWith(
                          fontSize: 11,
                          color: colorEstado,
                        ),
                      ),
                    ),
                    Text(
                      'CH 4 (DER)',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: <Widget>[
                    for (int i = 0; i < 4; i++) ...<Widget>[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: _CanalIr(numero: i + 1, activo: activos[i]),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                _PistaLinea(lineaMm: e?.lineaMm),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CanalIr extends StatelessWidget {
  const _CanalIr({required this.numero, required this.activo});

  final int numero;
  final bool activo;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label:
          'Sensor $numero: ${activo ? 'sobre la línea' : 'fuera de la línea'}',
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56,
        decoration: BoxDecoration(
          color: activo
              ? CockpitColors.primaryTonal
              : CockpitColors.surfaceContainer,
          borderRadius: BorderRadius.circular(CockpitRadius.md),
          border: Border.all(
            color: activo
                ? CockpitColors.primary.withValues(alpha: 0.7)
                : Colors.transparent,
          ),
          boxShadow: activo
              ? <BoxShadow>[
                  BoxShadow(
                    color: CockpitColors.primary.withValues(alpha: 0.25),
                    blurRadius: 8,
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              '$numero',
              style: mono(
                size: 12,
                color: activo
                    ? CockpitColors.primary
                    : CockpitColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: activo
                    ? CockpitColors.primary
                    : CockpitColors.outlineVariant,
                boxShadow: activo
                    ? <BoxShadow>[
                        BoxShadow(
                          color: CockpitColors.primary.withValues(alpha: 0.8),
                          blurRadius: 6,
                        ),
                      ]
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pista con marcador: dónde ve la línea la regleta (±32 mm).
class _PistaLinea extends StatelessWidget {
  const _PistaLinea({required this.lineaMm});

  final double? lineaMm;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints c) {
        const double alto = 14;
        const double marcador = 44;
        final double ancho = c.maxWidth;
        final double? l = lineaMm;
        final double fraccion = l == null ? 0.5 : fraccionPistaLinea(l);
        final double izq = (ancho - marcador) * fraccion;
        return SizedBox(
          height: alto,
          child: Stack(
            alignment: Alignment.centerLeft,
            children: <Widget>[
              Container(
                height: 6,
                decoration: BoxDecoration(
                  color: CockpitColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              Positioned(
                left: ancho / 2 - 1,
                child: Container(
                  width: 2,
                  height: alto,
                  color: CockpitColors.outline,
                ),
              ),
              if (l != null)
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOutCubic,
                  left: izq,
                  child: Container(
                    width: marcador,
                    height: 8,
                    decoration: BoxDecoration(
                      color: CockpitColors.primary,
                      borderRadius: BorderRadius.circular(4),
                      boxShadow: <BoxShadow>[
                        BoxShadow(
                          color: CockpitColors.primary.withValues(alpha: 0.6),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Los dos motores (izquierdo y derecho) con velocidad y RPM estimadas.
class _TarjetaMotores extends StatelessWidget {
  const _TarjetaMotores({required this.estado, required this.sin});

  final Estado? estado;
  final bool sin;

  @override
  Widget build(BuildContext context) {
    final Estado? e = sin ? null : estado;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          child: _Motor(etiqueta: 'M-IZQ', v: e?.vIzq),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _Motor(etiqueta: 'M-DER', v: e?.vDer),
        ),
      ],
    );
  }
}

class _Motor extends StatelessWidget {
  const _Motor({required this.etiqueta, required this.v});

  final String etiqueta;
  final double? v;

  @override
  Widget build(BuildContext context) {
    final double? vel = v;
    final bool parado = vel == null || vel.abs() < 0.005;
    final bool atras = vel != null && vel < -0.005;
    final Color color = vel == null
        ? CockpitColors.outline
        : (atras ? CockpitColors.warning : CockpitColors.primary);
    final String sentido = vel == null
        ? '—'
        : (parado ? 'ALTO' : (atras ? 'ATRÁS' : 'ADEL.'));

    return CockpitCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  etiqueta,
                  style: CockpitText.labelMd.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ),
              Icon(
                parado
                    ? Icons.pause_circle_outline
                    : (atras ? Icons.rotate_left : Icons.rotate_right),
                color: color,
                size: 20,
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: <Widget>[
                Text(
                  vel == null ? '—' : signo(vel, decimales: 2),
                  style: cifra(size: 24),
                ),
                const SizedBox(width: 3),
                Text(
                  'm/s',
                  style: mono(
                    size: 11,
                    peso: FontWeight.w500,
                    color: CockpitColors.onSurfaceVariant,
                    espaciado: 0,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          ProgressTrack(
            fraccion: vel == null ? 0 : math.min(1.0, vel.abs() / 0.6),
            color: color,
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              _DatoPeque(
                etiqueta: 'RPM ≈',
                valor: vel == null
                    ? '—'
                    : rpmDeVelocidad(vel).abs().toStringAsFixed(0),
              ),
              _DatoPeque(
                etiqueta: 'SENTIDO',
                valor: sentido,
                color: color,
                derecha: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DatoPeque extends StatelessWidget {
  const _DatoPeque({
    required this.etiqueta,
    required this.valor,
    this.color = CockpitColors.onSurface,
    this.derecha = false,
  });

  final String etiqueta;
  final String valor;
  final Color color;
  final bool derecha;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: derecha
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          etiqueta,
          style: CockpitText.telemetrySm.copyWith(
            color: CockpitColors.onSurfaceVariant,
            fontSize: 10,
          ),
        ),
        Text(valor, style: cifra(size: 14, color: color)),
      ],
    );
  }
}

/// HUD de obstáculos: lo que ve cada HC-SR04P (no hay cámara en el robot).
class _TarjetaObstaculos extends StatelessWidget {
  const _TarjetaObstaculos({required this.ultrasonido});

  final Ultrasonido? ultrasonido;

  @override
  Widget build(BuildContext context) {
    final Ultrasonido? u = ultrasonido;
    final ZonaSonar zf = zonaFrente(u);
    final ZonaSonar za = zonaAtras(u);
    final bool fallo = zf == ZonaSonar.fallo || za == ZonaSonar.fallo;
    final bool vigente = zf != ZonaSonar.sinSenal && zf != ZonaSonar.sinDatos;

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.sensors,
            etiqueta: 'HUD de obstáculos',
            trailing: StatusPill(
              texto: fallo ? 'FALLO' : (vigente ? '2 CANALES' : 'SIN SEÑAL'),
              color: fallo
                  ? CockpitColors.hazard
                  : (vigente ? CockpitColors.ok : CockpitColors.outline),
            ),
          ),
          const SizedBox(height: 12),
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
      ),
    );
  }
}

/// Acciones rápidas: Frenar y Modo Auto (mismas órdenes y reglas de siempre).
class _AccionesRapidas extends StatelessWidget {
  const _AccionesRapidas({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final bool activo = servicio.puedeEnviarOrdenes;
    return Row(
      children: <Widget>[
        Expanded(
          child: Pressable(
            habilitado: activo,
            child: OutlinedButton.icon(
              onPressed: activo
                  ? () => enviarOrden(context, servicio, 'frenar')
                  : null,
              icon: const Icon(
                Icons.stop_circle_outlined,
                size: 20,
                color: CockpitColors.primary,
              ),
              label: const FittedBox(
                fit: BoxFit.scaleDown,
                child: Text('FRENAR'),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Pressable(
            habilitado: activo,
            child: FilledButton.icon(
              onPressed: activo
                  ? () => enviarOrden(context, servicio, 'auto')
                  : null,
              icon: const Icon(Icons.smart_toy_outlined, size: 20),
              label: const FittedBox(
                fit: BoxFit.scaleDown,
                child: Text('MODO AUTO'),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
