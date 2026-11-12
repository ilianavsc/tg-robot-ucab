/* Íconos de los componentes del robot (SVG en línea, 32 × 32).
   Color de acento por familia: energía = coral, control = violeta, movimiento = verde, sensores = amarillo.
   Uso: TGI("Batería") devuelve el <svg>. Si no hay ícono para un nombre, devuelve uno genérico. */
(function () {
  var C = { energia: "#F2603D", control: "#6B4EE6", mov: "#0F9D84", sensor: "#F2B33D" };
  var abre = '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="#14213D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var I = {
    "Microcontrolador":
      '<rect x="9" y="9" width="14" height="14" rx="2"/><rect x="13" y="13" width="6" height="6" rx="1" fill="' + C.control + '" stroke="none"/>' +
      '<path d="M12 9V5M16 9V5M20 9V5M12 27v-4M16 27v-4M20 27v-4M9 12H5M9 16H5M9 20H5M27 12h-4M27 16h-4M27 20h-4"/>',
    "Driver":
      '<rect x="4" y="17" width="24" height="10" rx="2"/><rect x="9" y="11" width="14" height="6" fill="' + C.control + '" stroke="none"/>' +
      '<path d="M10 11V5M14 11V5M18 11V5M22 11V5"/><circle cx="8" cy="22" r="1.4"/><circle cx="24" cy="22" r="1.4"/>',
    "Motores":
      '<rect x="3" y="10" width="12" height="12" rx="2"/><rect x="15" y="11" width="8" height="10" rx="1" fill="' + C.mov + '" stroke="none"/>' +
      '<rect x="15" y="11" width="8" height="10" rx="1"/><path d="M23 16h6M7 10v12"/>',
    "Batería":
      '<rect x="3" y="10" width="22" height="12" rx="2"/><rect x="6" y="13" width="11" height="6" rx="1" fill="' + C.energia + '" stroke="none"/><path d="M25 13.5h3v5h-3"/>',
    "Porta pilas":
      '<rect x="4" y="5" width="24" height="22" rx="2"/><rect x="8" y="8" width="4" height="16" rx="2" fill="' + C.energia + '" stroke="none"/>' +
      '<rect x="14" y="8" width="4" height="16" rx="2" fill="' + C.energia + '" stroke="none"/><rect x="20" y="8" width="4" height="16" rx="2" fill="' + C.energia + '" stroke="none"/>',
    "BMS":
      '<path d="M16 4l10 4v7c0 6.5-4.3 11-10 13C10.3 26 6 21.5 6 15V8z"/><path d="M11.5 15.5l3.2 3.2 6-6.5" stroke="' + C.energia + '" stroke-width="2.4"/>',
    "Cargador":
      '<rect x="7" y="9" width="14" height="14" rx="3"/><path d="M11 9V4M17 9V4M14 23v3c0 2 2 3 4 3h6"/><path d="M15 12l-3 5h4l-3 5" stroke="' + C.energia + '" stroke-width="2"/>',
    "Puerto de carga":
      '<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="5"/><circle cx="16" cy="16" r="1.8" fill="' + C.energia + '" stroke="none"/>',
    "Regulador":
      '<rect x="4" y="7" width="24" height="18" rx="2"/><circle cx="12" cy="16" r="4"/><path d="M22 11v9M19 17l3 3 3-3" stroke="' + C.energia + '" stroke-width="2"/>',
    "Medición de batería":
      '<path d="M5 22a11 11 0 0 1 22 0"/><path d="M16 22l6-7" stroke="' + C.energia + '" stroke-width="2.2"/><circle cx="16" cy="22" r="1.8" fill="#14213D" stroke="none"/><path d="M8 17l1.5 1M24 17l-1.5 1M16 11v2"/>',
    "Protección":
      '<rect x="8" y="11" width="16" height="10" rx="2"/><path d="M3 16h5M24 16h5"/><path d="M11 16c2-3 3 3 5 0s3 3 5 0" stroke="' + C.energia + '" stroke-width="2"/>',
    "Sensores de línea":
      '<rect x="3" y="7" width="26" height="9" rx="2"/><circle cx="8" cy="11.5" r="1.6"/><circle cx="13" cy="11.5" r="1.6"/><circle cx="19" cy="11.5" r="1.6"/><circle cx="24" cy="11.5" r="1.6"/>' +
      '<path d="M3 25h26" stroke="#14213D" stroke-width="4"/><path d="M13 18v3M19 18v3" stroke="' + C.sensor + '" stroke-width="2"/>',
    "Obstáculos":
      '<rect x="3" y="11" width="16" height="10" rx="2"/><circle cx="7.5" cy="16" r="2.5"/><circle cx="14.5" cy="16" r="2.5"/>' +
      '<path d="M22 12a6 6 0 0 1 0 8M25 9a10 10 0 0 1 0 14" stroke="' + C.sensor + '" stroke-width="2"/>',
    "Movimiento y alarma":
      '<rect x="10" y="10" width="12" height="12" rx="2"/><path d="M16 10V3M13.5 5.5L16 3l2.5 2.5M22 16h7M26.5 13.5L29 16l-2.5 2.5M10 22l-5 5M5 23v4h4"/><circle cx="16" cy="16" r="2.2" fill="' + C.sensor + '" stroke="none"/>',
    "Ruedas":
      '<circle cx="16" cy="16" r="12" stroke-width="3.2"/><circle cx="16" cy="16" r="7" fill="' + C.mov + '" stroke="none"/><path d="M16 10v12M10 16h12" stroke="#fff" stroke-width="1.6"/><circle cx="16" cy="16" r="2" fill="#14213D" stroke="none"/>',
    "Rueda loca":
      '<path d="M8 6h16M11 6v8h10V6"/><path d="M9 14h14"/><circle cx="16" cy="21" r="6" fill="' + C.mov + '" stroke="none"/><circle cx="16" cy="21" r="6"/><path d="M5 28h22"/>',
    "Re-localización":
      '<circle cx="16" cy="17" r="2.6" fill="' + C.sensor + '" stroke="none"/><path d="M11 12a7 7 0 0 0 0 10M21 12a7 7 0 0 1 0 10M7 8a12.5 12.5 0 0 0 0 18M25 8a12.5 12.5 0 0 1 0 18"/>',
    "Mecanismo de carga":
      '<path d="M4 13h24l-3 11H7z"/><path d="M10 13V8h12v5"/><rect x="13" y="16" width="6" height="4" rx="1" fill="' + C.mov + '" stroke="none"/>'
  };
  var generico = '<rect x="6" y="6" width="20" height="20" rx="3"/><path d="M11 16h10M16 11v10"/>';
  window.TGI = function (nombre) {
    return abre + (I[nombre] || generico) + "</svg>";
  };
})();
