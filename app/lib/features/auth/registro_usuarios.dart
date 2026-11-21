import 'package:flutter/foundation.dart';

import 'sesion_local.dart';

/// Cuenta del registro local (en memoria).
class CuentaLocal {
  const CuentaLocal({
    required this.codigo,
    required this.usuario,
    required this.nombre,
    required this.clave,
    required this.rol,
    this.demo = false,
  });

  /// Código numérico de la cuenta (`00` Administrador, `01` Operador base, ...).
  final String codigo;

  /// Nombre de usuario en minúsculas (único).
  final String usuario;
  final String nombre;
  final String clave;
  final RolUsuario rol;

  /// `true` en las dos cuentas base (`00` y `01`), que no se pueden eliminar.
  final bool demo;
}

/// Resultado de crear un operador.
enum ResultadoAlta {
  creado('Operador creado.'),
  sinPermiso('Solo un Administrador puede crear operadores.'),
  nombreVacio('Escribe el nombre del operador.'),
  usuarioCorto('El usuario necesita al menos 3 caracteres.'),
  usuarioInvalido('Usa solo letras, números, punto, guion y guion bajo.'),
  usuarioRepetido('Ese usuario ya existe.'),
  claveCorta('La contraseña necesita al menos 4 caracteres.');

  const ResultadoAlta(this.mensaje);

  final String mensaje;
  bool get exito => this == creado;
}

/// **RBAC local (mock, sin backend).** Registro en memoria de las cuentas del
/// laboratorio: las dos cuentas base (`00` `administrador` / `administrador`
/// como Administrador y `01` `usuario` / `usuario` como Operador ya registrado
/// bajo la gestión de la cuenta `00`) y los operadores que el Administrador
/// da de alta durante la sesión.
///
/// Modelo cerrado: no existe registro público; solo un Administrador crea o
/// elimina operadores. Nada se guarda en el dispositivo ni en un servidor: las
/// cuentas nuevas desaparecen al cerrar la app. Las contraseñas están en
/// memoria en texto plano porque es una demostración sin backend.
class RegistroUsuarios extends ChangeNotifier {
  RegistroUsuarios() {
    _cuentas.addAll(const <CuentaLocal>[
      CuentaLocal(
        codigo: '00',
        usuario: 'administrador',
        nombre: 'Administrador',
        clave: 'administrador',
        rol: RolUsuario.administrador,
        demo: true,
      ),
      CuentaLocal(
        codigo: '01',
        usuario: 'usuario',
        nombre: 'Operador',
        clave: 'usuario',
        rol: RolUsuario.operador,
        demo: true,
      ),
    ]);
  }

  static final RegExp _formatoUsuario = RegExp(r'^[a-z0-9._-]+$');
  static const int largoMinimoUsuario = 3;
  static const int largoMinimoClave = 4;

  final List<CuentaLocal> _cuentas = <CuentaLocal>[];
  int _siguienteNumero = 2;

  List<CuentaLocal> get cuentas => List<CuentaLocal>.unmodifiable(_cuentas);

  /// Operadores que se dieron de alta en esta sesión (eliminables).
  List<CuentaLocal> get operadoresCreados => List<CuentaLocal>.unmodifiable(
    _cuentas.where((CuentaLocal c) => !c.demo),
  );

  static String normalizar(String usuario) => usuario.trim().toLowerCase();

  CuentaLocal? buscar(String usuario) {
    final String u = normalizar(usuario);
    for (final CuentaLocal c in _cuentas) {
      if (c.usuario == u) return c;
    }
    return null;
  }

  /// La cuenta si usuario, contraseña y [rolEsperado] (si se indica) coinciden;
  /// `null` si no.
  CuentaLocal? autenticar(
    String usuario,
    String clave, {
    RolUsuario? rolEsperado,
  }) {
    final CuentaLocal? c = buscar(usuario);
    if (c == null || c.clave != clave) return null;
    if (rolEsperado != null && c.rol != rolEsperado) return null;
    return c;
  }

  /// Da de alta un **Operador**. Solo lo permite un [actor] Administrador.
  ResultadoAlta crearOperador({
    required RolUsuario? actor,
    required String nombre,
    required String usuario,
    required String clave,
  }) {
    if (actor != RolUsuario.administrador) return ResultadoAlta.sinPermiso;
    final String n = nombre.trim();
    final String u = normalizar(usuario);
    if (n.isEmpty) return ResultadoAlta.nombreVacio;
    if (u.length < largoMinimoUsuario) return ResultadoAlta.usuarioCorto;
    if (!_formatoUsuario.hasMatch(u)) return ResultadoAlta.usuarioInvalido;
    if (buscar(u) != null) return ResultadoAlta.usuarioRepetido;
    if (clave.length < largoMinimoClave) return ResultadoAlta.claveCorta;
    final String codigo = _siguienteNumero.toString().padLeft(2, '0');
    _siguienteNumero++;
    _cuentas.add(
      CuentaLocal(
        codigo: codigo,
        usuario: u,
        nombre: n,
        clave: clave,
        rol: RolUsuario.operador,
      ),
    );
    notifyListeners();
    return ResultadoAlta.creado;
  }

  /// Elimina un operador creado. Las cuentas de demostración no se eliminan y
  /// solo lo permite un [actor] Administrador.
  bool eliminarOperador({required RolUsuario? actor, required String usuario}) {
    if (actor != RolUsuario.administrador) return false;
    final CuentaLocal? c = buscar(usuario);
    if (c == null || c.demo || c.rol != RolUsuario.operador) return false;
    _cuentas.remove(c);
    notifyListeners();
    return true;
  }
}
