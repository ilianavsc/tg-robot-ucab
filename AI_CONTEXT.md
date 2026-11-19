# AI_CONTEXT · Memoria del Proyecto TG Robot UCAB

> **Proyecto:** Robot móvil autónomo para búsqueda y transporte de componentes de laboratorio  
> **Institución:** Universidad Católica Andrés Bello (UCAB) · Telecomunicaciones  
> **Autoras:** Iliana Semprun y Andrea Ferrer · **Tutor:** Ing. Biagio Cante  
> **Repositorio:** `https://github.com/ilianavsc/tg-robot-ucab` (rama `main`)  
> **Ruta Local:** `C:\Users\ivsc\10112026\tg-robot-ucab`

---

## 0. Estado más reciente (19 nov 2026)

- **Fase:** Fase I cierra el 20 nov (documento de requerimientos y matriz de hardware v2). Cronograma de 32 semanas: 26/10/2026 a 11/06/2027.
- **Prototipos (nomenclatura oficial P01–P13, fuente: `datos/proyecto.js`):** hechos P01, P09 y P10; en pruebas (validados en simulación/SIL, falta hardware) P02, P03, P07, P08, P11, P12 y P13; pendientes P04, P05 y P06. La portada calcula la barra desde `TG.prototipos` (cuenta "hecho" + "pruebas").
- **P09 ≠ P10:** P09 = App Flutter Web (lo que usa el operador). P10 = ESP32 virtual en el navegador (el robot falso). P11 (Centro de Alertas) y P12 (Analítica + CSV) viven dentro de la App P09.
- **Diseño de la app (19 nov):** la app P09 usa el sistema "Autonomous Laboratory Cockpit" (`app/DESIGN.md`, de Google Stitch): tema oscuro, Inter + JetBrains Mono incrustadas, 4 secciones (Dashboard, Controles, Radar, Alertas) con barra inferior y botón Freno Remoto (envía `frenar`; no sustituye el interruptor físico). Solo cambió la capa visual; la lógica de `lib/core/` es la misma.
- **Mapa de Pista y Modo Demo físico (19 nov):** el Dashboard abre con el Mapa de Pista (`app/lib/features/telemetria/mapa_pista.dart`): circuito cerrado con las estaciones **Cuarto de Componentes** (inicio), **Punto de Control** (intermedio) y **Laboratorio 1** (destino), robot con flecha y cono del HC-SR04P frontal (verde > 50 cm, ámbar 20–50 cm, rojo < 20 cm), misión, destinos y Pausar/Reanudar (`frenar` / `auto`). Borrado progresivo: el tramo ya recorrido se atenúa a una línea punteada tenue y solo el tramo pendiente queda iluminado (`#00F2FE`). En Modo Demo todo sale de `core/demo/simulacion_pista.dart` (marcha ≈ 0,40 m/s con lazo PD de línea, batería 3S lineal 12,60 → 9,90 V, ciclo de obstáculo continuo con parada < 20 cm, órdenes que actúan al instante); la reducción gradual de velocidad en 20–50 cm es del demo, el firmware solo avisa. Con el robot real NO se dibuja posición ni se ofrecen destinos (no hay localización absoluta, ni LiDAR, ni brújula).
- **Acceso, RBAC local y perfiles (19 nov, Stitch v2):** la app abre en un Login con autenticación **local sin backend** (`app/lib/features/auth/`): `usuario` / `usuario` (Operador) y `admin` / `admin` (Administrador), documentadas en la propia pantalla, o el botón Modo Demo (Offline). No hay registro público (modelo cerrado de laboratorio): solo un Administrador crea y elimina Operadores desde Perfil → Gestión de Usuarios (`features/perfil/gestion_usuarios.dart`, `RegistroUsuarios` en memoria; las cuentas nuevas pueden iniciar sesión mientras la app siga abierta y se pierden al cerrarla; las contraseñas están en memoria en texto plano porque es una demostración). El botón de Perfil del `AppBar` abre `features/perfil/`: el Operador ve su sesión y el enlace MQTT real (`--` si no hay dato); el Administrador añade los parámetros Fail-Safe (solo lectura: parada < 20 cm, precaución 20–50 cm) y la exportación del CSV real de P12. No se muestran misiones ni distancia recorrida porque el robot no las mide. Cerrar Sesión vuelve al Login (y detiene el Modo Demo si estaba activo).
- **Simulador 2 V2 · gemelo digital de movimiento (SIL):** `prototipos/simulador-2-v2-teach-and-repeat/`. Carga tal cual `specs/pista_canonica.json` (9,0 m) y `specs/navegacion/teach_and_repeat.js` (la máquina de estados no se reescribe: la página y `simulador_movimiento.js` solo modelan el mundo y llaman a `nucleo.paso`). Cinta con retiro progresivo en vivo (clic en la pista o botón), ghost line del tramo recorrido, fase de enseñanza (graba los huecos de cinta), control automático/manual, obstáculos < 20 cm y 20–50 cm, deriva del giroscopio, empujón de rumbo, Freno Remoto y telemetría lógica (4× TCRT5000, MPU-6050 relativo, 2× HC-SR04P, RSSI BLE solo en los 2 extremos). 22 pruebas en Node (también en CI). Supuestos de planta [PENDIENTE DE MEDICIÓN FÍSICA]; MPU-6050 y BLE [PENDIENTE DE INTEGRACIÓN EN FIRMWARE].
- **Freno Remoto (19 nov):** el botón siempre visible de la app (antes «E-STOP») se llama **Freno Remoto** y envía `frenar` por MQTT (QoS 1). **No es una parada de emergencia cableada** y no sustituye el interruptor físico del robot.
- **Arquitectura 1 ESP32 móvil + 2 ESP32 fijos (19 nov):** el robot es un solo ESP32; dos ESP32 fijos (Cuarto de Componentes y Laboratorio 1) serán **balizas BLE de proximidad** (*anchors*). En tramos sin cinta (`TCRT5000 = [0,0,0,0]`) el robot mantendría el rumbo **relativo** con el giroscopio de la MPU-6050 (*heading hold*, sin magnetómetro) hasta que la baliza del siguiente punto confirme proximidad por RSSI. Solo existe en simulación: el escaneo BLE y la lectura de la MPU-6050 están **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]** (`docs/arquitectura/balizas-ble.md`).
- **Aprendizaje de Ruta (solo Admin) y P10 híbrido (19 nov):** el Perfil del Administrador abre una pasada virtual con puntos de control (*landmarks*), la ruta guardada (que el Operador ve en su mapa) y la vista previa de la **reducción progresiva de cinta** (`app/lib/features/perfil/`). El P10 trae el panel «Simulación Híbrida (SIL)»: tramo sin cinta, heading hold simulado y RSSI BLE de −80 a −52 dBm hacia las 2 balizas (`p10_hibrido_modelo.js`, 10 pruebas en Node, también en CI). Todo SIL, en memoria; no se envían rutas al robot.
- **Pinout (19 nov):** el TRIG del HC-SR04P trasero se separó a **GPIO 15** (frente GPIO 23; ECO frente 33, ECO atrás 5).
- **SIL vs HIL, estado real (19 nov):** hoy todo es **SIL** (P10, Modo Demo, 116 pruebas de la app, 10 de P10, 13 de `specs/navegacion`, 22 del Simulador 2 V2). **HIL no se ha hecho**: llega con el hardware en diciembre. Login/RBAC es una **maqueta local** (memoria, sin backend de producción ni Firebase). Al salir del Modo Demo la app **no reconecta** el MQTT: hay que pulsar Conectar.
- **Navegación teach-and-repeat (19 nov):** `specs/pista_canonica.json` es la fuente única de verdad de la pista (9,0 m, tramos, 3 puntos de control, 2 balizas BLE solo en extremos). `specs/navegacion/teach_and_repeat.js` implementa la máquina de estados determinista de 5 estados (`FOLLOW_LINE`, `LINE_LOST_CHECK`, `HEADING_HOLD`, `WAIT_BEACON`, `REACQUIRE_LINE`) con fail-safe frontal (< 20 cm / 20–50 cm), portable 1:1 a C++; test harness en Node (13/13). Estando en `HEADING_HOLD`, un RSSI ≥ −80 dBm de la baliza del extremo final pasa directo a `WAIT_BEACON` sin `REACQUIRE_LINE` (solo tras salir del inicio; la deriva excesiva manda primero). El timeout de 4 s sin línea **no se amplía** (límite ante la deriva del MPU-6050): un hueco de > ~4,5 m lejos de un extremo termina en `timeout_sin_linea`.
- **Tesis (19 nov):** citas **unificadas en IEEE** en los 3 capítulos y el Marco teórico. RF-05 corregido a «se detiene con el frente a < 20 cm». Autonomía: **estimada** (≈ 3 h), no medida. RNF-04: los 4,1 s son del banco P01 con broker público (SIL) y no representan al sistema real. Cada dato sin medición lleva **[PENDIENTE DE MEDICIÓN FÍSICA]**. Ver `docs/tomo/auditoria-tesis-vs-sistema.md`.
- **P09 (App Flutter Web):** `app/`, desplegada por GitHub Actions (`deploy_web.yml`) en `https://ilianavsc.github.io/tg-robot-ucab/app/`. Botones Adelante, Atrás, Izquierda, Derecha, Frenar y Auto; cada uno publica en `ordenes` (QoS 1) y espera el ACK. Muestra la latencia de cada confirmación. Tiene Modo Demo (ACK simulado a 300 ms). Lista de brokers de respaldo: HiveMQ, EMQX, Mosquitto.
- **P10 (ESP32 Virtual en el navegador):** `prototipos/P10-simulador-esp32/`. Publica `estado` cada 2 s, `ultrasonido` y `alertas` (QoS 2), recibe `ordenes`, responde en `ordenes/ack` y entiende `adelante, atras, izquierda, derecha, frenar, auto`. Aplica la misma regla de seguridad que el firmware. Panel "Inyección de Eventos Virtuales (SIL)". No envía testamento LWT al detenerse.
- **SIL vs. HIL:** todo lo validado hasta ahora es SIL (Software In the Loop: P10, Modo Demo, `firmware/pruebas_pc/`). HIL (Hardware In the Loop) = ESP32 y sensores reales, desde diciembre; plantilla de mediciones en `prototipos/P02-sensores/README.md`.
- **Contrato de órdenes y ACK:**
  - Orden: `{"id":"<uuid>","cmd":"<comando>"}` (un pedido sin `cmd` solo se confirma).
  - ACK: `{"id":"...","recibidas":N,"t":millis}`; el firmware real y el P10 usan el mismo formato.
