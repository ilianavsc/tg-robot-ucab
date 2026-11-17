/* Menú, pie de página, modal de documentación (.md) y utilidades de fechas, compartidos por todo el sitio */
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
    ["pruebas", "Centro de pruebas", "prototipos/centro-pruebas.html"],
    ["requerimientos", "Requerimientos", "requerimientos.html"],
    ["hardware", "Hardware", "hardware.html"],
    ["arquitectura", "Arquitectura", "arquitectura.html"],
    ["decisiones", "Decisiones", "decisiones.html"],
    ["bitacora", "Bitácora", "bitacora.html"],
    ["docs", "Documentación", "index.html#t-explora"],
    // La app Flutter vive en su propia subcarpeta de GitHub Pages
    ["app", "App web", "https://ilianavsc.github.io/tg-robot-ucab/app/"]
  ];

  // Los enlaces absolutos no llevan el prefijo `base` de las subpáginas.
  function urlDe(u) { return /^https?:\/\//.test(u) ? u : base + u; }
  var menu = document.getElementById("menu");
  if (menu) {
    var html = '<a class="menu-marca" href="' + base + 'index.html"><span class="punto-marca" aria-hidden="true"></span>TG Robot UCAB</a><nav aria-label="Secciones"><ul>';
    secciones.forEach(function (s) {
      if (s[2]) html += '<li><a href="' + urlDe(s[2]) + '"' + (s[0] === actual ? ' aria-current="page"' : "") + ">" + s[1] + "</a></li>";
      else html += '<li><span class="pronto" title="Próximamente">' + s[1] + "</span></li>";
    });
    menu.innerHTML = html + "</ul></nav>";
  }
  var pie = document.getElementById("pie");
  if (pie) {
    pie.innerHTML = window.TG.autoras + " · Ingeniería en Telecomunicaciones, UCAB · Tutor: " + window.TG.tutor +
      ' · <a href="' + window.TG.repo + '" target="_blank" rel="noopener">Repositorio en GitHub</a>' +
      ' · <a class="pie-enlace-historial" href="' + base + 'archivo-fase-1.html">Ver historial de desarrollo</a>';
  }

  /* =====================================================================
     VISOR MODAL DE DOCUMENTACIÓN MARKDOWN (marked.js vía CDN)
     ===================================================================== */
  var markedPromesa = null;
  function asegurarMarked() {
    if (window.marked) return Promise.resolve(window.marked);
    if (markedPromesa) return markedPromesa;
    markedPromesa = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
      s.onload = function () { resolve(window.marked); };
      s.onerror = function () { reject(new Error("No se pudo cargar marked.js")); };
      document.head.appendChild(s);
    });
    return markedPromesa;
  }

  function obtenerModal() {
    var dlg = document.getElementById("modal-md");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "modal-md";
    dlg.className = "modal-md";
    dlg.setAttribute("aria-label", "Visor de documentación");
    dlg.innerHTML =
      '<div class="modal-md-cabecera">' +
        '<span class="modal-md-ruta" id="modal-md-ruta">Documento</span>' +
        '<button type="button" class="modal-md-cerrar" id="modal-md-cerrar">✕ Cerrar</button>' +
      '</div>' +
      '<div class="modal-md-cuerpo" id="modal-md-cuerpo"></div>';
    document.body.appendChild(dlg);

    document.getElementById("modal-md-cerrar").addEventListener("click", function () {
      dlg.close();
    });
    dlg.addEventListener("click", function (ev) {
      if (ev.target === dlg) dlg.close();
    });
    dlg.addEventListener("close", function () {
      document.body.style.overflow = "";
    });
    return dlg;
  }

  function normalizarRutaMd(enlace) {
    var dataMd = enlace.getAttribute("data-md");
    if (dataMd) {
      return /\/$/.test(dataMd) ? dataMd + "README.md" : dataMd;
    }
    var href = enlace.getAttribute("href") || "";
    if (!href || href.hasAttribute && enlace.hasAttribute("download")) return null;
    var ghMatch = href.match(/^https?:\/\/github\.com\/ilianavsc\/tg-robot-ucab\/blob\/main\/(.+\.md)$/i);
    if (ghMatch) return base + ghMatch[1];
    if (/^https?:\/\//i.test(href)) return null;
    if (/\.md(#.*)?$/i.test(href)) return href.split("#")[0];
    return null;
  }

  function abrirModalMd(ruta, titulo) {
    var dlg = obtenerModal();
    var etiqueta = document.getElementById("modal-md-ruta");
    var cuerpo = document.getElementById("modal-md-cuerpo");
    etiqueta.textContent = titulo ? titulo + " · " + ruta : ruta;
    cuerpo.innerHTML = '<p class="suave">Cargando documento…</p>';
    if (!dlg.open) {
      document.body.style.overflow = "hidden";
      dlg.showModal();
    }

    Promise.all([
      asegurarMarked(),
      fetch(ruta).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
    ]).then(function (res) {
      var markedLib = res[0];
      var textoMd = res[1];
      var htmlRender = markedLib.parse ? markedLib.parse(textoMd) : markedLib(textoMd);
      cuerpo.innerHTML = htmlRender;

      // Resolver rutas relativas (imágenes y enlaces) respecto a la carpeta del .md
      var dir = ruta.indexOf("/") >= 0 ? ruta.slice(0, ruta.lastIndexOf("/") + 1) : "";
      if (dir) {
        cuerpo.querySelectorAll("img[src]").forEach(function (img) {
          var src = img.getAttribute("src");
          if (src && !/^(https?:|data:|\/)/i.test(src)) img.setAttribute("src", dir + src);
        });
        cuerpo.querySelectorAll("a[href]").forEach(function (a) {
          var h = a.getAttribute("href");
          if (h && !/^(https?:|mailto:|#|\/)/i.test(h)) a.setAttribute("href", dir + h);
        });
      }
      cuerpo.scrollTop = 0;
    }).catch(function (err) {
      cuerpo.innerHTML = '<div class="aviso-grande"><p><b>No se pudo cargar el documento:</b> ' + ruta + '</p><p class="suave">' + err.message + '</p></div>';
    });
  }

  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (location.protocol === "file:" && /(^|\/)app\/?$/.test(href)) {
      ev.preventDefault();
      window.open("https://ilianavsc.github.io/tg-robot-ucab/app/", "_blank", "noopener");
      return;
    }
    var rutaMd = normalizarRutaMd(a);
    if (!rutaMd) return;
    ev.preventDefault();
    var titulo = a.getAttribute("data-titulo") || (a.querySelector("h3") ? a.querySelector("h3").textContent.trim() : a.textContent.trim());
    abrirModalMd(rutaMd, titulo);
  });
})();
