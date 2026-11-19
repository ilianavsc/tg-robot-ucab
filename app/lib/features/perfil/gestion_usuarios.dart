import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/cockpit_theme.dart';
import '../auth/registro_usuarios.dart';
import '../auth/sesion_local.dart';
import '../telemetria/cockpit_ui.dart';

/// **Gestión de Usuarios** (solo Administrador): alta y baja de operadores en
/// memoria (`RegistroUsuarios`). Sin backend: las cuentas nuevas permiten
/// iniciar sesión en el Login mientras la app siga abierta y se pierden al
/// cerrarla. Modelo cerrado: no existe registro público.
class PantallaGestionUsuarios extends StatefulWidget {
  const PantallaGestionUsuarios({super.key});

  @override
  State<PantallaGestionUsuarios> createState() =>
      _PantallaGestionUsuariosState();
}

class _PantallaGestionUsuariosState extends State<PantallaGestionUsuarios> {
  final TextEditingController _nombre = TextEditingController();
  final TextEditingController _usuario = TextEditingController();
  final TextEditingController _clave = TextEditingController();
  bool _verClave = false;
  String? _mensaje;
  bool _exito = false;

  @override
  void dispose() {
    _nombre.dispose();
    _usuario.dispose();
    _clave.dispose();
    super.dispose();
  }

  void _crear() {
    final RegistroUsuarios registro = context.read<RegistroUsuarios>();
    final RolUsuario? actor = context.read<SesionLocal>().rol;
    final String usuario = RegistroUsuarios.normalizar(_usuario.text);
    final ResultadoAlta r = registro.crearOperador(
      actor: actor,
      nombre: _nombre.text,
      usuario: _usuario.text,
      clave: _clave.text,
    );
    setState(() {
      _exito = r.exito;
      _mensaje = r.exito ? 'Operador @$usuario creado.' : r.mensaje;
      if (r.exito) {
        _nombre.clear();
        _usuario.clear();
        _clave.clear();
      }
    });
  }

  void _eliminar(CuentaLocal c) {
    final bool ok = context.read<RegistroUsuarios>().eliminarOperador(
      actor: context.read<SesionLocal>().rol,
      usuario: c.usuario,
    );
    setState(() {
      _exito = ok;
      _mensaje = ok
          ? 'Operador @${c.usuario} eliminado.'
          : 'No se pudo eliminar a @${c.usuario}.';
    });
  }

