// Paneles plegables: solo interfaz (no toca la escena 3D).
// Los paneles arrancan cerrados (+ abre, − cierra) para que se vea el modelo 3D completo.
// - instalarPanelesEscenario(ui): P03 y P08, paneles dibujados sobre el lienzo de 1600 × 900.
// - instalarPanelesP01(): P01, paneles HTML normales.
// El recorrido automático usa tour(x, y): abre el panel donde va a hacer clic y cierra el que abrió antes.

const CSS = `
/* --- modo escenario (P03, P08): paneles dibujados sobre el lienzo 1600 × 900 --- */
.pl-m{transition:opacity .2s var(--eo,cubic-bezier(.23,1,.32,1)),visibility .2s,background .15s ease-out,color .15s ease-out}
.pl-cp,.pl-cab{transition:top .25s cubic-bezier(.23,1,.32,1),height .25s cubic-bezier(.23,1,.32,1)}
.pl-oculto{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
.pl-bar{position:absolute;z-index:3;pointer-events:auto;cursor:pointer;background:transparent;border:0;margin:0;padding:0 46px 0 0;display:flex;align-items:center;justify-content:flex-end;font:700 17px 'JetBrains Mono',monospace;line-height:1;color:#0F9D84;border-radius:12px;transition:top .25s cubic-bezier(.23,1,.32,1),transform .16s cubic-bezier(.23,1,.32,1)}
.pl-bar:active{transform:scale(.97)}
.pl-bar:focus-visible,.pl-todo:focus-visible,.pl-tg:focus-visible{outline:2.5px solid #6B4EE6;outline-offset:2px}
.pl-todo{position:absolute;left:470px;top:104px;height:26px;padding:0 13px;border:1.5px solid #14213D;border-radius:999px;background:rgba(255,255,255,.92);color:#14213D;font:700 9.5px 'JetBrains Mono',monospace;letter-spacing:1.2px;cursor:pointer;pointer-events:auto;white-space:nowrap}
@media (hover:hover) and (pointer:fine){.pl-todo:hover{background:#14213D;color:#fff}}
.pl-todo:active{background:#14213D;color:#fff;transform:scale(.97)}
/* --- modo P01: paneles HTML normales --- */
.pl-tg{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:0;padding:0;margin:0;cursor:pointer;font:700 15px 'Bricolage Grotesque',sans-serif;color:#14213D;text-transform:uppercase;letter-spacing:.05em;text-align:left}
.pl-tg{transition:transform .16s cubic-bezier(.23,1,.32,1)}
.pl-tg:active{transform:scale(.99)}
.pl-tg small{font:600 11px 'JetBrains Mono',monospace;color:#5b6b7a;letter-spacing:.06em;text-transform:none}
.pl-tg::after{content:'+';font:700 18px 'JetBrains Mono',monospace;line-height:1;color:#0F9D84}
.pl-abierto>.pl-tg::after,.pl-abierto>.cons-cab>.pl-tg::after{content:'−'}
.pl-hd{display:flex;align-items:center;gap:8px}
.pl-hd>.pl-tg{flex:1;width:auto;min-height:30px}
.pl-hd>.pl-tg::after{content:none}
.pl-sig{flex:none;width:30px;height:30px;border-radius:8px;border:1.5px solid #14213D;background:#fff;cursor:pointer;padding:0;font:700 18px 'JetBrains Mono',monospace;line-height:1;color:#0F9D84}
.pl-sig::before{content:'+'}
.pl-abierto .pl-sig::before{content:'−'}
.pl-sig:focus-visible{outline:2.5px solid #6B4EE6;outline-offset:2px}
.pl-cuerpo{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .25s cubic-bezier(.23,1,.32,1),opacity .2s ease-out}
.pl-abierto>.pl-cuerpo{grid-template-rows:1fr;opacity:1}
.pl-in{overflow:hidden;min-height:0}
.pl-abierto>.pl-cuerpo>.pl-in{padding-top:8px}
.panel.pl-p,.leyenda.pl-p{backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);background:rgba(255,255,255,.9)}
.consola.pl-p{transition:height .25s cubic-bezier(.23,1,.32,1)}
.consola.pl-p:not(.pl-abierto){height:auto!important;min-height:38px}
.consola.pl-p:not(.pl-abierto) #log{flex:none;max-height:78px;overflow:hidden} /* cerrada solo muestra las últimas líneas: con la telemetría constante el log crece sin parar */
.consola .pl-tg{width:auto;color:#e8eef5;font-size:13.5px}
.consola .pl-tg::after{color:#9fb0c4}
.consola .pl-tg small{color:#9fb0c4}
.consola.pl-p>.cons-cab>b,.consola.pl-p>.cons-cab>span{display:none}
@media (prefers-reduced-motion:reduce){.pl-m,.pl-cp,.pl-cab,.pl-bar,.pl-cuerpo,.consola.pl-p{transition:none!important}}
`;

