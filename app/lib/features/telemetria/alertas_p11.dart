import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/mqtt/mqtt_service.dart';

/// Colores del Centro de Alertas (los mismos tonos de la pantalla principal).
const Color _rojo = Color(0xFFE11D48);
const Color _rojoFondo = Color(0xFFFFF1F2);
const Color _rojoTexto = Color(0xFF9F1239);
const Color _ambar = Color(0xFFD97706);
const Color _ambarFondo = Color(0xFFFFFBEB);
const Color _ambarTexto = Color(0xFF92400E);
const Color _gris = Color(0xFF64748B);

String _hora(DateTime d) {
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${dos(d.hour)}:${dos(d.minute)}:${dos(d.second)}';
}

Color _color(NivelAlerta n) => n == NivelAlerta.critica ? _rojo : _ambar;

/// **P11 · Banner de Alerta Activa.** Arriba de la pantalla: rojo si es
/// crítica, ámbar si es aviso. Muestra la hora, el motivo, de dónde salió y el
/// botón "Reconocer". Si no hay alertas pendientes, no ocupa espacio.
class BannerAlertaActiva extends StatelessWidget {
  const BannerAlertaActiva({super.key});

  @override
  Widget build(BuildContext context) {
    final servicio = context.watch<MqttService>();
    final AlertaActiva? a = servicio.centroAlertas.principal;
    final int pendientes = servicio.centroAlertas.pendientes;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      switchInCurve: Curves.easeOutCubic,
      child: a == null
          ? const SizedBox(key: ValueKey<String>('sin-alerta'), width: double.infinity)
          : _ContenidoBanner(
              key: ValueKey<String>('${a.clave}-${a.desde.millisecondsSinceEpoch}'),
              alerta: a,
              otras: pendientes - 1,
              alReconocer: () => servicio.reconocerAlerta(a.clave),
            ),
    );
  }
}

class _ContenidoBanner extends StatelessWidget {
  const _ContenidoBanner({
    super.key,
    required this.alerta,
    required this.otras,
    required this.alReconocer,
  });

  final AlertaActiva alerta;
  final int otras;
  final VoidCallback alReconocer;

  @override
  Widget build(BuildContext context) {
    final bool critica = alerta.nivel == NivelAlerta.critica;
    final Color color = _color(alerta.nivel);
    final Color fondo = critica ? _rojoFondo : _ambarFondo;
    final Color texto = critica ? _rojoTexto : _ambarTexto;

    final Widget boton = FilledButton.icon(
      onPressed: alReconocer,
      style: FilledButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 40),
        visualDensity: VisualDensity.compact,
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
      ),
      icon: const Icon(Icons.check, size: 16),
      label: const Text('Reconocer'),
    );

    return Semantics(
      liveRegion: true,
      label: 'Alerta ${critica ? 'crítica' : 'de aviso'}: ${alerta.titulo}',
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: fondo,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color, width: 2),
        ),
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints c) {
            final Widget info = Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  critica ? Icons.report : Icons.warning_amber_rounded,
                  color: color,
                  size: 28,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        '${critica ? 'ALERTA CRÍTICA' : 'AVISO'} · ${_hora(alerta.desde)}'
                        '${alerta.confirmadaPorRobot ? ' · confirmada por el robot' : ''}',
                        style: TextStyle(
                          color: color,
                          fontWeight: FontWeight.w800,
                          fontSize: 11.5,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        alerta.titulo,
                        style: TextStyle(
                          color: texto,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        alerta.detalle,
                        style: TextStyle(color: texto, fontSize: 13),
                      ),
                      if (otras > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '+$otras alerta${otras == 1 ? '' : 's'} más sin reconocer',
                            style: TextStyle(
                              color: texto,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            );
            if (c.maxWidth < 480) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[info, const SizedBox(height: 10), boton],
              );
            }
            return Row(
              children: <Widget>[
                Expanded(child: info),
                const SizedBox(width: 12),
                boton,
              ],
            );
          },
        ),
      ),
    );
  }
}

