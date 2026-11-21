import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import '../../shared/widgets/pastilla_mqtt.dart';
import '../telemetria/cockpit_ui.dart';
import 'registro_usuarios.dart';
import 'sesion_local.dart';

/// Pantalla de acceso (Stitch v2). Autenticación **local, sin backend**: el
/// usuario y la contraseña se comprueban contra `RegistroUsuarios` (memoria) y
/// el rol sale de la cuenta, no de un selector. También ofrece el Modo Demo
/// (Offline). No hay registro público: solo un Administrador crea operadores.
class PantallaLogin extends StatefulWidget {
  const PantallaLogin({super.key});

  @override
  State<PantallaLogin> createState() => _PantallaLoginState();
}

class _PantallaLoginState extends State<PantallaLogin> {
  final TextEditingController _usuario = TextEditingController();
  final TextEditingController _clave = TextEditingController();
  RolUsuario _rolSeleccionado = RolUsuario.operador;
  bool _verClave = false;
  String? _error;

  @override
  void dispose() {
    _usuario.dispose();
    _clave.dispose();
    super.dispose();
  }

  void _cambiarRol(RolUsuario rol) {
    if (_rolSeleccionado == rol) return;
    setState(() {
      _rolSeleccionado = rol;
      _error = null;
    });
  }

  void _entrar() {
    final CuentaLocal? cuenta = context.read<RegistroUsuarios>().autenticar(
      _usuario.text,
      _clave.text,
    );
    if (cuenta == null) {
      setState(() => _error = 'Usuario o contraseña incorrectos.');
      return;
    }
    if (cuenta.rol != _rolSeleccionado) {
      setState(
        () => _error =
            'Esta cuenta corresponde al perfil ${cuenta.rol.nombre}.',
      );
      return;
    }
    context.read<SesionLocal>().iniciar(
      cuenta.rol,
      usuario: cuenta.usuario,
      nombre: cuenta.nombre,
    );
  }

  /// Modo Demo directo: entra como el Operador de demostración y arranca la
  /// telemetría simulada de `MqttService` (sin red ni robot).
  void _entrarDemo() {
    context.read<MqttService>().iniciarSimulacion();
    context.read<SesionLocal>().iniciar(
      RolUsuario.operador,
      usuario: 'usuario',
      nombre: 'Operador demo',
      demo: true,
    );
  }

