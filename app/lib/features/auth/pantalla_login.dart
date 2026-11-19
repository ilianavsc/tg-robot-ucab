import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import '../../shared/widgets/pastilla_mqtt.dart';
import '../telemetria/cockpit_ui.dart';
import 'sesion_local.dart';

/// Pantalla de acceso (Stitch v2). Autenticación **local, sin backend**:
/// elige el rol (Operador o Administrador) o entra directo al Modo Demo.
///
/// No verifica contraseñas ni guarda nada; el aviso de la pantalla lo dice.
class PantallaLogin extends StatefulWidget {
  const PantallaLogin({super.key});

  @override
  State<PantallaLogin> createState() => _PantallaLoginState();
}

class _PantallaLoginState extends State<PantallaLogin> {
  late final TextEditingController _correo = TextEditingController(
    text: correoDemoPorRol[RolUsuario.operador],
  );
  final TextEditingController _clave = TextEditingController();
  RolUsuario _rol = RolUsuario.operador;
  bool _verClave = false;
  String? _errorCorreo;

  @override
  void dispose() {
    _correo.dispose();
    _clave.dispose();
    super.dispose();
  }

  void _elegirRol(RolUsuario rol) {
    setState(() {
      // Si el correo es uno de los de demostración (o está vacío), sigue al rol.
      final String actual = _correo.text.trim();
      if (actual.isEmpty || correoDemoPorRol.values.contains(actual)) {
        _correo.text = correoDemoPorRol[rol]!;
      }
      _rol = rol;
      _errorCorreo = null;
    });
  }

  void _entrar() {
    final String correo = _correo.text.trim();
    if (!correo.contains('@') ||
        correo.startsWith('@') ||
        correo.endsWith('@')) {
      setState(
        () => _errorCorreo =
            'Escribe un correo, por ejemplo operador@ucab.edu.ve',
      );
      return;
    }
    context.read<SesionLocal>().iniciar(_rol, correo: correo);
  }

  /// Modo Demo directo: entra como Operador y arranca la telemetría simulada
  /// de `MqttService` (sin red ni robot).
  void _entrarDemo() {
    context.read<MqttService>().iniciarSimulacion();
    context.read<SesionLocal>().iniciar(
      RolUsuario.operador,
      correo: correoDemoPorRol[RolUsuario.operador]!,
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
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  _Marca(),
                  const SizedBox(height: 32),
                  _etiqueta('ACCEDER COMO'),
                  SegmentedButton<RolUsuario>(
                    key: const Key('login-rol'),
                    showSelectedIcon: false,
                    segments: <ButtonSegment<RolUsuario>>[
                      for (final RolUsuario r in RolUsuario.values)
                        ButtonSegment<RolUsuario>(
                          value: r,
                          label: Text(r.nombre.toUpperCase()),
                          icon: Icon(
                            r == RolUsuario.operador
                                ? Icons.engineering_outlined
                                : Icons.admin_panel_settings_outlined,
                            size: 18,
                          ),
                        ),
                    ],
                    selected: <RolUsuario>{_rol},
                    onSelectionChanged: (Set<RolUsuario> s) =>
                        _elegirRol(s.first),
                  ),
                  const SizedBox(height: 20),
                  _etiqueta('CORREO INSTITUCIONAL'),
                  TextField(
                    key: const Key('login-correo'),
                    controller: _correo,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    style: CockpitText.bodyMd.copyWith(
                      color: CockpitColors.onSurface,
                    ),
                    onChanged: (_) {
                      if (_errorCorreo != null) {
                        setState(() => _errorCorreo = null);
                      }
                    },
                    decoration: _decoracion(
                      icono: Icons.mail_outline,
                      hint: 'correo@ucab.edu.ve',
                      error: _errorCorreo,
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
                    style: CockpitText.bodyMd.copyWith(
                      color: CockpitColors.onSurface,
                    ),
                    decoration: _decoracion(
                      icono: Icons.lock_outline,
                      hint: '••••••••',
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
                        onPressed: () => setState(() => _verClave = !_verClave),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const _AvisoLocal(),
                  const SizedBox(height: 20),
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
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    key: const Key('login-demo'),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      minimumSize: const Size.fromHeight(52),
                      textStyle: const TextStyle(
                        fontFamily: CockpitText.sans,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    onPressed: _entrarDemo,
                    icon: const Icon(Icons.science_outlined, size: 18),
                    label: const Text('Modo Demo (Offline)'),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Entra como Operador con telemetría simulada, sin red ni robot.',
                    textAlign: TextAlign.center,
                    style: CockpitText.bodySm.copyWith(
                      color: CockpitColors.outline,
                    ),
                  ),
                  const SizedBox(height: 32),
                  const Center(child: PastillaMqtt()),
                  const SizedBox(height: 10),
                  Text(
                    'Universidad Católica Andrés Bello · Ingeniería',
                    textAlign: TextAlign.center,
                    style: CockpitText.telemetrySm.copyWith(
                      color: CockpitColors.outline,
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

/// Logotipo y nombre de la app.
class _Marca extends StatelessWidget {
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

/// Deja claro que el acceso es local y no hay servidor.
class _AvisoLocal extends StatelessWidget {
  const _AvisoLocal();

  @override
  Widget build(BuildContext context) {
    return Row(
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
            'Autenticación local de demostración: no hay servidor. La contraseña '
            'no se verifica ni se guarda, y la sesión termina al cerrar la app.',
            key: const Key('login-aviso-local'),
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}
