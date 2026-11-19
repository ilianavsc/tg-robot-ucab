# Auditoría: capítulos de la tesis frente al sistema implementado

**Fecha:** 19/11/2026 · **Alcance:** `tesis/capitulo_1.md`, `capitulo_2.md`, `capitulo_3.md` y `marco_teorico.md` frente al firmware (`firmware/robot_integrado.ino`), la app Flutter (`app/`) y `datos/proyecto.js`.

**Regla aplicada:** el texto de los Capítulos I y II y del Marco teórico viene de los documentos de Word de las estudiantes y **no se reescribió**; solo se añadieron notas de auditoría visibles y se corrigió un defecto de conversión (numeración de los objetivos). El Capítulo III es un borrador del repositorio y sí se sincronizó. No se inventó ningún resultado: donde falta una medición con el robot real aparece **[PENDIENTE DE MEDICIÓN FÍSICA]**.

## 1. Hardware

| Afirmación | Dónde | Sistema real | Estado |
|---|---|---|---|
| 4× TCRT5000 (línea) en ADC1 | Cap. III, `docs/sensores.md` | GPIO 36, 39, 34, 35; separación 18 mm; 3,3 V | Coincide |
| 2× HC-SR04P (frente y atrás) | Cap. III | Eco frontal GPIO 33, eco trasero GPIO 5, TRIG frontal GPIO 23 y TRIG trasero GPIO 15 (separado desde el 19/11/2026) | Coincide; Cap. III actualizado con los pines |
| MPU-6050 como IMU (giroscopio + acelerómetro) | Cap. I (OE 5 y 7), Cap. II (II.2.2.3, II.2.10) | Está en la lista de compra y en el mapa de pines (GPIO 21/22), pero el firmware **no la lee**: solo hay un gancho comentado | **Marcado** en Cap. II y Cap. III. El antirrobo (RF-08) y la fusión con el giroscopio no tienen resultados |
| ESP32-WROOM-32, batería Li-Ion 3S, un solo robot | Cap. I, II, III | Coincide | Coincide |
| Sin LiDAR, sin magnetómetro ni rumbo | (regla del proyecto) | La app no muestra rumbo (se quitó «RUMBO 088° E» del diseño) y el mapa no dibuja posición con el robot real | Coincide; Cap. III lo declara |

## 2. Seguridad

| Afirmación | Sistema real | Estado |
|---|---|---|
| Parada crítica con el eco frontal < 20 cm; precaución 20–50 cm | Firmware y `CentroAlertas` (`umbralParadaCm = 20`, `umbralAvisoCm = 50`); en el firmware real la zona 20–50 cm **solo avisa** | Coincide. El Cap. III aclara que la reducción gradual de velocidad en 20–50 cm es del Modo Demo |
| Parámetros Fail-Safe de solo lectura | Perfil del Administrador: tarjeta con candado, sin controles de edición ni anulación (hay una prueba que lo verifica) | Coincide |
| Corte por batería 9,90 V, rearme > 10,10 V; manual: 5 s sin órdenes | Firmware | Coincide (Cap. III.3.5) |
| «Se detiene a ≥ 20 cm del obstáculo» (RF-05) | El firmware corta motores cuando el eco es **< 20 cm**; la distancia final de parada será menor | **Inconsistencia de criterio.** Marcada en Cap. III.3.3 y en la nota de RF-05; hay que acordar con el tutor cómo se define y se mide la distancia de parada |
| Al salir del Modo Demo se reconecta el MQTT | `iniciarSimulacion()` desconecta el MQTT real y `detenerSimulacion()` **no** reconecta | Documentado como limitación (Cap. III.6) |

## 3. Aplicación

| Afirmación | Sistema real | Estado |
|---|---|---|
| App Flutter con 4 secciones y Freno Remoto (`frenar`) | Dashboard, Controles, Radar y Alertas; sistema *Autonomous Laboratory Cockpit* | Coincide |
| Seguimiento del robot en tiempo real (Cap. II.2.9, OE 6) | Telemetría real por MQTT; Mapa de Pista con posición **solo en Modo Demo** (simulada) | Cap. II y Cap. III aclaran qué es simulación |
| Usuarios con dos roles: solicitante y encargado (Fase V) | Hoy: maqueta local de roles Operador/Administrador, en memoria, sin backend ni Firebase; contraseñas sin protección | Cap. III.3.6 y III.5.3 actualizados |
| Catálogo, solicitudes, historial de entregas, notificaciones con backend (OE 6) | No implementados | Pendiente (Fase V); nota en Cap. II.2.9 |
| Analítica de sesión y CSV (P12) | Implementada; el Administrador la exporta desde su Perfil | Coincide |

## 4. Resultados y mediciones (nada se extrapola de la simulación)

| Valor del tomo | Origen real | Estado |
|---|---|---|
| 50/50 pedidos, 7/7 pruebas (P01); 22 s de detección de desconexión | Simulación (SIL) | Ya rotulado como SIL |
| Velocidad ≈ 0,57 m/s; 0,36–0,47 m/s siguiendo la línea | Cálculo y simulador | **[PENDIENTE DE MEDICIÓN FÍSICA]** (Cap. III.3.3) |
| Autonomía ≈ 3 h | Cálculo; el Cap. II dice «se midió en condiciones de operación» | **Marcado** en Cap. II: aún no se midió |
| Error de línea, distancia de parada, falsas alarmas | Sin datos | **[PENDIENTE DE MEDICIÓN FÍSICA]** |
| Modo Demo: 0,40 m/s, batería lineal 12,60 → 9,90 V, circuito de 10 m | Supuestos de simulación | Declarados como supuestos en Cap. III.3.6 |

## 5. Referencias y formato

- **Conflicto de estilo de citas (sin resolver):** los Capítulos I y II y el Marco teórico declaran **IEEE** (numérico); el Capítulo III usa autor-año (APA). Decidir con el tutor un único estilo para el tomo.
- Se corrigió la numeración de los 9 objetivos específicos del Capítulo I (la conversión de Word la dejaba en 1, 1, 2…).
- Los índices y listas de figuras y tablas de Word se omitieron a propósito (llevan números de página).
- «Cambios pendientes del Capítulo II» (`docs/tomo/capitulo-ii-cambios.md`) sigue vigente: incluye los tiempos verbales de lo que aún no existe.

## 6. Pendientes que dependen de las estudiantes o del tutor

1. Elegir el estilo de citas del tomo (IEEE o autor-año).
2. Definir la métrica de la distancia de parada de RF-05.
3. Decidir si se reescriben en futuro o condicional los pasajes del Capítulo II que hablan de resultados que no existen (IMU, autonomía medida, funciones de la app).
4. Completar cada **[PENDIENTE DE MEDICIÓN FÍSICA]** con su registro HIL o de campo.