- **Firmware C++ · pruebas SIL (10 escenarios T1-T10):** `firmware/pruebas_pc/` compila `firmware/robot_integrado.ino` con g++ (`-Wall -Wextra -Werror`) e imitaciones del core ESP32, y prueba órdenes/ACK, duplicados QoS 1, obstáculos, fallo de eco, timeout manual, corte por batería y lectura alternada. Corre en GitHub Actions antes de cada despliegue. **No** está compilado con el core ESP32 del Arduino IDE ni probado en un ESP32 real.
- **Web:** insignia "Firmware C++ · pruebas SIL" en `index.html`; interfaz pulida (ease-out, hover solo con puntero, paneles colapsables, animaciones en la app Flutter). `prototipos/centro-pruebas.html` guía al jurado en 3 pasos.
- **Documentos para las pruebas:** `docs/guia_pruebas_lab.md` (bloques A, B, C y D), `docs/centro_de_pruebas.md` (flujo físico con ESP32 y app) y `docs/guion_defensa.md` (demostración en 5 pasos, con el radar P13 interactivo).
- **Hardware:** pedido de Amazon hecho el 16 nov (motores, 3 ESP32, BMS, ultrasónicos), llega a Miami entre el 15 y el 28 dic. Pendiente: cargador 12,6 V (buscar el de casa) y compras en Mercado Libre.
- **Pendientes:** compilar el `.ino` en el Arduino IDE, prueba H0 de Wi-Fi en el laboratorio, pista real del P08 con medidas del laboratorio, mover la prueba física de P03 a enero si el pedido tarda, WPA2-Enterprise de la red UCAB (el firmware usa Wi-Fi simple), broker de producción sin decidir, la app no tiene tests unitarios.

