import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'alertas_p11.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';

enum _Filtro { todas, criticas, avisos }

/// **Alertas**: watchdog de telemetría, alertas activas (con "Reconocer") y el
/// registro reciente de eventos del Centro de Alertas (P11).
///
/// La lógica vive en `core/alertas/centro_alertas.dart`; esta pantalla solo la
/// muestra y llama a `reconocerAlerta`, `reconocerTodasLasAlertas` y
/// `reiniciarSesion` del servicio.
class PantallaAlertas extends StatefulWidget {
  const PantallaAlertas({super.key});

  @override
  State<PantallaAlertas> createState() => _PantallaAlertasState();
}

class _PantallaAlertasState extends State<PantallaAlertas> {
  _Filtro _filtro = _Filtro.todas;

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final CentroAlertas centro = servicio.centroAlertas;
    final List<EventoAlerta> eventos = centro.eventos;
    final List<AlertaActiva> activas = centro.activas;

    final int nCriticas = eventos
        .where((EventoAlerta e) => e.nivel == NivelAlerta.critica)
        .length;
    final int nAvisos = eventos.length - nCriticas;
    final List<EventoAlerta> visibles = eventos.where((EventoAlerta e) {
      switch (_filtro) {
        case _Filtro.todas:
          return true;
        case _Filtro.criticas:
          return e.nivel == NivelAlerta.critica;
        case _Filtro.avisos:
          return e.nivel == NivelAlerta.aviso;
      }
    }).toList();

