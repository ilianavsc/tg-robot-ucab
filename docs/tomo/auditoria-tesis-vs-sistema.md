# Auditoría: capítulos de la tesis frente al sistema implementado

**Fecha:** 19/11/2026 (cierre de la segunda pasada) · **Alcance:** `tesis/capitulo_1.md`, `capitulo_2.md`, `capitulo_3.md` y `marco_teorico.md` frente al firmware (`firmware/robot_integrado.ino`), la app Flutter (`app/`), el simulador P10 y `datos/proyecto.js`.

**Regla aplicada:** el texto de los Capítulos I y II y del Marco teórico viene de los documentos de Word de las estudiantes. Solo se corrigieron los defectos de conversión (numeración de los objetivos) y se cambió lo que el tutor pidió expresamente («medido» por «estimado» en la autonomía); el resto son **notas de auditoría** visibles. El Capítulo III es un borrador del repositorio y sí se sincronizó. No se inventó ningún resultado: donde falta una medición con el robot real aparece **[PENDIENTE DE MEDICIÓN FÍSICA]**, y donde falta código en el firmware, **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]**.

## 1. Hardware y arquitectura

| Afirmación | Sistema real | Estado |
|---|---|---|
| **1 ESP32 móvil + 2 ESP32 fijos (balizas BLE)** | Diseño en `docs/arquitectura/balizas-ble.md`; el pedido incluye 3 ESP32. Solo existe en simulación (P10 y vista previa del Admin) | Documentado; balizas y escaneo BLE **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]** |
| 4× TCRT5000 en ADC1 | GPIO 36, 39, 34, 35; separación 18 mm; 3,3 V | Coincide |
| 2× HC-SR04P | ECO frente GPIO 33, ECO atrás GPIO 5; **TRIG frente GPIO 23 y TRIG atrás GPIO 15 (separado desde el 19/11)** | Coincide; Cap. III y docs actualizados |
| MPU-6050 | En la lista de compra y en el mapa de pines (GPIO 21/22); el firmware **no la lee** (solo un gancho). Roles previstos: antirrobo con el acelerómetro y *heading hold* con el giroscopio | **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]**, marcado en Cap. II y III |
| ESP32-WROOM-32, batería Li-Ion 3S, un solo robot | Coincide | Coincide |
| Sin LiDAR, sin magnetómetro ni rumbo | La app no muestra rumbo; el heading hold es *relativo* | Coincide |

## 2. Seguridad

| Afirmación | Sistema real | Estado |
|---|---|---|
| Parada crítica < 20 cm; precaución 20–50 cm | Firmware y `CentroAlertas`; en el firmware real la zona 20–50 cm **solo avisa** | Coincide; Cap. III aclara que la reducción gradual de velocidad es del Modo Demo |
| Fail-Safe de solo lectura | Perfil del Administrador: tarjeta con candado, sin edición ni anulación (hay una prueba) | Coincide |
| **RF-05** | El firmware corta motores con el eco **< 20 cm** | **Corregido** el criterio de «≥ 20 cm» a «< 20 cm» (datos, requerimientos, P02, Cap. III); distancia final de parada **[PENDIENTE DE MEDICIÓN FÍSICA]** |
| Corte por batería 9,90 V, rearme > 10,10 V; manual: 5 s sin órdenes | Firmware | Coincide |
| **Freno Remoto (no es un E-STOP)** | Envía `frenar` por MQTT; no es una parada cableada ni sustituye el interruptor físico | Renombrado en toda la app y los docs; documentado en Cap. III.3.6 |
| Reconexión MQTT tras el Modo Demo | `iniciarSimulacion()` desconecta el MQTT real y `detenerSimulacion()` **no** reconecta: hay que pulsar Conectar | Documentado (Cap. III.3.6 y III.6) |

## 3. Aplicación

| Afirmación | Sistema real | Estado |
|---|---|---|
| App con 4 secciones y Freno Remoto | Dashboard, Controles, Radar, Alertas; *Autonomous Laboratory Cockpit* | Coincide |
| Mapa de Pista | Cuarto de Componentes → Punto de Control → Laboratorio 1; borrado progresivo del tramo recorrido; posición **solo en Modo Demo** | Cap. III aclara qué es simulación |
| **Roles Operador / Administrador** | Maqueta local en memoria, sin backend de producción ni Firebase; contraseñas sin protección; sin registro público | Documentado como *mock* (Cap. III.3.6 y III.5.3) |
| Aprendizaje de Ruta (solo Admin) | Pasada virtual, puntos de control y reducción progresiva de cinta, en memoria; no envía rutas al robot | Documentado; el Operador no lo ve |
| Catálogo, solicitudes, historial, notificaciones con backend (OE 6) | No implementados | Pendiente (Fase V); nota en Cap. II.2.9 |
| Analítica de sesión y CSV (P12) | Implementada; el Administrador la exporta desde su Perfil | Coincide |

## 4. SIL frente a HIL (nada se extrapola)

| Qué | Entorno real | Estado |
|---|---|---|
| 10 escenarios del firmware en PC (SIL), P10, Modo Demo, 116 pruebas de la app, escenario híbrido de P10 (10 pruebas en Node), `specs/navegacion` (13) y Simulador 2 V2 (22) | **SIL** | Hecho; rotulado como SIL |
| Firmware en el ESP32 real con sensores y motores, balizas BLE, MPU-6050 | **HIL** | **No se ha hecho** (hardware llega en diciembre) |

| Valor del tomo | Origen real | Estado |
|---|---|---|
| 50/50 pedidos, 7/7 pruebas (P01); 22 s de detección de desconexión | SIL | Rotulado como SIL |
| **RNF-04**: latencia media de 4,1 s | Banco P01 con broker público: no representa al sistema real | Nota corregida; criterio y medición **[PENDIENTE DE MEDICIÓN FÍSICA]** |
| Velocidad ≈ 0,57 m/s; 0,36–0,47 m/s siguiendo la línea | Cálculo y simulador | **[PENDIENTE DE MEDICIÓN FÍSICA]** |
| **Autonomía ≈ 3 h** | Estimación por cálculo; el Cap. II decía «se midió» | **Corregido** a «estimó» en Cap. II; **[PENDIENTE DE MEDICIÓN FÍSICA]** |
| Error de línea, distancia de parada, falsas alarmas, RSSI y deriva | Sin datos | **[PENDIENTE DE MEDICIÓN FÍSICA]** |
| Modo Demo: 0,40 m/s, batería lineal, circuito de 9,0 m; P10 híbrido: 9,0 m, RSSI −80 → −52 dBm | Supuestos de simulación | Declarados como supuestos |

## 5. Referencias y formato

- **Citas unificadas en IEEE** (numéricas) en los Capítulos I, II y III y en el Marco teórico. Quedan por confirmar la ciudad y la editorial de [1] y [2] del Capítulo III.
- Se corrigió la numeración de los 9 objetivos específicos del Capítulo I (la conversión de Word la dejaba en 1, 1, 2…).
- Los índices y listas de figuras y tablas de Word se omitieron a propósito (llevan números de página).
- «Cambios pendientes del Capítulo II» (`docs/tomo/capitulo-ii-cambios.md`) sigue vigente.

## 6. Pendientes que dependen de las estudiantes o del tutor

1. Decidir si se reescriben en futuro o condicional los pasajes del Capítulo II que hablan de resultados que no existen (IMU, funciones de la app).
2. Confirmar ciudad y editorial de las referencias [1] y [2] del Capítulo III.
3. Completar cada **[PENDIENTE DE MEDICIÓN FÍSICA]** y cada **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]** con su registro HIL o de campo.
