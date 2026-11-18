# Migración del menú · 11 enlaces → 5 grupos

**Estado:** auditoría de enlaces **aprobada**. El menú todavía tiene 11 entradas en
`assets/sitio.js`; este documento fija el plan para compactarlo a 5 grupos **sin
romper enlaces**, con las rutas ya verificadas.

## 1. Menú actual (verificado, todos los destinos existen)

| # | Etiqueta | Destino | ¿Existe? |
|---|---|---|---|
| 1 | Inicio | `index.html` | ✅ |
| 2 | Cronograma | `cronograma.html` | ✅ |
| 3 | Prototipos | `prototipos/index.html` | ✅ |
| 4 | Centro de pruebas | `prototipos/centro-pruebas.html` | ✅ |
| 5 | Requerimientos | `requerimientos.html` | ✅ |
| 6 | Hardware | `hardware.html` | ✅ |
| 7 | Arquitectura | `arquitectura.html` | ✅ |
| 8 | Decisiones | `decisiones.html` | ✅ |
| 9 | Bitácora | `bitacora.html` | ✅ |
| 10 | Documentación | `index.html#t-explora` (ancla `id="t-explora"` ✅) | ✅ |
| 11 | App web | `https://ilianavsc.github.io/tg-robot-ucab/app/` | ✅ |

## 2. Propuesta de 5 grupos

| Grupo | Destino | Qué absorbe |
|---|---|---|
| **Inicio** | `index.html` | — |
| **Prototipos** | `prototipos/index.html` | catálogo + `centro-pruebas.html` (se enlaza desde dentro) |
| **Documentación** | `index.html#t-explora` | requerimientos, hardware, arquitectura, decisiones, bitácora (ya están como tarjetas en esa sección) |
| **Cronograma** | `cronograma.html` | — |
| **App web** | `https://ilianavsc.github.io/tg-robot-ucab/app/` | — |

> Las páginas individuales (`requerimientos.html`, etc.) no desaparecen: quedan
> accesibles desde las tarjetas de "Explora la Documentación" en `index.html`.

## 3. Reglas que garantizan que no se rompan enlaces

1. **Enlaces absolutos** (`http(s)://`) no llevan prefijo `base` → `urlDe()` en
   `sitio.js` ya lo resuelve. La App web es un enlace absoluto, así que funciona
   igual en producción y en `file://` (hay un fallback que redirige `app/` a GitHub).
2. **Enlaces relativos** del menú se construyen con `base + ruta`. `data-base` está
   verificado y es consistente: `""` en la raíz, `../` en `prototipos/`, `../../`
   en las carpetas de cada prototipo y `../../../` en sus simuladores.
3. **Anclas** (`#t-explora`) apuntan a un `id` que existe en `index.html`.

## 4. Cómo aplicar el cambio (sin tocar CSS)

En `assets/sitio.js`, reemplazar el array `secciones` (11 entradas) por el de 5
grupos de la tabla anterior. Nada más cambia: el generador de `<li>` y el
`aria-current` siguen igual. Si al implementarlo se quiere mantener "Centro de
pruebas" visible, añadirlo como tarjeta en `prototipos/index.html`.
