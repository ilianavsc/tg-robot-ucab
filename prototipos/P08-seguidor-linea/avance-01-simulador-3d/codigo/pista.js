// La DEFINICIÓN de las pistas del Simulador 1 de aprendizaje progresivo. Sin three.js aquí, para poder probarla en Node.
//   - Pista A: el circuito histórico de 8,05 m (provisional, del Avance 1).
//   - Pista B: el recorrido canónico de 9,0 m (Pasillo UCAB, specs/pista_canonica.json): rectas largas y curvas técnicas.
// Cada pista trae sus tramos y una máscara de cinta (P.cinta): hoy toda la línea está presente; los próximos simuladores
// de retiro progresivo de la cinta solo llaman a ocultarTramo() y la lectura de la línea (linea.js) ya respeta la máscara.
// Unidades: metros. Plano del piso: x (a lo ancho) y z (a lo largo).

export const CINTA = 0.019; // cinta aislante negra de 19 mm (lista de materiales)
export const ZONA = {x0: -2, z0: -1, ancho: 4, alto: 2}; // área del piso con textura de la pista A (4 m x 2 m)
export const ZONA_B = {x0: -2.2, z0: -1.1, ancho: 4.4, alto: 2.2}; // la pista B es más larga (4,1 m de punta a punta)

// Puntos de control del circuito, en el sentido en que lo recorre el robot.
// La recta de abajo hace de "pasillo" (salida y llegada); la curva de la izquierda es la más cerrada.
const CTRL_A = [
  [-1.0, -0.62],
  [0.0, -0.62],
  [0.9, -0.62],
  [1.4, -0.48],
  [1.62, -0.05],
  [1.42, 0.42],
  [0.95, 0.58],
  [0.55, 0.36],
  [0.25, 0.04],
  [-0.1, 0.06],
  [-0.4, 0.36],
  [-0.85, 0.58],
  [-1.32, 0.5],
  [-1.5, 0.12],
  [-1.42, -0.3],
];

const PASO = 0.005; // un punto cada 5 mm

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

// Datos de cada pista (lo que se muestra en la interfaz y en las pruebas)
export const PISTAS = {
  A: {
    id: 'A',
    nombre: 'Pista A · Circuito histórico',
    corto: 'A · 8,05 m',
    largoNominal: 8.05,
    descripcion: 'Circuito provisional del Avance 1: rectas, curvas suaves, una S y una curva cerrada de 22 cm de radio. Registro histórico, superado por la pista canónica de 9,0 m.',
    tramos: [{id: 'Circuito', nombre: 'Vuelta completa', desdeM: 0, hastaM: 8.05}],
  },
  B: {
    id: 'B',
    nombre: 'Pista B · Pasillo UCAB (canónica)',
    corto: 'B · 9,0 m',
    largoNominal: 9.0,
    descripcion: 'Recorrido canónico de 9,0 m (specs/pista_canonica.json): rectas largas de 3,6 m, dos curvas cerradas y una chicane. Los tramos T1 a T4 siguen las distancias de la especificación.',
    // T1..T4 salen de specs/pista_canonica.json (desdeM/hastaM sobre la longitud total de 9,0 m)
    tramos: [
      {id: 'T1', nombre: 'Salida del Cuarto de Componentes', desdeM: 0, hastaM: 3.0},
      {id: 'T2', nombre: 'Tramo de cruce (en simuladores futuros, sin cinta)', desdeM: 3.0, hastaM: 4.5},
      {id: 'T3', nombre: 'Pasillo', desdeM: 4.5, hastaM: 7.5},
      {id: 'T4', nombre: 'Entrada al Laboratorio 1', desdeM: 7.5, hastaM: 9.0},
    ],
  },
};
export const IDS_PISTA = Object.keys(PISTAS);