let cssPuesto = false;
const ponerCss = () => {
  if (cssPuesto) return;
  cssPuesto = true;
  const s = document.createElement('style');
  s.id = 'pl-css';
  s.textContent = CSS;
  document.head.appendChild(s);
};
const avisar = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 280);
const px = (v) => (v === '' || v == null ? NaN : parseFloat(v));

export function instalarPanelesEscenario(ui, {W = 1600, H = 900} = {}) {
  ponerCss();
  const EXCLUIR = /\b(call|cur|ring|tourchip|turn|pl-bar|pl-todo)\b/;
  const paneles = [...ui.querySelectorAll(':scope > .cp')].map((cp) => {
    const r = {x: px(cp.style.left), y: px(cp.style.top), w: px(cp.style.width), h: px(cp.style.height)};
    return {cp, r, abajo: r.y > H / 2, miembros: [], ph: null, pn: null, abierto: true, delTour: false};
  });
  const dentro = (r, x, y) => x >= r.x - 1 && x < r.x + r.w && y >= r.y - 1 && y < r.y + r.h;
  for (const n of ui.children) {
    if (n.classList.contains('cp') || EXCLUIR.test(n.getAttribute('class') || '')) continue;
    let x = px(n.style.left);
    const y = px(n.style.top);
    if (isNaN(x) && !isNaN(px(n.style.right))) x = W - px(n.style.right) - 12; // los números de panel van por la derecha
    if (isNaN(x) || isNaN(y)) continue;
    const p = paneles.find((q) => dentro(q.r, x, y));
    if (!p) continue;
    if (n.classList.contains('ph')) p.ph = n;
    else if (n.classList.contains('pn')) p.pn = n;
    else {
      n.classList.add('pl-m');
      p.miembros.push(n);
    }
  }
  const BAR = 40;
  const CAB = 30;
  const todo = document.createElement('button');
  todo.type = 'button';
  todo.className = 'pl-todo';
  const poner = (p, abierto) => {
    p.abierto = abierto;
    const {r} = p;
    const y0 = abierto || !p.abajo ? r.y : r.y + r.h - BAR;
    p.cp.style.top = `${y0}px`;
    p.cp.style.height = `${abierto ? r.h : BAR}px`;
    for (const e of [p.ph, p.pn]) if (e) e.style.top = `${y0 + Number(e.dataset.top)}px`;
    p.bar.style.top = `${y0}px`;
    p.bar.style.height = `${abierto ? CAB : BAR}px`;
    p.bar.textContent = abierto ? '−' : '+';
    p.bar.setAttribute('aria-expanded', abierto);
    p.bar.setAttribute('aria-label', `${abierto ? 'Cerrar' : 'Abrir'} el panel ${p.titulo}`);
    for (const m of p.miembros) m.classList.toggle('pl-oculto', !abierto);
    todo.textContent = paneles.some((q) => q.abierto) ? 'CERRAR PANELES' : 'ABRIR PANELES';
  };
  for (const p of paneles) {
    p.cp.classList.add('pl-cp');
    for (const e of [p.ph, p.pn])
      if (e) {
        e.classList.add('pl-cab');
        e.dataset.top = px(e.style.top) - p.r.y;
      }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pl-bar';
    Object.assign(b.style, {left: `${p.r.x}px`, width: `${p.r.w}px`});
    p.titulo = p.ph ? p.ph.textContent.trim() : 'panel';
    b.addEventListener('click', () => {
      p.delTour = false; // si la persona lo toca, ya es suyo
      poner(p, !p.abierto);
      avisar();
    });
    ui.appendChild(b);
    p.bar = b;
  }
  todo.addEventListener('click', () => {
    const abrir = !paneles.some((q) => q.abierto);
    for (const p of paneles) {
      p.delTour = false;
      poner(p, abrir);
    }
    avisar();
  });
  ui.appendChild(todo);
  for (const p of paneles) poner(p, false); // cerrados al empezar
  avisar();

  return {
    // El recorrido va a hacer clic en (x, y): abre ese panel si está cerrado y cierra el que abrió antes.
    tour(x, y) {
      const p = paneles.find((q) => dentro(q.r, x, y));
      for (const q of paneles)
        if (q.delTour && q !== p) {
          q.delTour = false;
          poner(q, false);
        }
      if (p && !p.abierto) {
        p.delTour = true;
        poner(p, true);
      }
    },
    tourEl(el) {
      if (el) this.tour(px(el.style.left) + 2, px(el.style.top) + 2);
    },
    // La persona tomó el control: los paneles que abrió el recorrido se quedan abiertos y pasan a ser suyos.
    soltarTour() {
      for (const p of paneles) p.delTour = false;
    },
  };
}