  InputDecoration _decoracion(
    String etiqueta,
    IconData icono, {
    Widget? sufijo,
  }) {
    OutlineInputBorder borde(Color c) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(CockpitRadius.md),
      borderSide: BorderSide(color: c),
    );
    return InputDecoration(
      labelText: etiqueta,
      labelStyle: CockpitText.bodyMd.copyWith(color: CockpitColors.outline),
      filled: true,
      fillColor: CockpitColors.surfaceContainer,
      prefixIcon: Icon(icono, size: 20, color: CockpitColors.onSurfaceVariant),
      suffixIcon: sufijo,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      enabledBorder: borde(
        CockpitColors.outlineVariant.withValues(alpha: 0.55),
      ),
      focusedBorder: borde(CockpitColors.primary),
    );
  }

  @override
  Widget build(BuildContext context) {
    final RegistroUsuarios registro = context.watch<RegistroUsuarios>();
    final bool esAdmin =
        context.watch<SesionLocal>().rol == RolUsuario.administrador;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: CockpitColors.surfaceLowest,
        titleSpacing: 0,
        leading: IconButton(
          tooltip: 'Volver',
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          'GESTIÓN DE USUARIOS',
          style: CockpitText.labelMd.copyWith(
            fontSize: 14,
            color: CockpitColors.onSurface,
          ),
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: Icon(
                      Icons.info_outline,
                      size: 16,
                      color: CockpitColors.secondary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Demo local sin backend: las cuentas viven en memoria y se '
                      'pierden al cerrar la app. No hay registro público: solo un '
                      'Administrador crea operadores.',
                      style: CockpitText.bodySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              CockpitCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    const SectionLabel(
                      icono: Icons.person_add_alt_1_outlined,
                      etiqueta: 'Crear operador',
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      key: const Key('usuarios-nombre'),
                      controller: _nombre,
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                      style: CockpitText.bodyMd,
                      decoration: _decoracion('Nombre', Icons.badge_outlined),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      key: const Key('usuarios-usuario'),
                      controller: _usuario,
                      autocorrect: false,
                      enableSuggestions: false,
                      textInputAction: TextInputAction.next,
                      style: CockpitText.bodyMd,
                      decoration: _decoracion('Usuario', Icons.person_outline),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      key: const Key('usuarios-clave'),
                      controller: _clave,
                      obscureText: !_verClave,
                      autocorrect: false,
                      enableSuggestions: false,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _crear(),
                      style: CockpitText.bodyMd,
                      decoration: _decoracion(
                        'Contraseña',
                        Icons.lock_outline,
                        sufijo: IconButton(
                          tooltip: _verClave
                              ? 'Ocultar contraseña'
                              : 'Mostrar contraseña',
                          icon: Icon(
                            _verClave
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                          ),
                          onPressed: () =>
                              setState(() => _verClave = !_verClave),
                        ),
                      ),
                    ),
                    if (_mensaje != null) ...<Widget>[
                      const SizedBox(height: 10),
                      Text(
                        _mensaje!,
                        key: const Key('usuarios-mensaje'),
                        style: CockpitText.bodySm.copyWith(
                          color: _exito
                              ? CockpitColors.ok
                              : CockpitColors.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      key: const Key('usuarios-crear'),
                      onPressed: esAdmin ? _crear : null,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('CREAR OPERADOR'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              CockpitCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    SectionLabel(
                      icono: Icons.groups_outlined,
                      etiqueta: 'Cuentas',
                      trailing: StatusPill(
                        texto: '${registro.cuentas.length}',
                        color: CockpitColors.primary,
                        punto: false,
                      ),
                    ),
                    const SizedBox(height: 10),
                    for (final CuentaLocal c in registro.cuentas) ...<Widget>[
                      _FilaCuenta(
                        cuenta: c,
                        alEliminar: esAdmin && !c.demo
                            ? () => _eliminar(c)
                            : null,
                      ),
                      const SizedBox(height: 8),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilaCuenta extends StatelessWidget {
  const _FilaCuenta({required this.cuenta, required this.alEliminar});

  final CuentaLocal cuenta;
  final VoidCallback? alEliminar;

  @override
  Widget build(BuildContext context) {
    final bool admin = cuenta.rol == RolUsuario.administrador;
    return Container(
      key: Key('cuenta-${cuenta.usuario}'),
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer,
        borderRadius: BorderRadius.circular(CockpitRadius.md),
      ),
      child: Row(
        children: <Widget>[
          Icon(
            admin
                ? Icons.admin_panel_settings_outlined
                : Icons.engineering_outlined,
            color: admin ? CockpitColors.warning : CockpitColors.primary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  cuenta.nombre,
                  softWrap: true,
                  style: CockpitText.bodyMd.copyWith(
                    color: CockpitColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '@${cuenta.usuario}',
                  style: CockpitText.telemetrySm.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          CockpitTag(
            texto: cuenta.demo
                ? '${cuenta.rol.etiqueta} · DEMO'
                : cuenta.rol.etiqueta,
            fondo: CockpitColors.surfaceHigh,
            color: CockpitColors.onSurfaceVariant,
          ),
          if (alEliminar != null)
            IconButton(
              key: Key('usuarios-eliminar-${cuenta.usuario}'),
              tooltip: 'Eliminar a @${cuenta.usuario}',
              onPressed: alEliminar,
              icon: const Icon(
                Icons.delete_outline,
                color: CockpitColors.error,
              ),
            )
          else
            const SizedBox(width: 8),
        ],
      ),
    );
  }
}
