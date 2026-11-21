/* Simulador 2 V2 · estado del gemelo digital y puente con la app Flutter. Sin DOM.
 *
 * Formato del estado (una sola fuente para la página, las pruebas y el mapa de la app):
 *   { pista, x, y, angulo, velocidad_ms, frente_cm, atras_cm, alerta, s_m }
 *     pista        "A" (circuito histórico, 8,05 m) | "B" (canónica, 9,0 m)
 *     x, y         metros en el mundo de SIM1 (y = Z de SIM1)
 *     angulo       grados, 0 = +x (este), positivo antihorario, −180..180
 *     velocidad_ms velocidad lineal (m/s), con signo
 *     frente_cm    HC-SR04P frontal (0 = sin eco)       atras_cm  HC-SR04P trasero
 *     alerta       ninguna | obstaculo | obstaculo_atras | timeout_sin_linea | deriva_excesiva
 *     s_m          metros recorridos sobre la pista: la app dibuja su mapa con s_m / largo_m
 *
 * x, y, angulo y s_m son SOLO del gemelo (SIL): el robot real no tiene localización absoluta ni brújula, y la app
 * no los recibe por MQTT. Lo que sí entiende la app sale de aContratoApp(): topics estado y ultrasonido del firmware.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.GemeloEstado = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ALERTAS = ["ninguna", "obstaculo", "obstaculo_atras", "timeout_sin_linea", "deriva_excesiva"];

  function r(x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; }

  function alertaDe(sim, frenteCm, atrasCm) {
    if (sim.nav.paradaSeguridad && (sim.motivoParada === "timeout_sin_linea" || sim.motivoParada === "deriva_excesiva")) return sim.motivoParada;
    var umbral = sim.nucleo.CFG.UMBRAL_PARADA_CM;
    if (frenteCm > 0 && frenteCm < umbral) return "obstaculo";
    if (atrasCm > 0 && atrasCm < umbral) return "obstaculo_atras";
    return "ninguna";
  }

  /* S = módulo SimMovimiento (para leer los sensores y la pose) */
  function estadoGemelo(sim, S) {
    var pose = S.poseMundo(sim);
    var frente = S.frenteActualCm(sim), atras = S.atrasActualCm(sim);
    return {
      pista: sim.trazado ? sim.trazado.id : "B",
      x: r(pose.x, 3), y: r(pose.y, 3), angulo: r(pose.angulo, 1),
      velocidad_ms: r(sim.vLineal, 3),
      frente_cm: r(frente, 1), atras_cm: r(atras, 1),
      alerta: alertaDe(sim, frente, atras),
      s_m: r(sim.s, 3)
    };
  }

  /* Valida el formato (para las pruebas y para quien consuma el estado) */
  function validar(e) {
    var errores = [];
    ["pista", "x", "y", "angulo", "velocidad_ms", "frente_cm", "atras_cm", "alerta", "s_m"].forEach(function (k) {
      if (!(k in e)) errores.push("falta " + k);
    });
    if (e.pista !== "A" && e.pista !== "B") errores.push("pista inválida");
    if (!(e.angulo > -180 - 1e-9 && e.angulo <= 180 + 1e-9)) errores.push("angulo fuera de −180..180");
    if (ALERTAS.indexOf(e.alerta) < 0) errores.push("alerta inválida");
    ["x", "y", "velocidad_ms", "frente_cm", "atras_cm", "s_m"].forEach(function (k) {
      if (typeof e[k] !== "number" || !isFinite(e[k])) errores.push(k + " no es un número");
    });
    return errores;
  }

  /* Lo que entiende la app Flutter de hoy (sin tocar app/): estado y ultrasonido, con las claves del firmware.
     La posición (s_m / largo_m) va aparte porque el firmware real no la publica. */
  function aContratoApp(e, sim, S) {
    var vIzq = sim.vIzq * sim.P.V_MAX_MS, vDer = sim.vDer * sim.P.V_MAX_MS;
    var sens = sim.sensores || S.sensoresActuales(sim);
    var parada = e.alerta === "obstaculo" ? "obstaculo_frente" : (e.alerta === "obstaculo_atras" ? "obstaculo_atras" : "ninguna");
    var tms = Math.round(sim.t * 1000);
    return {
      estado: {
        estado: sim.modo === "manual" ? "manual" : "autonomo",
        linea_mm: r(sens.hayCinta ? sens.lineaRealMm : 0, 1),
        v_izq: r(vIzq, 3), v_der: r(vDer, 3), parada: parada, t: tms
      },
      ultrasonido: { frente_cm: e.frente_cm, atras_cm: e.atras_cm, frente_ok: true, atras_ok: true, t: tms },
      mapa: { fraccion: r(e.s_m / sim.L, 4), largo_m: sim.L }
    };
  }

  return { ALERTAS: ALERTAS, estadoGemelo: estadoGemelo, validar: validar, aContratoApp: aContratoApp };
});
