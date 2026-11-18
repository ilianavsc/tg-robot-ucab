/// Guarda un CSV en el dispositivo. En Flutter Web dispara la descarga del
/// navegador; en otras plataformas devuelve `false` (la UI copia el texto al
/// portapapeles como respaldo).
library;

export 'descarga_csv_stub.dart'
    if (dart.library.js_interop) 'descarga_csv_web.dart';