function plegable(caja, titulo, sub) {
  // Los elementos con data-pl-cab suben a la cabecera, entre el título y el botón +/− (por ejemplo "0.5×").
  const extras = [...caja.querySelectorAll(':scope > [data-pl-cab]')];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pl-tg';
  b.innerHTML = `${titulo}${sub ? ` <small>${sub}</small>` : ''}`;
  let cab = b;
  let sig = null;
  if (extras.length) {
    cab = document.createElement('div');
    cab.className = 'pl-hd';
    sig = document.createElement('button');
    sig.type = 'button';
    sig.className = 'pl-sig';
    sig.setAttribute('aria-label', `Abrir o cerrar ${titulo.toLowerCase()}`);
    cab.append(b, ...extras, sig);
  }
  const cuerpo = document.createElement('div');
  cuerpo.className = 'pl-cuerpo';
  const adentro = document.createElement('div');
  adentro.className = 'pl-in';
  while (caja.firstChild) adentro.appendChild(caja.firstChild); // se mueven los mismos nodos: los botones siguen funcionando
  cuerpo.appendChild(adentro);
  caja.append(cab, cuerpo);
  caja.classList.add('pl-p');
  const poner = (a) => {
    caja.classList.toggle('pl-abierto', a);
    for (const x of [b, sig]) x?.setAttribute('aria-expanded', a);
    adentro.inert = !a;
  };
  const alternar = () => {
    poner(!caja.classList.contains('pl-abierto'));
    avisar();
  };
  b.addEventListener('click', alternar);
  sig?.addEventListener('click', alternar);
  poner(false);
}

export function instalarPanelesP01() {
  ponerCss();
  const panel = document.querySelector('#app > .panel');
  const ley = document.querySelector('#app > .leyenda');
  const cons = document.querySelector('#app > .consola');
  if (panel) plegable(panel, 'Controles', '');
  if (ley && ley.children.length) plegable(ley, 'Buzones', '5 tópicos');
  if (cons) {
    const cab = cons.querySelector('.cons-cab');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pl-tg';
    b.innerHTML = 'Consola <small>lo que ve el broker</small>';
    cab.insertBefore(b, cab.firstChild);
    cons.classList.add('pl-p');
    const poner = (a) => {
      cons.classList.toggle('pl-abierto', a);
      b.setAttribute('aria-expanded', a);
    };
    b.addEventListener('click', () => {
      poner(!cons.classList.contains('pl-abierto'));
      avisar();
    });
    poner(false);
  }
  avisar();
}
