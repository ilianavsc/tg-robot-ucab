/* Simulador 2 V2 · adaptador de las pistas de SIM1 a la planta de movimiento.
 *
 * SIM1 (prototipos/P08-seguidor-linea/avance-01-simulador-3d/codigo/pista.js) define DOS pistas:
 *   A · circuito histórico de 8,05 m   y   B · recorrido canónico de 9,0 m (Pasillo UCAB).
 * Este archivo NO las redefine: recibe el objeto que devuelve crearPista() de SIM1 (X, Z, TX, TZ, paso, largo)
 * y calcula lo que la planta necesita: curvatura con signo κ(s), pose en el mundo (x, y, angulo) y si un tramo es recto.
 *
 * Convenios (iguales en el estado del gemelo digital):
 *   x, y  = metros del mundo de SIM1 (y = Z de SIM1).
 *   angulo = grados, 0 = +x (este), positivo ANTIHORARIO, de −180 a 180.
 *   s = metros recorridos sobre la pista (0 = salida; en un circuito cerrado s = largo vuelve a la salida).
 *   κ > 0 = la pista gira a la izquierda (antihorario) en el sentido de s creciente.
 *
 * SUPUESTO DE SIMULACIÓN: en un circuito cerrado las dos balizas BLE (inicio y fin) caen en el mismo punto del piso.
 * El RSSI se calcula por DISTANCIA RECORRIDA sobre la pista (|s − 0| y |s − largo|), no por distancia euclidiana.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.PistasSim1 = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RAD = Math.PI / 180;

  function normalizar(g) {
    while (g > 180) g -= 360;
    while (g <= -180) g += 360;
    return g;
  }

  /* p1 = resultado de crearPista(id) de SIM1 · id = "A" | "B" */
  function crearTrazado(p1, id, nombre) {
    var N = p1.N, paso = p1.paso, L = p1.largo;
    var theta = new Float64Array(N); /* rumbo de la pista (rad, antihorario desde +x) en el sentido de s creciente */
    var i;
    for (i = 0; i < N; i++) theta[i] = Math.atan2(p1.TZ[i], p1.TX[i]);
    /* curvatura con signo: cambio del rumbo en ±5 muestras (±2,5 cm) */
    var kappa = new Float64Array(N), h = 5, d;
    for (i = 0; i < N; i++) {
      d = theta[(i + h) % N] - theta[(i - h + N) % N];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      kappa[i] = d / (2 * h * paso);
    }
    function idx(s) {
      var k = Math.round(s / paso);
      return ((k % N) + N) % N;
    }
    var t = {
      id: id, nombre: nombre || ("Pista " + id), L: L, N: N, paso: paso,
      cerrada: true,
      kappa: function (s) { return kappa[idx(s)]; },
      /* rumbo de la pista (grados) en s, mirando en el sentido de s creciente */
      rumboPistaGrados: function (s) { return theta[idx(s)] / RAD; },
      puntoEn: function (s) { var k = idx(s); return { x: p1.X[k], y: p1.Z[k] }; },
      /* ¿El tramo [desde, hasta] es recto? (radio de curva > radioMinM en todas sus muestras) */
      rectoEn: function (desdeM, hastaM, radioMinM) {
        var rmin = radioMinM || 10, a = Math.round(desdeM / paso), b = Math.round(hastaM / paso), k;
        for (k = a; k <= b; k++) if (Math.abs(kappa[((k % N) + N) % N]) > 1 / rmin) return false;
        return true;
      },
      /* tramo recto más largo (m) y dónde termina */
      rectaMasLarga: function (radioMinM) {
        var rmin = radioMinM || 10, mejor = 0, act = 0, fin = 0, k;
        for (k = 0; k < 2 * N; k++) {
          if (Math.abs(kappa[k % N]) <= 1 / rmin) { act++; if (act > mejor) { mejor = act; fin = k % N; } } else act = 0;
        }
        return { largoM: mejor * paso, finM: fin * paso };
      },
      /* Pose del robot en el mundo. dir = +1 (s crece) o −1 (s decrece).
         lateralIzqM = desvío a la izquierda de la cinta en el sentido de MARCHA; yawFrenetGrados = giro del robot
         respecto a la pista (positivo = horario, como yawVerdad de la planta). */
      pose: function (s, dir, lateralIzqM, yawFrenetGrados) {
        var k = idx(s), th = theta[k] + (dir < 0 ? Math.PI : 0);
        var x = p1.X[k] - Math.sin(th) * lateralIzqM;
        var y = p1.Z[k] + Math.cos(th) * lateralIzqM;
        return { x: x, y: y, angulo: normalizar(th / RAD - yawFrenetGrados) };
      },
      /* cuadro que encierra la pista (para dibujarla) */
      caja: function () {
        var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, k;
        for (k = 0; k < N; k++) {
          if (p1.X[k] < x0) x0 = p1.X[k];
          if (p1.X[k] > x1) x1 = p1.X[k];
          if (p1.Z[k] < y0) y0 = p1.Z[k];
          if (p1.Z[k] > y1) y1 = p1.Z[k];
        }
        return { x0: x0, x1: x1, y0: y0, y1: y1 };
      },
      /* polilínea cada `cada` muestras, para dibujar */
      puntos: function (cada) {
        var r = [], k, c = cada || 4;
        for (k = 0; k < N; k += c) r.push([p1.X[k], p1.Z[k]]);
        return r;
      }
    };
    return t;
  }

  /* Objeto "pista" que entiende la planta (mismo formato que specs/pista_canonica.json).
     B = la pista canónica tal cual (tramos T1–T4, puntos de control y balizas de la especificación).
     A = pista histórica: sin estaciones intermedias (la especificación no define tramos para ella): un solo tramo
     con cinta, balizas solo en los extremos y los mismos umbrales de la canónica. */
  function pistaPara(id, canonica, largoM) {
    if (id === "B") return canonica;
    return {
      nombre: "Circuito histórico de SIM1 (Pista A)",
      version: canonica.version, estado: "historica",
      longitudTotalM: largoM, anchoCintaMm: canonica.anchoCintaMm, unidades: canonica.unidades,
      balizasBLE: [
        { id: "B1", extremo: "inicio", ubicacion: "Salida", posicionM: 0 },
        { id: "B2", extremo: "fin", ubicacion: "Meta", posicionM: largoM }
      ],
      tramos: [{ id: "T1", tipo: "linea", desdeM: 0, hastaM: largoM, longitudM: largoM, rumboGrados: 0, descripcion: "Vuelta completa con cinta" }],
      puntosDeControl: [],
      umbrales: canonica.umbrales, estados: canonica.estados
    };
  }

  return { crearTrazado: crearTrazado, pistaPara: pistaPara, normalizar: normalizar };
});
