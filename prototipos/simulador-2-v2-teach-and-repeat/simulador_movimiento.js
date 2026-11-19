/* Simulador 2 V2 · planta física del robot sobre la pista canónica (9,0 m).
 *
 * Este archivo SOLO modela el mundo y el robot (cinta, sensores, cinemática,
 * giroscopio, balizas BLE, obstáculos). La lógica de navegación NO está aquí:
 * se le entrega el núcleo `specs/navegacion/teach_and_repeat.js` (el mismo
 * archivo que prueba `specs/navegacion/teach_and_repeat.test.js`) y la pista
 * `specs/pista_canonica.json`, y en cada tick se llama a `nucleo.paso(...)`.
 *
 * Todo es SIMULACIÓN (SIL): la velocidad máxima, el ancho entre ruedas, el
 * sesgo del giroscopio y el modelo de RSSI son supuestos, no mediciones.
 * [PENDIENTE DE MEDICIÓN FÍSICA]. La MPU-6050 y el escaneo BLE están
 * [PENDIENTE DE INTEGRACIÓN EN FIRMWARE]. Sin magnetómetro: el rumbo es
 * RELATIVO a la dirección de la pista al empezar el viaje.
 *
 * Convenios: s = posición sobre la pista (m, 0 = Cuarto de Componentes,
 * 9,0 = Laboratorio 1). dir = +1 (ida) o -1 (vuelta). yaw positivo = giro a la
 * derecha (horario). y = desvío lateral a la IZQUIERDA de la cinta (m);
 * linea_mm > 0 = cinta a la izquierda del robot (igual que el firmware).
 * Navegación teach-and-repeat: se enseña la ruta y se repite.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.SimMovimiento = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Supuestos de la planta (no vienen de la pista ni del núcleo) */
  var P = {
    V_MAX_MS: 0.65,        /* velocidad con PWM = 1,0; BASE_VEL 0,8 -> 0,52 m/s */
    ANCHO_EJES_M: 0.16,    /* separación entre ruedas */
    ADELANTE_SENSOR_M: 0.08, /* los TCRT5000 van delante del eje */
    FRENTE_ROBOT_M: 0.12,  /* del centro al HC-SR04P frontal */
    ANCHO_CINTA_MM: 19,
    CAIDA_SENSOR_MM: 6,    /* el sensor pasa de ver a no ver la cinta en 6 mm */
    TAU_RUEDAS_S: 0.10,    /* retardo de primer orden de las ruedas */
    CELDA_M: 0.05,         /* resolución de la cinta */
    RADIO_BLE_M: 1.5,      /* a 1,5 m de una baliza el RSSI vale -80 dBm */
    CERCA_BLE_M: 0.25,     /* a 0,25 m vale -52 dBm */
    RSSI_PISO_DBM: -95,    /* sin señal */
    VEL_MANUAL_PWM: 0.8,
    GIRO_MANUAL_PWM: 0.4,
    ATRAS_LIBRE_CM: 160,
    ALCANCE_US_CM: 400
  };

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  var RAD = Math.PI / 180;

  /* RSSI (dBm) a una distancia d (m) de la baliza más cercana. Solo hay señal
     útil cerca de los EXTREMOS: a mitad de pasillo no se oye ninguna baliza. */
  function rssiAUnaBaliza(d) {
    if (d <= P.CERCA_BLE_M) return -52;
    if (d >= P.RADIO_BLE_M) {
      return Math.max(P.RSSI_PISO_DBM, -80 - 10 * (d - P.RADIO_BLE_M));
    }
    var f = (d - P.CERCA_BLE_M) / (P.RADIO_BLE_M - P.CERCA_BLE_M);
    return Math.round((-52 - 28 * Math.pow(f, 0.8)) * 10) / 10;
  }

  /* ------------------------------------------------------------ creación */

  /* nucleo: módulo teach_and_repeat.js · pista: specs/pista_canonica.json */
  function crear(nucleo, pista) {
    var L = pista.longitudTotalM;
    var celdas = Math.round(L / P.CELDA_M);
    var sim = {
      nucleo: nucleo, pista: pista, L: L, P: P,
      cinta: [], tramosEnsenados: [],
      s: 0, dir: 1, y: 0, yawVerdad: 0, sesgoAcumGrados: 0, sesgoDps: 0,
      vIzqCmd: 0, vDerCmd: 0, vIzq: 0, vDer: 0, vLineal: 0,
      modo: "auto",          /* "auto" = teach-and-repeat · "manual" */
      frenoRemoto: false,
      manual: "frenar",
      obstaculoS: null, frenteForzadoCm: null, atrasForzadoCm: null,
      t: 0, nav: null, ultimaSalida: null, entradas: null, sensores: null,
      eventos: [], estadoPrevio: null, llegadaCompleta: false,
      derivaEnHoldGrados: 0, derivaPicoGrados: 0, tHoldMs: 0, maxErrHold: 0
    };
    sim.nav = nucleo.nuevoNav();
    /* La cinta física sale de la pista canónica: tramos "linea" = con cinta */
    var i;
    for (i = 0; i < celdas; i++) sim.cinta.push(true);
    pista.tramos.forEach(function (t) {
      if (t.tipo === "sin_linea") setCinta(sim, t.desdeM, t.hastaM, false);
    });
    /* Ruta enseñada inicial = la canónica (enseñanza ya hecha) */
    sim.tramosEnsenados = tramosSinCintaDe(pista);
    registrar(sim, "Pista canónica " + L.toFixed(1) + " m cargada de specs/pista_canonica.json");
    return sim;
  }

  function tramosSinCintaDe(pista) {
    return pista.tramos
      .filter(function (t) { return t.tipo === "sin_linea"; })
      .map(function (t) { return { desdeM: t.desdeM, hastaM: t.hastaM, rumbo: t.rumboGrados }; });
  }

  function registrar(sim, texto) {
    sim.eventos.push({ t: sim.t, texto: texto });
    if (sim.eventos.length > 200) sim.eventos.shift();
  }

  /* --------------------------------------------------------------- cinta */

  function indiceCelda(sim, s) {
    return clamp(Math.floor(s / P.CELDA_M + 1e-9), 0, sim.cinta.length - 1);
  }

  function hayCinta(sim, s) {
    if (s < 0 || s > sim.L) return false;
    return sim.cinta[indiceCelda(sim, s)];
  }

  /* Pone o quita cinta entre desde y hasta (m). */
  function setCinta(sim, desde, hasta, presente) {
    var a = Math.round(desde / P.CELDA_M), b = Math.round(hasta / P.CELDA_M), i;
    for (i = a; i < b && i < sim.cinta.length; i++) {
      if (i >= 0) sim.cinta[i] = presente;
    }
  }

  /* ¿El tramo [desde,hasta] tiene toda su cinta? (para los botones de la UI) */
  function tramoConCinta(sim, desde, hasta) {
    var a = Math.round(desde / P.CELDA_M), b = Math.round(hasta / P.CELDA_M), i;
    for (i = a; i < b; i++) if (!sim.cinta[i]) return false;
    return true;
  }

  /* Intervalos [desde,hasta] sin cinta de la cinta actual. */
  function huecosDeCinta(sim) {
    var res = [], i = 0, n = sim.cinta.length, ini;
    while (i < n) {
      if (!sim.cinta[i]) {
        ini = i;
        while (i < n && !sim.cinta[i]) i++;
        res.push({ desdeM: ini * P.CELDA_M, hastaM: i * P.CELDA_M });
      } else {
        i++;
      }
    }
    return res;
  }

  /* FASE DE ENSEÑANZA: graba como "sin cinta" cada hueco de la cinta actual,
     con el rumbo del tramo (0° = a lo largo de la pista). */
  function ensenar(sim) {
    sim.tramosEnsenados = huecosDeCinta(sim).map(function (h) {
      return { desdeM: h.desdeM, hastaM: h.hastaM, rumbo: 0 };
    });
    registrar(sim, "Enseñanza: " + sim.tramosEnsenados.length + " tramo(s) sin cinta grabado(s)");
    return sim.tramosEnsenados;
  }

  /* ¿La ruta enseñada dice que aquí hay un hueco de cinta? */
  function tramoEnsenadoEn(sim, s) {
    var i, t;
    for (i = 0; i < sim.tramosEnsenados.length; i++) {
      t = sim.tramosEnsenados[i];
      if (s >= t.desdeM - 0.03 && s <= t.hastaM + 0.03) return t;
    }
    return null;
  }

  /* ------------------------------------------------------------ sensores */

  function sensoresActuales(sim) {
    var xs = sim.pista.umbrales.posicionesSensoresMm;
    var psi = sim.yawVerdad * RAD;
    var sSensor = sim.s + sim.dir * P.ADELANTE_SENSOR_M;
    var tiene = hayCinta(sim, sSensor);
    /* desvío lateral del sensor respecto a la cinta (izquierda positiva) */
    var ySensor = sim.y - P.ADELANTE_SENSOR_M * Math.sin(psi);
    var lineaMm = -ySensor * 1000;
    var n = [], bin = [], i, d, v;
    for (i = 0; i < 4; i++) {
      if (!tiene) { v = 0; }
      else {
        d = Math.abs(xs[i] - lineaMm);
        v = clamp(1 - Math.max(0, d - P.ANCHO_CINTA_MM / 2) / P.CAIDA_SENSOR_MM, 0, 1);
      }
      n.push(Math.round(v * 1000) / 1000);
      bin.push(v > 0.5 ? 1 : 0);
    }
    return { n: n, bin: bin, hayCinta: tiene, lineaRealMm: lineaMm };
  }

  function rssiActual(sim) {
    var d1 = Math.abs(sim.s - 0), d2 = Math.abs(sim.s - sim.L);
    var d = Math.min(d1, d2);
    return { rssi: rssiAUnaBaliza(d), baliza: d1 <= d2 ? "B1" : "B2", distM: d };
  }

  function frenteActualCm(sim) {
    if (sim.frenteForzadoCm !== null) return sim.frenteForzadoCm;
    if (sim.obstaculoS === null) return 0; /* 0 = sin eco / despejado */
    var dist = (sim.obstaculoS - (sim.s + sim.dir * P.FRENTE_ROBOT_M)) * sim.dir * 100;
    if (dist <= 0) return 1; /* contacto: lectura mínima */
    return dist > P.ALCANCE_US_CM ? 0 : Math.round(dist * 10) / 10;
  }

  function atrasActualCm(sim) {
    return sim.atrasForzadoCm !== null ? sim.atrasForzadoCm : P.ATRAS_LIBRE_CM;
  }

  /* Rumbo medido por el MPU-6050 virtual: el real + el sesgo acumulado. */
  function yawMedido(sim) {
    return sim.yawVerdad + sim.sesgoAcumGrados;
  }

  /* ---------------------------------------------------------------- paso */

  /* Avanza dtMs milisegundos de simulación. */
  function paso(sim, dtMs) {
    var dt = dtMs / 1000;
    var nucleo = sim.nucleo;
    var sens = sensoresActuales(sim);
    var rs = rssiActual(sim);
    var frente = frenteActualCm(sim);
    var atras = atrasActualCm(sim);
    var tramo = tramoEnsenadoEn(sim, sim.s + sim.dir * P.ADELANTE_SENSOR_M);
    var salida = null;
    var pwmIzq = 0, pwmDer = 0;

    sim.sensores = sens;
    /* Con cinta a la vista el rumbo se resincroniza con la línea: el sesgo del
       giroscopio solo se acumula (deriva) cuando se pierde la cinta. */
    if (sens.bin[0] || sens.bin[1] || sens.bin[2] || sens.bin[3]) sim.sesgoAcumGrados = 0;
    sim.entradas = {
      n: sens.n, yaw: yawMedido(sim), rssi: rs.rssi, frenteCm: frente,
      dtMs: dtMs, tramoSinCinta: !!tramo, rumboTramo: tramo ? tramo.rumbo : 0
    };

    if (sim.modo === "auto" && !sim.frenoRemoto && !sim.llegadaCompleta) {
      /* TODA la decisión sale del núcleo compartido */
      salida = nucleo.paso(sim.nav, sim.entradas);
      sim.ultimaSalida = salida;
      pwmIzq = salida.vIzq;
      pwmDer = salida.vDer;
      if (salida.evento && salida.evento !== sim.ultimoEvento) registrar(sim, "Evento: " + salida.evento);
      sim.ultimoEvento = salida.evento;
      if (salida.llegada) {
        sim.llegadaCompleta = true;
        registrar(sim, "Llegada validada por la baliza del extremo (" + rs.baliza + ")");
      }
    } else if (sim.modo === "manual" && !sim.frenoRemoto) {
      var m = sim.manual, bloqueaFrente = frente > 0 && frente < nucleo.CFG.UMBRAL_PARADA_CM;
      if (m === "adelante" && !bloqueaFrente) { pwmIzq = pwmDer = P.VEL_MANUAL_PWM; }
      else if (m === "atras" && atras >= nucleo.CFG.UMBRAL_PARADA_CM) { pwmIzq = pwmDer = -P.VEL_MANUAL_PWM; }
      else if (m === "izquierda" && !bloqueaFrente) { pwmIzq = -P.GIRO_MANUAL_PWM; pwmDer = P.GIRO_MANUAL_PWM; }
      else if (m === "derecha" && !bloqueaFrente) { pwmIzq = P.GIRO_MANUAL_PWM; pwmDer = -P.GIRO_MANUAL_PWM; }
      sim.ultimaSalida = null;
    } else {
      sim.ultimaSalida = null; /* freno remoto o llegada: ruedas a 0 */
    }

    /* Ruedas: retardo de primer orden hacia la orden (el núcleo da PWM 0..1) */
    sim.vIzqCmd = pwmIzq; sim.vDerCmd = pwmDer;
    var a = dt / (P.TAU_RUEDAS_S + dt);
    sim.vIzq += (pwmIzq - sim.vIzq) * a;
    sim.vDer += (pwmDer - sim.vDer) * a;
    if (pwmIzq === 0 && pwmDer === 0 && Math.abs(sim.vIzq) < 0.01 && Math.abs(sim.vDer) < 0.01) {
      sim.vIzq = 0; sim.vDer = 0;
    }

    /* Cinemática diferencial */
    var vL = (sim.vIzq + sim.vDer) / 2 * P.V_MAX_MS;
    var omegaCw = (sim.vIzq - sim.vDer) * P.V_MAX_MS / P.ANCHO_EJES_M; /* rad/s, horario + */
    var psi = sim.yawVerdad * RAD;
    sim.s += sim.dir * vL * Math.cos(psi) * dt;
    sim.y += -vL * Math.sin(psi) * dt;
    sim.yawVerdad += omegaCw / RAD * dt;
    sim.vLineal = vL;
    sim.sesgoAcumGrados += sim.sesgoDps * dt;
    if (sim.s < 0) { sim.s = 0; }
    if (sim.s > sim.L) { sim.s = sim.L; }
    sim.t += dt;

    /* Contadores de HEADING_HOLD para el panel */
    if (salida && sim.nav.estado === nucleo.ESTADO.HEADING_HOLD) {
      sim.tHoldMs += dtMs;
      var err = Math.abs(nucleo.anguloNormalizado(yawMedido(sim) - sim.nav.rumboObjetivo));
      if (err > sim.maxErrHold) sim.maxErrHold = err;
      sim.derivaEnHoldGrados = sim.sesgoAcumGrados;
      if (Math.abs(sim.derivaEnHoldGrados) > Math.abs(sim.derivaPicoGrados)) sim.derivaPicoGrados = sim.derivaEnHoldGrados;
    }
    if (sim.nav.estado !== sim.estadoPrevio) {
      var nombre = nucleo.NOMBRE_ESTADO[sim.nav.estado];
      registrar(sim, "Estado → " + nombre);
      if (sim.nav.estado === nucleo.ESTADO.HEADING_HOLD) {
        sim.tHoldMs = 0; sim.maxErrHold = 0; sim.derivaPicoGrados = 0; sim.derivaEnHoldGrados = 0;
      }
      sim.estadoPrevio = sim.nav.estado;
    }
    return salida;
  }

  /* -------------------------------------------------- acciones del usuario */

  function nuevoViaje(sim, dir) {
    sim.nav = sim.nucleo.nuevoNav();
    sim.dir = dir;
    sim.s = dir > 0 ? 0 : sim.L;
    sim.y = 0; sim.yawVerdad = 0; sim.sesgoAcumGrados = 0;
    sim.vIzq = sim.vDer = sim.vLineal = 0;
    sim.llegadaCompleta = false; sim.estadoPrevio = null; sim.ultimoEvento = null;
    sim.derivaEnHoldGrados = 0; sim.derivaPicoGrados = 0; sim.tHoldMs = 0; sim.maxErrHold = 0;
    sim.frenoRemoto = false;
    sim.modo = "auto";
    registrar(sim, dir > 0 ? "Viaje de ida: Cuarto de Componentes → Laboratorio 1" : "Viaje de vuelta: Laboratorio 1 → Cuarto de Componentes");
  }

  function frenoRemoto(sim) {
    sim.frenoRemoto = true;
    sim.manual = "frenar";
    registrar(sim, 'Freno Remoto: orden "frenar" (no es un E-STOP cableado)');
  }

  function reanudar(sim) {
    sim.frenoRemoto = false;
    registrar(sim, 'Orden "auto": se reanuda teach-and-repeat');
  }

  function inyectarObstaculo(sim, distanciaM) {
    sim.obstaculoS = sim.s + sim.dir * (distanciaM + P.FRENTE_ROBOT_M);
    sim.frenteForzadoCm = null;
    registrar(sim, "Obstáculo colocado a " + Math.round(distanciaM * 100) + " cm delante");
  }

  function quitarObstaculo(sim) {
    sim.obstaculoS = null; sim.frenteForzadoCm = null;
    registrar(sim, "Obstáculo retirado");
  }

  function forzarFrente(sim, cm) {
    sim.frenteForzadoCm = cm;
    registrar(sim, "Lectura frontal forzada a " + cm + " cm");
  }

  /* Empujón: gira el robot de golpe (el giroscopio también lo mide). */
  function empujon(sim, grados) {
    sim.yawVerdad += grados;
    registrar(sim, "Empujón de rumbo " + (grados >= 0 ? "+" : "") + grados + "°");
  }

  function zonaFrente(sim, cm) {
    var C = sim.nucleo.CFG;
    if (!(cm > 0)) return "libre";
    if (cm < C.UMBRAL_PARADA_CM) return "critica";
    if (cm < C.UMBRAL_AVISO_CM) return "precaucion";
    return "libre";
  }

  return {
    P: P, crear: crear, paso: paso, ensenar: ensenar, huecosDeCinta: huecosDeCinta,
    setCinta: setCinta, tramoConCinta: tramoConCinta, hayCinta: hayCinta,
    tramoEnsenadoEn: tramoEnsenadoEn, sensoresActuales: sensoresActuales,
    rssiActual: rssiActual, rssiAUnaBaliza: rssiAUnaBaliza, frenteActualCm: frenteActualCm,
    atrasActualCm: atrasActualCm, yawMedido: yawMedido, nuevoViaje: nuevoViaje,
    frenoRemoto: frenoRemoto, reanudar: reanudar, inyectarObstaculo: inyectarObstaculo,
    quitarObstaculo: quitarObstaculo, forzarFrente: forzarFrente, empujon: empujon,
    zonaFrente: zonaFrente, registrar: registrar
  };
});
