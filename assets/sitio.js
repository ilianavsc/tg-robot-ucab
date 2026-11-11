/* Menú, pie de página y utilidades de fechas, compartidos por todo el sitio */
(function () {
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var DIA = 864e5;

  function fecha(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function hoy() {
    var q = new URLSearchParams(location.search).get("hoy");
    if (q) return fecha(q);
    var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  }
  function dias(a, b) { return Math.round((b - a) / DIA); }
  function corto(d) { return d.getDate() + " " + MESES[d.getMonth()]; }
  function largo(d) { return corto(d) + " " + d.getFullYear(); }

  /* Semanas del TG: la numeración oficial no cuenta la semana de parciales (11 al 16 ene 2027).
     Ahora es una semana extra de trabajo: se muestra como "semana 11 + extra" */
  var PAUSA_INI = fecha("2027-01-11"), PAUSA_FIN = fecha("2027-01-17");
  function inicioSemana(n) {
    var d = new Date(fecha(window.TG.inicio).getTime() + (n - 1) * 7 * DIA);
    if (d >= PAUSA_INI) d = new Date(d.getTime() + 7 * DIA);
    return d;
  }
  function semana(d) {
    var ini = fecha(window.TG.inicio);
    if (d < ini) return { n: 0 };
    if (d >= PAUSA_INI && d <= PAUSA_FIN) return { n: 11, extra: true };
    var n = Math.floor(dias(ini, d) / 7) + 1;
    if (d > PAUSA_FIN) n -= 1;
    return { n: Math.min(n, window.TG.totalSemanas) };
  }
  function faseDe(d) {
    var f = window.TG.fases;
    for (var i = 0; i < f.length; i++) if (d <= fecha(f[i].fin).getTime() + DIA - 1) return f[i];
    return f[f.length - 1];
  }
  function estadoFase(f, d) {
    if (d > fecha(f.fin)) return "hecha";
    if (d >= fecha(f.inicio)) return "en curso";
    return "por venir";
  }

  window.TGU = { fecha: fecha, hoy: hoy, dias: dias, corto: corto, largo: largo,
    inicioSemana: inicioSemana, semana: semana, faseDe: faseDe, estadoFase: estadoFase };

  /* Menú */
  var base = document.body.getAttribute("data-base") || "";
  var actual = document.body.getAttribute("data-pagina") || "";
  var secciones = [
    ["inicio", "Inicio", "index.html"],
    ["cronograma", "Cronograma", "cronograma.html"],
    ["prototipos", "Prototipos", "prototipos/index.html"],
    ["bitacora", "Bitácora", null],
    ["decisiones", "Decisiones", null],
    ["hardware", "Hardware", null],
    ["arquitectura", "Arquitectura", null]
  ];
  var menu = document.getElementById("menu");
  if (menu) {
    var html = '<a class="menu-marca" href="' + base + 'index.html"><span class="punto-marca" aria-hidden="true"></span>TG Robot UCAB</a><nav aria-label="Secciones"><ul>';
    secciones.forEach(function (s) {
      if (s[2]) html += '<li><a href="' + base + s[2] + '"' + (s[0] === actual ? ' aria-current="page"' : "") + ">" + s[1] + "</a></li>";
      else html += '<li><span class="pronto" title="Próximamente">' + s[1] + "</span></li>";
    });
    menu.innerHTML = html + "</ul></nav>";
  }
  var pie = document.getElementById("pie");
  if (pie) {
    pie.innerHTML = window.TG.autoras + " · Ingeniería en Telecomunicaciones, UCAB · Tutor: " + window.TG.tutor +
      ' · <a href="' + window.TG.repo + '">Repositorio en GitHub</a>';
  }
})();
