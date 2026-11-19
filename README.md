# Robot móvil de búsqueda y transporte para el laboratorio de Telecomunicaciones

Trabajo de Grado, Ingeniería en Telecomunicaciones, UCAB.

**Autoras:** Iliana Vanessa Semprun Cascitelli y Andrea Valentina Ferrer Pinto
**Tutor:** Ing. Biagio Domenico Cante Mata

## Sitio del proyecto (portafolio) — la cara principal
👉 **https://ilianavsc.github.io/tg-robot-ucab/**

Cada prototipo tiene una página visual que se entiende en 30 segundos, con sus pruebas y capturas.

## App web (Flutter) — lista para el jurado
👉 **https://ilianavsc.github.io/tg-robot-ucab/app/**

Trae **Modo Demo**: simula la telemetría del robot cada 2 s sin internet ni broker,
así la demostración no depende de la red del laboratorio.
Código en [`app/`](app/), desplegado automáticamente por GitHub Actions en cada push a `main`.

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

## Prototipos (nomenclatura oficial P01 a P13)

La lista oficial vive en [`datos/proyecto.js`](datos/proyecto.js) (`TG.prototipos`); esta tabla la copia.

| Código | Nombre | Tema | Estado |
|---|---|---|---|
| P01 | Así se hablan el robot y la app | MQTT | Hecho |
| P02 | Los sentidos del robot | Sensores (4× TCRT5000 + 2× HC-SR04P) | En pruebas (simulación) |
| P03 | Motores que van parejo | PID / encoders | En pruebas (simulación) |
| P04 | ¿BLE o QR? | Ubicación | Pendiente |
| P05 | Robot virtual y puente | Firebase | Pendiente |
| P06 | Primera versión de la app | Flutter | Pendiente |
| P07 | El cerebro completo | Firmware integrado (`firmware/`) | En pruebas (lógica validada en PC) |
| P08 | Seguir la línea | Simulador 3D | En pruebas (simulación) |
| **P09** | **Interfaz Web / Modo Demo** | **App Flutter** (`app/`) | Hecho |
| **P10** | **Simulador ESP32 Virtual** | **ESP32 en el navegador** (`prototipos/P10-simulador-esp32/`) | Hecho |
| P11 | La alarma llega al teléfono | Centro de Alertas en la app | En pruebas (validado en simulación, falta hardware) |
| P12 | Pruebas y estadística | Analítica de sesión + CSV en la app | En pruebas (validado en simulación, falta hardware) |
| P13 | Radar Ultrasónico (Frente/Atrás) | 2× HC-SR04P | En pruebas (simulación) |

**No confundir P09 con P10:** P09 es la **app** (Flutter Web, lo que usa el operador);
P10 es el **robot falso** (una página que se comporta como el ESP32 y publica por MQTT).
Juntos forman el Gemelo Digital. H0 (Wi-Fi del laboratorio) es una prueba de hardware,
no un prototipo numerado.

## Gemelo Digital: probar todo sin el robot (5 min)