    return ListView(
      key: const PageStorageKey<String>('alertas'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: <Widget>[
        _TarjetaWatchdog(servicio: servicio),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            _ChipFiltro(
              icono: Icons.list_alt,
              etiqueta: 'TODAS (${eventos.length})',
              seleccionado: _filtro == _Filtro.todas,
              alTocar: () => setState(() => _filtro = _Filtro.todas),
            ),
            _ChipFiltro(
              icono: Icons.error_outline,
              colorIcono: CockpitColors.error,
              etiqueta: 'CRÍTICAS ($nCriticas)',
              seleccionado: _filtro == _Filtro.criticas,
              alTocar: () => setState(() => _filtro = _Filtro.criticas),
            ),
            _ChipFiltro(
              icono: Icons.warning_amber_rounded,
              colorIcono: CockpitColors.warning,
              etiqueta: 'AVISOS ($nAvisos)',
              seleccionado: _filtro == _Filtro.avisos,
              alTocar: () => setState(() => _filtro = _Filtro.avisos),
            ),
          ],
        ),
        if (activas.isNotEmpty) ...<Widget>[
          const SizedBox(height: 16),
          _Rotulo('ACTIVAS (${activas.length})'),
          const SizedBox(height: 8),
          for (final AlertaActiva a in activas) ...<Widget>[
            _TarjetaAlertaActiva(alerta: a, servicio: servicio),
            const SizedBox(height: 10),
          ],
        ],
        const SizedBox(height: 8),
        _Rotulo('REGISTRO RECIENTE'),
        const SizedBox(height: 8),
        if (visibles.isEmpty)
          CockpitCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Icon(Icons.verified_outlined, color: CockpitColors.ok),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    eventos.isEmpty
                        ? 'Sin eventos en esta sesión. Se registran: obstáculo < 20 cm, '
                              'sensor sin eco, proximidad 20–50 cm, batería ≤ 10.3 V y las '
                              'alertas que publica el robot.'
                        : 'No hay eventos de este tipo.',
                    style: CockpitText.bodySm.copyWith(
                      color: CockpitColors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          for (final EventoAlerta e in visibles) ...<Widget>[
            _TarjetaEvento(evento: e),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 6),
        Row(
          children: <Widget>[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: centro.pendientes == 0
                    ? null
                    : servicio.reconocerTodasLasAlertas,
                icon: const Icon(Icons.done_all, size: 18),
                label: const FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text('RECONOCER TODAS'),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: servicio.reiniciarSesion,
                icon: const Icon(Icons.restart_alt, size: 18),
                label: const FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text('REINICIAR SESIÓN'),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            'Alertas en vivo vía MQTT: ${servicio.topicoAlertas} (QoS 2)',
            textAlign: TextAlign.center,
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}

class _Rotulo extends StatelessWidget {
  const _Rotulo(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        texto,
        style: CockpitText.labelMd.copyWith(
          fontSize: 11,
          color: CockpitColors.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _ChipFiltro extends StatelessWidget {
  const _ChipFiltro({
    required this.icono,
    required this.etiqueta,
    required this.seleccionado,
    required this.alTocar,
    this.colorIcono = CockpitColors.onSurfaceVariant,
  });

  final IconData icono;
  final String etiqueta;
  final bool seleccionado;
  final VoidCallback alTocar;
  final Color colorIcono;

  @override
  Widget build(BuildContext context) {
    final Color texto = seleccionado
        ? CockpitColors.onPrimary
        : CockpitColors.onSurface;
    return Semantics(
      button: true,
      selected: seleccionado,
      label: 'Filtro $etiqueta',
      child: Material(
        color: seleccionado ? CockpitColors.primary : CockpitColors.surfaceHigh,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: alTocar,
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(
                  icono,
                  size: 16,
                  color: seleccionado ? CockpitColors.onPrimary : colorIcono,
                ),
                const SizedBox(width: 6),
                Text(
                  etiqueta,
                  style: CockpitText.labelMd.copyWith(color: texto),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Watchdog de telemetría: estado global, alertas activas y desglose del registro.
class _TarjetaWatchdog extends StatelessWidget {
  const _TarjetaWatchdog({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final CentroAlertas centro = servicio.centroAlertas;
    final List<AlertaActiva> activas = centro.activas;
    final List<EventoAlerta> eventos = centro.eventos;

    final bool hayCritica = activas.any(
      (AlertaActiva a) => a.nivel == NivelAlerta.critica,
    );
    final bool sinDatos =
        !servicio.simulando && !servicio.recibiendoDatos && eventos.isEmpty;
    final String estado;
    final Color color;
    if (hayCritica) {
      estado = 'CRÍTICO';
      color = CockpitColors.hazard;
    } else if (activas.isNotEmpty) {
      estado = 'AVISO';
      color = CockpitColors.warning;
    } else if (sinDatos) {
      estado = 'SIN DATOS';
      color = CockpitColors.outline;
    } else {
      estado = 'NOMINAL';
      color = CockpitColors.ok;
    }

    int cuenta(bool Function(EventoAlerta) f) => eventos.where(f).length;
    final int critActivadas = cuenta(
      (EventoAlerta e) =>
          e.accion == AccionAlerta.activada && e.nivel == NivelAlerta.critica,
    );
    final int avisoActivadas = cuenta(
      (EventoAlerta e) =>
          e.accion == AccionAlerta.activada && e.nivel == NivelAlerta.aviso,
    );
    final int reconocidas = cuenta(
      (EventoAlerta e) => e.accion == AccionAlerta.reconocida,
    );
    final int despejadas = cuenta(
      (EventoAlerta e) => e.accion == AccionAlerta.despejada,
    );

    final int rx = servicio.segundosSinDatos;
    final String rxTexto = servicio.simulando
        ? 'Modo Demo'
        : (rx < 0 ? 'sin datos' : 'RX hace $rx s');

    return CockpitCard(
      degradado: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: <Color>[
          CockpitColors.surfaceLow,
          CockpitColors.surfaceLow,
          Color(0xFF12262B),
        ],
        stops: <double>[0, 0.6, 1],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: color.withValues(alpha: 0.7),
                      blurRadius: 6,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'WATCHDOG DE TELEMETRÍA',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: CockpitText.labelMd.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ),
              const StatusPill(
                texto: 'Ciclo 2 s',
                color: CockpitColors.primary,
                punto: false,
                icono: Icons.timer_outlined,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text.rich(
            TextSpan(
              children: <InlineSpan>[
                TextSpan(
                  text: 'Estado del sistema: ',
                  style: CockpitText.headlineSm.copyWith(
                    color: CockpitColors.onSurface,
                  ),
                ),
                TextSpan(
                  text: estado,
                  style: CockpitText.headlineSm.copyWith(color: color),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              Expanded(
                child: Row(
                  children: <Widget>[
                    Icon(
                      activas.isEmpty
                          ? Icons.check_circle_outline
                          : Icons.warning_amber_rounded,
                      size: 16,
                      color: activas.isEmpty ? CockpitColors.ok : color,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        '${activas.length} alerta${activas.length == 1 ? '' : 's'} activa${activas.length == 1 ? '' : 's'} · $rxTexto',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: CockpitText.bodySm.copyWith(
                          color: CockpitColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: CockpitColors.surfaceHigh.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(CockpitRadius.lg),
                ),
                child: Text(
                  '${eventos.length} EVENTOS\nREGISTRADOS',
                  textAlign: TextAlign.center,
                  style: CockpitText.labelMd.copyWith(
                    fontSize: 10,
                    color: CockpitColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _BarraSegmentada(
            segmentos: <(int, Color)>[
              (critActivadas, CockpitColors.hazard),
              (avisoActivadas, CockpitColors.warning),
              (reconocidas, CockpitColors.secondary),
              (despejadas, CockpitColors.ok),
            ],
          ),
          const SizedBox(height: 8),
          const Wrap(
            spacing: 12,
            runSpacing: 4,
            children: <Widget>[
              _LeyendaBarra('CRÍTICAS', CockpitColors.hazard),
              _LeyendaBarra('AVISOS', CockpitColors.warning),
              _LeyendaBarra('RECONOCIDAS', CockpitColors.secondary),
              _LeyendaBarra('DESPEJADAS', CockpitColors.ok),
            ],
          ),
        ],
      ),
    );
  }
}

class _LeyendaBarra extends StatelessWidget {
  const _LeyendaBarra(this.texto, this.color);

  final String texto;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          texto,
          style: CockpitText.telemetrySm.copyWith(
            color: CockpitColors.onSurfaceVariant,
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}

/// Barra con un tramo por categoría del registro (proporcional a su cantidad).
class _BarraSegmentada extends StatelessWidget {
  const _BarraSegmentada({required this.segmentos});

  final List<(int, Color)> segmentos;

  @override
  Widget build(BuildContext context) {
    final List<(int, Color)> con = segmentos
        .where(((int, Color) s) => s.$1 > 0)
        .toList();
    if (con.isEmpty) {
      return Container(
        height: 6,
        decoration: BoxDecoration(
          color: CockpitColors.ok.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(3),
        ),
      );
    }
    return Row(
      children: <Widget>[
        for (int i = 0; i < con.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            flex: con[i].$1,
            child: Container(
              height: 6,
              decoration: BoxDecoration(
                color: con[i].$2,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Alerta activa con su detalle y el botón de reconocer.
class _TarjetaAlertaActiva extends StatelessWidget {
  const _TarjetaAlertaActiva({required this.alerta, required this.servicio});

  final AlertaActiva alerta;
  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final bool critica = alerta.nivel == NivelAlerta.critica;
    final Color color = colorNivel(alerta.nivel);

    return CockpitCard(
      borde: alerta.reconocida ? null : color.withValues(alpha: 0.55),
      resplandor: alerta.reconocida ? null : color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _CabeceraEvento(
            nivel: alerta.nivel,
            id: '#${alerta.clave.toUpperCase()}',
            hora: alerta.desde,
            titulo: alerta.titulo,
          ),
          const SizedBox(height: 10),
          Text(
            alerta.detalle,
            style: CockpitText.bodyMd.copyWith(
              color: CockpitColors.onSurface.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              StatusPill(
                texto: alerta.origen == OrigenAlerta.robot
                    ? 'Robot · MQTT'
                    : 'Telemetría',
                color: CockpitColors.primary,
                punto: false,
              ),
              if (alerta.confirmadaPorRobot &&
                  alerta.origen != OrigenAlerta.robot)
                const StatusPill(
                  texto: 'Confirmada por el robot',
                  color: CockpitColors.ok,
                  punto: false,
                ),
              if (alerta.reconocida)
                const StatusPill(
                  texto: 'Reconocida',
                  color: CockpitColors.secondary,
                  icono: Icons.check,
                  punto: false,
                )
              else
                Material(
                  color: critica
                      ? CockpitColors.errorContainer
                      : CockpitColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(CockpitRadius.md),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(CockpitRadius.md),
                    onTap: () => servicio.reconocerAlerta(alerta.clave),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      alignment: Alignment.center,
                      child: Text(
                        'RECONOCER',
                        style: CockpitText.labelMd.copyWith(
                          color: critica
                              ? CockpitColors.onErrorContainer
                              : CockpitColors.onSurface,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Entrada del registro: qué pasó, cuándo y quién lo detectó.
class _TarjetaEvento extends StatelessWidget {
  const _TarjetaEvento({required this.evento});

  final EventoAlerta evento;

  @override
  Widget build(BuildContext context) {
    final String accion;
    final Color colorAccion;
    final IconData icono;
    switch (evento.accion) {
      case AccionAlerta.activada:
        accion = 'ACTIVADA';
        colorAccion = colorNivel(evento.nivel);
        icono = Icons.bolt;
      case AccionAlerta.reconocida:
        accion = 'RECONOCIDA';
        colorAccion = CockpitColors.secondary;
        icono = Icons.check;
      case AccionAlerta.despejada:
        accion = 'DESPEJADA';
        colorAccion = CockpitColors.ok;
        icono = Icons.verified_outlined;
    }
    final String id =
        '#EV-${(evento.hora.millisecondsSinceEpoch % 10000).toString().padLeft(4, '0')}';

    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _CabeceraEvento(
            nivel: evento.nivel,
            id: id,
            hora: evento.hora,
            titulo: evento.titulo,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              StatusPill(
                texto: accion,
                color: colorAccion,
                icono: icono,
                punto: false,
              ),
              StatusPill(
                texto: evento.origen == OrigenAlerta.robot
                    ? 'Robot · MQTT'
                    : 'Telemetría',
                color: CockpitColors.onSurfaceVariant,
                punto: false,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Cabecera común: icono de nivel, etiqueta CRÍTICA/AVISO, id, hora y título.
class _CabeceraEvento extends StatelessWidget {
  const _CabeceraEvento({
    required this.nivel,
    required this.id,
    required this.hora,
    required this.titulo,
  });

  final NivelAlerta nivel;
  final String id;
  final DateTime hora;
  final String titulo;

  @override
  Widget build(BuildContext context) {
    final bool critica = nivel == NivelAlerta.critica;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: critica
                ? CockpitColors.errorContainer
                : CockpitColors.warning.withValues(alpha: 0.22),
            borderRadius: BorderRadius.circular(CockpitRadius.lg),
          ),
          child: Icon(
            Icons.warning_amber_rounded,
            color: critica
                ? CockpitColors.onErrorContainer
                : CockpitColors.warning,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Wrap(
                spacing: 8,
                runSpacing: 2,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  CockpitTag(
                    texto: critica ? 'Crítica' : 'Aviso',
                    fondo: critica
                        ? CockpitColors.errorContainer
                        : CockpitColors.warning.withValues(alpha: 0.25),
                    color: critica
                        ? CockpitColors.onErrorContainer
                        : CockpitColors.warning,
                  ),
                  Text(
                    'ID: $id',
                    style: CockpitText.telemetrySm.copyWith(
                      color: CockpitColors.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    'Hoy ${horaCorta(hora)}',
                    style: CockpitText.telemetrySm.copyWith(
                      color: CockpitColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(titulo, style: CockpitText.titleMd),
            ],
          ),
        ),
      ],
    );
  }
}
