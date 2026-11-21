# Capítulo II: cambios pendientes

Revisión del 11/11/2026. **Aplicados el 12/11/2026** en una versión de Word con control de cambios (autor "Claude"), salvo lo marcado como comentario.

Quedan como comentarios en el Word, para decidir con el tutor: tiempo verbal de lo que aún no existe (autonomía, chasis), norma de CONATEL de uso libre en 2,4 GHz, antecedentes más recientes y las referencias nuevas que hay que agregar (kit de motor, L298, biblioteca MQTT, guía de ESP-IDF).

No se cambió: 3,6 V por pila (es lo correcto para la EVE 25P); el sitio usa 3,7 V y se unifica después.

1. **MQTT 3.1.1 en el prototipo.** La librería del ESP32 (MQTT de Joel Gaehwiler) usa 3.1.1: explicar *Clean Session* y dejar 5.0 como contexto (Clean Start, Session Expiry y Will Delay son de 5.0).
2. **Tabla 7 de tópicos.** Prefijo `ucab-tg-sf/robot/` y 5 tópicos: estado (QoS 0), ordenes (QoS 1), ordenes/ack (QoS 1), alertas (QoS 2), conexion (QoS 1, retenido, LWT). Agregar el resultado de P01: 50 de 50 pedidos confirmados con QoS 1 y sesión persistente.
3. **Resultados en pasado que aún no existen** (autonomía medida, balizas como proximidad, diseño del chasis). Revisar al final o cambiar a "se aplica en el proyecto para…". Preguntar al tutor.
4. **Bluetooth Core.** Actualizar la versión vigente (6.0 → la última en bluetooth.com) en [26] y II.3.3.
5. **Temas que faltan:** motorreductor (velocidad sin carga vs con carga), ejemplo de la ecuación (4) con el motor elegido (11 × 21,3 × 4 = 937 cuentas por vuelta, ~0,22 mm), radio compartida Wi-Fi/BLE en el ESP32, ADC2 no lee con Wi-Fi, BMS con balanceo.
6. **Detalles:** antecedentes más recientes y cercanos al tema; norma de CONATEL de equipos de uso libre en 2,4 GHz; términos básicos (puente H, BMS, Keep Alive, LWT, trilateración, "modo de respaldo"); unificar 3,6 V por pila (10,8 V) entre el capítulo, el sitio y el simulador.
7. **Posibles según lo que se decida:** marcas de cinta en la línea como re-localización; balizas de inicio y fin para calibrar tiempo y distancia.
8. **Objetivo 2 y Figura 4:** ver [objetivo-2-seleccion-hardware.md](objetivo-2-seleccion-hardware.md).
