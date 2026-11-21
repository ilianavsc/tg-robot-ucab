// Arranque seguro del 3D: mensaje de "Cargando", aviso si el navegador no puede con WebGL
// y aviso si se pierde el contexto 3D. Sin three.js aquí.
const CSS = `
.sim-aviso{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:50;font-family:'Atkinson Hyperlegible',system-ui,sans-serif}
.sim-aviso>div{pointer-events:auto;max-width:440px;margin:20px;background:#fff;border:2px solid #14213D;border-radius:16px;box-shadow:5px 5px 0 #14213D;padding:18px 22px;color:#14213D;font-size:17px;line-height:1.4;text-align:center}
.sim-aviso b{display:block;font-size:20px;margin-bottom:4px}
.sim-aviso button{margin-top:12px;font:700 16px 'Atkinson Hyperlegible',system-ui,sans-serif;background:#0F9D84;color:#fff;border:0;border-radius:10px;padding:9px 18px;cursor:pointer}
.sim-aviso.error>div{border-color:#F2603D;box-shadow:5px 5px 0 #F2603D}
.sim-aviso i{display:inline-block;width:14px;height:14px;border-radius:50%;background:#0F9D84;margin-right:8px;animation:simlat 1s ease-in-out infinite alternate}
@keyframes simlat{from{opacity:.25}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.sim-aviso i{animation:none}}`;

export function crearAviso() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const caja = document.createElement('div');
  caja.className = 'sim-aviso';
  caja.setAttribute('role', 'status');
  document.body.appendChild(caja);
  const poner = (html, error) => {
    caja.className = 'sim-aviso' + (error ? ' error' : '');
    caja.innerHTML = `<div>${html}</div>`;
    caja.style.display = 'flex';
    const b = caja.querySelector('button');
    if (b) b.onclick = () => location.reload();
  };
  let fatal = false;
  return {
    cargando: () => !fatal && poner('<i></i>Cargando simulación 3D…'),
    listo: () => {
      if (!fatal) caja.style.display = 'none';
    },
    // error que no se arregla solo: queda en pantalla con el botón de recargar
    error: (titulo, texto) => {
      fatal = true;
      poner(`<b>${titulo}</b>${texto}<br><button>Recargar la página</button>`, true);
    },
  };
}

// Avisa si el navegador suelta el contexto 3D (pasa cuando la tarjeta gráfica se satura o hay muchas pestañas 3D).
export function vigilarContexto(canvas, aviso) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    aviso.error('Se perdió el 3D', 'El navegador soltó la tarjeta gráfica. Cierra otras pestañas con 3D o video y recarga.');
  });
}

export const SIN_WEBGL = ['Tu navegador no pudo iniciar el 3D', 'Prueba con Chrome o Edge actualizados, y revisa que la "aceleración por hardware" esté activada en la configuración del navegador.'];
