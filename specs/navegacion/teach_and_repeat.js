/**
 * Núcleo portable de navegación "teach-and-repeat" (sin UI, sin hardware).
 *
 * Máquina de estados DETERMINISTA y PURA: cada llamada a paso(nav, entradas)
 * recibe el estado y las lecturas, y devuelve el nuevo estado + acciones.
 * No hay aleatoriedad, ni reloj, ni dependencias de hardware o UI.
 *
 * Portabilidad 1:1 a C++ (ESP32):
 *   - ESTADO es un enum numérico; NAV es un struct plano.
 *   - posicionLinea, anguloNormalizado, clamp y paso son funciones libres.
 *   - No se usan closures, arrow functions, clases ni features propias de JS.
 *
 * Terminología: "teach-and-repeat" (fase de enseñanza = grabación de la ruta;
 * fase de repetición = recorrido autónomo). Nunca "IA".
 */

'use strict';

/* ---------------------------------------------------------------- enum */
var ESTADO = {
  FOLLOW_LINE: 0,
  LINE_LOST_CHECK: 1,
  HEADING_HOLD: 2,
  WAIT_BEACON: 3,
  REACQUIRE_LINE: 4
};

var NOMBRE_ESTADO = [
  "FOLLOW_LINE", "LINE_LOST_CHECK", "HEADING_HOLD", "WAIT_BEACON", "REACQUIRE_LINE"
];

/* ------------------------------------------------------------ constantes */
/* Deben coincidir con specs/pista_canonica.json (umbrales). */
var CFG = {
  UMBRAL_PARADA_CM: 20,          // frente < 20 cm -> parada crítica
  UMBRAL_AVISO_CM: 50,           // 20..50 cm -> precaución (velocidad a la mitad)
  SEP_MM: 18,                    // separación entre sensores vecinos
  SUMA_MIN: 0.30,                // suma mínima para "veo la línea"
  BASE_VEL: 0.80,                // velocidad base (PWM 0..1)
  KP_LINEA: 0.030,               // corrección por mm de error de línea
  K_HEADING: 0.02,               // corrección por grado de deriva de rumbo
  TIEMPO_LINEA_PERDIDA_MS: 500,  // buffer antes de declarar tramo sin cinta
  TIEMPO_MAX_SIN_LINEA_MS: 4000, // timeout de seguridad sin línea. NO se aumenta:
                                 // es el límite ante deriva del MPU-6050 (huecos de
                                 // cinta > ~4,5 m a la velocidad base no se cruzan)
  RSSI_DETECTA_DBM: -80,         // detecta baliza BLE
  RSSI_LLEGADA_DBM: -52,         // valida llegada al extremo
  DRIFT_MAX_GRADOS: 30,          // deriva excesiva del giroscopio
  VEL_BUSQUEDA: 0.30,            // avance lento buscando la línea
  VEL_APROX_BEACON: 0.20         // avance lento acercándose a la baliza
};

/* ------------------------------------------------------------- helpers */

function clamp(x, lo, hi) {
  return x < lo ? lo : (x > hi ? hi : x);
}

/* Ángulo en [-180, 180]. */
function anguloNormalizado(grados) {
  var g = grados % 360;
  if (g > 180) g -= 360;
  if (g < -180) g += 360;
  return g;
}

/* Posición de la línea (mm) desde los 4 TCRT5000 normalizados (0..1).
   Sensores de izquierda a derecha, posiciones [27, 9, -9, -27] mm. */
function posicionLinea(n) {
  var suma = 0, num = 0, i;
  for (i = 0; i < 4; i++) {
    var v = clamp(n[i], 0, 1);
    suma += v;
    num += v * (1.5 - i) * CFG.SEP_MM;   /* xSensor(i) = (1.5 - i) * SEP_MM */
  }
  var ve = suma > CFG.SUMA_MIN;
  return { ve_linea: ve, linea_mm: ve ? (num / suma) : 0 };
}