---

## 1. Arquitectura de Prototipos de Ingeniería

El proyecto descompone el desarrollo del robot en prototipos medibles y modulares antes de la integración física:

- **P01 (MQTT & Telemetría):**
  - **Función:** Comunicación bidireccional entre la aplicación móvil y el robot vía Wi-Fi usando un broker MQTT central.
  - **Protocolo:** Telemetría periódica (`robot/estado`), órdenes de despacho (`robot/ordenes`), confirmación obligatoria (`robot/ordenes/ack`), alertas de seguridad (`robot/alertas`) y última voluntad (`robot/conexion`).
  - **Simulación:** Simulador 3D interactivo en Three.js con animación de paquetes y consola de depuración en tiempo real.
  - **Evidencia:** 0 órdenes perdidas en 50 pedidos; detección de desconexión por LWT en menos de 22 s.

- **P03 (Tracción & Encoders):**
  - **Función:** Cinemática diferencial con 2 micromotores JGA25-371 (Speed 200, reducción 1:21,3) comandados por puente H L298N.
  - **Medición:** Encoders óptico/magnéticos de 11 pulsos/rev (cuadratura, 937 cuentas por vuelta de rueda) leídos por interrupciones de hardware.
  - **Simulación (19 nov):** vitrina autónoma 3D (`prototipos/P03-motores/avance-02-simulador-3d/`): sin control por teclado, el robot recorre solo un circuito cerrado de cinta negra (≈ 6,6 m, ≈ 0,40 m/s supuesto) con Pausar/Reanudar, Vista Rayos X y Etiquetas. Muestra los componentes reales con ficha al hacer clic y lectura en vivo: regleta 4× TCRT5000 `[0/1,…]`, 2× HC-SR04P con conos (< 20 cm rojo, 20–50 cm ámbar; TRIG trasero separado en GPIO 15), ESP32 móvil, MPU-6050 (rumbo/*heading hold* **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]**), tracción diferencial + chasis PLA (modelo único Speed 200 + L298N, sin comparativas) y batería 3S. No reimplementa teach-and-repeat (eso es del Simulador 2 V2). Fuente en `codigo/` (esbuild, `construir.mjs`) y 10 pruebas en Node (`codigo/vitrina.test.js`, también en CI).

- **P09 (App Flutter Web) y P10 (ESP32 Virtual):** ver sección 0. Cierran el ciclo app, broker y robot sin hardware (Gemelo Digital, validación SIL).
- **P11 (Centro de Alertas) y P12 (Analítica + CSV):** dentro de la App P09 (`app/lib/features/telemetria/`). En pruebas: validados en simulación, pendientes de hardware.
- **P13 (Radar ultrasónico):** 2× HC-SR04P (frente y atrás).

- **P08 (Seguidor de Línea Óptico):**
  - **Función:** Navegación en pasillo siguiendo cinta negra de 19 mm sobre piso de granito con regleta de 4 sensores infrarrojos TCRT5000 en ADC1.
  - **Lazo de Control:** Algoritmo Proporcional-Derivativo (PD) a 100 Hz con cálculo de error ponderado y velocidad nominal de 0,41 m/s.
  - **Simulación:** Simulador 3D con pista cerrada de 8,05 m (histórico; pista canónica 9,0 m en `specs/pista_canonica.json`) y superficie granular procedural.

---

## 2. Estado del Firmware (`firmware/robot_integrado.ino`)

Unificación en C++ (Arduino IDE, ESP32 core 3.x) de P01, P03 y P08 en un solo ejecutable:
- **Uso de Memoria:** 71 % Flash, 15 % RAM. Cero llamadas a `delay()`; control estricto por `millis()` y temporizadores `micros()`.
- **Modos de Operación:**
  1. `MODO_AUTONOMO`: Sigue la línea con control PD a 100 Hz.
  2. `MODO_MANUAL`: Responde a comandos MQTT o teclas serie. Fail-safe de 5 s sin órdenes: frena y se queda en MANUAL (nunca pasa solo a autónomo; alerta `timeout_manual`).
- **Seguridad de ultrasonidos (18 nov):** lectura alternada (frente en ciclos pares, atrás en impares, 100 ms por ciclo; TRIG separado: frente GPIO 23, atrás GPIO 15). Frente < 20 cm detiene avance/giros/autónomo (solo retroceso con atrás ≥ 20 cm y sensor válido); 3 lecturas propias sin eco (600 ms) marcan `frente_ok`/`atras_ok = false` y bloquean esa dirección. Alertas en cola, publicadas desde `loop()`.
- **Corte por batería (18 nov):** `VOLTAJE_CORTE_V = 9.90` (3 lecturas de 200 ms): `detener()`, alerta `bateria_critica`, latch hasta > 10,10 V **y** una orden nueva; ≤ 10,30 V aviso `bateria_baja`; ≤ 1 V (USB) no corta.
- **Duplicados QoS 1:** una orden con el mismo `id` que la última no se ejecuta ni se cuenta; solo se reconfirma con el mismo `recibidas`.

### Mapa de Pines (ESP32 DevKit 30 pines)
| Función | Pines GPIO | Notas |
| :--- | :--- | :--- |
| **Motores (L298N)** | ENA: `25`, IN1: `26`, IN2: `27` <br> ENB: `14`, IN3: `4`, IN4: `13` | PWM a 20 kHz (sin silbido audible) |
| **Encoders** | Izq: `18` (A), `19` (B) <br> Der: `16` (A), `17` (B) | Interrupciones de hardware `CHANGE` |
| **Sensores Línea** | `36` (VP), `39` (VN), `34`, `35` | ADC1 exclusivamente (no interfieren con Wi-Fi) |
| **Ultrasonidos (2× HC-SR04P)** | TRIG frente `23`, TRIG atrás `15` (separado), ECHO frente `33`, ECHO atrás `5` | Lectura alternada; un TRIG por módulo |
| **Batería 3S** | `32` | Divisor resistivo 100k / 22k (aviso 10,30 V · corte 9,90 V, rearme > 10,10 V) |
| **Botón Alarma** | `0` (BOOT) | Alarma de prueba local |
| **IMU (Reservado)** | SDA: `21`, SCL: `22`, INT: `2` | I2C para acelerómetro antirrobo |

### Niveles QoS y Tópicos MQTT
- `ucab-tg-sf/robot/estado` (QoS 0): Telemetría cada 2 s (batería %, V, estado, orden contador).
- `ucab-tg-sf/robot/ordenes` (QoS 1): Comandos y pedidos desde la app móvil.
- `ucab-tg-sf/robot/ordenes/ack` (QoS 1): Confirmación obligatoria de recepción, formato `{"id","recibidas","t"}`. Si no hay conexión, el ACK queda en cola y se reenvía al reconectar.
- `ucab-tg-sf/robot/ultrasonido` (QoS 0): `{"frente_cm","atras_cm","frente_ok","atras_ok","t"}` cada 0,5 s.
- `ucab-tg-sf/robot/alertas` (QoS 2, handshake de 4 pasos): `{"n","tipo","prueba","valor","t"}`; tipos `obstaculo`, `obstaculo_atras`, `fallo_sensor_*`, `bateria_baja` (aviso 10,30 V), `bateria_critica` (corte 9,90 V), `timeout_manual`, `antirrobo`. Contrato completo en `docs/arquitectura/topicos-mqtt.md`.
- `ucab-tg-sf/robot/conexion` (QoS 1 retenido): Notificación de conexión y testamento LWT.

---

## 3. Estructura de la Web & Frontend

Diseñada como **Portafolio de Ingeniería** estático sin dependencias externas pesadas:

- **Estilos:**
  - `assets/css/style.css`: Hoja de estilos global unificada, diseño técnico minimalista, grid responsivo, tarjetas elevadas, badges de estado y visor de simuladores.
  - `assets/estilo.css`: Archivo puente que importa `style.css` y garantiza compatibilidad con cualquier página histórica.
- **Lógica JavaScript:**
  - `datos/proyecto.js`: **Fuente de verdad** del proyecto. Contiene objetos `TG.fases`, `TG.prototipos`, `TG.pendientes`, `TG.requerimientos` y metadatos.
  - `assets/sitio.js`: Utilidades de tiempo `TGU` (cálculo de semanas, días restantes e hitos), generación dinámica de la barra de navegación `#menu` y del pie de página `#pie` (con enlace a `archivo-fase-1.html`).
- **Páginas Principales:**
  - `index.html`: Dashboard principal con bienvenida, estado actual (software vs hardware), reloj de avance temporal, showcase de prototipos y firmware integrado.
  - `tesis.html` y `tesis/`: capítulos del tomo en Markdown (`tesis/capitulo_1.md`, `capitulo_2.md` y `marco_teorico.md`, convertidos de Word con citas IEEE e imágenes en `tesis/media/`; `tesis/capitulo_3.md`, borrador del Marco Metodológico con citas autor-año), listados desde `TG.tesis` y abiertos en el visor modal; enlace "Tesis" en el grupo "El Proyecto" del menú.
  - `PLAN.md`: Documento con diagrama Gantt en Mermaid y desglose de 32 semanas.
  - `cronograma.html`: Renderizado interactivo SVG de la línea de tiempo.
  - `prototipos/`: Landing pages individuales con visor 3D en la parte superior, descarga de código `.ino` y sección prediseñada para resultados de laboratorio.
