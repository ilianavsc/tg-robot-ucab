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
 * Física calibrada con SIM1 (JGA25-371 Speed 200 + L298N, 3S a 11,1 V; model.js de P08): PWM 1,0 = 0,572 m/s
 * (PWM 0,8 = 0,457 m/s en recta), constante de las ruedas 0,18 s, ancho entre ruedas 0,18 m, sensores TCRT5000
 * a 0,06 m del eje. Las dos pistas de SIM1 (A: 8,05 m, B: 9,0 m) entran por `opciones.trazado`
 * (pistas_sim1.js): la planta usa coordenadas de Frenet (s, y, ψ) con la curvatura κ(s) de la pista, así que en
 * curva el robot "ve" cómo se aleja la cinta. Sin trazado (los tests clásicos) la pista es un pasillo recto.
 * El rumbo de HEADING_HOLD es el del giroscopio ABSOLUTO desde la salida (yawAbs), igual que el MPU-6050 real.
 *
 * Convenios: s = posición sobre la pista (m, 0 = Cuarto de Componentes,
 * 9,0 = Laboratorio 1). dir = +1 (ida) o -1 (vuelta). yaw positivo = giro a la
 * derecha (horario). y = desvío lateral a la IZQUIERDA de la cinta (m);
 * linea_mm > 0 = cinta a la izquierda del robot (igual que el firmware).
 * Navegación teach-and-repeat: se enseña la ruta y se repite.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(require("./radar_us.js"));
  else raiz.SimMovimiento = fabrica(raiz.RadarUS);
})(typeof self !== "undefined" ? self : this, function (RadarUS) {
  "use strict";

  /* Supuestos de la planta (no vienen de la pista ni del núcleo) */
  var P = {
    V_MAX_MS: 0.572,       /* velocidad con PWM = 1,0 (SIM1: (11,1 − 2,1 V)/12 × 280 rpm × 0,8 × π × 0,065 / 60) */
    ANCHO_EJES_M: 0.18,    /* separación entre ruedas (SIM1) */
    ADELANTE_SENSOR_M: 0.06, /* los TCRT5000 van 6 cm delante del eje (SIM1) */
    FRENTE_ROBOT_M: 0.076, /* del eje a la cara del HC-SR04P frontal (modelo 3D de SIM1/P03) */
    ATRAS_ROBOT_M: 0.136,  /* del eje a la cara del HC-SR04P trasero */
    ANCHO_CINTA_MM: 19,
    CAIDA_SENSOR_MM: 6,    /* el sensor pasa de ver a no ver la cinta en 6 mm */
    TAU_RUEDAS_S: 0.18,    /* retardo de primer orden de las ruedas (SIM1) */
    CELDA_M: 0.05,         /* resolución de la cinta */
    RADIO_BLE_M: 1.5,      /* a 1,5 m de una baliza el RSSI vale -80 dBm */
    CERCA_BLE_M: 0.25,     /* a 0,25 m vale -52 dBm */
    RSSI_PISO_DBM: -95,    /* sin señal */
    VEL_MANUAL_PWM: 0.8,
    GIRO_MANUAL_PWM: 0.4,
    ATRAS_LIBRE_CM: 160,
    ALCANCE_US_CM: 400,
    CONO_US_GRADOS: 15,    /* semiapertura del haz del HC-SR04P (P03) */
    OBST_RADIO_M: 0.05,    /* ficha del obstáculo: ⌀ 10 cm */
    RAMPA_DECEL_MS2: 0.55, /* limitador suave del frenado (P13) */
    RAMPA_ACEL_MS2: 0.9,
    KD_LINEA_FW: 0.0015    /* término D del PD del firmware (robot_integrado.ino y SIM1: PWM por mm/s); el núcleo solo trae el P */
  };

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  var RAD = Math.PI / 180;

  /* RSSI (dBm) a una distancia d (m) de la baliza más cercana. Solo hay señal
     útil cerca de los EXTREMOS: a mitad de pasillo no se oye ninguna baliza. */
  function rssiAUnaBaliza(d, radio, cerca) {
    radio = radio || P.RADIO_BLE_M; cerca = cerca || P.CERCA_BLE_M;
    if (d <= cerca) return -52;
    if (d >= radio) {
      return Math.max(P.RSSI_PISO_DBM, -80 - 10 * (d - radio));
    }
    var f = (d - cerca) / (radio - cerca);
    return Math.round((-52 - 28 * Math.pow(f, 0.8)) * 10) / 10;
  }

  /* ------------------------------------------------------------ creación */

  /* nucleo: módulo teach_and_repeat.js · pista: specs/pista_canonica.json (o pistaPara() de pistas_sim1.js)
     opciones: { trazado (pistas_sim1.crearTrazado: pista con curvas), cintaCompleta (sin ruta enseñada: se enseña primero) } */
  function crear(nucleo, pista, opciones) {
    opciones = opciones || {};
    var L = pista.longitudTotalM;
    var celdas = Math.round(L / P.CELDA_M);
    var sim = {
      nucleo: nucleo, pista: pista, L: L, P: P, trazado: opciones.trazado || null,
      cinta: [], tramosEnsenados: [], huecosRechazados: [], perfiles: {}, rutaEnsenada: null,
      ensenando: false, perfilTmp: null, rumboMedio: null, obstaculos: [], motivoParada: null,
      bleRadioM: opciones.bleRadioM || P.RADIO_BLE_M, bleCercaM: opciones.bleCercaM || P.CERCA_BLE_M,
      baseLim: null, rampaActiva: false, baseUlt: 0, limitadorActivo: false, cintaVersion: 0,
      velObjetivoMs: null,
      s: 0, dir: 1, y: 0, yawVerdad: 0, yawAbs: 0, sesgoAcumGrados: 0, sesgoDps: 0,
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
    if (opciones.cintaCompleta) {
      /* se enseña primero con toda la cinta: aún no hay ruta enseñada */
      registrar(sim, "Pista " + (sim.trazado ? sim.trazado.id + " " : "") + L.toFixed(2) + " m con toda la cinta: falta enseñar la ruta");
      return sim;
    }
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
    sim.cintaVersion++;
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

  /* celda de la cinta por la que va (o entra) el robot */
  function celdaDe(sim, s) { return indiceCelda(sim, s); }

  /* Convierte los huecos de cinta actuales en tramos enseñados.
     · Con una pasada de enseñanza hecha (perfiles) el rumbo de cada hueco es el que midió el giroscopio al entrar en él,
       y solo se aceptan huecos RECTOS que la pasada recorrió con cinta: el núcleo sostiene UN rumbo, no una curva.
     · Sin pasada (los tests clásicos del pasillo recto) el rumbo es 0° = a lo largo de la pista. */
  function ensenar(sim) {
    var perfil = sim.perfiles[sim.dir], huecos = huecosDeCinta(sim);
    sim.tramosEnsenados = []; sim.huecosRechazados = [];
    huecos.forEach(function (h) {
      var entra = sim.dir > 0 ? h.desdeM : h.hastaM, rumbo = 0, motivo = null, c;
      if (sim.trazado) {
        if (!perfil) motivo = "sin pasada de enseñanza";
        else if (!sim.trazado.rectoEn(h.desdeM, h.hastaM)) motivo = "tramo curvo: el giroscopio sostiene un rumbo, no una curva";
        else {
          c = celdaDe(sim, Math.max(0, Math.min(sim.L, entra - sim.dir * 0.1)));
          if (perfil[c] === null || perfil[c] === undefined) motivo = "la pasada no recorrió este tramo";
          else rumbo = perfil[c];
        }
      }
      if (motivo) sim.huecosRechazados.push({ desdeM: h.desdeM, hastaM: h.hastaM, motivo: motivo });
      else sim.tramosEnsenados.push({ desdeM: h.desdeM, hastaM: h.hastaM, rumbo: rumbo });
    });
    registrar(sim, "Enseñanza: " + sim.tramosEnsenados.length + " tramo(s) sin cinta grabado(s)" +
      (sim.huecosRechazados.length ? " · " + sim.huecosRechazados.length + " rechazado(s) (" + sim.huecosRechazados[0].motivo + ")" : ""));
    return sim.tramosEnsenados;
  }

  /* PASADA DE ENSEÑANZA: el robot recorre la pista con TODA la cinta siguiendo la línea y el giroscopio anota,
     celda a celda, su rumbo absoluto. Al llegar queda guardada la ruta enseñada (perfil de rumbo por sentido). */
  function iniciarEnsenanza(sim, dir) {
    if (!tramoConCinta(sim, 0, sim.L)) {
      registrar(sim, "Para enseñar la pista necesita toda la cinta: restaura la cinta");
      return false;
    }
    nuevoViaje(sim, dir || 1);
    sim.ensenando = true;
    sim.perfilTmp = [];
    for (var i = 0; i < sim.cinta.length; i++) sim.perfilTmp.push(null);
    registrar(sim, "Pasada de enseñanza " + (sim.dir > 0 ? "de ida" : "de vuelta") + ": el robot sigue la línea y graba su rumbo");
    return true;
  }

  function terminarEnsenanza(sim) {
    sim.ensenando = false;
    sim.perfiles[sim.dir] = sim.perfilTmp;
    sim.perfilTmp = null;
    sim.rutaEnsenada = { pista: sim.trazado ? sim.trazado.id : "B", dir: sim.dir, largoM: sim.L, celdas: sim.cinta.length };
    registrar(sim, "Ruta enseñada y guardada (" + sim.rutaEnsenada.celdas + " celdas de " + (P.CELDA_M * 100) + " cm)");
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
    var kap = sim.trazado ? sim.dir * sim.trazado.kappa(sim.s) : 0;
    var ySensor = sim.y - P.ADELANTE_SENSOR_M * Math.sin(psi) - kap * P.ADELANTE_SENSOR_M * P.ADELANTE_SENSOR_M / 2;
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
    return { rssi: rssiAUnaBaliza(d, sim.bleRadioM, sim.bleCercaM), baliza: d1 <= d2 ? "B1" : "B2", distM: d };
  }

  /* Pose del robot en el mundo de SIM1 (solo con trazado): {x, y, angulo en grados, 0 = +x, antihorario} */
  function poseMundo(sim) {
    if (sim.trazado) return sim.trazado.pose(sim.s, sim.dir, sim.y, sim.yawVerdad);
    return { x: sim.s, y: sim.y, angulo: sim.dir > 0 ? -sim.yawVerdad : 180 - sim.yawVerdad };
  }

  /* Lectura (cm) del sensor lado = "frente" | "atras" sobre los obstáculos del mundo (fichas), o null si no hay eco */
  function eco(sim, lado) {
    if (!sim.obstaculos.length) return null;
    var p = poseMundo(sim), a = p.angulo + (lado === "atras" ? 180 : 0), off = lado === "atras" ? P.ATRAS_ROBOT_M : P.FRENTE_ROBOT_M, rad = Math.PI / 180;
    return RadarUS.medirCono({ x: p.x + Math.cos(a * rad) * off, y: p.y + Math.sin(a * rad) * off, angulo: a }, sim.obstaculos, P.CONO_US_GRADOS, P.ALCANCE_US_CM / 100);
  }

  function frenteActualCm(sim) {
    if (sim.frenteForzadoCm !== null) return sim.frenteForzadoCm;
    var mundo = eco(sim, "frente"), cm = 0;
    if (sim.obstaculoS !== null) {
      var dist = (sim.obstaculoS - (sim.s + sim.dir * P.FRENTE_ROBOT_M)) * sim.dir * 100;
      if (dist <= 0) cm = 1; /* contacto: lectura mínima */
      else cm = dist > P.ALCANCE_US_CM ? 0 : Math.round(dist * 10) / 10;
    }
    if (mundo !== null && (cm === 0 || mundo < cm)) cm = mundo;
    return cm; /* 0 = sin eco / despejado */
  }

  function atrasActualCm(sim) {
    if (sim.atrasForzadoCm !== null) return sim.atrasForzadoCm;
    var mundo = eco(sim, "atras");
    return mundo !== null ? mundo : P.ATRAS_LIBRE_CM;
  }

  /* Rumbo medido por el MPU-6050 virtual: el real + el sesgo acumulado. */
  function yawMedido(sim) {
    return sim.yawAbs + sim.sesgoAcumGrados;
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
    if (sim.cintaVersion !== sim.cintaVersionVista) {
      sim.cintaVersionVista = sim.cintaVersion;
      /* con una pasada de enseñanza hecha, los huecos de cinta se enseñan solos (si son rectos y la pasada los recorrió) */
      if (sim.perfiles[sim.dir] && !sim.ensenando && sim.cintaVersion > 0) ensenar(sim);
    }
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
      /* Limitador suave de planta (P13): el núcleo manda PWM 0,5× en precaución y 0 en parada crítica; la planta
         suaviza la componente COMÚN con una rampa en m/s² (el diferencial de la corrección de línea no se toca).
         La parada a < 20 cm es inmediata; al despejar, la velocidad se recupera con rampa. */
      /* Término D del PD del firmware real (el núcleo compartido solo tiene el P): amortigua la corrección de línea.
         Con la dinámica calibrada de SIM1 (ruedas de 0,18 s) el P solo no sostiene las curvas de 22–27 cm. */
      var estN = nucleo.ESTADO;
      if ((sim.nav.estado === estN.FOLLOW_LINE || sim.nav.estado === estN.REACQUIRE_LINE) && sens.hayCinta && !salida.frenadoCritico && (sens.bin[0] || sens.bin[1] || sens.bin[2] || sens.bin[3])) {
        var lmAhora = nucleo.posicionLinea(sens.n).linea_mm;
        if (sim.lmPrevio !== null && sim.lmPrevio !== undefined) {
          var corrD = P.KD_LINEA_FW * (lmAhora - sim.lmPrevio) / dt;
          pwmIzq -= corrD; pwmDer += corrD;
        }
        sim.lmPrevio = lmAhora;
      } else { sim.lmPrevio = null; }
      var baseNuc = (pwmIzq + pwmDer) / 2, difNuc = (pwmDer - pwmIzq) / 2;
      if (sim.velObjetivoMs > 0 && baseNuc > 0 && !salida.frenadoCritico) {
        var pwmObj = clamp(sim.velObjetivoMs / P.V_MAX_MS, 0.1, 1.0);
        if (pwmObj < baseNuc) {
          var esc = pwmObj / baseNuc;
          baseNuc = pwmObj;
          difNuc = difNuc * Math.max(0.45, esc);
          pwmIzq = baseNuc - difNuc;
          pwmDer = baseNuc + difNuc;
        }
      }
      if (salida.frenadoCritico) {
        sim.baseLim = baseNuc; sim.rampaActiva = true;
      } else if (salida.precaucion || sim.rampaActiva) {
        if (sim.baseLim === null) sim.baseLim = sim.baseUlt;
        sim.rampaActiva = true;
        sim.baseLim = RadarUS.rampa(sim.baseLim, baseNuc, dt, P.V_MAX_MS, P.RAMPA_DECEL_MS2, P.RAMPA_ACEL_MS2);
        if (Math.abs(sim.baseLim - baseNuc) < 1e-3 && !salida.precaucion) { sim.baseLim = null; sim.rampaActiva = false; }
      } else {
        sim.baseUlt = baseNuc;
      }
      sim.limitadorActivo = sim.rampaActiva;
      if (sim.rampaActiva && sim.baseLim !== null) {
        pwmIzq = sim.baseLim - difNuc;
        pwmDer = sim.baseLim + difNuc;
      }
      if (salida.evento && salida.evento !== sim.ultimoEvento) registrar(sim, "Evento: " + salida.evento);
      if (salida.paradaSeguridad && salida.evento) sim.motivoParada = salida.evento;
      sim.ultimoEvento = salida.evento;
      if (salida.llegada) {
        sim.llegadaCompleta = true;
        registrar(sim, "Llegada validada por la baliza del extremo (" + rs.baliza + ")");
        if (sim.ensenando) terminarEnsenanza(sim);
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
    if (sim.modo !== "auto" || sim.frenoRemoto) { sim.baseLim = null; sim.rampaActiva = false; sim.limitadorActivo = false; }

    /* Ruedas: retardo de primer orden hacia la orden (el núcleo da PWM 0..1) */
    sim.vIzqCmd = pwmIzq; sim.vDerCmd = pwmDer;
    var a = dt / (P.TAU_RUEDAS_S + dt);
    sim.vIzq += (pwmIzq - sim.vIzq) * a;
    sim.vDer += (pwmDer - sim.vDer) * a;
    if (pwmIzq === 0 && pwmDer === 0 && Math.abs(sim.vIzq) < 0.01 && Math.abs(sim.vDer) < 0.01) {
      sim.vIzq = 0; sim.vDer = 0;
    }

    /* Cinemática diferencial en coordenadas de Frenet: s = avance sobre la pista, y = desvío a la izquierda,
       yawVerdad = giro respecto a la pista (horario +). Con curvatura κ el rumbo relativo cambia aunque el robot
       no gire: ψ' = ω + κ·σ'. El giroscopio (yawAbs) solo mide la rotación del propio robot. */
    var vL = (sim.vIzq + sim.vDer) / 2 * P.V_MAX_MS;
    var omegaCw = (sim.vIzq - sim.vDer) * P.V_MAX_MS / P.ANCHO_EJES_M; /* rad/s, horario + */
    var psi = sim.yawVerdad * RAD;
    var kap = sim.trazado ? sim.dir * sim.trazado.kappa(sim.s) : 0;
    var den = Math.max(0.25, 1 - kap * sim.y);
    var sigma = vL * Math.cos(psi) / den;
    sim.s += sim.dir * sigma * dt;
    sim.y += -vL * Math.sin(psi) * dt;
    sim.yawVerdad += (omegaCw + kap * sigma) / RAD * dt;
    sim.yawAbs += omegaCw / RAD * dt;
    sim.vLineal = vL;
    sim.sesgoAcumGrados += sim.sesgoDps * dt;
    if (sim.s < 0) { sim.s = 0; }
    if (sim.s > sim.L) { sim.s = sim.L; }
    sim.t += dt;
    /* pasada de enseñanza: el giroscopio anota su rumbo por celda */
    if (sim.ensenando && sim.perfilTmp) {
      /* rumbo SUAVIZADO (media móvil de 0,4 s): el robot serpentea unos grados sobre la cinta y el rumbo que se
         sostiene sin cinta debe ser el de la pista, no el de un instante */
      var ym = yawMedido(sim);
      sim.rumboMedio = sim.rumboMedio === null ? ym : sim.rumboMedio + (ym - sim.rumboMedio) * Math.min(1, dt / 0.4);
      var ce = celdaDe(sim, sim.s);
      if (sim.perfilTmp[ce] === null) sim.perfilTmp[ce] = sim.rumboMedio;
    }

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
    sim.y = 0; sim.yawVerdad = 0; sim.yawAbs = 0; sim.sesgoAcumGrados = 0;
    sim.vIzq = sim.vDer = sim.vLineal = 0;
    sim.ensenando = false; sim.perfilTmp = null; sim.rumboMedio = null; sim.motivoParada = null;
    sim.baseLim = null; sim.rampaActiva = false; sim.baseUlt = 0; sim.limitadorActivo = false;
    sim.llegadaCompleta = false; sim.estadoPrevio = null; sim.ultimoEvento = null;
    sim.derivaEnHoldGrados = 0; sim.derivaPicoGrados = 0; sim.tHoldMs = 0; sim.maxErrHold = 0;
    sim.frenoRemoto = false;
    sim.modo = "auto";
    registrar(sim, dir > 0 ? "Viaje de ida: Cuarto de Componentes → Laboratorio 1" : "Viaje de vuelta: Laboratorio 1 → Cuarto de Componentes");
    if (sim.perfiles[sim.dir]) ensenar(sim); /* repetir: los huecos de cinta se cruzan con lo enseñado */
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
    sim.obstaculoS = null; sim.frenteForzadoCm = null; sim.obstaculos = [];
    registrar(sim, "Obstáculo retirado");
  }

  /* Ficha del obstáculo puesta (o movida) en el mundo de SIM1: la detectan los dos HC-SR04P con su cono de ±15° */
  function colocarObstaculo(sim, x, y) {
    var nuevo = !sim.obstaculos.length;
    sim.obstaculos = [{ x: x, y: y, r: P.OBST_RADIO_M }];
    sim.frenteForzadoCm = null;
    if (nuevo) registrar(sim, "Obstáculo colocado en (" + x.toFixed(2) + "; " + y.toFixed(2) + ") m");
  }

  function forzarFrente(sim, cm) {
    sim.frenteForzadoCm = cm;
    registrar(sim, "Lectura frontal forzada a " + cm + " cm");
  }

  /* Empujón: gira el robot de golpe (el giroscopio también lo mide). */
  function empujon(sim, grados) {
    sim.yawVerdad += grados; sim.yawAbs += grados;
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
    zonaFrente: zonaFrente, registrar: registrar,
    poseMundo: poseMundo, colocarObstaculo: colocarObstaculo, iniciarEnsenanza: iniciarEnsenanza, eco: eco
  };
});
