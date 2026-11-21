/* Simulador 2 V2 · Etapa 2: Máquina de 14 estados de aprendizaje, Gemelo V1 y registro RMS por viaje.
 *
 * Separada por completo de los 5 estados del núcleo de navegación
 * (FOLLOW_LINE, LINE_LOST_CHECK, HEADING_HOLD, WAIT_BEACON, REACQUIRE_LINE).
 * Regla de ingeniería: la geometría capturada en SLOW_READING (0,16 m/s) es la
 * referencia fija (inmutable). Los viajes de ajuste solo refinan el modelo dinámico.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.AprendizajeGemelo = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ESTADOS = [
    "INITIAL",
    "SLOW_READING",
    "NORMAL_READING",
    "TWIN_CREATING",
    "TWIN_V1_READY",
    "ADJUSTING",
    "EVALUATION_PENDING",
    "ADJUSTMENT_REQUIRED",
    "PHASE1_READY",
    "BEACONS_STARTING",
    "BEACONS_ACTIVE",
    "NO_TAPE_TEST",
    "PHASE1_VALIDATED",
    "FAULT"
  ];

  var C = {
    VEL_LENTA_MS: 0.16,
    VEL_NORMAL_MS: 0.41,
    TRANSICION_GEMELO_MS: 600,
    META_VIAJES_DEMO: 3,
    META_VIAJES_SIL: 5,
    UMBRAL_LAT_RMS_MM: 18.0,
    UMBRAL_HEAD_RMS_DEG: 4.5,
    UMBRAL_COBERTURA_PCT: 95.0,
    TAU_NOMINAL_S: 0.18
  };

  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  function crear(opciones) {
    opciones = opciones || {};
    var meta = opciones.metaViajes === 5 ? 5 : C.META_VIAJES_DEMO;
    return {
      estado: "INITIAL",
      estadoPrevioFallo: "INITIAL",
      pistaId: opciones.pistaId || "B",
      metaViajes: meta,
      capturaLentaOk: false,
      capturaNormalOk: false,
      geometriaRef: null,          /* referencia fija congelada tras SLOW_READING */
      modeloDinamico: {
        wheel_tau_s: 0.22,         /* estimación inicial antes de ajustar hacia 0,18 s */
        factorDinamico: 1.0,
        rmsBaseMm: null
      },
      viajes: [],                  /* historial estructurado por viaje */
      viajesAjusteValidos: 0,
      viajeActivo: null,           /* acumulador en curso */
      ultimaEvaluacion: null,
      motivoFallo: null,
      madurez: "En construcción"   /* En construcción | En ajuste | Validado Fase 1 */
    };
  }

  function setMetaViajes(ap, n) {
    ap.metaViajes = (n === 5) ? 5 : C.META_VIAJES_DEMO;
    if (ap.estado === "EVALUATION_PENDING" && ap.viajesAjusteValidos < ap.metaViajes) {
      ap.estado = "ADJUSTING";
    } else if (ap.estado === "ADJUSTING" && ap.viajesAjusteValidos >= ap.metaViajes && !ap.viajeActivo) {
      ap.estado = "EVALUATION_PENDING";
    }
    return ap.metaViajes;
  }

  function iniciarViaje(ap, tipo, pistaId, largoM, numCeldas) {
    var target = tipo === "SLOW_READING" ? C.VEL_LENTA_MS : C.VEL_NORMAL_MS;
    ap.motivoFallo = null;
    if (tipo === "SLOW_READING") {
      ap.estado = "SLOW_READING";
      ap.madurez = "En construcción";
    } else if (tipo === "NORMAL_READING") {
      ap.estado = "NORMAL_READING";
      ap.madurez = "En construcción";
    } else {
      ap.estado = "ADJUSTING";
      ap.madurez = "En ajuste";
    }
    ap.estadoPrevioFallo = ap.estado;
    ap.viajeActivo = {
      trip_id: ap.viajes.length + 1,
      trip_type: tipo,
      track_id: pistaId || ap.pistaId,
      target_speed_ms: target,
      length_m: largoM,
      numCeldas: Math.max(1, numCeldas || 1),
      celdasVistas: {},
      nCeldasVistas: 0,
      nMuestras: 0,
      sumVel: 0,
      sumLatSqMm: 0,
      sumHeadSqDeg: 0,
      duracionS: 0
    };
    return ap.viajeActivo;
  }

  function muestrearTick(ap, sim, dtMs) {
    var va = ap.viajeActivo;
    if (!va) return null;
    var dt = dtMs / 1000;
    va.duracionS += dt;
    va.nMuestras++;
    va.sumVel += Math.abs(sim.vLineal || 0);
    var latMm = (sim.y || 0) * 1000;
    var headDeg = sim.yawVerdad || 0;
    va.sumLatSqMm += latMm * latMm;
    va.sumHeadSqDeg += headDeg * headDeg;
    var cel = Math.max(0, Math.min(va.numCeldas - 1, Math.floor((sim.s || 0) / (sim.P ? sim.P.CELDA_M : 0.05) + 1e-9)));
    if (!va.celdasVistas[cel]) {
      va.celdasVistas[cel] = true;
      va.nCeldasVistas++;
    }
    return va;
  }

  function construirRegistro(va, wheelTauS, valido, stopReason) {
    var n = Math.max(1, va.nMuestras);
    var cov = Math.min(100, (va.nCeldasVistas / va.numCeldas) * 100);
    return {
      trip_id: va.trip_id,
      trip_type: va.trip_type,
      track_id: va.track_id,
      target_speed_ms: r2(va.target_speed_ms),
      actual_speed_ms: r2(va.sumVel / n),
      duration_s: r2(va.duracionS),
      length_m: r2(va.length_m),
      coverage_pct: r2(cov),
      lateral_error_rms_mm: r2(Math.sqrt(va.sumLatSqMm / n)),
      heading_error_rms_deg: r2(Math.sqrt(va.sumHeadSqDeg / n)),
      wheel_tau_s: r3(wheelTauS),
      valid: Boolean(valido),
      stop_reason: stopReason || "none"
    };
  }

  /* Finaliza el viaje activo (éxito o fallo). Las pasadas inválidas NUNCA cuentan. */
  function finalizarViaje(ap, sim, llego, stopReason) {
    var va = ap.viajeActivo;
    if (!va) return null;
    ap.viajeActivo = null;

    var cov = Math.min(100, (va.nCeldasVistas / va.numCeldas) * 100);
    var valido = Boolean(llego) && (!stopReason || stopReason === "none") && cov >= C.UMBRAL_COBERTURA_PCT;
    var motivo = valido ? "none" : (stopReason && stopReason !== "none" ? stopReason : "cobertura_insuficiente");

    /* Refinamiento realista de wheel_tau_s hacia 0,18 s solo en viajes válidos */
    var tauEst = ap.modeloDinamico.wheel_tau_s;
    if (valido && va.trip_type !== "SLOW_READING") {
      tauEst = tauEst + (C.TAU_NOMINAL_S - tauEst) * 0.45;
      ap.modeloDinamico.wheel_tau_s = r3(tauEst);
    }

    var reg = construirRegistro(va, ap.modeloDinamico.wheel_tau_s, valido, motivo);
    ap.viajes.push(reg);

    if (!valido) {
      ap.estado = "FAULT";
      ap.motivoFallo = motivo;
      return reg;
    }

    if (va.trip_type === "SLOW_READING") {
      ap.capturaLentaOk = true;
      /* Geometría de referencia FIJA e inmutable */
      var perfil = (sim && sim.perfiles && sim.perfiles[1]) ? sim.perfiles[1].slice() : [];
      ap.geometriaRef = Object.freeze({
        track_id: va.track_id,
        length_m: r2(va.length_m),
        celdas: Object.freeze(perfil),
        lateral_ref_rms_mm: reg.lateral_error_rms_mm
      });
      ap.estado = "NORMAL_READING";
      ap.madurez = "En construcción";
    } else if (va.trip_type === "NORMAL_READING") {
      ap.capturaNormalOk = true;
      ap.modeloDinamico.rmsBaseMm = reg.lateral_error_rms_mm;
      if (ap.capturaLentaOk) {
        ap.estado = "TWIN_CREATING";
        ap.madurez = "En construcción";
      }
    } else if (va.trip_type === "ADJUSTING") {
      ap.viajesAjusteValidos++;
      ap.madurez = "En ajuste";
      if (ap.viajesAjusteValidos >= ap.metaViajes) {
        ap.estado = "EVALUATION_PENDING";
      } else {
        ap.estado = "ADJUSTING";
      }
    }
    return reg;
  }

  /* Completa la transición automática TWIN_CREATING -> TWIN_V1_READY (500–700 ms) */
  function completarNacimientoGemelo(ap) {
    if (ap.estado !== "TWIN_CREATING") return false;
    ap.estado = "TWIN_V1_READY";
    ap.madurez = "En ajuste";
    return true;
  }

  /* Evalúa por CALIDAD REAL (RMS lateral, RMS angular, cobertura), nunca solo por contador */
  function evaluarGemelo(ap) {
    var validos = ap.viajes.filter(function (v) { return v.valid && v.trip_type === "ADJUSTING"; });
    if (!ap.geometriaRef || validos.length < ap.metaViajes) {
      ap.estado = "ADJUSTMENT_REQUIRED";
      ap.madurez = "En ajuste";
      ap.ultimaEvaluacion = {
        aprobado: false,
        motivo: "faltan viajes válidos o referencia geométrica",
        lateral_rms_mm: null,
        heading_rms_deg: null,
        coverage_pct: 0,
        mejora_pct: 0
      };
      return ap.ultimaEvaluacion;
    }

    var recientes = validos.slice(-ap.metaViajes);
    var mean = function (fn) {
      var s = 0;
      for (var i = 0; i < recientes.length; i++) s += fn(recientes[i]);
      return s / recientes.length;
    };
    var latRms = r2(mean(function (v) { return v.lateral_error_rms_mm; }));
    var headRms = r2(mean(function (v) { return v.heading_error_rms_deg; }));
    var covPct = r2(mean(function (v) { return v.coverage_pct; }));
    var baseMm = ap.modeloDinamico.rmsBaseMm || recientes[0].lateral_error_rms_mm || 1;
    var mejora = baseMm > 0 ? r2(Math.max(0, ((baseMm - latRms) / baseMm) * 100)) : 0;

    var cumpleLat = latRms <= C.UMBRAL_LAT_RMS_MM;
    var cumpleHead = headRms <= C.UMBRAL_HEAD_RMS_DEG;
    var cumpleCov = covPct >= C.UMBRAL_COBERTURA_PCT;
    var aprobado = cumpleLat && cumpleHead && cumpleCov;

    ap.ultimaEvaluacion = {
      aprobado: aprobado,
      motivo: aprobado ? "cumple umbrales RMS y cobertura" : (!cumpleLat ? "error lateral RMS > " + C.UMBRAL_LAT_RMS_MM + " mm" : (!cumpleHead ? "error angular RMS > " + C.UMBRAL_HEAD_RMS_DEG + "°" : "cobertura < " + C.UMBRAL_COBERTURA_PCT + " %")),
      lateral_rms_mm: latRms,
      heading_rms_deg: headRms,
      coverage_pct: covPct,
      mejora_pct: mejora
    };

    if (aprobado) {
      ap.estado = "PHASE1_READY";
      ap.madurez = "Validado Fase 1";
    } else {
      ap.estado = "ADJUSTMENT_REQUIRED";
      ap.madurez = "En ajuste";
    }
    return ap.ultimaEvaluacion;
  }

  function recuperarFallo(ap) {
    if (ap.estado !== "FAULT") return ap.estado;
    ap.motivoFallo = null;
    if (!ap.capturaLentaOk) ap.estado = "INITIAL";
    else if (!ap.capturaNormalOk) ap.estado = "NORMAL_READING";
    else if (ap.viajesAjusteValidos >= ap.metaViajes) ap.estado = "EVALUATION_PENDING";
    else ap.estado = ap.viajesAjusteValidos === 0 ? "TWIN_V1_READY" : "ADJUSTING";
    return ap.estado;
  }

  function resumenMetricas(ap) {
    var validos = ap.viajes.filter(function (v) { return v.valid; });
    var ult = validos.length ? validos[validos.length - 1] : null;
    var baseMm = ap.modeloDinamico.rmsBaseMm;
    var mejora = (ult && baseMm && baseMm > 0) ? r2(Math.max(0, ((baseMm - ult.lateral_error_rms_mm) / baseMm) * 100)) : 0;
    return {
      estado: ap.estado,
      madurez: ap.madurez,
      viajesValidos: ap.viajesAjusteValidos,
      metaViajes: ap.metaViajes,
      rmsLatMm: ult ? ult.lateral_error_rms_mm : 0,
      rmsHeadDeg: ult ? ult.heading_error_rms_deg : 0,
      mejoraPct: ap.ultimaEvaluacion ? ap.ultimaEvaluacion.mejora_pct : mejora,
      wheelTauS: ap.modeloDinamico.wheel_tau_s
    };
  }

  function etiquetaBoton(ap, corriendo, frenoRemoto) {
    if (frenoRemoto) return { texto: "▶ Reanudar (auto)", clase: "btn-ctx ok", accion: "reanudar" };
    if (ap.estado === "FAULT") return { texto: "↺ Reintentar etapa", clase: "btn-ctx aviso", accion: "recuperar" };
    if (corriendo) return { texto: "⏸ Pausar", clase: "btn-ctx aviso", accion: "pausar" };
    if (ap.estado === "INITIAL") return { texto: "🎓 Iniciar lectura lenta", clase: "btn-ctx", accion: "lenta" };
    if (ap.estado === "SLOW_READING") return { texto: ap.viajeActivo ? "▶ Reanudar lectura lenta" : "🎓 Iniciar lectura lenta", clase: "btn-ctx", accion: ap.viajeActivo ? "continuar" : "lenta" };
    if (ap.estado === "NORMAL_READING") return { texto: ap.viajeActivo ? "▶ Reanudar pasada normal" : "▶ Iniciar pasada normal", clase: "btn-ctx", accion: ap.viajeActivo ? "continuar" : "normal" };
    if (ap.estado === "TWIN_CREATING") return { texto: "⏳ Gemelo V1 · creando…", clase: "btn-ctx ok", accion: "esperar" };
    if (ap.estado === "TWIN_V1_READY") return { texto: "▶ Iniciar viaje 1/" + ap.metaViajes, clase: "btn-ctx ok", accion: "ajuste" };
    if (ap.estado === "ADJUSTING") {
      if (ap.viajeActivo) return { texto: "▶ Reanudar viaje " + (ap.viajesAjusteValidos + 1) + "/" + ap.metaViajes, clase: "btn-ctx ok", accion: "continuar" };
      return { texto: "▶ Iniciar viaje " + (ap.viajesAjusteValidos + 1) + "/" + ap.metaViajes, clase: "btn-ctx ok", accion: "ajuste" };
    }
    if (ap.estado === "EVALUATION_PENDING") return { texto: "📊 Evaluar gemelo", clase: "btn-ctx ok", accion: "evaluar" };
    if (ap.estado === "ADJUSTMENT_REQUIRED") return { texto: "🔧 Continuar ajustes", clase: "btn-ctx aviso", accion: "ajuste" };
    if (ap.estado === "PHASE1_READY") return { texto: "✓ Fase 1 lista (Etapa 3)", clase: "btn-ctx ok", accion: "fase1_info" };
    return { texto: "▶ Repetir ruta", clase: "btn-ctx ok", accion: "ajuste" };
  }

  return {
    ESTADOS: ESTADOS,
    C: C,
    crear: crear,
    setMetaViajes: setMetaViajes,
    iniciarViaje: iniciarViaje,
    muestrearTick: muestrearTick,
    finalizarViaje: finalizarViaje,
    completarNacimientoGemelo: completarNacimientoGemelo,
    evaluarGemelo: evaluarGemelo,
    recuperarFallo: recuperarFallo,
    resumenMetricas: resumenMetricas,
    etiquetaBoton: etiquetaBoton
  };
});
