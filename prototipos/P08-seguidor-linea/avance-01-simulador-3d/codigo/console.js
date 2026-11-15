// La consola del seguidor de línea, en 1600 x 900: encabezado, los ojos (4 TCRT5000), el cerebro (PD),
// la pista, los resultados, y abajo el control, los sensores, la batería y las vistas. update(s) redibuja todo.
import {PINES_LINEA, R} from './model.js';
import {CINTA} from './pista.js';

export const C = {ink: '#14213D', mute: '#4A5A73', faint: '#c9d7d2', line: '#d9e3df', panel: 'rgba(255,255,255,.93)', coral: '#F2603D', teal: '#0F9D84', violet: '#6B4EE6', amber: '#F2B33D', papel: '#EEF3F1'};
export const VIEWS = ['heroe', 'sensores', 'arriba', 'sigue', 'lado'];
export const VIEW_LABEL = {heroe: 'HÉROE', sensores: 'SENSORES', arriba: 'ARRIBA', sigue: 'DETRÁS', lado: 'DE LADO'};
export const BATS = ['llena', 'nominal', 'baja'];

const CSS = `
#app{font-family:'Atkinson Hyperlegible',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.dp{font-family:'Bricolage Grotesque',system-ui,sans-serif}
.cp{position:absolute;background:${C.panel};border:1.5px solid ${C.ink};border-radius:10px;box-shadow:4px 4px 0 ${C.ink}}
.ph{position:absolute;display:flex;align-items:center;gap:8px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.6px}
.ph i{display:block;width:10px;height:10px;border-radius:3px;background:var(--c)}
.pn{position:absolute;font:600 10px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:600 9.2px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:26px;padding:0 10px;display:flex;align-items:center;justify-content:center;border:1.5px solid ${C.ink};border-radius:7px;background:#fff;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;transition:background .15s,color .15s;pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.97)}
.bt.on{background:${C.ink};color:#fff}
.bt.man.on{background:${C.coral};border-color:${C.coral};color:#fff}
.call{position:absolute;white-space:nowrap;transform:translate(-50%,-100%);padding:4px 8px 5px;background:rgba(255,255,255,.92);border:1.5px solid ${C.ink};border-radius:7px}
.call b{display:block;font:700 13px 'Bricolage Grotesque',sans-serif;color:${C.ink};line-height:1.1}
.call span{display:block;font:600 9px 'JetBrains Mono',monospace;letter-spacing:.8px;color:${C.mute};margin-top:1px}
.slh{position:absolute;pointer-events:auto;cursor:ew-resize;height:26px}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const f1 = (x) => x.toFixed(1).replace('.', ',');
const f2 = (x) => x.toFixed(2).replace('.', ',');
const f3 = (x) => x.toFixed(3).replace('.', ',');
const seg = (t) => (t == null ? 'aún no' : `${f1(t)} s`);

export function createConsole(app, toStage) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n, c) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px;--c:${c}"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 14}px">${n}</div>`);
  };
  const hr = (x, y, w) => add(`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:1px;background:${C.line}"></div>`);
  const fila = (x, y, label, w = 262) => {
    add(`<div class="sm" style="position:absolute;left:${x}px;top:${y + 3}px">${label}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - x - w}px;top:${y}px;font-size:12.5px;font-weight:600;text-align:right"></div>`);
  };
  const nota = (x, y, w, txt = '') => add(`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;font-size:12px;line-height:1.35;color:${C.mute}">${txt}</div>`);

  // ------------------------------------------------------------ encabezado
  add(`<div style="position:absolute;left:0;top:0;width:118px;height:92px;background:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:30px;top:30px;width:22px;height:22px;border-radius:6px;background:${C.teal};box-shadow:7px 7px 0 ${C.coral}"></div>`);
  add(`<div class="dp" style="position:absolute;left:66px;top:28px;color:#fff;font-size:22px;font-weight:700">TG</div>`);
  add(`<div class="sm" style="position:absolute;left:142px;top:18px;letter-spacing:2.2px">TRABAJO DE GRADO · ROBOT UCAB · P08 AVANCE 1</div>`);
  add(`<div class="dp" style="position:absolute;left:141px;top:32px;font-size:34px;font-weight:700;letter-spacing:-.6px;line-height:1">Cómo sigue la línea <span style="color:${C.coral}">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:142px;top:72px;font-size:11px;letter-spacing:1.8px;color:${C.mute}">4 × TCRT5000 + ESP32 + L298N + 2 MOTORES JGA25-371 SPEED 200 · CINTA NEGRA 19 MM SOBRE GRANITO</div>`);
  const estBig = add(`<div class="dp" style="position:absolute;right:300px;top:26px;font-size:30px;font-weight:700;letter-spacing:-.4px;text-align:right"></div>`);
  const estSub = add(`<div class="sm" style="position:absolute;right:300px;top:64px;text-align:right"></div>`);
  add(`<div style="position:absolute;left:1316px;top:24px;width:1.5px;height:50px;background:${C.faint}"></div>`);
  const velBig = add(`<div class="dp" style="position:absolute;left:1334px;top:20px;font-size:40px;font-weight:700;letter-spacing:-1px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:1336px;top:64px">METROS POR SEGUNDO</div>`);

  // ------------------------------------------------------------ 01 los ojos
  panel(28, 112, 290, 310, 'LOS OJOS · 4 TCRT5000', '01', C.teal);
  nota(42, 138, 262, 'Cada sensor mira el piso. Sobre la cinta negra lee alto; sobre el granito, bajo.');
  const barras = add(`<svg style="position:absolute;left:42px;top:178px" width="262" height="150"></svg>`);
  hr(42, 334, 262);
  add(`<div class="sm" style="position:absolute;left:42px;top:342px">DÓNDE CREE QUE ESTÁ LA LÍNEA</div>`);
  const regla = add(`<svg style="position:absolute;left:42px;top:358px" width="262" height="34"></svg>`);
  const reglaTxt = add(`<div class="mo" style="position:absolute;left:42px;top:396px;font-size:11px;font-weight:600"></div>`);

  // ------------------------------------------------------------ 02 el cerebro
  panel(28, 436, 290, 246, 'EL CEREBRO · CONTROL PD', '02', C.violet);
  const cer = {
    e: fila(42, 462, 'ERROR (POSICIÓN)'),
    p: fila(42, 486, 'P = KP × ERROR'),
    d: fila(42, 510, 'D = KD × CAMBIO'),
    c: fila(42, 534, 'CORRECCIÓN'),
  };
  hr(42, 560, 262);
  const pwmSvg = add(`<svg style="position:absolute;left:42px;top:568px" width="262" height="62"></svg>`);
  nota(42, 634, 262, 'Si la línea queda a la izquierda, el motor derecho acelera y el izquierdo frena.');

  // ------------------------------------------------------------ 03 la pista
  panel(1282, 112, 290, 310, 'LA PISTA · PROVISIONAL', '03', C.coral);
  const mapa = add(`<svg style="position:absolute;left:1296px;top:142px" width="262" height="150"></svg>`);
  hr(1296, 300, 262);
  const pis = {largo: fila(1296, 308, 'UNA VUELTA'), rmin: fila(1296, 332, 'CURVA MÁS CERRADA')};
  nota(1296, 360, 262, 'Pista de prueba. Se cambia por el recorrido real con las medidas del laboratorio (18 nov).');

  // ------------------------------------------------------------ 04 resultados
  panel(1282, 436, 290, 246, 'RESULTADOS', '04', C.amber);
  const graf = add(`<svg style="position:absolute;left:1296px;top:462px" width="262" height="62"></svg>`);
  add(`<div class="sm" style="position:absolute;left:1296px;top:528px">QUÉ TAN LEJOS DE LA LÍNEA · ÚLTIMOS 6 S</div>`);
  const res = {
    act: fila(1296, 548, 'VUELTA ACTUAL'),
    ult: fila(1296, 572, 'ÚLTIMA VUELTA'),
    vel: fila(1296, 596, 'VELOCIDAD PROMEDIO'),
    err: fila(1296, 620, 'MÁS LEJOS (ESTA VUELTA)'),
    sal: fila(1296, 644, 'SE SALIÓ DE LA PISTA'),
  };

  // ------------------------------------------------------------ botones y barras
  const btn = {};
  const bt = (k, label, x, y, w, cls = '') => {
    btn[k] = add(`<div class="bt ${cls}" style="left:${x}px;top:${y}px;width:${w}px">${label}</div>`);
  };
  const SL = {};
  const slider = (k, x, y, w, min, max, step) => {
    add(`<div style="position:absolute;left:${x}px;top:${y - 2}px;width:${w}px;height:5px;border-radius:3px;background:${C.line}"></div>`);
    const fill = add(`<div style="position:absolute;left:${x}px;top:${y - 2}px;height:5px;border-radius:3px;background:${C.coral}"></div>`);
    const knob = add(`<div style="position:absolute;top:${y - 9}px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#fff;border:2px solid ${C.ink}"></div>`);
    const hit = add(`<div class="slh" style="left:${x - 10}px;top:${y - 13}px;width:${w + 20}px"></div>`);
    SL[k] = {x, y, w, min, max, step, fill, knob};
    const move = (e) => {
      const [sx] = toStage(e.clientX, e.clientY);
      const u = Math.min(1, Math.max(0, (sx - x) / w));
      const v = Math.round((min + u * (max - min)) / step) * step;
      api.onSlider?.(k, +v.toFixed(6));
    };
    hit.addEventListener('pointerdown', (e) => {
      api.onTouch?.();
      hit.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
  };
  const setSlider = (k, v) => {
    const s = SL[k];
    const u = (v - s.min) / (s.max - s.min);
    s.fill.style.width = `${s.w * u}px`;
    s.knob.style.left = `${s.x + s.w * u}px`;
  };

  // 05 control
  panel(28, 702, 520, 170, 'CONTROL', '05', C.coral);
  bt('arrancar', 'ARRANCAR', 42, 738, 150, 'man');
  bt('parar', 'PARAR', 200, 738, 150, 'man');
  bt('reiniciar', 'REINICIAR', 358, 738, 176);
  const lab = (x, y, t) => add(`<div class="sm" style="position:absolute;left:${x}px;top:${y - 5}px">${t}</div>`);
  const val = (x, y) => add(`<div class="mo" style="position:absolute;left:${x}px;top:${y - 8}px;font-size:12px;font-weight:600"></div>`);
  lab(42, 790, 'VELOCIDAD BASE');
  slider('base', 170, 790, 270, 0.3, 1, 0.05);
  const vBase = val(456, 790);
  lab(42, 820, 'KP (POR MM)');
  slider('kp', 170, 820, 270, 0, 0.08, 0.002);
  const vKp = val(456, 820);
  lab(42, 850, 'KD (S POR MM)');
  slider('kd', 170, 850, 270, 0, 0.004, 0.0001);
  const vKd = val(456, 850);

  // 06 sensores
  panel(560, 702, 300, 170, 'SENSORES', '06', C.teal);
  lab(574, 744, 'SEPARACIÓN ENTRE SENSORES');
  slider('sep', 574, 764, 196, 0.012, 0.04, 0.001);
  const vSep = val(786, 764);
  lab(574, 798, 'DELANTE DEL EJE DE RUEDAS');
  slider('ad', 574, 818, 196, 0.03, 0.12, 0.005);
  const vAd = val(786, 818);
  const sensNote = nota(574, 838, 272);

  // 07 batería
  // Fija en 11,1 V: la batería se prueba en P03 (Motores). Aquí solo se muestra, para enfocarse en el PD.
  panel(872, 702, 330, 170, 'BATERÍA · SOLO LECTURA', '07', C.amber);
  add(`<div class="dp" style="position:absolute;left:886px;top:734px;font-size:30px;font-weight:700;letter-spacing:-.5px;line-height:1">${f1(R.bat.nominal)} V</div>`);
  add(`<div class="sm" style="position:absolute;left:990px;top:738px;line-height:1.35">NOMINAL · FIJA<br>HEREDADA DE P03</div>`);
  add(`<div class="mo" style="position:absolute;left:1124px;top:740px;width:64px;padding:4px 0;border-radius:6px;text-align:center;font-size:11px;font-weight:700;letter-spacing:1px;background:${C.amber};color:${C.ink}">FIJA</div>`);
  const batNote = nota(886, 776, 302);

  // 08 vistas
  panel(1214, 702, 358, 170, 'VISTAS', '08', C.violet);
  VIEWS.forEach((k, i) => bt(k, VIEW_LABEL[k], 1228 + (i % 3) * 112, 738 + Math.floor(i / 3) * 36, 106));
  bt('etiquetas', 'ETIQUETAS', 1452, 774, 106);
  nota(1228, 822, 330, 'Arrastra para girar la cámara. La rueda del ratón acerca y aleja.');

  // ------------------------------------------------------------ etiquetas con línea guía
  const leaders = add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const LABELS = [
    ['sens', '4 × TCRT5000', 'miran el piso', [-150, 40]],
    ['rueda_izq', 'Motor Speed 200', 'con encoder', [40, -70]],
    ['esp', 'ESP32', 'corre el PD', [90, -90]],
    ['l298', 'L298N', 'el puente H', [-120, -80]],
    ['bat', 'Batería 3S', '', [-150, -40]],
  ];
  const calls = LABELS.map(([k, t, s]) => add(`<div class="call"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div>`));

  // ------------------------------------------------------------ dibujos
  const svgT = (x, y, t, o = '') => `<text x="${x}" y="${y}" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}" ${o}>${t}</text>`;
  const dibBarras = (lect, n) => {
    const H = 104;
    const y0 = 18;
    const um = R.adcPiso + R.umbral * (R.adcCinta - R.adcPiso);
    let s = '';
    s += `<path d="M0 ${y0 + H} H262" stroke="${C.ink}" stroke-width="1.2"/>`;
    const yU = y0 + H - (um / 4095) * H;
    s += `<path d="M0 ${yU} H262" stroke="${C.coral}" stroke-width="1" stroke-dasharray="3 3"/>`;
    s += `<path d="M196 6 H212" stroke="${C.coral}" stroke-width="1" stroke-dasharray="3 3"/>` + svgT(262, 9, 'UMBRAL', `text-anchor="end" fill="${C.coral}"`);
    lect.forEach((l, i) => {
      const x = 16 + i * 62;
      const h = (l.raw / 4095) * H;
      const on = n[i] > 0;
      s += `<rect x="${x}" y="${y0 + H - h}" width="40" height="${h}" rx="3" fill="${on ? C.teal : C.faint}"/>`;
      s += `<text x="${x + 20}" y="${y0 + H - h - 4}" text-anchor="middle" font-family="JetBrains Mono" font-size="9.5" font-weight="700" fill="${C.ink}">${l.raw}</text>`;
      s += `<text x="${x + 20}" y="${y0 + H + 13}" text-anchor="middle" font-family="JetBrains Mono" font-size="10" font-weight="700" fill="${C.ink}">S${i + 1}</text>`;
      s += `<text x="${x + 20}" y="${y0 + H + 24}" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="${C.mute}">${PINES_LINEA[i].replace('GPIO ', 'IO')}</text>`;
    });
    s += svgT(0, 9, 'LECTURA DEL ADC (0 A 4095)');
    return s;
  };
  const dibRegla = (sep, pos, real, perdida) => {
    // escala: ±70 mm en 262 px; la izquierda del robot va a la izquierda del dibujo
    const X = (mm) => 131 - (mm / 70) * 131;
    let s = `<path d="M0 22 H262" stroke="${C.line}" stroke-width="1"/>`;
    const w = ((CINTA * 1000) / 70) * 131;
    if (Math.abs(real) < 75) s += `<rect x="${X(real) - w / 2}" y="14" width="${w}" height="16" fill="#141518" opacity=".85" rx="1"/>`;
    [1.5, 0.5, -0.5, -1.5].forEach((k) => {
      const x = X(k * sep * 1000);
      s += `<rect x="${x - 4}" y="5" width="8" height="8" rx="2" fill="${C.teal}"/>`;
    });
    if (!perdida) s += `<path d="M${X(pos)} 32 l-5 -7 h10 z" fill="${C.violet}"/>`;
    s += `<path d="M131 0 V34" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 2" opacity=".5"/>`;
    return s;
  };
  const dibPwm = (izq, der) => {
    const bar = (y, v, t) => {
      const c = 148;
      const half = 78;
      let s = svgT(0, y + 10, t);
      s += `<rect x="${c - half}" y="${y}" width="${half * 2}" height="14" rx="3" fill="${C.line}"/>`;
      const w = Math.abs(v) * half;
      s += `<rect x="${v >= 0 ? c : c - w}" y="${y}" width="${w}" height="14" rx="3" fill="${v >= 0 ? C.violet : C.coral}"/>`;
      s += `<path d="M${c} ${y - 2} V${y + 16}" stroke="${C.ink}" stroke-width="1"/>`;
      s += `<text x="262" y="${y + 11}" text-anchor="end" font-family="JetBrains Mono" font-size="10" font-weight="700" fill="${C.ink}">${Math.round(v * 100)} %</text>`;
      return s;
    };
    return bar(4, izq, 'MOTOR IZQ.') + bar(30, der, 'MOTOR DER.') + svgT(70, 59, '← ATRÁS') + svgT(226, 59, 'ADELANTE →', 'text-anchor="end"');
  };
  let mapaBase = '';
  let mapaT = null;
  const prepMapa = (P) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < P.N; i++) {
      x0 = Math.min(x0, P.X[i]);
      x1 = Math.max(x1, P.X[i]);
      z0 = Math.min(z0, P.Z[i]);
      z1 = Math.max(z1, P.Z[i]);
    }
    const k = Math.min(246 / (x1 - x0), 134 / (z1 - z0));
    const ox = 131 - ((x0 + x1) / 2) * k;
    const oz = 75 - ((z0 + z1) / 2) * k;
    mapaT = (x, z) => [ox + x * k, oz + z * k];
    let d = '';
    for (let i = 0; i < P.N; i += 8) {
      const [x, y] = mapaT(P.X[i], P.Z[i]);
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    mapaBase = `<path d="${d}Z" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linejoin="round"/>`;
    const [sx, sy] = mapaT(P.X[0], P.Z[0]);
    mapaBase += `<path d="M${sx} ${sy - 9} V${sy + 9}" stroke="${C.coral}" stroke-width="3"/>` + svgT(sx + 4, sy + 20, 'SALIDA', `fill="${C.coral}" font-weight="700"`);
    pis.largo.textContent = `${f2(P.largo)} m`;
    pis.rmin.textContent = `radio ${Math.round(P.rmin * 100)} cm`;
  };
  const dibMapa = (eje, rastro) => {
    let s = mapaBase;
    if (rastro.length > 1) {
      let d = '';
      rastro.forEach((p, i) => {
        const [x, y] = mapaT(p[0], p[1]);
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      });
      s += `<path d="${d}" stroke="${C.teal}" stroke-width="1.6" fill="none" opacity=".9"/>`;
    }
    const [x, y] = mapaT(eje.x, eje.z);
    const hx = Math.sin(eje.th) * 12;
    const hy = Math.cos(eje.th) * 12;
    s += `<path d="M${x} ${y} L${x + hx} ${y + hy}" stroke="${C.coral}" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="5" fill="${C.coral}" stroke="#fff" stroke-width="1.5"/>`;
    return s;
  };
  const dibGraf = (hist) => {
    // hist: [{t, d}] d en mm; ventana 6 s; escala ±40 mm
    const H = 62;
    const Y = (mm) => H / 2 - (Math.max(-40, Math.min(40, mm)) / 40) * (H / 2 - 3);
    const w = ((CINTA * 1000) / 2 / 40) * (H / 2 - 3);
    let s = `<rect x="0" y="${H / 2 - w}" width="262" height="${w * 2}" fill="#141518" opacity=".1"/>`;
    s += `<path d="M0 ${H / 2} H262" stroke="${C.ink}" stroke-width="1" opacity=".5"/>`;
    s += svgT(0, 9, '+40 MM') + svgT(0, H - 2, '−40 MM') + svgT(262, H / 2 - 3, 'ANCHO DE LA CINTA', 'text-anchor="end"');
    if (hist.length > 1) {
      const t1 = hist[hist.length - 1].t;
      let d = '';
      hist.forEach((h, i) => {
        const x = 262 - ((t1 - h.t) / 6) * 262;
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${Y(h.d).toFixed(1)}`;
      });
      s += `<path d="${d}" stroke="${C.violet}" stroke-width="1.8" fill="none"/>`;
    }
    return s;
  };
  const dibMeta = (v) => {
    const ok = v >= R.meta[0] && v <= R.meta[1];
    return `<span style="color:${v == null ? C.ink : ok ? C.teal : C.coral}">${v == null ? 'aún no' : `${f2(v)} m/s`}</span>`;
  };

  // ------------------------------------------------------------ actualizar
  let cuadro = 0;
  const update = (s) => {
    cuadro++;
    const E = {
      sigue: ['SIGUE LA LÍNEA', C.teal],
      busca: ['BUSCA LA LÍNEA', C.amber],
      salio: ['SE SALIÓ', C.coral],
      parado: ['DETENIDO', C.ink],
    }[s.estado];
    estBig.textContent = E[0];
    estBig.style.color = E[1];
    estSub.textContent = `BATERÍA ${f1(s.vbat)} V · BASE ${Math.round(s.cfg.base * 100)} % · LAZO A ${R.hz} HZ`;
    velBig.textContent = f2(Math.abs(s.v));
    btn.arrancar.classList.toggle('on', s.corriendo);
    btn.parar.classList.toggle('on', !s.corriendo);
    for (const k of VIEWS) btn[k].classList.toggle('on', k === s.view);
    btn.etiquetas.classList.toggle('on', !!s.etiquetas);
    for (const k of ['base', 'kp', 'kd', 'sep', 'ad']) setSlider(k, k === 'sep' || k === 'ad' ? s[k] : s.cfg[k]);
    vBase.textContent = `${Math.round(s.cfg.base * 100)} %`;
    vKp.textContent = f3(s.cfg.kp);
    vKd.textContent = s.cfg.kd.toFixed(4).replace('.', ',');
    vSep.textContent = `${Math.round(s.sep * 1000)} mm`;
    vAd.textContent = `${Math.round(s.ad * 1000)} mm`;
    const hueco = s.sep * 1000 - CINTA * 1000;
    sensNote.innerHTML =
      hueco > 0 ? `<b style="color:${C.coral}">Hueco de ${Math.round(hueco)} mm</b> entre S2 y S3: la cinta (19 mm) puede quedar entre los dos y ninguno la ve.` : `La cinta (19 mm) siempre toca S2 o S3 cuando va centrada.`;
    batNote.innerHTML = `El motor recibe ${f1(s.vbat - R.drop)} V (el L298N pierde ${f1(R.drop)} V). <b style="color:${C.coral}">Ojo:</b> con ${f1(R.bat.baja)} V (batería baja) el robot va más lento: 0,36 m/s en esta pista. La batería se prueba en P03.`;

    // los ojos y el cerebro
    barras.innerHTML = dibBarras(s.lect, s.ctrl.n);
    regla.innerHTML = dibRegla(s.sep, s.ctrl.pos * 1000, s.real, s.ctrl.perdida);
    const mm = Math.round(s.ctrl.pos * 1000);
    reglaTxt.innerHTML = s.ctrl.perdida
      ? `<span style="color:${C.coral}">NINGÚN SENSOR LA VE · GIRA HACIA DONDE LA VIO</span>`
      : `<span style="color:${C.violet}">▲</span> ${mm === 0 ? 'CENTRADA' : `${Math.abs(mm)} MM A LA ${mm > 0 ? 'IZQUIERDA' : 'DERECHA'}`} <span style="color:${C.mute}">· REAL ${Math.abs(Math.round(s.real))} MM${Math.round(s.real) ? (s.real > 0 ? ' IZQ.' : ' DER.') : ''}</span>`;
    cer.e.textContent = `${f1(s.ctrl.e)} mm`;
    cer.p.textContent = `${s.ctrl.P >= 0 ? '+' : ''}${f2(s.ctrl.P)}`;
    cer.d.textContent = `${s.ctrl.D >= 0 ? '+' : ''}${f2(s.ctrl.D)}`;
    cer.c.innerHTML = `<span style="color:${C.violet}">${s.ctrl.corr >= 0 ? '+' : ''}${f2(s.ctrl.corr)}</span>`;
    pwmSvg.innerHTML = dibPwm(s.pwm.izq, s.pwm.der);

    // la pista y los resultados (cada 2 cuadros alcanza)
    if (cuadro % 2 === 0) {
      mapa.innerHTML = dibMapa(s.eje, s.rastro);
      graf.innerHTML = dibGraf(s.hist);
    }
    res.act.textContent = seg(s.vuelta.actual);
    res.ult.textContent = seg(s.vuelta.ultima);
    res.vel.innerHTML = dibMeta(s.vuelta.vel);
    res.err.textContent = `${Math.round(s.vuelta.errMax)} mm`;
    res.sal.innerHTML = `<span style="color:${s.salidas ? C.coral : C.ink}">${s.salidas}</span>`;

    // etiquetas
    let lines = '';
    LABELS.forEach(([k, , , [dx, dy]], i) => {
      const p = s.proj[k];
      const a = s.labels;
      const n = calls[i];
      if (!p || a < 0.02) {
        n.style.opacity = 0;
        return;
      }
      const x = Math.min(1250, Math.max(350, p[0] + dx));
      const y = Math.min(680, Math.max(140, p[1] + dy));
      n.style.opacity = a;
      n.style.left = `${x}px`;
      n.style.top = `${y}px`;
      lines += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${C.coral}" opacity="${a}"/><path d="M${p[0]} ${p[1]} L${x} ${y}" stroke="${C.ink}" stroke-width="1.2" opacity="${a * 0.8}"/>`;
    });
    leaders.innerHTML = lines;
  };

  const api = {root: ui, btn, update, prepMapa, onSlider: null, onTouch: null};
  return api;
}
