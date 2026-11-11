# Robot móvil de búsqueda y transporte para el laboratorio de Telecomunicaciones

Trabajo de Grado, Ingeniería en Telecomunicaciones, UCAB.

**Autoras:** Iliana Vanessa Semprun Cascitelli y Andrea Valentina Ferrer Pinto
**Tutor:** Ing. Biagio Domenico Cante Mata

## Sitio del proyecto
👉 **https://ilianavsc.github.io/tg-robot-ucab/**

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

Pausa por exámenes: 11 al 16 ene 2027 (no se cuenta como semana).

## Prototipos

| Código | Nombre | Fase | Estado |
|---|---|---|---|
| P00 | Repositorio | I | En curso |
| P01 | MQTT base | I | En pruebas |
| H0 | Wi-Fi del laboratorio | I | Pendiente |
| P02 | Sensores | II | Pendiente |
| P03 | PID de velocidad | II | Pendiente |
| P04 | BLE o QR | II | Pendiente |
| P05 | Robot virtual y puente | III | Pendiente |
| P06 | App esqueleto | III | Pendiente |
| P07 | Firmware integrado | III | Pendiente |
| P08 | Navegación en Webots | III | Pendiente |
| P09 | Kalman y re-localización | IV | Pendiente |
| P10 | App completa | V | Pendiente |
| P11 | Alerta antirrobo de punta a punta | V | Pendiente |
| P12 | Protocolo y estadística | VI | Pendiente |

## Carpetas
- `docs/` cronograma, requerimientos, arquitectura, bitácora y tomo
- `index.html` inicio del sitio (semana actual, próximo hito, pendientes)
- `cronograma.html` línea de tiempo de las 7 fases
- `assets/` estilo y menú compartidos por todas las páginas
- `datos/proyecto.js` **el único archivo que hay que editar para actualizar el sitio** (fases, prototipos, pendientes, bitácora)
- `prototipos/` una carpeta por prototipo con su página visual (`index.html`), su ficha (`README.md`), `codigo/` y `evidencias/`
- `firmware/` código final del ESP32
- `puente/` script MQTT a Firebase
- `app/` proyecto Flutter
- `hardware/` CAD, esquemáticos y lista de materiales
- `pruebas/` protocolos, datos y análisis

## Reglas de trabajo
1. Cada tarea tiene una sola responsable.
2. Una rama por tarea (ejemplo: `p03-pid`).
3. Antes de empezar: Pull.
4. Al terminar: Pull Request y la otra revisa.
5. Commits así: `tipo: qué hiciste (#tarea)`. Tipos: feat, fix, docs, test, chore.
6. Nunca subir contraseñas ni llaves.
7. Cada prototipo termina con su página visual y su ficha llenas.
