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
3. Agregar el prototipo a la portada (`index.html` de la raíz).

## Reglas de la página visual
- Arriba: título simple y una frase que lo explique para alguien que no es ingeniero.
- Una comparación con algo de la vida diaria y un dibujo.
- Colores con un solo significado en todo el sitio: verde = sale del robot, coral = llega al robot, violeta = alarmas o conceptos, amarillo = avisos y pendientes.
- Lo técnico va al final, en "Para los curiosos".
- Sin contraseñas y sin capturas con datos personales (recortar el escritorio).
