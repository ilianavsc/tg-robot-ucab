import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/estado.dart';
import '../../core/models/orden_ack.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'alertas_p11.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';

/// **Controles**: modo (MANUAL RC / LINE TRACK), matriz táctil en cruz, último
/// ACK y el núcleo de seguridad.
///
/// Las órdenes son las del firmware (`adelante`, `atras`, `izquierda`,
/// `derecha`, `frenar`, `auto`) y salen por `MqttService.publicarOrden` (QoS 1)
/// exactamente como antes: un toque, una orden. No se cambió el protocolo.
class PantallaControles extends StatelessWidget {
  const PantallaControles({super.key});

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final Estado? e = servicio.ultimoEstado;
    final bool sin = estadoSinSenal(e);

    // Con el banner de alerta visible (p. ej. obstáculo) la lista tiene menos
    // altura útil: +48 px de colchón al final para que el Freno Remoto nunca tape
    // "GIRAR DER" ni "RETROCESO" al desplazarse en 390×844.
    final bool bannerVisible = servicio.centroAlertas.principal != null;
    return ListView(
      key: const PageStorageKey<String>('controles'),
      padding: EdgeInsets.fromLTRB(16, 12, 16, 120 + (bannerVisible ? 48 : 0)),
      children: <Widget>[
        _PestanasModo(servicio: servicio, estado: sin ? null : e),
        const SizedBox(height: 12),
        _BannerModo(servicio: servicio, estado: sin ? null : e),
        const SizedBox(height: 12),
        CockpitColumnas(
          children: <Widget>[
            _MatrizTactil(servicio: servicio, estado: sin ? null : e),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _TarjetaAck(servicio: servicio),
                const SizedBox(height: 12),
                _NucleoSeguridad(servicio: servicio, estado: sin ? null : e),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

/// Pestañas de modo. Tocar la que **no** está activa envía la orden que cambia
/// de modo (`frenar` pasa a MANUAL; `auto` pasa a AUTÓNOMO). Tocar la activa no
/// hace nada, para no frenar el robot por accidente.
class _PestanasModo extends StatelessWidget {
  const _PestanasModo({required this.servicio, required this.estado});

  final MqttService servicio;
  final Estado? estado;

  @override
  Widget build(BuildContext context) {
    final Estado? e = estado;
    final bool activo = servicio.puedeEnviarOrdenes;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceLowest,
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        border: Border.all(
          color: CockpitColors.outlineVariant.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _Pestana(
              icono: Icons.sports_esports_outlined,
              etiqueta: 'MANUAL RC',
              seleccionada: e?.esManual ?? false,
              alTocar: activo && !(e?.esManual ?? false)
                  ? () => enviarOrden(context, servicio, 'frenar')
                  : null,
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: _Pestana(
              icono: Icons.alt_route,
              etiqueta: 'LINE TRACK',
              seleccionada: e?.esAutonomo ?? false,
              alTocar: activo && !(e?.esAutonomo ?? false)
                  ? () => enviarOrden(context, servicio, 'auto')
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _Pestana extends StatelessWidget {
  const _Pestana({
    required this.icono,
    required this.etiqueta,
    required this.seleccionada,
    required this.alTocar,
  });

  final IconData icono;
  final String etiqueta;
  final bool seleccionada;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final Color color = seleccionada
        ? CockpitColors.onPrimary
        : CockpitColors.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: seleccionada,
      label: 'Modo $etiqueta',
      child: Material(
        color: seleccionada ? CockpitColors.primary : Colors.transparent,
        borderRadius: BorderRadius.circular(CockpitRadius.md + 2),
        child: InkWell(
          borderRadius: BorderRadius.circular(CockpitRadius.md + 2),
          onTap: alTocar,
          child: Container(
            height: 44,
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(icono, size: 18, color: color),
                const SizedBox(width: 6),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      etiqueta,
                      style: CockpitText.labelMd.copyWith(color: color),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Banner del modo actual y de la última orden.
class _BannerModo extends StatelessWidget {
  const _BannerModo({required this.servicio, required this.estado});

  final MqttService servicio;
  final Estado? estado;

  @override
  Widget build(BuildContext context) {
    final Estado? e = estado;
    final String titulo;
    final Color color;
    if (e == null) {
      titulo = 'SIN TELEMETRÍA DEL ROBOT';
      color = CockpitColors.outline;
    } else if (e.esManual) {
      titulo = 'CONTROL MANUAL ACTIVO';
      color = CockpitColors.primary;
    } else {
      titulo = 'SEGUIMIENTO AUTÓNOMO ACTIVO';
      color = CockpitColors.ok;
    }

    final String? cmd = servicio.ultimoComando;
    final String sub = cmd == null
        ? 'Bus de órdenes MQTT · QoS 1'
        : 'Última orden: $cmd${servicio.esperandoAck ? ' · esperando ACK…' : ' · confirmada'}';
    final Duration? lat = servicio.ultimoAck?.latencia;

    return CockpitCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: <Widget>[
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: <BoxShadow>[
                BoxShadow(color: color.withValues(alpha: 0.7), blurRadius: 6),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(titulo, style: CockpitText.labelMd.copyWith(color: color)),
                const SizedBox(height: 2),
                Text(
                  sub,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: CockpitText.telemetrySm.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (lat != null) ...<Widget>[
            const SizedBox(width: 8),
            StatusPill(
              texto: 'LATENCIA ${lat.inMilliseconds} ms',
              color: CockpitColors.primary,
              punto: false,
            ),
          ],
        ],
      ),
    );
  }
}

/// Matriz táctil en cruz: AVANZAR / GIRAR IZQ / ALTO / GIRAR DER / RETROCESO,
/// con las RPM (estimadas) y la velocidad de cada rueda en las esquinas.
class _MatrizTactil extends StatelessWidget {
  const _MatrizTactil({required this.servicio, required this.estado});

  final MqttService servicio;
  final Estado? estado;

  @override
  Widget build(BuildContext context) {
    final Estado? e = estado;
    final bool activo = servicio.puedeEnviarOrdenes;

    Widget boton(String etiqueta, String cmd, IconData icono) => _BotonCruz(
      etiqueta: etiqueta,
      comando: cmd,
      icono: icono,
      habilitado: activo,
      alTocar: () => enviarOrden(context, servicio, cmd),
    );

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.control_camera,
            etiqueta: 'Matriz táctil',
            trailing: StatusPill(
              texto: activo ? 'LISTO · QoS 1' : 'SIN ENLACE',
              color: activo ? CockpitColors.ok : CockpitColors.outline,
              punto: false,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            activo
                ? 'Un toque envía la orden. En manual, 5 s sin órdenes y el robot frena.'
                : 'Conéctate al broker para enviar órdenes.',
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 14),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: LayoutBuilder(
                builder: (BuildContext context, BoxConstraints c) {
                  const double sep = 8;
                  final double lado = (c.maxWidth - sep * 2) / 3;
                  final double alto = lado * 0.95;
                  Widget fila(List<Widget> celdas) => Row(
                    children: <Widget>[
                      for (int i = 0; i < 3; i++) ...<Widget>[
                        if (i > 0) const SizedBox(width: sep),
                        SizedBox(width: lado, height: alto, child: celdas[i]),
                      ],
                    ],
                  );
                  return Column(
                    children: <Widget>[
                      fila(<Widget>[
                        _CeldaRueda(
                          etiqueta: 'IZQ · RPM',
                          valor: e == null
                              ? '—'
                              : rpmDeVelocidad(e.vIzq).abs().toStringAsFixed(0),
                        ),
                        boton('AVANZAR', 'adelante', Icons.keyboard_arrow_up),
                        _CeldaRueda(
                          etiqueta: 'DER · RPM',
                          valor: e == null
                              ? '—'
                              : rpmDeVelocidad(e.vDer).abs().toStringAsFixed(0),
                        ),
                      ]),
                      const SizedBox(height: sep),
                      fila(<Widget>[
                        boton('GIRAR IZQ', 'izquierda', Icons.rotate_left),
                        _BotonAlto(
                          habilitado: activo,
                          alTocar: () =>
                              enviarOrden(context, servicio, 'frenar'),
                        ),
                        boton('GIRAR DER', 'derecha', Icons.rotate_right),
                      ]),
                      const SizedBox(height: sep),
                      fila(<Widget>[
                        _CeldaRueda(
                          etiqueta: 'IZQ · m/s',
                          valor: e == null ? '—' : signo(e.vIzq, decimales: 2),
                        ),
                        boton('RETROCESO', 'atras', Icons.keyboard_arrow_down),
                        _CeldaRueda(
                          etiqueta: 'DER · m/s',
                          valor: e == null ? '—' : signo(e.vDer, decimales: 2),
                        ),
                      ]),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CeldaRueda extends StatelessWidget {
  const _CeldaRueda({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Text(
            etiqueta,
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
              fontSize: 10,
            ),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              valor,
              style: cifra(size: 18, color: CockpitColors.primary),
            ),
          ),
        ],
      ),
    );
  }
}

class _BotonCruz extends StatelessWidget {
  const _BotonCruz({
    required this.etiqueta,
    required this.comando,
    required this.icono,
    required this.habilitado,
    required this.alTocar,
  });

  final String etiqueta;
  final String comando;
  final IconData icono;
  final bool habilitado;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: habilitado,
      label: '$etiqueta. Envía la orden $comando.',
      excludeSemantics: true,
      child: Pressable(
        habilitado: habilitado,
        child: Material(
          color: CockpitColors.surfaceHigh,
          borderRadius: BorderRadius.circular(CockpitRadius.lg),
          child: InkWell(
            borderRadius: BorderRadius.circular(CockpitRadius.lg),
            onTap: habilitado ? alTocar : null,
            child: Opacity(
              opacity: habilitado ? 1 : 0.45,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Icon(icono, size: 30, color: CockpitColors.primary),
                  const SizedBox(height: 2),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      etiqueta,
                      style: const TextStyle(
                        fontFamily: CockpitText.sans,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: CockpitColors.onSurface,
                      ),
                    ),
                  ),
                  Text(
                    comando,
                    style: CockpitText.telemetrySm.copyWith(
                      color: CockpitColors.onSurfaceVariant,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón central ALTO: envía `frenar` (pasa a MANUAL con las ruedas en 0).
class _BotonAlto extends StatelessWidget {
  const _BotonAlto({required this.habilitado, required this.alTocar});

  final bool habilitado;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: habilitado,
      label: 'Alto. Envía la orden frenar.',
      excludeSemantics: true,
      child: Pressable(
        habilitado: habilitado,
        child: Material(
          color: CockpitColors.errorContainer,
          borderRadius: BorderRadius.circular(CockpitRadius.lg),
          child: InkWell(
            borderRadius: BorderRadius.circular(CockpitRadius.lg),
            onTap: habilitado ? alTocar : null,
            child: Opacity(
              opacity: habilitado ? 1 : 0.5,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(CockpitRadius.lg),
                  border: Border.all(
                    color: CockpitColors.hazard.withValues(alpha: 0.5),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    const Icon(
                      Icons.pan_tool_outlined,
                      size: 30,
                      color: CockpitColors.onErrorContainer,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ALTO',
                      style: CockpitText.labelMd.copyWith(
                        fontWeight: FontWeight.w700,
                        color: CockpitColors.onErrorContainer,
                      ),
                    ),
                    Text(
                      'frenar',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onErrorContainer.withValues(
                          alpha: 0.8,
                        ),
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tarjeta del último ACK. El cambio de modo (MANUAL RC / LINE TRACK) vive solo
/// en las pestañas de arriba: no se repite aquí como "AUTO NAV".
class _TarjetaAck extends StatelessWidget {
  const _TarjetaAck({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final ({String titulo, String detalle, String etiqueta, Color color}) ack =
        _resumenAck(servicio);

    return _TarjetaAccion(
      icono: ack.etiqueta == 'ESPERANDO'
          ? Icons.hourglass_top
          : Icons.check_circle_outline,
      colorIcono: ack.color,
      fondoIcono: ack.color.withValues(alpha: 0.18),
      etiqueta: ack.etiqueta,
      colorEtiqueta: ack.color,
      titulo: ack.titulo,
      detalle: ack.detalle,
      habilitado: false,
      alTocar: null,
    );
  }

  /// Misma lógica de textos que la antigua caja de "Último ACK".
  static ({String titulo, String detalle, String etiqueta, Color color})
  _resumenAck(MqttService servicio) {
    final OrdenAck? a = servicio.ultimoAck;
    if (servicio.esperandoAck) {
      return (
        titulo: 'ÚLTIMO ACK',
        detalle:
            'Enviada "${servicio.ultimoComando ?? ''}": esperando confirmación. '
            'Si no llega, revisa que el robot (o el P10) esté en el mismo broker.',
        etiqueta: 'ESPERANDO',
        color: CockpitColors.warning,
      );
    }
    if (a == null) {
      return (
        titulo: 'ÚLTIMO ACK',
        detalle: 'Ninguno todavía. Envía una orden para ver la confirmación del robot.',
        etiqueta: 'SIN ORDEN',
        color: CockpitColors.outline,
      );
    }
    final String que = a.comando != null
        ? '"${a.comando}"'
        : 'una orden de otra app';
    final String ms = a.latencia != null
        ? ' en ${a.latencia!.inMilliseconds} ms'
        : '';
    final String idCorto = a.id.length > 8 ? '${a.id.substring(0, 8)}…' : a.id;
    return (
      titulo: 'ÚLTIMO ACK',
      detalle:
          'Confirmó $que$ms${a.simulada ? ' (demo)' : ''}${a.repetida ? ' · repetido' : ''}. '
          'id $idCorto${a.recibidas != null ? ' · ${a.recibidas} órdenes' : ''} · ${horaCorta(a.llegada)}',
      etiqueta: 'CONFIRMADA',
      color: CockpitColors.ok,
    );
  }
}

class _TarjetaAccion extends StatelessWidget {
  const _TarjetaAccion({
    required this.icono,
    required this.colorIcono,
    required this.fondoIcono,
    required this.etiqueta,
    required this.colorEtiqueta,
    required this.titulo,
    required this.detalle,
    required this.habilitado,
    required this.alTocar,
  });

  final IconData icono;
  final Color colorIcono;
  final Color fondoIcono;
  final String etiqueta;
  final Color colorEtiqueta;
  final String titulo;
  final String detalle;
  final bool habilitado;
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final Widget contenido = Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceHigh.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        border: Border.all(
          color: CockpitColors.outlineVariant.withValues(alpha: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: fondoIcono,
                  borderRadius: BorderRadius.circular(CockpitRadius.md),
                ),
                child: Icon(icono, color: colorIcono),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  etiqueta,
                  textAlign: TextAlign.right,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: CockpitText.labelMd.copyWith(
                    fontSize: 11,
                    color: colorEtiqueta,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            titulo,
            style: const TextStyle(
              fontFamily: CockpitText.sans,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: CockpitColors.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            detalle,
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
    if (alTocar == null) return contenido;
    return Semantics(
      button: true,
      enabled: habilitado,
      label: '$titulo. Envía la orden auto.',
      child: Pressable(
        habilitado: habilitado,
        child: Opacity(
          opacity: habilitado ? 1 : 0.5,
          child: InkWell(
            borderRadius: BorderRadius.circular(CockpitRadius.lg),
            onTap: habilitado ? alTocar : null,
            child: contenido,
          ),
        ),
      ),
    );
  }
}

/// Núcleo de seguridad: lo que hace el firmware para no moverse a ciegas
/// (watchdog manual de 5 s, obstáculos y corte por batería).
class _NucleoSeguridad extends StatelessWidget {
  const _NucleoSeguridad({required this.servicio, required this.estado});

  final MqttService servicio;
  final Estado? estado;

  @override
  Widget build(BuildContext context) {
    final Estado? e = estado;
    final ParadaInfo parada = describirParada(e?.parada ?? 'ninguna');
    final ZonaSonar zf = zonaFrente(servicio.ultimoUltrasonido);
    final ZonaSonar za = zonaAtras(servicio.ultimoUltrasonido);
    final NivelBateria nivel = nivelBateria(e);

    final String estadoGeneral;
    final Color colorGeneral;
    if (e == null) {
      estadoGeneral = 'SIN DATOS';
      colorGeneral = CockpitColors.outline;
    } else if (parada.detenido) {
      estadoGeneral = 'BLOQUEO ACTIVO';
      colorGeneral = colorNivel(parada.nivel!);
    } else {
      estadoGeneral = 'TODO OK';
      colorGeneral = CockpitColors.ok;
    }

    // Watchdog de inactividad (solo aplica en MANUAL)
    final String wd;
    final Color wdColor;
    if (e == null) {
      wd = '—';
      wdColor = CockpitColors.onSurface;
    } else if (e.parada == 'timeout') {
      wd = 'DETENIDO';
      wdColor = CockpitColors.warning;
    } else if (e.esManual) {
      wd = 'ARMADO';
      wdColor = CockpitColors.ok;
    } else {
      wd = 'N/A';
      wdColor = CockpitColors.onSurfaceVariant;
    }

    // Obstáculos
    final String obs;
    final Color obsColor;
    if (e == null && servicio.ultimoUltrasonido == null) {
      obs = '—';
      obsColor = CockpitColors.onSurface;
    } else if (e?.parada == 'obstaculo_frente' || zf == ZonaSonar.parada) {
      obs = 'FRENTE';
      obsColor = CockpitColors.error;
    } else if (e?.parada == 'obstaculo_atras' || za == ZonaSonar.parada) {
      obs = 'ATRÁS';
      obsColor = CockpitColors.warning;
    } else if (zf == ZonaSonar.fallo || za == ZonaSonar.fallo) {
      obs = 'FALLO';
      obsColor = CockpitColors.error;
    } else if (zf == ZonaSonar.precaucion || za == ZonaSonar.precaucion) {
      obs = 'CERCA';
      obsColor = CockpitColors.warning;
    } else {
      obs = 'LIBRE';
      obsColor = CockpitColors.ok;
    }

    final String bat;
    final Color batColor;
    switch (nivel) {
      case NivelBateria.corte:
        bat = 'CORTE';
        batColor = CockpitColors.error;
      case NivelBateria.aviso:
        bat = 'AVISO';
        batColor = CockpitColors.warning;
      case NivelBateria.nominal:
        bat = 'OK';
        batColor = CockpitColors.ok;
      case NivelBateria.sinMedida:
        bat = '—';
        batColor = CockpitColors.onSurface;
    }

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.shield_outlined,
            etiqueta: 'Núcleo de seguridad',
            colorIcono: colorGeneral,
            trailing: Text(
              estadoGeneral,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: CockpitText.labelMd.copyWith(color: colorGeneral),
            ),
          ),
          if (parada.detenido) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              parada.etiqueta,
              style: CockpitText.telemetrySm.copyWith(
                color: colorNivel(parada.nivel!),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Watchdog 5 s',
                  valor: wd,
                  tamano: 14,
                  color: wdColor,
                  pie: 'sin órdenes',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Obstáculo',
                  valor: obs,
                  tamano: 14,
                  color: obsColor,
                  pie: 'parada < 20 cm',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  etiqueta: 'Batería',
                  valor: bat,
                  tamano: 14,
                  color: batColor,
                  pie: 'corte 9.90 V',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