// ---- Pista A: curva suave por los puntos de control ----
function trazoA() {
  const fino = [];
  const n = CTRL_A.length;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL_A[(i - 1 + n) % n];
    const p1 = CTRL_A[i];
    const p2 = CTRL_A[(i + 1) % n];
    const p3 = CTRL_A[(i + 2) % n];
    for (let k = 0; k < 400; k++) fino.push(catmull(p0, p1, p2, p3, k / 400));
  }
  // remuestreo por longitud, un punto cada PASO
  const xs = [];
  const zs = [];
  let acc = 0;
  xs.push(fino[0][0]);
  zs.push(fino[0][1]);
  for (let i = 1; i <= fino.length; i++) {
    const a = fino[i - 1];
    const b = fino[i % fino.length];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let ax = a[0];
    let az = a[1];
    while (acc + seg >= PASO) {
      const k = (PASO - acc) / seg;
      ax += (b[0] - ax) * k;
      az += (b[1] - az) * k;
      seg = Math.hypot(b[0] - ax, b[1] - az);
      acc = 0;
      xs.push(ax);
      zs.push(az);
    }
    acc += seg;
  }
  xs.pop();
  zs.pop();
  return {xs, zs};
}

// ---- Pista B: rectas y arcos exactos (tortuga) ----
// Salida en la recta de abajo (rumbo este), horquilla a la derecha, recta larga de 3,6 m hacia el oeste (cubre el tramo T2),
// horquilla a la izquierda y regreso por abajo con una chicane (en T4) hasta cerrar en la salida. Largo total: 9,000 m.
export const B_GEO = {R: 0.27, a0: 1.5, c: 0.9}; // radio de las curvas, primer recto y recto antes de la chicane
function segmentosB() {
  const {R, a0, c} = B_GEO;
  const chi = [Math.PI / 4, -Math.PI / 2, Math.PI / 4]; // chicane: +45°, −90°, +45° (largo 0,848 m, avanza 0,764 m)
  const chiL = chi.reduce((s, a) => s + Math.abs(a) * R, 0);
  // avance neto de la chicane (calculado con la misma tortuga)
  const dxChi = tortuga(chi.map((ang) => ({ang})), R).x;
  const b = (9 - 2 * Math.PI * R + dxChi - chiL) / 2; // largo de la recta larga: cierra el circuito en 9,0 m
  const e = b - a0 - dxChi - c; // último recto, hasta la salida
  return {R, segs: [{L: a0}, {ang: Math.PI}, {L: b}, {ang: Math.PI}, {L: c}, ...chi.map((ang) => ({ang})), {L: e}], b, e};
}

// Recorre una lista de segmentos {L} (recto) o {ang} (arco de radio R, + a la izquierda) y entrega el punto final
function tortuga(segs, R, puntos = null, paso = PASO) {
  let x = 0;
  let z = 0;
  let h = 0;
  let s = 0;
  let k = 0;
  for (const g of segs) {
    const len = g.L !== undefined ? g.L : Math.abs(g.ang) * R;
    const sg = Math.sign(g.ang || 1);
    const cx = x - Math.sin(h) * R * sg;
    const cz = z + Math.cos(h) * R * sg;
    if (puntos) {
      while (k * paso < s + len - 1e-9) {
        const d = k * paso - s;
        if (g.L !== undefined) puntos.push([x + Math.cos(h) * d, z + Math.sin(h) * d]);
        else {
          const a = (d / R) * sg;
          puntos.push([cx + Math.sin(h + a) * R * sg, cz - Math.cos(h + a) * R * sg]);
        }
        k++;
      }
    }
    if (g.L !== undefined) {
      x += Math.cos(h) * len;
      z += Math.sin(h) * len;
    } else {
      h += g.ang;
      x = cx + Math.sin(h) * R * sg;
      z = cz - Math.cos(h) * R * sg;
    }
    s += len;
  }
  return {x, z, h, largo: s};
}

function trazoB() {
  const {R, segs} = segmentosB();
  const pts = [];
  tortuga(segs, R, pts);
  // centra el trazo en la zona del piso
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return {xs: xs.map((v) => v - cx), zs: zs.map((v) => v - cz)};
}

