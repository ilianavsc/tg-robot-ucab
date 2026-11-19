/* P10 · Escenario híbrido (SIL): tramo sin cinta + balizas BLE.
 *
 * Modelo puro (sin DOM ni red) para poder probarlo con Node. Todo es
 * SIMULACIÓN: ni la lectura de la MPU-6050 ni el escaneo BLE están integrados
 * en el firmware real ([PENDIENTE DE INTEGRACIÓN EN FIRMWARE]).
 *
 * Arquitectura prevista: 1 ESP32 móvil (el robot) + 2 ESP32 fijos que anuncian
 * por BLE como balizas de proximidad (anchors): una en el Cuarto de Componentes
 * y otra en el Laboratorio 1. Sin magnetómetro: el "heading hold" mantiene el
 * rumbo RELATIVO (el que tenía al perder la cinta) con el giroscopio de la
 * MPU-6050; no hay brújula ni rumbo absoluto.
 *
 * Recorrido: Cuarto de Componentes (s = 0) → tramo sin cinta → Laboratorio 1
 * (s = LONGITUD_M). El tramo sin cinta termina cuando la baliza del Laboratorio 1
 * confirma proximidad (RSSI ≥ CONFIRMA_DBM durante LECTURAS_CONFIRMACION lecturas).
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.P10Hibrido = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  var C = {
    LONGITUD_M: 8,            /* distancia entre las 2 balizas (supuesto de simulación) */
    INICIO_SIN_CINTA_M: 1.0,  /* la cinta se acaba 1 m después del cuarto */
    V_MS: 0.35,               /* velocidad de marcha sin cinta (supuesto) */
    RSSI_CERCA: -52,          /* dBm junto a la baliza */
    RSSI_LEJOS: -80,          /* dBm en el límite de detección */
    RADIO_DETECCION_M: 6,
    DIST_CERCA_M: 0.5,
    CONFIRMA_DBM: -55,        /* umbral de proximidad */
    LECTURAS_CONFIRMACION: 3, /* lecturas seguidas por encima del umbral */
    PERIODO_LECTURA_S: 0.2,   /* escaneo BLE simulado: 5 lecturas/s */
    SESGO_GIRO_DPS: 0.30,     /* sesgo del giroscopio (°/s), supuesto */
    GANANCIA_HOLD: 1.2        /* 1/s del lazo de corrección de rumbo */
  };

  function acotar(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* RSSI (dBm) a una distancia d (m) de una baliza: de -80 (lejos) a -52 (cerca). */
  function rssi(d) {
    var f = 1 - acotar((d - C.DIST_CERCA_M) / (C.RADIO_DETECCION_M - C.DIST_CERCA_M), 0, 1);
    return Math.round((C.RSSI_LEJOS + (C.RSSI_CERCA - C.RSSI_LEJOS) * Math.pow(f, 1.5)) * 10) / 10;
  }

  function crear() {
    return {
      activo: false, fase: "inactivo", t: 0, s: 0,
      lecturaT: 0, rssiCuarto: C.RSSI_CERCA, rssiLab: rssi(C.LONGITUD_M),
      confirmaciones: 0, confirmada: false,
      headingErrDeg: 0, derivaHoldCm: 0, derivaSinHoldCm: 0, errSinHoldDeg: 0,
      lecturas: 0
    };
  }

  function iniciar(e) {
    var n = crear();
    for (var k in n) e[k] = n[k];
    e.activo = true;
    e.fase = "con-cinta";
    return e;
  }

  function sinCinta(e) {
    return e.activo && e.s >= C.INICIO_SIN_CINTA_M && !e.confirmada && e.fase !== "completo";
  }

  /* Lectura de los 4 TCRT5000 (0 = no ve cinta). Sin cinta: [0,0,0,0]. */
  function tcrt(e) {
    return sinCinta(e) ? [0, 0, 0, 0] : [0, 1, 1, 0];
  }

  /* Avanza el escenario dt segundos. Devuelve el mismo objeto. */
  function avanzar(e, dt) {
    if (!e.activo || e.fase === "completo") return e;
    var resto = dt;
    while (resto > 1e-9) {
      var paso = Math.min(resto, 0.05);
      resto -= paso;
      e.t += paso;
      if (e.fase === "con-cinta" && e.s >= C.INICIO_SIN_CINTA_M) e.fase = "sin-cinta";
      if (e.fase === "confirmado") {
        /* llegada: se detiene a los pocos cm */
        if (e.s < C.LONGITUD_M) e.s = Math.min(C.LONGITUD_M, e.s + C.V_MS * paso);
        else e.fase = "completo";
      } else {
        e.s = Math.min(C.LONGITUD_M, e.s + C.V_MS * paso);
      }
      /* Giroscopio: el sesgo se acumula; el heading hold lo corrige. Sin cinta. */
      if (sinCinta(e)) {
        e.headingErrDeg += (C.SESGO_GIRO_DPS - C.GANANCIA_HOLD * e.headingErrDeg) * paso;
        e.errSinHoldDeg += C.SESGO_GIRO_DPS * paso;
        e.derivaHoldCm += C.V_MS * Math.sin(e.headingErrDeg * Math.PI / 180) * paso * 100;
        e.derivaSinHoldCm += C.V_MS * Math.sin(e.errSinHoldDeg * Math.PI / 180) * paso * 100;
      }
      /* Escaneo BLE */
      e.lecturaT += paso;
      if (e.lecturaT >= C.PERIODO_LECTURA_S - 1e-9) {
        e.lecturaT = 0;
        e.lecturas++;
        var dCuarto = Math.abs(e.s - 0);
        var dLab = Math.abs(C.LONGITUD_M - e.s);
        /* rizado determinista de ±1 dBm (sin aleatoriedad) */
        e.rssiCuarto = Math.round((rssi(dCuarto) + Math.sin(e.t * 3.1)) * 10) / 10;
        e.rssiLab = Math.round((rssi(dLab) + Math.sin(e.t * 2.3 + 1)) * 10) / 10;
        if (e.fase === "sin-cinta" || e.fase === "con-cinta") {
          if (e.rssiLab >= C.CONFIRMA_DBM) e.confirmaciones++;
          else e.confirmaciones = 0;
          if (e.confirmaciones >= C.LECTURAS_CONFIRMACION) {
            e.confirmada = true;
            e.fase = "confirmado";
          }
        }
      }
    }
    return e;
  }

  var ETIQUETAS = {
    inactivo: "Inactivo",
    "con-cinta": "Con cinta (salida del Cuarto de Componentes)",
    "sin-cinta": "Tramo SIN cinta · heading hold + BLE",
    confirmado: "Baliza del Laboratorio 1 confirmada · cinta de nuevo",
    completo: "Completo: llegó al Laboratorio 1"
  };

  return {
    C: C, rssi: rssi, crear: crear, iniciar: iniciar, avanzar: avanzar,
    tcrt: tcrt, sinCinta: sinCinta, ETIQUETAS: ETIQUETAS
  };
});
