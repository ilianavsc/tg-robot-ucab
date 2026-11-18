import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/estado.dart';
import '../../core/models/orden_ack.dart';
import '../../core/models/ultrasonido.dart';
import '../../core/mqtt/mqtt_service.dart';

/// Pantalla de telemetría con diseño Material 3 de nivel portafolio.
///
/// Agrupa la información en tarjetas temáticas (Enlace MQTT, Batería 3S con
/// barra de progreso, Modo y Línea óptica, Cinemática y Sistema), usando
/// colores condicionales e iconografía clara.
class TelemetriaScreen extends StatelessWidget {
  const TelemetriaScreen({super.key});

  static const Color _verdePrimario = Color(0xFF0F9D84);
  static const Color _rojoError = Color(0xFFE11D48);
  static const Color _ambarAviso = Color(0xFFD97706);

  @override
  Widget build(BuildContext context) {
    final servicio = context.watch<MqttService>();
    final estado = servicio.ultimoEstado;
    final colorEstado = _colorConexion(servicio);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Row(
          children: <Widget>[
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: colorEstado,
                shape: BoxShape.circle,
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: colorEstado.withValues(alpha: 0.4),
                    blurRadius: 6,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'TG Robot UCAB · Telemetría',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
            ),
          ],
        ),
        actions: <Widget>[
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Chip(
              visualDensity: VisualDensity.compact,
              avatar: Icon(
                servicio.simulando
                    ? Icons.science
                    : (servicio.conectado ? Icons.cloud_done : Icons.cloud_off),
                size: 15,
                color: Colors.white,
              ),
              label: Text(
                servicio.simulando
                    ? 'MODO DEMO'
                    : _textoConexion(servicio.conexion).toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                ),
              ),
              backgroundColor: colorEstado,
              side: BorderSide.none,
            ),
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 860),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              _Aparece(
                indice: 0,
                child: _TarjetaConexionYControles(
                  servicio: servicio,
                  colorEstado: colorEstado,
                ),
              ),
              const SizedBox(height: 16),
              _Aparece(
                indice: 1,
                child: _TarjetaOrdenes(servicio: servicio),
              ),
              const SizedBox(height: 16),
              if (estado == null)
                _Aparece(
                  indice: 2,
                  child: _TarjetaEsperandoDatos(servicio: servicio),
                )
              else ...<Widget>[
                _Aparece(indice: 2, child: _TarjetaBateria(estado: estado)),
                const SizedBox(height: 16),
                _Aparece(indice: 3, child: _TarjetaModoYLinea(estado: estado)),
                const SizedBox(height: 16),
                _Aparece(
                  indice: 4,
                  child: _TarjetaTraccionYSistema(estado: estado),
                ),
              ],
              const SizedBox(height: 16),
              _Aparece(
                indice: 5,
                child: const _TarjetaUltrasonicos(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Color _colorConexion(MqttService servicio) {
    if (servicio.simulando) return _verdePrimario;
    switch (servicio.conexion) {
      case EstadoConexion.conectado:
        return _verdePrimario;
      case EstadoConexion.conectando:
        return _ambarAviso;
      case EstadoConexion.error:
        return _rojoError;
      case EstadoConexion.desconectado:
        return const Color(0xFF64748B);
    }
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
}

/// Tarjeta principal con estado del enlace MQTT y los botones de acción.
class _TarjetaConexionYControles extends StatelessWidget {
  const _TarjetaConexionYControles({
    required this.servicio,
    required this.colorEstado,
  });

  final MqttService servicio;
  final Color colorEstado;

  @override
  Widget build(BuildContext context) {
    final bool tieneError =
        !servicio.simulando &&
        (servicio.conexion == EstadoConexion.error ||
            servicio.ultimoError != null);

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: tieneError
              ? TelemetriaScreen._rojoError
              : const Color(0xFFCBD5E1),
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
                Icon(
                  servicio.simulando
                      ? Icons.bolt
                      : (tieneError ? Icons.error_outline : Icons.router),
                  color: colorEstado,
                  size: 26,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        servicio.simulando
                            ? 'Simulación Local Activa (Modo Demo)'
                            : 'Enlace MQTT · ${servicio.nombreBroker}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                      Text(
                        '${servicio.host}:${servicio.puertoEfectivo} · Tópico: ${servicio.topicoEstado}',
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: colorEstado.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: colorEstado),
                  ),
                  child: Text(
                    servicio.recibiendoDatos
                        ? 'Recibiendo (${servicio.segundosSinDatos} s)'
                        : servicio.ultimoMensaje == null
                        ? 'Esperando datos'
                        : 'Sin datos (${servicio.segundosSinDatos} s)',
                    style: TextStyle(
                      color: colorEstado,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List<Widget>.generate(servicio.listaBrokers.length, (int i) {
                final b = servicio.listaBrokers[i];
                final bool activo = i == servicio.indiceBroker;
                return InkWell(
                  onTap: () => servicio.seleccionarBroker(i),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: activo ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: activo ? const Color(0xFF0F172A) : const Color(0xFFCBD5E1),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        if (activo && servicio.conectado) ...<Widget>[
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: Color(0xFF22C55E),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Text(
                          '${b.nombre} (:${kIsWeb ? b.puertoWeb : b.puertoNativo})',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: activo ? Colors.white : const Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
            if (servicio.ultimoError != null && !servicio.simulando) ...<Widget>[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: TelemetriaScreen._rojoError,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        servicio.ultimoError!,
                        style: const TextStyle(
                          color: Color(0xFF9F1239),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (servicio.simulando) ...<Widget>[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  border: Border.all(color: const Color(0xFF6EE7B7)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: <Widget>[
                    Icon(
                      Icons.check_circle,
                      color: TelemetriaScreen._verdePrimario,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'MODO DEMO ACTIVO · Emitiendo los 6 perfiles de telemetría cada 2 s sin red.',
                        style: TextStyle(
                          color: Color(0xFF065F46),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: <Widget>[
                FilledButton.icon(
                  onPressed: servicio.conectar,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 12,
                    ),
                  ),
                  icon: const Icon(Icons.wifi_tethering, size: 18),
                  label: const Text('Conectar'),
                ),
                OutlinedButton.icon(
                  onPressed: servicio.desconectar,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  icon: const Icon(Icons.link_off, size: 18),
                  label: const Text('Desconectar'),
                ),
                FilledButton.icon(
                  onPressed: servicio.iniciarSimulacion,
                  style: FilledButton.styleFrom(
                    backgroundColor: TelemetriaScreen._verdePrimario,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 12,
                    ),
                  ),
                  icon: const Icon(Icons.play_circle_fill, size: 18),
                  label: const Text('Modo Demo'),
                ),
                if (servicio.simulando)
                  OutlinedButton.icon(
                    onPressed: servicio.detenerSimulacion,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: TelemetriaScreen._rojoError,
                      side: const BorderSide(color: TelemetriaScreen._rojoError),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                    icon: const Icon(Icons.stop_circle_outlined, size: 18),
                    label: const Text('Detener Demo'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Estado vacío cuando aún no ha llegado el primer paquete de telemetría.
class _TarjetaEsperandoDatos extends StatelessWidget {
  const _TarjetaEsperandoDatos({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
        child: Column(
          children: <Widget>[
            const Icon(
              Icons.sensors,
              size: 48,
              color: TelemetriaScreen._verdePrimario,
            ),
            const SizedBox(height: 12),
            const Text(
              'Esperando telemetría del robot…',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enciende el ESP32 físico, abre el Simulador Web P10 o pulsa "Modo Demo" para visualizar los sensores en vivo.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: servicio.iniciarSimulacion,
              style: FilledButton.styleFrom(
                backgroundColor: TelemetriaScreen._verdePrimario,
              ),
              icon: const Icon(Icons.play_arrow),
              label: const Text('Activar Modo Demo ahora'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de órdenes: 4 direcciones, Frenar, Auto y la última confirmación (ack).
///
/// Las direcciones y Frenar pasan el robot a MANUAL; Auto lo vuelve a AUTÓNOMO.
///
/// Cada botón publica `{"id":"<uuid>","cmd":"<comando>"}` en
/// `ucab-tg-sf/robot/ordenes` (QoS 1). Los comandos son los del firmware.
class _TarjetaOrdenes extends StatelessWidget {
  const _TarjetaOrdenes({required this.servicio});

  final MqttService servicio;

  static const Color _azulOrden = Color(0xFF2563EB);

  void _enviar(BuildContext context, String comando) {
    final enviada = servicio.publicarOrden(comando);
    if (!enviada) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(servicio.ultimoError ?? 'No se pudo enviar la orden.'),
            backgroundColor: TelemetriaScreen._rojoError,
          ),
        );
    }
  }

  Widget _boton(
    BuildContext context, {
    required String etiqueta,
    required String comando,
    required IconData icono,
    bool detener = false,
    bool auto = false,
  }) {
    final bool activo = servicio.puedeEnviarOrdenes;
    final Color color = detener
        ? TelemetriaScreen._rojoError
        : (auto ? TelemetriaScreen._verdePrimario : _azulOrden);
    return _Presionable(
      habilitado: activo,
      child: SizedBox(
        height: 52,
        child: FilledButton.icon(
          onPressed: activo ? () => _enviar(context, comando) : null,
          style: FilledButton.styleFrom(
            backgroundColor: color,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 6),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          icon: Icon(icono, size: 18),
          label: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              etiqueta,
              maxLines: 1,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final OrdenAck? ack = servicio.ultimoAck;
    final bool activo = servicio.puedeEnviarOrdenes;

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
                Icon(Icons.gamepad, color: _azulOrden, size: 26),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Órdenes al robot',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              activo
                  ? 'Cada botón publica en ${servicio.topicoOrdenes} (QoS 1) y el robot confirma en ${servicio.topicoAck}.'
                  : 'Conéctate al broker (o activa el Modo Demo) para enviar órdenes.',
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 16),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        const Spacer(),
                        Expanded(
                          flex: 2,
                          child: _boton(context,
                              etiqueta: 'Adelante',
                              comando: 'adelante',
                              icono: Icons.arrow_upward),
                        ),
                        const Spacer(),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: _boton(context,
                              etiqueta: 'Izquierda',
                              comando: 'izquierda',
                              icono: Icons.arrow_back),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _boton(context,
                              etiqueta: 'Frenar',
                              comando: 'frenar',
                              icono: Icons.stop,
                              detener: true),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _boton(context,
                              etiqueta: 'Derecha',
                              comando: 'derecha',
                              icono: Icons.arrow_forward),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        const Spacer(),
                        Expanded(
                          flex: 2,
                          child: _boton(context,
                              etiqueta: 'Atrás',
                              comando: 'atras',
                              icono: Icons.arrow_downward),
                        ),
                        const Spacer(),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: _boton(context,
                          etiqueta: 'Auto · seguir la línea solo',
                          comando: 'auto',
                          icono: Icons.smart_toy,
                          auto: true),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _CajaUltimoAck(
              ack: ack,
              esperando: servicio.esperandoAck,
              ultimoComando: servicio.ultimoComando,
            ),
          ],
        ),
      ),
    );
  }
}

/// Muestra la última confirmación (ack) o que se está esperando una.
class _CajaUltimoAck extends StatelessWidget {
  const _CajaUltimoAck({
    required this.ack,
    required this.esperando,
    required this.ultimoComando,
  });

  final OrdenAck? ack;
  final bool esperando;
  final String? ultimoComando;

  static String _hora(DateTime d) {
    String dos(int n) => n.toString().padLeft(2, '0');
    return '${dos(d.hour)}:${dos(d.minute)}:${dos(d.second)}';
  }

  @override
  Widget build(BuildContext context) {
    final OrdenAck? a = ack;
    final Color color;
    final IconData icono;
    final String titulo;
    final String detalle;

    if (esperando) {
      color = TelemetriaScreen._ambarAviso;
      icono = Icons.hourglass_top;
      titulo = 'Enviada "${ultimoComando ?? ''}" · esperando confirmación…';
      detalle = 'Si no llega, revisa que el robot (o el P10) esté encendido y en el mismo broker.';
    } else if (a == null) {
      color = const Color(0xFF64748B);
      icono = Icons.inbox_outlined;
      titulo = 'Último ACK: ninguno todavía';
      detalle = 'Envía una orden para ver la confirmación del robot.';
    } else {
      color = TelemetriaScreen._verdePrimario;
      icono = Icons.check_circle;
      final String que = a.comando != null ? '"${a.comando}"' : 'una orden de otra app';
      final String ms = a.latencia != null ? ' en ${a.latencia!.inMilliseconds} ms' : '';
      titulo = 'Último ACK: confirmó $que$ms${a.simulada ? ' (demo)' : ''}${a.repetida ? ' · repetido' : ''}';
      final String idCorto = a.id.length > 8 ? '${a.id.substring(0, 8)}…' : a.id;
      detalle = 'id $idCorto'
          '${a.recibidas != null ? ' · el robot lleva ${a.recibidas} órdenes' : ''}'
          ' · llegó a las ${_hora(a.llegada)}';
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.45), width: 1.5),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        switchInCurve: Curves.easeOutCubic,
        child: Row(
        key: ValueKey<String>('$titulo|$detalle'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icono, color: color, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  titulo,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detalle,
                  style: const TextStyle(color: Color(0xFF475569), fontSize: 12.5),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

/// Tarjeta de Batería Li-Ion 3S con barra de progreso y alerta de voltaje bajo.
class _TarjetaBateria extends StatelessWidget {
  const _TarjetaBateria({required this.estado});

  final Estado estado;

  @override
  Widget build(BuildContext context) {
    final bool baja = estado.bateriaBaja;
    final Color colorBarra = baja
        ? TelemetriaScreen._rojoError
        : (estado.bateria <= 40
              ? TelemetriaScreen._ambarAviso
              : TelemetriaScreen._verdePrimario);

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: baja ? TelemetriaScreen._rojoError : const Color(0xFFCBD5E1),
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
                Icon(
                  baja ? Icons.battery_alert : Icons.battery_charging_full,
                  color: colorBarra,
                  size: 28,
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Batería Li-Ion 3S (Nominal 11.1 V)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
                Text(
                  '${estado.bateria} % · ${estado.bateriaV.toStringAsFixed(2)} V',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                    color: colorBarra,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: TweenAnimationBuilder<double>(
                tween: Tween<double>(end: estado.bateria.clamp(0, 100) / 100.0),
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeOutCubic,
                builder: (BuildContext context, double valor, Widget? _) {
                  return LinearProgressIndicator(
                    value: valor,
                    minHeight: 14,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation<Color>(colorBarra),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: Wrap(
                alignment: WrapAlignment.spaceBetween,
                spacing: 12,
                runSpacing: 4,
                children: <Widget>[
                  const Text(
                    'Corte seguro: 9.90 V (0 %)',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  if (baja)
                    const Text(
                      '¡ALERTA: BATERÍA BAJA!',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: TelemetriaScreen._rojoError,
                      ),
                    )
                  else
                    const Text(
                      'Carga máxima: 12.60 V (100 %)',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de Modo de Operación (Autónomo / Manual) y Seguimiento de Línea.
class _TarjetaModoYLinea extends StatelessWidget {
  const _TarjetaModoYLinea({required this.estado});

  final Estado estado;

  @override
  Widget build(BuildContext context) {
    final bool veLinea = estado.veLaLinea;
    final Color colorLinea = veLinea
        ? TelemetriaScreen._verdePrimario
        : TelemetriaScreen._rojoError;

    final Widget itemModo = _ItemMetricaIcono(
      icono: estado.esAutonomo ? Icons.smart_toy : Icons.sports_esports,
      colorIcono: estado.esAutonomo
          ? TelemetriaScreen._verdePrimario
          : const Color(0xFF7C3AED),
      titulo: 'Modo de Operación',
      valor: estado.esAutonomo
          ? 'Autónomo (PD 100 Hz)'
          : 'Manual (Control Remoto)',
    );

    final Widget itemLinea = _ItemMetricaIcono(
      icono: veLinea ? Icons.timeline : Icons.warning_amber,
      colorIcono: colorLinea,
      titulo: 'Posición de Línea (4× TCRT5000)',
      valor:
          '${estado.lineaMm.toStringAsFixed(1)} mm (${veLinea ? "En pista" : "Perdida"})',
    );

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            if (constraints.maxWidth < 480) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  itemModo,
                  const SizedBox(height: 12),
                  itemLinea,
                ],
              );
            }
            return Row(
              children: <Widget>[
                Expanded(child: itemModo),
                const SizedBox(width: 16),
                Expanded(child: itemLinea),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Tarjeta de Velocidades de Ruedas (P03) y Contadores de Sistema (P01).
class _TarjetaTraccionYSistema extends StatelessWidget {
  const _TarjetaTraccionYSistema({required this.estado});

  final Estado estado;

  @override
  Widget build(BuildContext context) {
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
                Icon(Icons.speed, color: Color(0xFF0F172A), size: 22),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Tracción Diferencial y Telemetría de Sistema',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: <Widget>[
                _ChipDato(
                  icono: Icons.tire_repair,
                  etiqueta: 'Rueda Izquierda',
                  valor: '${estado.vIzq.toStringAsFixed(2)} m/s',
                ),
                _ChipDato(
                  icono: Icons.tire_repair,
                  etiqueta: 'Rueda Derecha',
                  valor: '${estado.vDer.toStringAsFixed(2)} m/s',
                ),
                _ChipDato(
                  icono: Icons.moving,
                  etiqueta: 'Velocidad Media',
                  valor: '${estado.velocidadMedia.toStringAsFixed(2)} m/s',
                ),
                _ChipDato(
                  icono: Icons.inventory_2_outlined,
                  etiqueta: 'Órdenes Recibidas',
                  valor: '${estado.ordenes}',
                ),
                _ChipDato(
                  icono: Icons.tag,
                  etiqueta: 'Paquete Estado',
                  valor: '#${estado.numero}',
                ),
                _ChipDato(
                  icono: Icons.timer_outlined,
                  etiqueta: 'Tiempo Activo',
                  valor: estado.tiempoEncendido,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemMetricaIcono extends StatelessWidget {
  const _ItemMetricaIcono({
    required this.icono,
    required this.colorIcono,
    required this.titulo,
    required this.valor,
  });

  final IconData icono;
  final Color colorIcono;
  final String titulo;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colorIcono.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icono, color: colorIcono, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  titulo,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  valor,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
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

class _ChipDato extends StatelessWidget {
  const _ChipDato({
    required this.icono,
    required this.etiqueta,
    required this.valor,
  });

  final IconData icono;
  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                ),
                Text(
                  valor,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
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


/// Tarjeta de los 2 sensores ultrasónicos: distancia al frente y atrás en cm,
/// en vivo (se actualiza con cada mensaje de `ucab-tg-sf/robot/ultrasonido`).
///
/// Se reconstruye sola con `context.select` (el resto de la pantalla no se
/// entera). Un [Timer] de 1 s reevalúa la frescura: si pasan más de 3 s sin
/// mensajes nuevos, la tarjeta se pone gris y muestra "Sin señal". Sin ese
/// reloj, cuando se corta la transmisión no llega nada que dispare el redibujo
/// y los últimos valores quedarían congelados.
class _TarjetaUltrasonicos extends StatefulWidget {
  const _TarjetaUltrasonicos();

  @override
  State<_TarjetaUltrasonicos> createState() => _TarjetaUltrasonicosState();
}

class _TarjetaUltrasonicosState extends State<_TarjetaUltrasonicos> {
  static const Duration _limiteFrescura = Duration(seconds: 3);
  static const Color _gris = Color(0xFF94A3B8);

  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _reloj?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Ultrasonido? ult = context.select<MqttService, Ultrasonido?>(
      (MqttService s) => s.ultimoUltrasonido,
    );
    final bool hayDatos = ult != null;
    final bool sinSenal =
        ult != null && DateTime.now().difference(ult.llegada) > _limiteFrescura;
    final Color acento = sinSenal ? _gris : const Color(0xFF2563EB);

    final Widget frente = _FilaDistancia(
      etiqueta: 'Frente',
      icono: Icons.arrow_upward,
      cm: ult?.frenteCm,
      hayDatos: hayDatos,
      sinSenal: sinSenal,
    );
    final Widget atras = _FilaDistancia(
      etiqueta: 'Atrás',
      icono: Icons.arrow_downward,
      cm: ult?.atrasCm,
      hayDatos: hayDatos,
      sinSenal: sinSenal,
    );

    return Card(
      elevation: 0,
      color: sinSenal ? const Color(0xFFF1F5F9) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: sinSenal ? _gris : const Color(0xFFCBD5E1),
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
                Icon(Icons.sensors, color: acento, size: 26),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Ultrasónicos',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ),
                if (sinSenal)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _gris,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Sin señal',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              !hayDatos
                  ? 'Esperando lecturas en ucab-tg-sf/robot/ultrasonido…'
                  : (sinSenal
                      ? 'Sin señal: hace más de 3 s que no llegan lecturas.'
                      : 'Distancia al frente y atrás del robot.'),
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (BuildContext context, BoxConstraints c) {
                if (c.maxWidth >= 600) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(child: frente),
                      const SizedBox(width: 24),
                      Expanded(child: atras),
                    ],
                  );
                }
                return Column(
                  children: <Widget>[
                    frente,
                    const SizedBox(height: 14),
                    atras,
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Una fila de distancia: etiqueta, valor en cm y barra de 0 a 200 cm.
/// Verde con más de 50 cm, ámbar de 20 a 50 y rojo con menos de 20.
/// Con [sinSenal] todo se muestra en gris.
class _FilaDistancia extends StatelessWidget {
  const _FilaDistancia({
    required this.etiqueta,
    required this.icono,
    required this.cm,
    required this.hayDatos,
    required this.sinSenal,
  });

  final String etiqueta;
  final IconData icono;
  final double? cm;
  final bool hayDatos;
  final bool sinSenal;

  static const double _alcanceCm = 200;

  @override
  Widget build(BuildContext context) {
    final double? valor = cm;
    final Color color;
    if (sinSenal || valor == null) {
      color = const Color(0xFF94A3B8);
    } else if (valor < 20) {
      color = TelemetriaScreen._rojoError;
    } else if (valor < 50) {
      color = TelemetriaScreen._ambarAviso;
    } else {
      color = TelemetriaScreen._verdePrimario;
    }
    final String texto = valor != null
        ? '${valor.toStringAsFixed(0)} cm'
        : (hayDatos ? 'sin eco' : '—');
    final double fraccion =
        valor == null ? 0.0 : (valor / _alcanceCm).clamp(0.0, 1.0).toDouble();

    return Semantics(
      label: '$etiqueta: ${sinSenal ? 'sin señal' : texto}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icono, size: 18, color: const Color(0xFF475569)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  etiqueta,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
              Text(
                texto,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(end: fraccion),
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              builder: (BuildContext context, double v, Widget? _) {
                return LinearProgressIndicator(
                  value: v,
                  minHeight: 10,
                  backgroundColor: const Color(0xFFE2E8F0),
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Entrada suave de una tarjeta: opacidad + subida corta, con ease-out.
/// Se anima una sola vez al aparecer (no se repite con cada mensaje de telemetría).
/// Si el sistema pide menos movimiento, no anima.
class _Aparece extends StatelessWidget {
  const _Aparece({required this.indice, required this.child});

  final int indice;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: Duration(milliseconds: 220 + 50 * indice),
      curve: Curves.easeOutCubic,
      builder: (BuildContext context, double t, Widget? hijo) {
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, 8 * (1 - t)),
            child: hijo,
          ),
        );
      },
      child: child,
    );
  }
}

/// Respuesta al pulsar: el botón se encoge un 3 % mientras el dedo está encima.
/// Usa [Listener], así no interfiere con el clic del botón de adentro.
class _Presionable extends StatefulWidget {
  const _Presionable({required this.child, this.habilitado = true});

  final Widget child;
  final bool habilitado;

  @override
  State<_Presionable> createState() => _PresionableState();
}

class _PresionableState extends State<_Presionable> {
  bool _abajo = false;

  void _poner(bool valor) {
    if (_abajo != valor && mounted) setState(() => _abajo = valor);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _poner(widget.habilitado),
      onPointerUp: (_) => _poner(false),
      onPointerCancel: (_) => _poner(false),
      child: AnimatedScale(
        scale: _abajo ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}
