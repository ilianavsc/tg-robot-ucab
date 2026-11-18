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
  /* Menú en 5 grupos: tipo "enlace" va solo, tipo "grupo" despliega sus hijos.
     Cada hijo es [clave de data-pagina, texto, url]. */
  var APP_URL = "https://ilianavsc.github.io/tg-robot-ucab/app/"; // la app Flutter vive en su propia subcarpeta de GitHub Pages
  var grupos = [
    { tipo: "enlace", clave: "inicio", texto: "Inicio", url: "index.html" },
    { tipo: "grupo", id: "proyecto", texto: "El Proyecto", hijos: [
      ["cronograma", "Cronograma", "cronograma.html"],
      ["requerimientos", "Requerimientos", "requerimientos.html"],
      ["hardware", "Hardware", "hardware.html"],
      ["arquitectura", "Arquitectura", "arquitectura.html"],
      ["decisiones", "Decisiones", "decisiones.html"]
    ] },
    { tipo: "enlace", clave: "prototipos", texto: "Prototipos", url: "prototipos/index.html" },
    { tipo: "grupo", id: "avances", texto: "Avances", hijos: [
      ["pruebas", "Centro de pruebas", "prototipos/centro-pruebas.html"],
      ["bitacora", "Bitácora", "bitacora.html"],
      ["docs", "Documentación", "index.html#t-explora"]
    ] },
    { tipo: "enlace", clave: "app", texto: "App Web", url: APP_URL, destacado: true }
  ];

  // Los enlaces absolutos no llevan el prefijo `base` de las subpáginas.
  function urlDe(u) { return /^https?:\/\//.test(u) ? u : base + u; }
  var CHEVRON = '<svg class="menu-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  var ICONO_MENU = '<svg class="icono-hamb" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  var menu = document.getElementById("menu");
  if (menu) {
    var html = '<a class="menu-marca" href="' + base + 'index.html"><span class="punto-marca" aria-hidden="true"></span>TG Robot UCAB</a>' +
      '<button type="button" class="menu-hamburguesa" id="menu-hamburguesa" aria-expanded="false" aria-controls="menu-nav" aria-label="Abrir menú de navegación">' + ICONO_MENU + '<span>Menú</span></button>' +
      '<nav id="menu-nav" aria-label="Secciones"><ul class="menu-lista">';
    grupos.forEach(function (g) {
      if (g.tipo === "enlace") {
        html += '<li><a' + (g.destacado ? ' class="menu-app"' : "") + ' href="' + urlDe(g.url) + '"' + (g.clave === actual ? ' aria-current="page"' : "") + ">" + g.texto + "</a></li>";
        return;
      }
      var activo = g.hijos.some(function (h) { return h[0] === actual; });
      html += '<li class="menu-grupo' + (activo ? " tiene-actual" : "") + '">' +
        '<button type="button" class="menu-grupo-btn" aria-expanded="false" aria-haspopup="true" aria-controls="mg-' + g.id + '">' + g.texto + CHEVRON + "</button>" +
        '<ul class="menu-sub" id="mg-' + g.id + '">';
      g.hijos.forEach(function (h) {
        html += '<li><a href="' + urlDe(h[2]) + '"' + (h[0] === actual ? ' aria-current="page"' : "") + ">" + h[1] + "</a></li>";
      });
      html += "</ul></li>";
    });
    menu.innerHTML = html + "</ul></nav>";

    /* Botón hamburguesa en móvil */
    var btnHamb = document.getElementById("menu-hamburguesa");
    var cerrarMovil = function () {
      menu.classList.remove("menu-movil-abierto");
      if (btnHamb) btnHamb.setAttribute("aria-expanded", "false");
    };
    if (btnHamb) {
      btnHamb.addEventListener("click", function (e) {
        e.stopPropagation();
        var abierto = menu.classList.toggle("menu-movil-abierto");
        btnHamb.setAttribute("aria-expanded", abierto ? "true" : "false");
        if (!abierto) items.forEach(cerrarG);
      });
    }

    /* Despliegue: hover en PC, clic en PC y móvil/táctil; Esc, clic afuera y salir con Tab lo cierran. */
    var conHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    var items = [].slice.call(menu.querySelectorAll(".menu-grupo"));
    var temporizadores = new WeakMap();
    var cerrarG = function (g) {
      g.classList.remove("abierto");
      g.querySelector(".menu-grupo-btn").setAttribute("aria-expanded", "false");
    };
    var abrirG = function (g) {
      items.forEach(function (o) { if (o !== g) cerrarG(o); });
      g.classList.add("abierto");
      g.querySelector(".menu-grupo-btn").setAttribute("aria-expanded", "true");
    };
    items.forEach(function (g) {
      var btn = g.querySelector(".menu-grupo-btn");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (g.classList.contains("abierto")) cerrarG(g);
        else abrirG(g);
      });
      g.addEventListener("mouseenter", function () {
        if (!conHover.matches) return;
        clearTimeout(temporizadores.get(g));
        abrirG(g);
      });
      g.addEventListener("mouseleave", function () {
        if (!conHover.matches) return;
        temporizadores.set(g, setTimeout(function () { cerrarG(g); }, 140));
      });
      g.addEventListener("focusout", function (e) {
        if (!g.contains(e.relatedTarget)) cerrarG(g);
      });
    });
    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) {
        items.forEach(cerrarG);
        cerrarMovil();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      items.forEach(function (g) {
        if (g.classList.contains("abierto")) {
          cerrarG(g);
          if (g.contains(document.activeElement)) g.querySelector(".menu-grupo-btn").focus();
        }
      });
      cerrarMovil();
    });
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
