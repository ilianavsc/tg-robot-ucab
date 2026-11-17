# Prototipos

Cada prototipo tiene su propia carpeta y SIEMPRE la misma estructura:

```
P0X-nombre/
├── index.html    página visual: se entiende en 30 segundos
├── README.md     ficha técnica: todos los detalles
├── codigo/       código del simulador (sketch.ino, diagram.json, libraries.txt...)
└── evidencias/   capturas numeradas: 01-algo.png, 02-algo.png...
```

P = prototipo simulado. H = prueba con hardware real.

## Para crear uno nuevo
1. Copiar `plantilla-pagina.html` como `index.html` dentro de la carpeta nueva.
2. Copiar `plantilla-ficha.md` como `README.md`.
3. Agregarlo (o cambiar su estado) en `datos/proyecto.js`, en la lista `prototipos`. La portada, el cronograma y la lista de prototipos se actualizan solos.

## Reglas de la página visual
- Arriba: título simple y una frase que lo explique para alguien que no es ingeniero.
- Una comparación con algo de la vida diaria y un dibujo.
- Colores con un solo significado en todo el sitio: verde = sale del robot, coral = llega al robot, violeta = alarmas o conceptos, amarillo = avisos y pendientes.
- Lo técnico va al final, en "Para los curiosos".
- Sin contraseñas y sin capturas con datos personales (recortar el escritorio).

## Cómo recompilar los simuladores 3D (P01, P03, P08)
Cada `codigo/` tiene todo el fuente: `main.js` (entrada), los módulos, `style.css` y `paneles.js` (paneles plegables, solo interfaz).
1. Descarga el kit [teardown](https://github.com/elvarofficial/teardown) (licencia MIT).
2. Copia la carpeta `codigo/` del prototipo a una carpeta nueva, por ejemplo `mi-sim/`.
3. Desde la carpeta del kit: `node sims/build.mjs ../mi-sim`.
4. El resultado sale en `teardown-out/dist/mi-sim.html`: cópialo como `simulador.html`.

No edites `simulador.html` a mano: se pierde al recompilar. Cambia el fuente en `codigo/`.
