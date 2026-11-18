import 'dart:convert';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// Flutter Web: arma un Blob `text/csv` (con BOM UTF-8 para que Excel lea las
/// tildes) y lo descarga con un `<a download>` temporal.
Future<bool> descargarCsv(String nombreArchivo, String contenido) async {
  try {
    final bytes = utf8.encode('﻿$contenido');
    final blob = web.Blob(
      <JSAny>[bytes.toJS].toJS,
      web.BlobPropertyBag(type: 'text/csv;charset=utf-8'),
    );
    final url = web.URL.createObjectURL(blob);
    final enlace = web.HTMLAnchorElement()
      ..href = url
      ..download = nombreArchivo
      ..style.display = 'none';
    web.document.body?.append(enlace);
    enlace.click();
    enlace.remove();
    web.URL.revokeObjectURL(url);
    return true;
  } catch (_) {
    return false;
  }
}