1. Abre el **ESP32 virtual (P10)**: `prototipos/P10-simulador-esp32/index.html`
   (en el sitio: <https://ilianavsc.github.io/tg-robot-ucab/prototipos/P10-simulador-esp32/>)
   y pulsa **Encender ESP32 Virtual**. Anota el broker al que se conectó (HiveMQ, EMQX o Mosquitto).
2. Abre la **App (P09)**: <https://ilianavsc.github.io/tg-robot-ucab/app/>, elige **el mismo broker**
   en el selector segmentado y pulsa **Conectar**.
3. En la App verás estado, ultrasonidos, **Centro de Alertas (P11)** y **Analítica de Sesión (P12)**.
4. En el P10 usa el panel **Inyección de Eventos Virtuales (SIL)** (obstáculo 14 cm, bloqueo total,
   fallo de sensor sin eco, batería 10,05 V, corte por batería 9,85 V, restaurar). El P10 aplica la **misma regla de seguridad
   que el firmware** y la App muestra el banner rojo/ámbar.
5. En la App pulsa **Exportar Reporte CSV**. Sin internet: botón **Modo Demo** de la App (7 perfiles,
   misma regla de seguridad).

Para correr la app en local: `cd app && flutter pub get && flutter run -d chrome`.

**SIL vs. HIL (rigor de las pruebas):** todo lo anterior es **SIL** (*Software In the
Loop*): el firmware se emula (P10, Modo Demo) o se compila en el PC con imitaciones del
hardware (`firmware/pruebas_pc/`). Las pruebas **HIL** (*Hardware In the Loop*) empiezan
cuando llegue el hardware: ESP32 real, sensores reales y la app; sus mediciones se anotan
en [`prototipos/P02-sensores/README.md`](prototipos/P02-sensores/README.md).

**Verificación automática (CI):** cada push a `main` corre, antes de publicar, las 5 suites
verdes: `flutter analyze` (0 issues), `flutter test` (116/116), `node specs/navegacion/teach_and_repeat.test.js`
(13/13), `node prototipos/P10-simulador-esp32/p10_hibrido_modelo.test.js` (10/10) y
`node prototipos/simulador-2-v2-teach-and-repeat/simulador_movimiento.test.js` (22/22). El firmware
además se compila en el PC (`sh firmware/pruebas_pc/correr.sh`, escenarios T1–T10 en SIL) en GitHub
Actions; si algo falla, no se despliega.
Contratos JSON de todos los tópicos: [`docs/arquitectura/topicos-mqtt.md`](docs/arquitectura/topicos-mqtt.md).

## Carpetas
- `index.html` y las demás páginas de la raíz: el sitio (inicio, cronograma, prototipos, requerimientos, hardware, arquitectura, decisiones y bitácora)
- `datos/proyecto.js` **el único archivo que hay que editar para actualizar el sitio** (fases, prototipos, pendientes, decisiones, bitácora)
- `assets/` estilo y menú compartidos por todas las páginas
- `prototipos/` una carpeta por prototipo con su página visual (`index.html`), `codigo/` y `evidencias/`
- `app/` la App Flutter Web (P09, con P11 y P12 dentro); se publica sola en `/app/` con cada push a `main`
- `firmware/` firmware integrado del robot (`robot_integrado.ino`, P01 + P03 + P08 + ultrasonidos), su README y `pruebas_pc/` (10 escenarios SIL T1-T10 de seguridad que corren en el PC y en GitHub Actions)
- `docs/` requerimientos, arquitectura (tópicos MQTT), guías de pruebas y del jurado
- `tesis/` capítulos del Trabajo de Grado en Markdown (`capitulo_1.md`, `capitulo_2.md` y `marco_teorico.md` vienen de los Word y usan citas IEEE; `capitulo_3.md` es el borrador del Marco Metodológico; imágenes en `tesis/media/`); `tesis.html` los lista y los abre en el visor modal (la lista sale de `TG.tesis` en `datos/proyecto.js`)
- `hardware/materiales/` lista de materiales y registro de cambios
- `specs/` fuente única de verdad de la pista (`pista_canonica.json`, 9,0 m) y núcleo de navegación teach-and-repeat (`navegacion/teach_and_repeat.js`, 5 estados) con su test harness

El puente MQTT a Firebase (P05), el CAD y los esquemáticos se agregan cuando tengan contenido.

## Reglas de trabajo
1. Cada tarea tiene una sola responsable.
2. Una rama por tarea (ejemplo: `p03-pid`).
3. Antes de empezar: Pull.
4. Al terminar: Pull Request y la otra revisa.
5. Commits así: `tipo: qué hiciste (#tarea)`. Tipos: feat, fix, docs, test, chore.
6. Nunca subir contraseñas ni llaves.
7. Cada prototipo termina con su página visual y su ficha llenas.
