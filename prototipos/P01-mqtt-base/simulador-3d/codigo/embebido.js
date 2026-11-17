// Móvil dentro de un iframe: sin doble scroll. Mide la altura real y se la envía a la página padre (cambio de Iliana, 17 nov).
/* Embebido en iframe (movil): sin doble scroll. Mide la altura real y se la envia a la pagina padre. */
(function () {
  var emb = false;
  try { emb = window.self !== window.top; } catch (e) { emb = true; }
  if (!emb) return;
  var root = document.documentElement;
  root.classList.add("embebido");
  var mq = window.matchMedia("(max-width:768px)");
  var ultimo = -1;
  function altoPadre() {
    try { return window.parent.innerHeight; } catch (e) { return window.screen.height; }
  }
  function medir() {
    var app = document.getElementById("app");
    if (!app) return;
    var h = null;
    if (mq.matches) {
      root.style.setProperty("--gl-h", Math.round(altoPadre() * 0.26) + "px");
      h = Math.ceil(app.getBoundingClientRect().height);
    } else {
      root.style.removeProperty("--gl-h");
    }
    if (h === ultimo) return;
    ultimo = h;
    try { window.parent.postMessage({ tipo: "p01-altura", h: h }, "*"); } catch (e) {}
  }
  window.addEventListener("load", medir);
  window.addEventListener("resize", medir);
  if (mq.addEventListener) mq.addEventListener("change", medir);
  if (window.ResizeObserver) {
    var app0 = document.getElementById("app");
    if (app0) new ResizeObserver(medir).observe(app0);
  }
  medir();
})();
