// La pista de prueba PROVISIONAL: un circuito cerrado con rectas, curvas suaves, una S y una curva cerrada.
// Se reemplaza por el recorrido real del laboratorio cuando se midan las distancias (observación del 18 nov).
// Unidades: metros. Plano del piso: x (a lo ancho) y z (a lo largo). Sin three.js aquí, para poder probarla en Node.

export const CINTA = 0.019; // cinta aislante negra de 19 mm (lista de materiales)
export const ZONA = {x0: -2, z0: -1, ancho: 4, alto: 2}; // área del piso con textura (4 m x 2 m)

// Puntos de control del circuito, en el sentido en que lo recorre el robot.
// La recta de abajo hace de "pasillo" (salida y llegada); la curva de la izquierda es la más cerrada.
const CTRL = [
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

export function crearPista() {
  // 1) curva fina
  const fino = [];
  const n = CTRL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n];
    const p1 = CTRL[i];
    const p2 = CTRL[(i + 1) % n];
    const p3 = CTRL[(i + 2) % n];
    for (let k = 0; k < 400; k++) fino.push(catmull(p0, p1, p2, p3, k / 400));
  }
  // 2) remuestreo por longitud, un punto cada PASO
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
  const N = xs.length;
  const X = Float64Array.from(xs);
  const Z = Float64Array.from(zs);
  // 3) tangente y radio de curva en cada punto (círculo por 3 puntos a ±5 cm)
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
  return {X, Z, TX, TZ, RAD, N, largo: N * PASO, rmin, paso: PASO, ctrl: CTRL};
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
