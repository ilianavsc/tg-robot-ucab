# Robot móvil de búsqueda y transporte para el laboratorio de Telecomunicaciones

Trabajo de Grado, Ingeniería en Telecomunicaciones, UCAB.

**Autoras:** Iliana Vanessa Semprun Cascitelli y Andrea Valentina Ferrer Pinto
**Tutor:** Ing. Biagio Domenico Cante Mata

## App web (Flutter) — lista para el jurado
👉 **https://ilianavsc.github.io/tg-robot-ucab/**

Trae **Modo Demo**: simula la telemetría del robot cada 2 s sin internet ni broker,
así la demostración no depende de la red del laboratorio.
Código en [`app/`](app/), desplegado automáticamente por GitHub Actions en cada push a `main`.

## Sitio del proyecto (portafolio)
👉 **https://ilianavsc.github.io/tg-robot-ucab/portafolio/**

Cada prototipo tiene una página visual que se entiende en 30 segundos, con sus pruebas y capturas.

## Resumen
Robot móvil de bajo costo que busca y transporta componentes electrónicos dentro del laboratorio, con una app para hacer pedidos y recibir alertas.
Control con ESP32, navegación por línea con fusión de sensores, comunicación MQTT y app en Flutter con Firebase.

## Fases (32 semanas, 26/10/2026 al 11/06/2027)

| Fase | Nombre | Fechas | Estado |
|---|---|---|---|
| I | Revisión y levantamiento | 26 oct al 20 nov 2026 | En curso |
| II | Diseño del sistema | 23 nov al 18 dic 2026 | Pendiente |
| III | Construcción y firmware | 21 dic 2026 al 5 feb 2027 | Pendiente |
| IV | Navegación progresiva | 8 feb al 12 mar 2027 | Pendiente |
| V | App y backend | 15 mar al 16 abr 2027 | Pendiente |
| VI | Integración y alertas | 19 abr al 7 may 2027 | Pendiente |
| VII | Pruebas y redacción final | 10 may al 11 jun 2027 | Pendiente |

La semana de parciales (11 al 16 ene 2027) es semana extra de trabajo de la Fase III.

## Prototipos

| Código | Nombre | Fase | Estado |
|---|---|---|---|
| P00 | Repositorio | I | En curso |
| P01 | MQTT base | I | Hecho |
| H0 | Wi-Fi del laboratorio | I | Pendiente |
| P02 | Sensores | II | Pendiente |
| P03 | PID de velocidad | II | Avances 1 y 2 adelantados |
| P04 | BLE o QR | II | Pendiente |
| P05 | Robot virtual y puente | III | Pendiente |
| P06 | App esqueleto | III | Pendiente |
| P07 | Firmware integrado | III | Código unificado compilado; falta probarlo en el hardware |
| P08 | Navegación en Webots | III | Pendiente |
| P09 | Kalman y re-localización | IV | Pendiente |
| P10 | App completa | V | Pendiente |
| P11 | Alerta antirrobo de punta a punta | V | Pendiente |
| P12 | Protocolo y estadística | VI | Pendiente |

## Carpetas
- `index.html` y las demás páginas de la raíz: el sitio (inicio, cronograma, prototipos, requerimientos, hardware, arquitectura, decisiones y bitácora)
- `datos/proyecto.js` **el único archivo que hay que editar para actualizar el sitio** (fases, prototipos, pendientes, decisiones, bitácora)
- `assets/` estilo y menú compartidos por todas las páginas
- `prototipos/` una carpeta por prototipo con su página visual (`index.html`), `codigo/` y `evidencias/`
- `docs/requerimientos/` borrador del documento de requerimientos (hito de la Fase I)
- `hardware/materiales/` lista de materiales y registro de cambios
- `firmware/` firmware integrado del robot (`robot_integrado.ino`, P01 + P03 + P08) y su README con las librerías y los pasos de carga

Las carpetas de la app, el puente MQTT a Firebase, el CAD y los esquemáticos se crean cuando tengan contenido.

## Reglas de trabajo
1. Cada tarea tiene una sola responsable.
2. Una rama por tarea (ejemplo: `p03-pid`).
3. Antes de empezar: Pull.
4. Al terminar: Pull Request y la otra revisa.
5. Commits así: `tipo: qué hiciste (#tarea)`. Tipos: feat, fix, docs, test, chore.
6. Nunca subir contraseñas ni llaves.
7. Cada prototipo termina con su página visual y su ficha llenas.