/* -------------------------------------------------------------- estado */

function nuevoNav() {
  return {
    estado: ESTADO.FOLLOW_LINE,
    perdidaMs: 0,          /* ms acumulados sin línea */
    rumboObjetivo: 0,      /* rumbo enseñado para el tramo sin cinta */
    haSalidoDeInicio: false,
    paradaSeguridad: false,/* latch terminal (timeout / deriva) */
    llegada: false
  };
}

/* ----------------------------------------------------------- transición */

/*
 * entradas:
 *   n          -> [n0..n3] TCRT5000 normalizados 0..1
 *   yaw        -> rumbo del MPU-6050 (grados)
 *   rssi       -> RSSI BLE de la baliza más cercana (dBm)
 *   frenteCm   -> distancia frontal del HC-SR04P (0 = sin eco / despejado)
 *   dtMs       -> tiempo desde la última llamada
 *   tramoSinCinta -> true si la ruta enseñada indica hueco de cinta aquí
 *   rumboTramo -> rumbo enseñado para HEADING_HOLD (grados)
 */
function paso(nav, entradas) {
  var out = {
    estado: nav.estado,
    vIzq: 0,
    vDer: 0,
    frenadoCritico: false,
    precaucion: false,
    paradaSeguridad: false,
    llegada: false,
    evento: null
  };

  /* Latch terminal: timeout o deriva ya ocurrieron, no se reanuda. */
  if (nav.paradaSeguridad) {
    out.paradaSeguridad = true;
    return out;
  }

  /* ---- Fail-safe frontal: cruza TODOS los estados ---- */
  var f = entradas.frenteCm;
  if (f > 0 && f < CFG.UMBRAL_PARADA_CM) {
    out.frenadoCritico = true;
    out.evento = "obstaculo_critico";
    return out; /* velocidad 0, estado sin cambiar */
  }
  if (f >= CFG.UMBRAL_PARADA_CM && f < CFG.UMBRAL_AVISO_CM) {
    out.precaucion = true;
  }

  /* Balizas solo en extremos: se marca que ya se dejó el inicio. */
  if (entradas.rssi < CFG.RSSI_DETECTA_DBM) {
    nav.haSalidoDeInicio = true;
  }

  var sens = posicionLinea(entradas.n);
  var ve = sens.ve_linea;
  var lm = sens.linea_mm;
  var corr;

  switch (nav.estado) {
    case ESTADO.FOLLOW_LINE:
      if (ve) {
        if (entradas.rssi >= CFG.RSSI_DETECTA_DBM && nav.haSalidoDeInicio) {
          nav.estado = ESTADO.WAIT_BEACON;
          out.evento = "beacon_detectado";
        } else {
          corr = CFG.KP_LINEA * lm;
          out.vIzq = clamp(CFG.BASE_VEL - corr, -1, 1);
          out.vDer = clamp(CFG.BASE_VEL + corr, -1, 1);
        }
      } else {
        nav.estado = ESTADO.LINE_LOST_CHECK;
        nav.perdidaMs = 0;
        out.evento = "linea_perdida";
      }
      break;

    case ESTADO.LINE_LOST_CHECK:
      nav.perdidaMs += entradas.dtMs;
      if (ve) {
        nav.estado = ESTADO.FOLLOW_LINE;
        nav.perdidaMs = 0;
        out.evento = "linea_recuperada";
        corr = CFG.KP_LINEA * lm;
        out.vIzq = clamp(CFG.BASE_VEL - corr, -1, 1);
        out.vDer = clamp(CFG.BASE_VEL + corr, -1, 1);
      } else if (entradas.tramoSinCinta && nav.perdidaMs >= CFG.TIEMPO_LINEA_PERDIDA_MS) {
        nav.estado = ESTADO.HEADING_HOLD;
        nav.rumboObjetivo = entradas.rumboTramo;
        out.evento = "tramo_sin_cinta";
      } else if (nav.perdidaMs >= CFG.TIEMPO_MAX_SIN_LINEA_MS) {
        nav.paradaSeguridad = true;
        out.paradaSeguridad = true;
        out.evento = "timeout_sin_linea";
      }
      break;

    case ESTADO.HEADING_HOLD:
      nav.perdidaMs += entradas.dtMs;
      {
        var err = anguloNormalizado(entradas.yaw - nav.rumboObjetivo);
        if (Math.abs(err) > CFG.DRIFT_MAX_GRADOS) {
          nav.paradaSeguridad = true;
          out.paradaSeguridad = true;
          out.evento = "deriva_excesiva";
        } else if (entradas.rssi >= CFG.RSSI_DETECTA_DBM && nav.haSalidoDeInicio) {
          /* Tramo sin cinta que termina en un EXTREMO: la baliza de ese extremo
             (RSSI >= detecta) pasa directo a WAIT_BEACON, sin REACQUIRE_LINE.
             Solo si ya se salió del inicio: junto a la baliza de salida no vale.
             La deriva excesiva se evalúa antes: manda la seguridad. */
          nav.estado = ESTADO.WAIT_BEACON;
          out.evento = "beacon_detectado";
        } else if (ve) {
          nav.estado = ESTADO.REACQUIRE_LINE;
          out.evento = "linea_reaparece";
        } else if (nav.perdidaMs >= CFG.TIEMPO_MAX_SIN_LINEA_MS) {
          nav.paradaSeguridad = true;
          out.paradaSeguridad = true;
          out.evento = "timeout_sin_linea";
        } else {
          corr = CFG.K_HEADING * err;
          out.vIzq = clamp(CFG.BASE_VEL - corr, -1, 1);
          out.vDer = clamp(CFG.BASE_VEL + corr, -1, 1);
        }
      }
      break;

    case ESTADO.REACQUIRE_LINE:
      nav.perdidaMs += entradas.dtMs;
      if (ve) {
        nav.estado = ESTADO.FOLLOW_LINE;
        nav.perdidaMs = 0;
        out.evento = "linea_reenganchada";
        corr = CFG.KP_LINEA * lm;
        out.vIzq = clamp(CFG.BASE_VEL - corr, -1, 1);
        out.vDer = clamp(CFG.BASE_VEL + corr, -1, 1);
      } else if (nav.perdidaMs >= CFG.TIEMPO_MAX_SIN_LINEA_MS) {
        nav.paradaSeguridad = true;
        out.paradaSeguridad = true;
        out.evento = "timeout_sin_linea";
      } else {
        out.vIzq = CFG.VEL_BUSQUEDA;
        out.vDer = CFG.VEL_BUSQUEDA;
      }
      break;

    case ESTADO.WAIT_BEACON:
      if (entradas.rssi >= CFG.RSSI_LLEGADA_DBM) {
        nav.llegada = true;
        out.llegada = true;
        out.evento = "llegada_validada";
      } else if (entradas.rssi >= CFG.RSSI_DETECTA_DBM) {
        out.vIzq = CFG.VEL_APROX_BEACON;
        out.vDer = CFG.VEL_APROX_BEACON;
        out.evento = "beacon_detectado";
      }
      /* rssi < detecta: sin señal, se queda esperando sin moverse */
      break;
  }

  /* Precaución (20-50 cm): reduce la velocidad a la mitad. */
  if (out.precaucion) {
    out.vIzq *= 0.5;
    out.vDer *= 0.5;
  }

  out.estado = nav.estado;
  return out;
}

module.exports = {
  ESTADO: ESTADO,
  NOMBRE_ESTADO: NOMBRE_ESTADO,
  CFG: CFG,
  clamp: clamp,
  anguloNormalizado: anguloNormalizado,
  posicionLinea: posicionLinea,
  nuevoNav: nuevoNav,
  paso: paso
};