/// **P11 · Centro de Alertas Activas.** Lista lo que está pasando ahora y el
/// registro reciente de eventos (activada / reconocida / despejada).
class TarjetaCentroAlertas extends StatelessWidget {
  const TarjetaCentroAlertas({super.key});

  static const int _eventosVisibles = 8;

  @override
  Widget build(BuildContext context) {
    final servicio = context.watch<MqttService>();
    final centro = servicio.centroAlertas;
    final activas = centro.activas;
    final eventos = centro.eventos.take(_eventosVisibles).toList();
    final bool hayCritica =
        activas.any((AlertaActiva a) => a.nivel == NivelAlerta.critica);
    final Color acento = activas.isEmpty
        ? const Color(0xFF0F9D84)
        : (hayCritica ? _rojo : _ambar);

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: activas.isEmpty ? const Color(0xFFCBD5E1) : acento,
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(Icons.notifications_active, color: acento, size: 24),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Centro de Alertas (P11)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ),
                if (centro.pendientes > 0)
                  TextButton.icon(
                    onPressed: servicio.reconocerTodasLasAlertas,
                    icon: const Icon(Icons.done_all, size: 16),
                    label: const Text('Reconocer todas'),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              activas.isEmpty
                  ? 'Sin alertas activas. Vigila obstáculo < 20 cm, sensor sin eco, '
                      'proximidad 20–50 cm y batería ≤ 10,3 V.'
                  : '${activas.length} activa${activas.length == 1 ? '' : 's'} · '
                      '${centro.pendientes} sin reconocer',
              style: const TextStyle(color: _gris, fontSize: 13),
            ),
            if (activas.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              for (final a in activas) _FilaActiva(alerta: a, servicio: servicio),
            ],
            const Divider(height: 24),
            const Text(
              'Registro reciente',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 6),
            if (eventos.isEmpty)
              const Text(
                'Todavía no hay eventos en esta sesión.',
                style: TextStyle(color: _gris, fontSize: 12.5),
              )
            else
              for (final e in eventos) _FilaEvento(evento: e),
          ],
        ),
      ),
    );
  }
}

class _FilaActiva extends StatelessWidget {
  const _FilaActiva({required this.alerta, required this.servicio});

  final AlertaActiva alerta;
  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final Color color = _color(alerta.nivel);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: alerta.reconocida ? const Color(0xFFF8FAFC) : color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: alerta.reconocida ? const Color(0xFFE2E8F0) : color),
      ),
      child: Row(
        children: <Widget>[
          Icon(
            alerta.nivel == NivelAlerta.critica ? Icons.report : Icons.warning_amber_rounded,
            color: alerta.reconocida ? _gris : color,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  alerta.titulo,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                ),
                Text(
                  'Desde ${_hora(alerta.desde)} · '
                  '${alerta.origen == OrigenAlerta.robot ? 'robot (MQTT)' : 'telemetría'}'
                  '${alerta.reconocida ? ' · reconocida' : ''}',
                  style: const TextStyle(color: _gris, fontSize: 12),
                ),
              ],
            ),
          ),
          if (!alerta.reconocida)
            IconButton(
              tooltip: 'Reconocer',
              onPressed: () => servicio.reconocerAlerta(alerta.clave),
              icon: Icon(Icons.check_circle_outline, color: color),
            ),
        ],
      ),
    );
  }
}

class _FilaEvento extends StatelessWidget {
  const _FilaEvento({required this.evento});

  final EventoAlerta evento;

  @override
  Widget build(BuildContext context) {
    final String accion;
    final Color color;
    switch (evento.accion) {
      case AccionAlerta.activada:
        accion = 'ACTIVADA';
        color = _color(evento.nivel);
      case AccionAlerta.reconocida:
        accion = 'RECONOCIDA';
        color = const Color(0xFF2563EB);
      case AccionAlerta.despejada:
        accion = 'DESPEJADA';
        color = const Color(0xFF0F9D84);
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 66,
            child: Text(
              _hora(evento.hora),
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                color: _gris,
              ),
            ),
          ),
          Container(
            width: 86,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              accion,
              textAlign: TextAlign.center,
              style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              evento.titulo,
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A)),
            ),
          ),
        ],
      ),
    );
  }
}
