# Menú de navegación · 5 grupos

**Estado:** implementado (commit `32e2128`). El menú pasó de 11 enlaces planos a
**5 grupos** (3 enlaces directos + 2 desplegables) con menú hamburguesa y acordeón
en móvil. Todo vive en `assets/sitio.js`; el CSS del hamburguesa está en `assets/css/style.css`.

## Estructura actual

| # | Grupo | Tipo | Destino / hijos |
|---|---|---|---|
| 1 | Inicio | enlace | `index.html` |
| 2 | El Proyecto | grupo | Cronograma · Requerimientos · Hardware · Arquitectura · Decisiones |
| 3 | Prototipos | enlace | `prototipos/index.html` |
| 4 | Avances | grupo | Centro de pruebas · Bitácora · Documentación (`index.html#t-explora`) |
| 5 | App Web | enlace (destacado) | `https://ilianavsc.github.io/tg-robot-ucab/app/` |

## Mapa de destinos (verificado, todos existen)

| Destino | Archivo | ¿Existe? |
|---|---|---|
| Inicio | `index.html` | ✅ |
| Cronograma | `cronograma.html` | ✅ |
| Requerimientos | `requerimientos.html` | ✅ |
| Hardware | `hardware.html` | ✅ |
| Arquitectura | `arquitectura.html` | ✅ |
| Decisiones | `decisiones.html` | ✅ |
| Prototipos | `prototipos/index.html` | ✅ |
| Centro de pruebas | `prototipos/centro-pruebas.html` | ✅ |
| Bitácora | `bitacora.html` | ✅ |
| Documentación | `index.html#t-explora` (ancla `id="t-explora"` ✅) | ✅ |
| App Web | URL absoluta de GitHub Pages | ✅ |

## Reglas de enlaces (verificadas)

1. Enlaces **absolutos** (`http(s)://`) no llevan el prefijo `base` → lo resuelve `urlDe()`.
2. Enlaces **relativos** usan `base + ruta`; `data-base` es consistente en todas las
   páginas (`""` en la raíz, `../` en `prototipos/`, `../../` y `../../../` en profundidad).
3. Los desplegables ("El Proyecto", "Avances") usan `hijos` con triplas `[clave, texto, url]`.
4. App Web se resalta con la clase `menu-app` (visible y destacada).

## Por qué se compactó

Reducir el ruido para el jurado: 5 opciones en lugar de 11, con los detalles
agrupados y el acceso a la app siempre visible.
