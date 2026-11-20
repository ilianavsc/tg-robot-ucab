/* Simulador 2 V2 · lógica del radar ultrasónico (tomada de P13) sin DOM, para poder probarla en Node.
 *
 * Qué trae de P13 (prototipos/P13-sensores-ultrasonicos/index.html):
 *   · zonas: crítica < 20 cm · precaución 20–50 cm · libre ≥ 50 cm (las mismas del firmware y del núcleo);
 *   · un obstáculo (ficha roja) que se arrastra sobre la pista y que cada sensor detecta con su cono;
 *   · el limitador suave del frenado (rampa 0,55 m/s² al frenar);
 *   · el velocímetro de 0,00 a 0,46 m/s (velocidad máxima en recta de SIM1: JGA25-371 a 11,1 V y 80 % de PWM).
 * Diferencia a propósito: el cono es de ±15° (como el simulador 3D de P03, más realista para un HC-SR04P) y no de ±35°.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.RadarUS = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RAD = Math.PI / 180;
  var C = {
    CONO_GRADOS: 15,         /* semiapertura del haz (P03) */
    PARADA_CM: 20,
    AVISO_CM: 50,
    VEL_MAX_VELO: 0.46,      /* fondo de escala del velocímetro (m/s) */
    ARCO_LEN: 94.25,         /* largo del arco SVG del velocímetro (igual que P13) */
    RAMPA_DECEL_MS2: 0.55,   /* frenado suave (P13) */
    RAMPA_ACEL_MS2: 0.90,    /* recuperación tras despejar (algo más ágil que los 0,42 de P13 para no alargar la demo) */
    ALCANCE_M: 4
  };

  function zona(cm) {
    if (!(cm > 0)) return "libre";
    return cm < C.PARADA_CM ? "critica" : (cm < C.AVISO_CM ? "precaucion" : "libre");
  }

  /* Distancia (cm) al obstáculo más cercano dentro del cono del sensor, o null si no hay eco.
     origen = {x, y, angulo en grados (0 = +x, antihorario)} · obstaculos = [{x, y, r}] en metros.
     Obstáculo circular: se detecta si el ángulo hacia su centro, restando lo que ocupa el círculo, cae dentro del cono. */
  function medirCono(origen, obstaculos, semiGrados, alcanceM) {
    var semi = (semiGrados === undefined ? C.CONO_GRADOS : semiGrados) * RAD;
    var alc = alcanceM || C.ALCANCE_M, mejor = null, i, o, dx, dy, d, ang, dif, ancho, dist;
    var ax = origen.angulo * RAD;
    for (i = 0; i < obstaculos.length; i++) {
      o = obstaculos[i];
      dx = o.x - origen.x; dy = o.y - origen.y;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d <= o.r) { mejor = 1; continue; }            /* contacto: lectura mínima */
      ang = Math.atan2(dy, dx);
      dif = Math.abs(Math.atan2(Math.sin(ang - ax), Math.cos(ang - ax)));
      ancho = Math.asin(Math.min(1, o.r / d));
      if (dif - ancho > semi) continue;                 /* fuera del cono */
      dist = d - o.r;
      if (dist > alc) continue;
      dist = Math.round(dist * 1000) / 10;              /* cm con un decimal */
      if (dist < 1) dist = 1;
      if (mejor === null || dist < mejor) mejor = dist;
    }
    return mejor;
  }

  /* Limita la velocidad de una orden (PWM 0..1 → se traduce con vMaxMs) a una rampa en m/s².
     Devuelve el nuevo valor de la componente común. */
  function rampa(actual, objetivo, dtS, vMaxMs, decelMs2, acelMs2) {
    var dec = (decelMs2 === undefined ? C.RAMPA_DECEL_MS2 : decelMs2) / vMaxMs * dtS;
    var ace = (acelMs2 === undefined ? C.RAMPA_ACEL_MS2 : acelMs2) / vMaxMs * dtS;
    if (objetivo < actual) return Math.max(objetivo, actual - dec);
    return Math.min(objetivo, actual + ace);
  }

  /* Velocímetro SVG de P13 (arco de 94,25 y aguja de −90° a +90°) */
  function velocimetro(vel) {
    var r = Math.max(0, Math.min(1, Math.abs(vel) / C.VEL_MAX_VELO));
    return {
      razon: r,
      dashoffset: Math.round(C.ARCO_LEN * (1 - r) * 100) / 100,
      agujaGrados: Math.round((-90 + r * 180) * 10) / 10,
      color: Math.abs(vel) <= 0.005 ? "rojo" : "verde"
    };
  }

  return { C: C, zona: zona, medirCono: medirCono, rampa: rampa, velocimetro: velocimetro };
});