// ---- Lo común: tangentes, radios, máscara de cinta y tramos ----
function armar(xs, zs, def) {
  const N = xs.length;
  const X = Float64Array.from(xs);
  const Z = Float64Array.from(zs);
  const TX = new Float64Array(N);
  const TZ = new Float64Array(N);
  const RAD = new Float64Array(N);
  const h = 10;
  for (let i = 0; i < N; i++) {
    const a = (i - h + N) % N;
    const b = (i + h) % N;
    const dx = X[b] - X[a];
    const dz = Z[b] - Z[a];
    const L = Math.hypot(dx, dz);
    TX[i] = dx / L;
    TZ[i] = dz / L;
    const A = Math.hypot(X[i] - X[a], Z[i] - Z[a]);
    const B = Math.hypot(X[b] - X[i], Z[b] - Z[i]);
    const C = L;
    const cruz = Math.abs((X[i] - X[a]) * (Z[b] - Z[a]) - (Z[i] - Z[a]) * (X[b] - X[a]));
    RAD[i] = cruz < 1e-12 ? Infinity : (A * B * C) / (2 * cruz);
  }
  let rmin = Infinity;
  for (let i = 0; i < N; i++) rmin = Math.min(rmin, RAD[i]);
  const largo = N * PASO;
  // los tramos de la definición, cortados a la longitud real de la pista
  const tramos = def.tramos.map((t) => ({...t, hastaM: Math.min(t.hastaM, largo), linea: true}));
  return {
    id: def.id,
    nombre: def.nombre,
    corto: def.corto,
    descripcion: def.descripcion,
    X,
    Z,
    TX,
    TZ,
    RAD,
    N,
    largo,
    rmin,
    paso: PASO,
    tramos,
    zona: def.id === 'B' ? ZONA_B : ZONA, // área del piso con granito y cinta
    cinta: new Uint8Array(N).fill(1), // 1 = hay cinta en esa muestra
  };
}

export function crearPista(id = 'A') {
  const def = PISTAS[id];
  if (!def) throw new Error(`pista desconocida: ${id}`);
  const {xs, zs} = id === 'B' ? trazoB() : trazoA();
  const P = armar(xs, zs, def);
  P.ctrl = id === 'A' ? CTRL_A : null;
  return P;
}

// Tramo que contiene la muestra i
export const tramoEn = (P, i) => {
  const m = i * P.paso;
  return P.tramos.find((t) => m >= t.desdeM && m < t.hastaM) || P.tramos[P.tramos.length - 1];
};

// Retiro de cinta: quita (o repone) la cinta entre dos distancias de la pista. La lectura de la línea y el piso pintado lo respetan.
// Los simuladores futuros de aprendizaje progresivo parten de aquí; este simulador no oculta nada.
export function ocultarTramo(P, desdeM, hastaM, hay = false) {
  for (let i = 0; i < P.N; i++) {
    const m = i * P.paso;
    if (m >= desdeM && m < hastaM) P.cinta[i] = hay ? 1 : 0;
  }
  const t = P.tramos.find((q) => q.desdeM === desdeM && q.hastaM === hastaM);
  if (t) t.linea = !!hay;
}

// El punto de la pista más cercano a (x, z). Busca cerca de i0 (ventana ±win) o en toda la pista.
// d con signo: positivo si el punto está a la IZQUIERDA del sentido de marcha.
export function cercano(P, x, z, i0 = -1, win = 80) {
  let best = Infinity;
  let bi = 0;
  const N = P.N;
  if (i0 < 0) {
    for (let i = 0; i < N; i++) {
      const d = (P.X[i] - x) ** 2 + (P.Z[i] - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
  } else {
    for (let k = -win; k <= win; k++) {
      const i = (((i0 + k) % N) + N) % N;
      const d = (P.X[i] - x) ** 2 + (P.Z[i] - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
  }
  // izquierda de la tangente (tx, tz) es (tz, -tx)
  const s = (x - P.X[bi]) * P.TZ[bi] - (z - P.Z[bi]) * P.TX[bi];
  return {i: bi, d: Math.sign(s || 1) * Math.sqrt(best)};
}

// Distancia sin signo a la línea central, buscando cerca de i0
export const distancia = (P, x, z, i0) => Math.abs(cercano(P, x, z, i0, 40).d);
