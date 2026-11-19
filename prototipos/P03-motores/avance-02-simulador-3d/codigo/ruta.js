// La ruta cerrada de demostración y la geometría de los sensores. Sin three.js aquí.
// Mundo: x a la derecha de la pantalla, z hacia el frente, ángulo th sobre +y.
// Con th = 0 el robot mira a +z; su izquierda es +x.

export const CINTA = 0.019; // cinta negra de 19 mm (proyecto)
export const HUELLA = 0.004; // radio de la huella del TCRT5000 sobre el piso (supuesto, ⌀ 8 mm)

// Posiciones de los sensores en el marco del robot
export const GEO = {
  tcrtZ: 0.112, // la regleta TCRT5000, al frente bajo el chasis
  tcrtX: [0.027, 0.009, -0.009, -0.027], // S1..S4 de izquierda a derecha, separación de 18 mm
  usF: {z: 0.109}, // cara del HC-SR04P frontal
  usR: {z: -0.109}, // cara del HC-SR04P trasero
  semiAngulo: (15 * Math.PI) / 180, // abertura del haz del HC-SR04P
};

export const ZONAS = {critica: 0.2, precaucion: 0.5}; // m

export const zonaDe = (d) => (d < ZONAS.critica ? 'critica' : d < ZONAS.precaucion ? 'precaucion' : 'libre');

const N = 1800;
const forma = (t) => [1.3 * Math.cos(t) + 0.06 * Math.cos(3 * t), 0.75 * Math.sin(t) + 0.04 * Math.sin(2 * t)];

export function crearRuta() {
  const x = new Float64Array(N);
  const z = new Float64Array(N);
  const s = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const p = forma((2 * Math.PI * i) / N);
    x[i] = p[0];
    z[i] = p[1];
  }
  for (let i = 1; i <= N; i++) {
    const a = i - 1;
    const b = i % N;
    s[i] = s[i - 1] + Math.hypot(x[b] - x[a], z[b] - z[a]);
  }
  const largo = s[N];
  // índice a partir de una distancia sobre la ruta
  const idx = (d) => {
    d = ((d % largo) + largo) % largo;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (s[m] <= d) lo = m;
      else hi = m;
    }
    return {i: lo, f: (d - s[lo]) / (s[lo + 1] - s[lo])};
  };
  const en = (d) => {
    const {i, f} = idx(d);
    const j = (i + 1) % N;
    const px = x[i] + (x[j] - x[i]) * f;
    const pz = z[i] + (z[j] - z[i]) * f;
    const tx = x[j] - x[i];
    const tz = z[j] - z[i];
    const m = Math.hypot(tx, tz);
    return {x: px, z: pz, tx: tx / m, tz: tz / m};
  };
  // curvatura con signo en el punto i (+ gira a la izquierda: +x al avanzar por +z)
  const curvatura = (i) => {
    const a = (i - 3 + N) % N;
    const c = (i + 3) % N;
    const ax = x[i] - x[a];
    const az = z[i] - z[a];
    const bx = x[c] - x[i];
    const bz = z[c] - z[i];
    const cr = az * bx - ax * bz; // + si gira hacia +x al ir por +z
    const dd = Math.hypot(ax, az) * Math.hypot(bx, bz) * Math.hypot(x[c] - x[a], z[c] - z[a]);
    return (2 * cr) / dd;
  };
  // punto más cercano a (px, pz), buscando cerca de la muestra "hint"; devuelve distancia, abscisa y lado
  const cercano = (px, pz, hint, ventana = 90) => {
    let best = Infinity;
    let bi = hint;
    for (let k = -ventana; k <= ventana; k++) {
      const i = (((hint + k) % N) + N) % N;
      const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    // afina con el segmento vecino
    let dist = Math.sqrt(best);
    for (const j of [(bi + 1) % N, (bi - 1 + N) % N]) {
      const a = bi;
      const ex = x[j] - x[a];
      const ez = z[j] - z[a];
      const u = Math.max(0, Math.min(1, ((px - x[a]) * ex + (pz - z[a]) * ez) / (ex * ex + ez * ez)));
      dist = Math.min(dist, Math.hypot(px - (x[a] + ex * u), pz - (z[a] + ez * u)));
    }
    return {dist, i: bi, s: s[bi]};
  };
  const puntos = [];
  for (let i = 0; i < N; i += 2) puntos.push([x[i], z[i]]);
  return {N, largo, x, z, s, en, curvatura, cercano, puntos};
}

// Obstáculos cilíndricos (bidones de 9 cm), puestos fuera de la cinta, en las curvas de los extremos:
// al entrar y salir de cada curva los haces del HC-SR04P pasan por las zonas de precaución y crítica.
export const OBSTACULOS = [
  {x: -1.52, z: 0.06, r: 0.045},
  {x: 1.47, z: -0.25, r: 0.045},
  {x: 1.53, z: 0.12, r: 0.045},
];

// Distancia ultrasónica: el eco más cercano dentro del haz (5 rayos, ±15°). Devuelve metros o Infinity.
export function ultrasonido(px, pz, th, lado, obstaculos, alcance = 4) {
  const dir = lado === 'frente' ? 1 : -1;
  const zc = lado === 'frente' ? GEO.usF.z : GEO.usR.z;
  const ox = px + Math.sin(th) * zc;
  const oz = pz + Math.cos(th) * zc;
  let mejor = Infinity;
  for (let k = -2; k <= 2; k++) {
    const a = th + (dir < 0 ? Math.PI : 0) + (k / 2) * GEO.semiAngulo;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    for (const o of obstaculos) {
      // rayo contra círculo
      const lx = o.x - ox;
      const lz = o.z - oz;
      const tca = lx * dx + lz * dz;
      if (tca < 0) continue;
      const d2 = lx * lx + lz * lz - tca * tca;
      if (d2 > o.r * o.r) continue;
      const t = tca - Math.sqrt(o.r * o.r - d2);
      if (t >= 0 && t < mejor) mejor = t;
    }
  }
  return mejor > alcance ? Infinity : mejor;
}

// Los 4 TCRT5000: 1 si el sensor está sobre la cinta
export function lineaSensores(ruta, px, pz, th, hint) {
  const sx = Math.sin(th);
  const cx = Math.cos(th);
  return GEO.tcrtX.map((lx) => {
    const wx = px + sx * GEO.tcrtZ + cx * lx;
    const wz = pz + cx * GEO.tcrtZ - sx * lx;
    return ruta.cercano(wx, wz, hint).dist <= CINTA / 2 + HUELLA ? 1 : 0;
  });
}