  InputDecoration _decoracion({
    required IconData icono,
    String? hint,
    Widget? sufijo,
    String? error,
  }) {
    OutlineInputBorder borde(Color c) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(CockpitRadius.md),
      borderSide: BorderSide(color: c),
    );
    return InputDecoration(
      filled: true,
      fillColor: CockpitColors.surfaceLow,
      hintText: hint,
      hintStyle: CockpitText.bodyMd.copyWith(color: CockpitColors.outline),
      errorText: error,
      errorMaxLines: 2,
      prefixIcon: Icon(icono, size: 20, color: CockpitColors.onSurfaceVariant),
      suffixIcon: sufijo,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      enabledBorder: borde(
        CockpitColors.outlineVariant.withValues(alpha: 0.55),
      ),
      focusedBorder: borde(CockpitColors.primary),
      errorBorder: borde(CockpitColors.error),
      focusedErrorBorder: borde(CockpitColors.error),
    );
  }

  Widget _etiqueta(String texto) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      texto,
      style: CockpitText.labelMd.copyWith(color: CockpitColors.onSurface),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final bool esAdmin = _rolSeleccionado == RolUsuario.administrador;
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: <Widget>[
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 64, 20, 20),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      const _Marca(),
                      const SizedBox(height: 24),
                      _SelectorRol(
                        seleccionado: _rolSeleccionado,
                        alCambiar: _cambiarRol,
                      ),
                      const SizedBox(height: 18),
                      _etiqueta('USUARIO'),
                      TextField(
                        key: const Key('login-usuario'),
                        controller: _usuario,
                        keyboardType: TextInputType.text,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.next,
                        style: CockpitText.bodyMd.copyWith(
                          color: CockpitColors.onSurface,
                        ),
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                        decoration: _decoracion(
                          icono: Icons.person_outline,
                          hint: esAdmin ? 'administrador' : 'usuario',
                        ),
                      ),
                      const SizedBox(height: 16),
                      _etiqueta('CONTRASEÑA'),
                      TextField(
                        key: const Key('login-clave'),
                        controller: _clave,
                        obscureText: !_verClave,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _entrar(),
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                        style: CockpitText.bodyMd.copyWith(
                          color: CockpitColors.onSurface,
                        ),
                        decoration: _decoracion(
                          icono: Icons.lock_outline,
                          hint: '••••••••',
                          error: _error,
                          sufijo: IconButton(
                            tooltip: _verClave
                                ? 'Ocultar contraseña'
                                : 'Mostrar contraseña',
                            icon: Icon(
                              _verClave
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                              color: CockpitColors.onSurfaceVariant,
                            ),
                            onPressed: () =>
                                setState(() => _verClave = !_verClave),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Pressable(
                        child: FilledButton(
                          key: const Key('login-entrar'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                            textStyle: const TextStyle(
                              fontFamily: CockpitText.sans,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          onPressed: _entrar,
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: <Widget>[
                              Text('Iniciar Sesión'),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_forward, size: 18),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                      const Center(child: PastillaMqtt()),
                      const SizedBox(height: 10),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'Universidad Católica Andrés Bello · Ingeniería',
                          key: const Key('login-pie'),
                          textAlign: TextAlign.center,
                          softWrap: true,
                          style: CockpitText.telemetrySm.copyWith(
                            color: CockpitColors.outline,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: 12,
              right: 16,
              child: Semantics(
                button: true,
                label: 'Entrar en Modo Demo (Offline)',
                child: OutlinedButton.icon(
                  key: const Key('login-demo'),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: CockpitColors.surfaceContainer.withValues(
                      alpha: 0.85,
                    ),
                    foregroundColor: CockpitColors.onSurfaceVariant,
                    minimumSize: const Size(44, 42),
                    tapTargetSize: MaterialTapTargetSize.padded,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    shape: const StadiumBorder(),
                    side: BorderSide(
                      color: CockpitColors.outlineVariant.withValues(
                        alpha: 0.6,
                      ),
                    ),
                    textStyle: CockpitText.labelMd.copyWith(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onPressed: _entrarDemo,
                  icon: const Icon(
                    Icons.science_outlined,
                    size: 16,
                    color: CockpitColors.primary,
                  ),
                  label: const Text('Demo'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barra deslizadora (segmented toggle) para elegir el perfil de acceso.
class _SelectorRol extends StatelessWidget {
  const _SelectorRol({required this.seleccionado, required this.alCambiar});

  final RolUsuario seleccionado;
  final ValueChanged<RolUsuario> alCambiar;

  @override
  Widget build(BuildContext context) {
    final bool esAdmin = seleccionado == RolUsuario.administrador;
    return Container(
      key: const Key('login-selector-rol'),
      height: 46,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceLow,
        borderRadius: BorderRadius.circular(CockpitRadius.md),
        border: Border.all(
          color: CockpitColors.outlineVariant.withValues(alpha: 0.55),
        ),
      ),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final double anchoOpcion = constraints.maxWidth / 2;
          return Stack(
            children: <Widget>[
              AnimatedAlign(
                alignment: esAdmin
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOutCubic,
                child: Container(
                  width: anchoOpcion,
                  height: double.infinity,
                  decoration: BoxDecoration(
                    color: CockpitColors.primary.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(CockpitRadius.md - 2),
                    border: Border.all(
                      color: CockpitColors.primary.withValues(alpha: 0.8),
                    ),
                  ),
                ),
              ),
              Row(
                children: <Widget>[
                  _opcion(
                    clave: const Key('rol-operador'),
                    etiqueta: 'Operador',
                    icono: Icons.engineering_outlined,
                    activa: !esAdmin,
                    alTocar: () => alCambiar(RolUsuario.operador),
                  ),
                  _opcion(
                    clave: const Key('rol-administrador'),
                    etiqueta: 'Administrador',
                    icono: Icons.admin_panel_settings_outlined,
                    activa: esAdmin,
                    alTocar: () => alCambiar(RolUsuario.administrador),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _opcion({
    required Key clave,
    required String etiqueta,
    required IconData icono,
    required bool activa,
    required VoidCallback alTocar,
  }) {
    final Color color = activa
        ? CockpitColors.primary
        : CockpitColors.onSurfaceVariant;
    return Expanded(
      child: Semantics(
        button: true,
        selected: activa,
        label: etiqueta,
        child: InkWell(
          key: clave,
          borderRadius: BorderRadius.circular(CockpitRadius.md - 2),
          onTap: alTocar,
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(icono, size: 16, color: color),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    etiqueta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: CockpitText.labelMd.copyWith(
                      fontSize: 12.5,
                      fontWeight: activa ? FontWeight.w700 : FontWeight.w600,
                      color: activa ? Colors.white : color,
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

/// Logotipo y nombre de la app.
class _Marca extends StatelessWidget {
  const _Marca();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: CockpitColors.primaryTonal.withValues(alpha: 0.45),
            borderRadius: BorderRadius.circular(CockpitRadius.xl),
            border: Border.all(
              color: CockpitColors.primary.withValues(alpha: 0.45),
            ),
          ),
          child: const Stack(
            alignment: Alignment.center,
            children: <Widget>[
              Icon(
                Icons.hexagon_outlined,
                size: 40,
                color: CockpitColors.primary,
              ),
              Icon(Icons.explore, size: 18, color: CockpitColors.primary),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text.rich(
          const TextSpan(
            children: <InlineSpan>[
              TextSpan(text: 'TG Robot '),
              TextSpan(
                text: 'UCAB',
                style: TextStyle(color: CockpitColors.primary),
              ),
            ],
          ),
          textAlign: TextAlign.center,
          style: CockpitText.headlineMd.copyWith(
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Autonomous Laboratory AGV',
          style: CockpitText.bodyMd.copyWith(
            color: CockpitColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
