// El piso de granito (terrazo) con la cinta negra encima, pintado en un lienzo de 4 m x 2 m (≈ 1 mm por píxel).
// De aquí salen dos cosas: la imagen que se ve en 3D y lo oscuro del granito bajo cada sensor.
// El granito es inventado al azar (granos negros, grises y blancos); el del laboratorio se fotografía el 18 nov.
import {CINTA, ZONA} from './pista.js';

export const PX = 4096;
export const PY = 2048;
const K = PX / ZONA.ancho; // píxeles por metro (1024)

const BASE = [220, 217, 210]; // fondo claro del granito
const GRANOS = [
  // color, cuán oscuro lo ve el sensor (0 claro, 1 negro), proporción
  [[62, 62, 66], 0.85, 0.24],
  [[128, 128, 132], 0.4, 0.34],
  [[246, 244, 239], 0, 0.28],
  [[184, 162, 150], 0.2, 0.14],
];

export function crearGranito(P) {
  let seed = 20261114;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const G = new Uint8Array(PX * PY); // oscuridad 0..255
  const img = new Uint8ClampedArray(PX * PY * 4);
  for (let i = 0; i < PX * PY; i++) {
    const v = (rnd() - 0.5) * 8;
    img[i * 4] = BASE[0] + v;
    img[i * 4 + 1] = BASE[1] + v;
    img[i * 4 + 2] = BASE[2] + v;
    img[i * 4 + 3] = 255;
  }
  // granos: radio de 1 a 4 mm, cubren cerca del 22 % del piso
  const nGranos = Math.round((PX * PY * 0.22) / (Math.PI * 2.4 * 2.4));
  for (let k = 0; k < nGranos; k++) {
    let u = rnd();
    let tipo = GRANOS[0];
    for (const g of GRANOS) {
      if (u < g[2]) {
        tipo = g;
        break;
      }
      u -= g[2];
    }
    const cx = rnd() * PX;
    const cy = rnd() * PY;
    const r = 1 + rnd() * 3;
    const rx = r * (0.7 + rnd() * 0.6);
    const ry = r * (0.7 + rnd() * 0.6);
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(PX - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(PY - 1, Math.ceil(cy + ry));
    const sh = (rnd() - 0.5) * 18;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const i = y * PX + x;
        G[i] = tipo[1] * 255;
        img[i * 4] = tipo[0][0] + sh;
        img[i * 4 + 1] = tipo[0][1] + sh;
        img[i * 4 + 2] = tipo[0][2] + sh;
      }
  }
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (canvas) pintar(canvas, img, P);
  // lo que ve el sensor del granito: promedio de su zona (centro y 4 puntos a 3 mm)
  const muestra = (x, z) => {
    const px = (x - ZONA.x0) * K - 0.5;
    const py = (z - ZONA.z0) * K - 0.5;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    if (ix < 0 || iy < 0 || ix >= PX - 1 || iy >= PY - 1) return 0;
    const fx = px - ix;
    const fy = py - iy;
    const i = iy * PX + ix;
    return ((G[i] * (1 - fx) + G[i + 1] * fx) * (1 - fy) + (G[i + PX] * (1 - fx) + G[i + PX + 1] * fx) * fy) / 255;
  };
  const r = 0.003;
  const gran = (x, z) => (muestra(x, z) * 2 + muestra(x + r, z) + muestra(x - r, z) + muestra(x, z + r) + muestra(x, z - r)) / 6;
  return {canvas, gran};
}

function pintar(canvas, img, P) {
  canvas.width = PX;
  canvas.height = PY;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(img, PX, PY), 0, 0);
  // la cinta: 19 mm de ancho sobre la línea central
  const toPx = (x, z) => [(x - ZONA.x0) * K, (z - ZONA.z0) * K];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= P.N; i++) {
    const [x, y] = toPx(P.X[i % P.N], P.Z[i % P.N]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#141518';
  ctx.lineWidth = CINTA * K;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = CINTA * K * 0.35;
  ctx.stroke();
  // marcas de salida a los lados de la cinta (no las ven los sensores)
  ctx.fillStyle = '#F2603D';
  for (const lado of [1, -1]) {
    const ox = P.TZ[0] * lado;
    const oz = -P.TX[0] * lado;
    for (let k = 0; k < 4; k++) {
      const off = 0.07 + k * 0.012;
      const [x, y] = toPx(P.X[0] + ox * off, P.Z[0] + oz * off);
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }
}

// Un cuadro de granito de 0,5 m que se repite fuera de la zona de la pista (sin cinta), con sus bordes empalmados
export function crearTeja() {
  const N = 512;
  let seed = 777;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const img = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const v = (rnd() - 0.5) * 8;
    img.set([BASE[0] + v, BASE[1] + v, BASE[2] + v, 255], i * 4);
  }
  const n = Math.round((N * N * 0.22) / (Math.PI * 2.4 * 2.4));
  for (let k = 0; k < n; k++) {
    let u = rnd();
    let tipo = GRANOS[0];
    for (const g of GRANOS) {
      if (u < g[2]) {
        tipo = g;
        break;
      }
      u -= g[2];
    }
    const cx = rnd() * N;
    const cy = rnd() * N;
    const r = 1 + rnd() * 3;
    const rx = r * (0.7 + rnd() * 0.6);
    const ry = r * (0.7 + rnd() * 0.6);
    const sh = (rnd() - 0.5) * 18;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const i = (((y % N) + N) % N) * N + (((x % N) + N) % N);
        img.set([tipo[0][0] + sh, tipo[0][1] + sh, tipo[0][2] + sh], i * 4);
      }
  }
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  canvas.getContext('2d').putImageData(new ImageData(img, N, N), 0, 0);
  return canvas;
}
