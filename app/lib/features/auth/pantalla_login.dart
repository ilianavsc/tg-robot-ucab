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
  bool _verClave = false;
  String? _error;

  @override
  void dispose() {
    _usuario.dispose();
    _clave.dispose();
    super.dispose();
  }

  /// Acceso rápido: rellena las credenciales de una cuenta de demostración.
  void _rellenar(String usuario, String clave) {
    setState(() {
      _usuario.text = usuario;
      _clave.text = clave;
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
                  const _Marca(),
                  const SizedBox(height: 28),
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
                      hint: 'usuario',
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
                        onPressed: () => setState(() => _verClave = !_verClave),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _AccesoRapido(alElegir: _rellenar),
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

/// Acceso rápido: rellena las credenciales de las cuentas de demostración.
class _AccesoRapido extends StatelessWidget {
  const _AccesoRapido({required this.alElegir});

  final void Function(String usuario, String clave) alElegir;

  @override
  Widget build(BuildContext context) {
    Widget ficha(Key k, IconData icono, String texto, String u, String c) {
      return Expanded(
        child: Material(
          color: CockpitColors.surfaceContainer,
          borderRadius: BorderRadius.circular(CockpitRadius.md),
          child: InkWell(
            key: k,
            borderRadius: BorderRadius.circular(CockpitRadius.md),
            onTap: () => alElegir(u, c),
            child: Container(
              constraints: const BoxConstraints(minHeight: 48),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(CockpitRadius.md),
                border: Border.all(
                  color: CockpitColors.outlineVariant.withValues(alpha: 0.55),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Icon(icono, size: 16, color: CockpitColors.primary),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      texto,
                      softWrap: true,
                      textAlign: TextAlign.center,
                      style: CockpitText.labelMd.copyWith(
                        fontSize: 11,
                        color: CockpitColors.onSurface,
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

    return Row(
      children: <Widget>[
        ficha(
          const Key('acceso-operador'),
          Icons.engineering_outlined,
          'OPERADOR DEMO',
          'usuario',
          'usuario',
        ),
        const SizedBox(width: 8),
        ficha(
          const Key('acceso-admin'),
          Icons.admin_panel_settings_outlined,
          'ADMIN DEMO',
          'admin',
          'admin',
        ),
      ],
    );
  }
}

/// Deja claro que es una demostración local, sin servidor ni registro público.
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
            'Demo local sin backend. Cuentas de ejemplo: usuario / usuario '
            '(Operador) y admin / admin (Administrador). No hay registro '
            'público: solo un Administrador crea operadores, que viven en '
            'memoria hasta cerrar la app.',
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
