// La consola, en 1600 x 900: encabezado, el cerebro (ESP32), el puente H (L298N), el músculo (motor), el aviso
// (encoder), y abajo las maniobras, las piezas, las vistas y lo que se ve. update(s) redibuja todo desde el estado.
import {R, PINES} from './model.js';

export const C = {ink: '#14213D', mute: '#4A5A73', faint: '#c9d7d2', line: '#d9e3df', panel: 'rgba(255,255,255,.93)', coral: '#F2603D', teal: '#0F9D84', violet: '#6B4EE6', amber: '#F2B33D', papel: '#EEF3F1'};
export const MAN = ['avanzar', 'izquierda', 'derecha', 'retroceder', 'frenar'];
export const MAN_LABEL = {avanzar: 'AVANZAR', izquierda: 'IZQUIERDA', derecha: 'DERECHA', retroceder: 'RETROCEDER', frenar: 'FRENAR'};
export const VIEWS = ['heroe', 'frente', 'arriba', 'motor', 'puente'];
export const VIEW_LABEL = {heroe: 'HÉROE', frente: 'FRENTE', arriba: 'ARRIBA', motor: 'MOTOR', puente: 'PUENTE H'};
export const DISPLAY = ['etiquetas', 'rayos', 'despiece', 'cables', 'girar'];
export const DISPLAY_LABEL = {etiquetas: 'ETIQUETAS', rayos: 'RAYOS X', despiece: 'DESPIECE', cables: 'CABLES', girar: 'GIRAR'};

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
.bt{position:absolute;height:26px;padding:0 10px;display:flex;align-items:center;justify-content:center;border:1.5px solid ${C.ink};border-radius:7px;background:#fff;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;transition:background .15s,color .15s}
.bt.on{background:${C.ink};color:#fff}
.bt.man.on{background:${C.coral};border-color:${C.coral};color:#fff}
.lamp{position:absolute;width:44px;height:20px;border-radius:5px;border:1.5px solid ${C.ink};font:700 9px 'JetBrains Mono',monospace;display:flex;align-items:center;justify-content:center;letter-spacing:.5px}
.call{position:absolute;white-space:nowrap;transform:translate(-50%,-100%);padding:4px 8px 5px;background:rgba(255,255,255,.92);border:1.5px solid ${C.ink};border-radius:7px}
.call b{display:block;font:700 13px 'Bricolage Grotesque',sans-serif;color:${C.ink};line-height:1.1}
.call span{display:block;font:600 9px 'JetBrains Mono',monospace;letter-spacing:.8px;color:${C.mute};margin-top:1px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;border:2px solid ${C.coral};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const f1 = (x) => x.toFixed(1).replace('.', ',');
const f2 = (x) => x.toFixed(2).replace('.', ',');
const miles = (n) => Math.round(n).toLocaleString('es-VE');

export function createConsole(app) {
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
  const spots = {};
  const panel = (x, y, w, h, title, n, c) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px;--c:${c}"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 14}px">${n}</div>`);
  };
  const hr = (x, y, w) => add(`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:1px;background:${C.line}"></div>`);

  // ------------------------------------------------------------ encabezado
  add(`<div style="position:absolute;left:0;top:0;width:118px;height:92px;background:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:30px;top:30px;width:22px;height:22px;border-radius:6px;background:${C.teal};box-shadow:7px 7px 0 ${C.coral}"></div>`);
  add(`<div class="dp" style="position:absolute;left:66px;top:28px;color:#fff;font-size:22px;font-weight:700">TG</div>`);
  add(`<div class="sm" style="position:absolute;left:142px;top:18px;letter-spacing:2.2px">TRABAJO DE GRADO · ROBOT UCAB · P03 AVANCE 2</div>`);
  add(`<div class="dp" style="position:absolute;left:141px;top:32px;font-size:34px;font-weight:700;letter-spacing:-.6px;line-height:1">Cómo se mueve el robot <span style="color:${C.coral}">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:142px;top:72px;font-size:11px;letter-spacing:1.8px;color:${C.mute}">ESP32 + L298N + 2 MOTORES JGA25-370 CON ENCODER · RUEDAS DE 65 MM</div>`);
  const manBig = add(`<div class="dp" style="position:absolute;right:300px;top:26px;font-size:30px;font-weight:700;letter-spacing:-.4px;color:${C.coral};text-align:right"></div>`);
  const manSub = add(`<div class="sm" style="position:absolute;right:300px;top:64px;text-align:right"></div>`);
  add(`<div style="position:absolute;left:1316px;top:24px;width:1.5px;height:50px;background:${C.faint}"></div>`);
  const velBig = add(`<div class="dp" style="position:absolute;left:1334px;top:20px;font-size:40px;font-weight:700;letter-spacing:-1px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:1336px;top:64px">METROS POR SEGUNDO</div>`);

  // ------------------------------------------------------------ 01 el cerebro
  panel(28, 112, 290, 310, 'EL CEREBRO · ESP32', '01', C.violet);
  add(`<div style="position:absolute;left:42px;top:140px;width:262px;font-size:12.5px;line-height:1.4;color:${C.mute}">Decide. Por cada motor manda el sentido (IN) y la fuerza (PWM).</div>`);
  const cerebro = {};
  ['izq', 'der'].forEach((lado, i) => {
    const y = 186 + i * 116;
    hr(42, y - 8, 262);
    add(`<div class="dp" style="position:absolute;left:42px;top:${y}px;font-size:15px;font-weight:700">${lado === 'izq' ? 'Motor izquierdo' : 'Motor derecho'}</div>`);
    const duty = add(`<div class="mo" style="position:absolute;right:${1600 - 304}px;top:${y + 1}px;font-size:12px;font-weight:600"></div>`);
    const [la, lb] = lado === 'izq' ? ['IN1', 'IN2'] : ['IN3', 'IN4'];
    const lampA = add(`<div class="lamp" style="left:42px;top:${y + 26}px">${la}</div>`);
    const lampB = add(`<div class="lamp" style="left:92px;top:${y + 26}px">${lb}</div>`);
    const sentido = add(`<div class="sm" style="position:absolute;left:146px;top:${y + 31}px"></div>`);
    const pwm = add(`<svg style="position:absolute;left:42px;top:${y + 50}px" width="262" height="34"></svg>`);
    add(`<div class="mo" style="position:absolute;left:42px;top:${y + 86}px;font-size:8.6px;color:${C.mute};letter-spacing:.4px">${PINES[lado].en} · ${PINES[lado].a.split(' · ')[1]} · ${PINES[lado].b.split(' · ')[1]} (propuesta)</div>`);
    cerebro[lado] = {duty, lampA, lampB, sentido, pwm};
  });

  // ------------------------------------------------------------ 02 el puente H
  panel(28, 436, 290, 246, 'EL PUENTE H · DRIVER', '02', C.coral);
  const hTitle = add(`<div class="sm" style="position:absolute;left:42px;top:462px"></div>`);
  const hSvg = add(`<svg style="position:absolute;left:42px;top:480px" width="262" height="136"></svg>`);
  const hTxt = add(`<div style="position:absolute;left:42px;top:620px;width:262px;font-size:12px;line-height:1.35"></div>`);

  // ------------------------------------------------------------ 03 el músculo
  panel(1282, 112, 290, 310, 'EL MÚSCULO · MOTOR', '03', C.coral);
  const filas = {};
  const filaDef = [
    ['volt', 'AL MOTOR LE LLEGAN'],
    ['rpmM', 'EL MOTOR GIRA (ADENTRO)'],
    ['caja', 'LA CAJA REDUCE'],
    ['rpmR', 'LA RUEDA GIRA'],
    ['amp', 'CORRIENTE (APROX.)'],
  ];
  filaDef.forEach(([k, n], i) => {
    const y = 144 + i * 27;
    add(`<div class="sm" style="position:absolute;left:1296px;top:${y + 3}px">${n}</div>`);
    filas[k] = add(`<div class="mo" style="position:absolute;right:${1600 - 1558}px;top:${y}px;font-size:12.5px;font-weight:600"></div>`);
  });
  hr(1296, 284, 262);
  add(`<div class="sm" style="position:absolute;left:1296px;top:296px">VELOCIDAD MÁXIMA VS META RNF-03</div>`);
  const meta = add(`<svg style="position:absolute;left:1296px;top:314px" width="262" height="58"></svg>`);
  const motNote = add(`<div style="position:absolute;left:1296px;top:378px;width:262px;font-size:11.5px;line-height:1.3;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ 04 el aviso
  panel(1282, 436, 290, 246, 'EL AVISO · ENCODER', '04', C.teal);
  add(`<div style="position:absolute;left:1296px;top:462px;width:262px;font-size:12px;line-height:1.35;color:${C.mute}">Un imán de 22 polos gira con el motor. Dos sensores Hall dan las señales A y B.</div>`);
  const scope = add(`<svg style="position:absolute;left:1296px;top:500px" width="262" height="74"></svg>`);
  add(`<div class="sm" style="position:absolute;left:1296px;top:577px">OSCILOSCOPIO · 10 MS · MOTOR IZQ.</div>`);
  hr(1296, 594, 262);
  const enc = {};
  [['hz', 'PULSOS POR SEGUNDO'], ['vuelta', 'POR VUELTA DE RUEDA'], ['cuenta', 'CUENTA IZQ / DER']].forEach(([k, n], i) => {
    const y = 602 + i * 24;
    add(`<div class="sm" style="position:absolute;left:1296px;top:${y + 3}px">${n}</div>`);
    enc[k] = add(`<div class="mo" style="position:absolute;right:${1600 - 1558}px;top:${y}px;font-size:12px;font-weight:600"></div>`);
  });

  // ------------------------------------------------------------ abajo: maniobra, piezas, vistas, ver
  const btn = {};
  const bt = (k, label, x, y, w, cls = '') => {
    btn[k] = add(`<div class="bt ${cls}" style="left:${x}px;top:${y}px;width:${w}px">${label}</div>`);
    spots[k] = [x + w / 2, y + 13];
  };
  panel(28, 702, 520, 170, 'MANIOBRA', '05', C.coral);
  MAN.forEach((k, i) => bt(k, MAN_LABEL[k], 42 + i * 99, 738, 92, 'man'));
  add(`<div class="sm" style="position:absolute;left:42px;top:790px">FUERZA (PWM)</div>`);
  const SL = {x: 150, w: 300, y: 795};
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y - 2}px;width:${SL.w}px;height:5px;border-radius:3px;background:${C.line}"></div>`);
  const slFill = add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y - 2}px;height:5px;border-radius:3px;background:${C.coral}"></div>`);
  const slKnob = add(`<div style="position:absolute;top:${SL.y - 9}px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#fff;border:2px solid ${C.ink}"></div>`);
  const slVal = add(`<div class="mo" style="position:absolute;left:468px;top:787px;font-size:12px;font-weight:600"></div>`);
  spots.slider = [SL.x + SL.w * 0.5, SL.y];
  add(`<div style="position:absolute;left:42px;top:822px;width:490px;font-size:12px;line-height:1.35;color:${C.mute}">PWM: el ESP32 prende y apaga el motor ${miles(R.pwmHz)} veces por segundo. Más tiempo prendido = más fuerza.</div>`);

  panel(560, 702, 300, 170, 'PIEZAS', '06', C.amber);
  add(`<div class="sm" style="position:absolute;left:574px;top:742px">DRIVER</div>`);
  bt('l298n', 'L298N', 660, 735, 84);
  bt('tb6612', 'TB6612FNG', 750, 735, 96);
  add(`<div class="sm" style="position:absolute;left:574px;top:784px">MOTOR</div>`);
  bt('m130', '130 RPM', 660, 777, 84);
  bt('m170', '170 RPM', 750, 777, 96);
  const piezasNote = add(`<div style="position:absolute;left:574px;top:816px;width:272px;font-size:12px;line-height:1.35;color:${C.mute}"></div>`);

  panel(872, 702, 330, 170, 'VISTAS', '07', C.violet);
  VIEWS.forEach((k, i) => bt(k, VIEW_LABEL[k], 886 + (i % 3) * 102, 738 + Math.floor(i / 3) * 36, 96));
  add(`<div style="position:absolute;left:886px;top:822px;width:302px;font-size:12px;line-height:1.35;color:${C.mute}">Arrastra para girar la cámara. La rueda del ratón acerca y aleja.</div>`);

  panel(1214, 702, 358, 170, 'VER', '08', C.teal);
  DISPLAY.forEach((k, i) => bt(k, DISPLAY_LABEL[k], 1228 + (i % 3) * 112, 738 + Math.floor(i / 3) * 36, 106));
  const verNote = add(`<div style="position:absolute;left:1228px;top:822px;width:330px;font-size:12px;line-height:1.35;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ etiquetas con línea guía
  const leaders = add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const LABELS = [
    ['rueda_izq', 'Rueda', 'Ø 65 mm', [40, -70]],
    ['caja_izq', 'Caja reductora', '', [70, 60]],
    ['lata_izq', 'Motor 370', '6000 rpm adentro', [-10, 92]],
    ['enc_izq', 'Encoder', '11 pulsos por vuelta', [-120, 70]],
    ['l298', 'Driver', '', [-120, -80]],
    ['esp', 'ESP32', 'el cerebro', [90, -90]],
    ['bat', 'Batería 3S', '11,1 V', [-150, -40]],
    ['lm', 'LM2596', 'baja a 5 V', [120, 30]],
    ['loca', 'Rueda loca', 'apoyo trasero', [-130, 40]],
  ];
  const calls = LABELS.map(([k, t, s]) => add(`<div class="call"><b>${t}</b><span>${s}</span></div>`));

  // ------------------------------------------------------------ cursor del recorrido
  const cur = add(`<svg class="cur" width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17 15 Z" fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  const ring = add(`<div class="ring"></div>`);

  // ------------------------------------------------------------ dibujos
  const pwmPath = (duty, on) => {
    if (!on || duty <= 0) return `<path d="M0 31 H262" stroke="${C.faint}" stroke-width="2" fill="none"/>`;
    const per = 37.4;
    let d = 'M0 31';
    for (let x = 0; x < 262; x += per) {
      const hi = Math.min(x + per * duty, 262);
      d += ` V13 H${hi.toFixed(1)} V31 H${Math.min(x + per, 262).toFixed(1)}`;
    }
    return `<path d="${d}" stroke="${C.violet}" stroke-width="2" fill="none" stroke-linejoin="round"/><text x="262" y="8" text-anchor="end" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}">${Math.round(duty * 100)} % PRENDIDO</text>`;
  };
  const hBridge = (inA, inB, duty, driver) => {
    // interruptores: S1 arriba izq, S2 arriba der, S3 abajo izq, S4 abajo der
    const on = inA && !inB ? [1, 0, 0, 1] : !inA && inB ? [0, 1, 1, 0] : [0, 0, 1, 1];
    const flujo = inA !== inB && duty > 0;
    const sw = (x, y, k, n) => {
      const c = on[k] ? (flujo ? C.coral : C.ink) : C.faint;
      return `<g><rect x="${x - 16}" y="${y - 12}" width="32" height="24" rx="5" fill="${on[k] ? c : '#fff'}" stroke="${on[k] ? c : C.faint}" stroke-width="1.5"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="10" fill="${on[k] ? '#fff' : C.mute}">${n}</text></g>`;
    };
    const L = 44;
    const Rr = 218;
    const T = 12;
    const B = 126;
    const top = 40;
    const bot = 98;
    const mid = 69;
    let s = '';
    s += `<text x="131" y="9" text-anchor="middle" font-family="JetBrains Mono" font-size="9" font-weight="700" fill="${C.ink}">+ ${f1(R.vbat)} V BATERÍA</text>`;
    s += `<path d="M${L} ${T + 4} H${Rr} M${L} ${B} H${Rr}" stroke="${C.ink}" stroke-width="1.5"/>`;
    s += `<text x="131" y="${B + 10}" text-anchor="middle" font-family="JetBrains Mono" font-size="9" font-weight="700" fill="${C.mute}">GND</text>`;
    s += `<path d="M${L} ${T + 4} V${top - 12} M${L} ${top + 12} V${bot - 12} M${L} ${bot + 12} V${B}" stroke="${C.ink}" stroke-width="1.5"/>`;
    s += `<path d="M${Rr} ${T + 4} V${top - 12} M${Rr} ${top + 12} V${bot - 12} M${Rr} ${bot + 12} V${B}" stroke="${C.ink}" stroke-width="1.5"/>`;
    s += `<path d="M${L} ${mid} H${131 - 22} M${131 + 22} ${mid} H${Rr}" stroke="${C.ink}" stroke-width="1.5"/>`;
    if (flujo) {
      const pts = inA ? `M${L} ${T + 4} V${mid} H${Rr} V${B}` : `M${Rr} ${T + 4} V${mid} H${L} V${B}`;
      s += `<path d="${pts}" stroke="${C.coral}" stroke-width="4" fill="none" stroke-dasharray="7 6" opacity=".9"><animate attributeName="stroke-dashoffset" from="26" to="0" dur="${(0.9 - 0.6 * duty).toFixed(2)}s" repeatCount="indefinite"/></path>`;
    }
    s += `<circle cx="131" cy="${mid}" r="21" fill="#fff" stroke="${flujo ? C.coral : C.ink}" stroke-width="2"/><text x="131" y="${mid + 5}" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="15" fill="${C.ink}">M</text>`;
    s += sw(L, top, 0, 'S1') + sw(Rr, top, 1, 'S2') + sw(L, bot, 2, 'S3') + sw(Rr, bot, 3, 'S4');
    s += `<text x="${L - 20}" y="${mid + 4}" text-anchor="end" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}">OUT1</text><text x="${Rr + 20}" y="${mid + 4}" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}">OUT2</text>`;
    return s;
  };
  const scopePath = (phase, hz) => {
    // A y B sobre 10 ms: cada píxel es un instante; phase en ciclos (cámara lenta)
    const win = 0.01;
    const sig = (off, y0) => {
      let d = '';
      let prev = null;
      for (let x = 0; x <= 262; x += 1) {
        const c = phase - hz * win * (1 - x / 262) - off;
        const hi = ((c % 1) + 1) % 1 < 0.5;
        const y = hi ? y0 : y0 + 22;
        if (prev === null) d += `M${x} ${y}`;
        else if (y !== prev) d += ` H${x} V${y}`;
        prev = y;
      }
      return d + ' H262';
    };
    if (hz < 0.5) return `<path d="M0 26 H262 M0 66 H262" stroke="${C.faint}" stroke-width="2"/><text x="0" y="10" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}">A</text><text x="0" y="50" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}">B</text>`;
    return `<path d="${sig(0, 4)}" stroke="${C.teal}" stroke-width="2" fill="none"/><path d="${sig(0.25, 44)}" stroke="${C.teal}" stroke-width="2" fill="none" opacity=".6"/><text x="252" y="20" text-anchor="end" font-family="JetBrains Mono" font-size="8.5" font-weight="700" fill="${C.teal}">A</text><text x="252" y="60" text-anchor="end" font-family="JetBrains Mono" font-size="8.5" font-weight="700" fill="${C.teal}">B</text>`;
  };
  const metaBar = (vel) => {
    const W = 262;
    const X = (v) => (Math.min(v, 0.7) / 0.7) * W;
    let s = `<rect x="${X(R.meta[0])}" y="2" width="${X(R.meta[1]) - X(R.meta[0])}" height="30" fill="${C.violet}" opacity=".13" rx="3"/>`;
    s += `<path d="M${X(R.meta[0])} 2 V32 M${X(R.meta[1])} 2 V32" stroke="${C.violet}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    s += `<rect x="0" y="11" width="${Math.max(0, X(Math.abs(vel)))}" height="12" rx="3" fill="${Math.abs(vel) >= R.meta[0] - 0.005 ? C.teal : C.coral}"/>`;
    s += `<path d="M0 38 H${W}" stroke="${C.ink}" stroke-width="1.2"/>`;
    [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach((v) => {
      s += `<text x="${Math.min(W - 6, Math.max(6, X(v)))}" y="52" text-anchor="middle" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}">${String(v).replace('.', ',')}</text>`;
    });
    return s;
  };

  const lastH = {key: ''};
  const lastP = {izq: '', der: ''};
  // s: ver live.js
  const update = (s) => {
    const man = s.man;
    manBig.textContent = s.nombre;
    manSub.textContent = s.w !== 0 && Math.abs(s.w) > 0.05 ? `GIRA ${Math.round((Math.abs(s.w) * 180) / Math.PI)}° POR SEGUNDO` : Math.abs(s.v) > 0.005 ? 'EN LÍNEA RECTA' : 'QUIETO';
    velBig.textContent = f2(Math.abs(s.v));
    for (const k of MAN) btn[k].classList.toggle('on', k === man);
    for (const k of VIEWS) btn[k].classList.toggle('on', k === s.view);
    for (const k of DISPLAY) btn[k].classList.toggle('on', !!s.display[k]);
    btn.l298n.classList.toggle('on', s.driver === 'l298n');
    btn.tb6612.classList.toggle('on', s.driver === 'tb6612');
    btn.m130.classList.toggle('on', s.variante === 130);
    btn.m170.classList.toggle('on', s.variante === 170);
    // slider
    slFill.style.width = `${300 * s.duty}px`;
    slKnob.style.left = `${150 + 300 * s.duty}px`;
    slVal.textContent = `${Math.round(s.duty * 100)} %`;
    spots.slider = [150 + 300 * s.duty, 795];

    for (const lado of ['izq', 'der']) {
      const m = s[lado];
      const c = cerebro[lado];
      const on = m.dir !== 0;
      c.duty.textContent = on ? `PWM ${Math.round(s.duty * 255)}/255` : 'PWM 0/255';
      const [a, b] = m.in;
      c.lampA.style.background = a ? C.violet : '#fff';
      c.lampA.style.color = a ? '#fff' : C.mute;
      c.lampB.style.background = b ? C.violet : '#fff';
      c.lampB.style.color = b ? '#fff' : C.mute;
      c.lampA.textContent = `${c.lampA.textContent.slice(0, 3)}=${a}`;
      c.lampB.textContent = `${c.lampB.textContent.slice(0, 3)}=${b}`;
      c.sentido.textContent = m.dir > 0 ? '→ HACIA ADELANTE' : m.dir < 0 ? '← HACIA ATRÁS' : '■ FRENA';
      const pk = `${on}${s.duty.toFixed(2)}`;
      if (pk !== lastP[lado]) {
        c.pwm.innerHTML = pwmPath(s.duty, on);
        lastP[lado] = pk;
      }
    }
    // puente H del motor izquierdo
    const L = s.izq;
    const dName = s.driver === 'l298n' ? 'L298N' : 'TB6612FNG';
    const hk = `${L.in}${s.duty.toFixed(2)}${s.driver}`;
    if (hk !== lastH.key) {
      hSvg.innerHTML = hBridge(L.in[0], L.in[1], s.duty, s.driver);
      lastH.key = hk;
      hTitle.textContent = `${dName} · MOTOR IZQUIERDO`;
      hTxt.innerHTML =
        L.dir > 0
          ? `<b>S1 y S4 cerrados.</b> La corriente cruza el motor de izquierda a derecha: avanza.`
          : L.dir < 0
          ? `<b>S2 y S3 cerrados.</b> La corriente cruza al revés: retrocede.`
          : `<b>S3 y S4 cerrados.</b> El motor queda en corto a tierra y frena rápido.`;
    }
    // motor
    const mm = s.izq.m;
    const vDisp = mm.vDisp;
    filas.volt.innerHTML = `${f1(Math.abs(mm.v))} V <span style="color:${C.mute};font-weight:400">de ${f1(vDisp)}</span>`;
    filas.rpmM.textContent = `${miles(Math.abs(s.izq.rpm) * mm.ratio)} rpm`;
    filas.caja.textContent = `1 : ${mm.ratio}`;
    filas.rpmR.textContent = `${miles(Math.abs(s.izq.rpm))} rpm`;
    filas.amp.textContent = `≈ ${f2(mm.corriente)} A`;
    meta.innerHTML = metaBar(s.vMax);
    const ok = s.vMax >= R.meta[0] - 0.005;
    motNote.innerHTML =
      s.duty < 0.999
        ? `Con ${Math.round(s.duty * 100)} % de PWM. Sube a 100 % para ver el máximo.`
        : ok
        ? `<b style="color:${C.teal}">Llega a la meta.</b> El driver pierde ${f1(R.drop[s.driver])} V.`
        : `<b style="color:${C.coral}">No llega a la meta.</b> El driver pierde ${f1(R.drop[s.driver])} V.`;
    // encoder
    scope.innerHTML = scopePath(s.scope, s.izq.hz);
    enc.hz.textContent = `${miles(s.izq.hz)} Hz`;
    enc.vuelta.textContent = `${s.porVuelta} × 4 = ${miles(s.porVuelta * 4)}`;
    enc.cuenta.textContent = `${miles(s.izq.cuenta)} / ${miles(s.der.cuenta)}`;
    // notas
    piezasNote.innerHTML = s.driver === 'l298n' ? `L298N: barato y aguanta 2 A, pero se come ${f1(R.drop.l298n)} V.` : `TB6612FNG: pierde solo ${f1(R.drop.tb6612)} V, pero aguanta 1,2 A por motor.`;
    verNote.textContent = s.display.rayos ? 'Rayos X: imanes, bobinas, engranes y el imán del encoder.' : s.display.despiece ? 'Despiece: cada pieza se separa por su eje.' : 'Prende RAYOS X para ver adentro del motor.';
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
    // cursor
    const cu = s.cursor;
    cur.style.transform = `translate(${cu.x - 2}px, ${cu.y - 2}px) scale(${cu.press ? 0.88 : 1})`;
    cur.style.opacity = cu.x < 0 ? 0 : 1;
    ring.style.left = `${cu.ringX}px`;
    ring.style.top = `${cu.ringY}px`;
    ring.style.opacity = cu.ring;
    ring.style.transform = `scale(${1.6 - 0.6 * cu.ring})`;
  };

  return {root: ui, btn, spots, update, SL};
}
