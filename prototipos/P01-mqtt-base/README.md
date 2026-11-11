# P01 MQTT base

**Fase:** I (Revisión y levantamiento)
**Responsable:** Iliana Semprun
**Tarea en GitHub:** #2
**Fecha:** 10/11/2026

👉 **Versión visual y fácil de entender:** [index.html](index.html) (o en GitHub Pages: https://ilianavsc.github.io/tg-robot-ucab/prototipos/P01-mqtt-base/)

## 1. Objetivo
Comunicar el ESP32 con el broker MQTT. Es la base de todo el sistema: por aquí viajan el estado del robot, las órdenes de la app y las alertas.

## 2. Requisito que valida
- El robot recibe órdenes y confirma que las recibió.
- El robot informa su estado de forma periódica.
- El sistema sabe cuándo el robot se desconecta.
- Las alertas viajan con la máxima garantía de entrega (QoS 2).

## 3. Simulador y enlace
- **Wokwi** (ESP32 DevKit C v4, red `Wokwi-GUEST`). Proyecto: `P01-mqtt-base` (pegar aquí el enlace de Wokwi)
- **Broker:** `broker.hivemq.com`, puerto 1883 (público, solo para desarrollo)
- **Cliente de prueba:** MQTTX, suscrito a `ucab-tg-sf/robot/#` con QoS 2
- **Librería:** `MQTT` de Joel Gaehwiler (soporta QoS 0, 1 y 2). Se descartó PubSubClient porque solo publica con QoS 0.

Código en `codigo/` (`sketch.ino`, `diagram.json`, `libraries.txt`).

## 4. Cómo se prueba
1. Abrir el proyecto en Wokwi y presionar ▶️.
2. En MQTTX, conectarse a `broker.hivemq.com:1883` y suscribirse a `ucab-tg-sf/robot/#` con QoS 2.
3. Ver que llegue el estado cada 2 s.
4. Publicar en `ucab-tg-sf/robot/ordenes` con QoS 1:
   `{"id":"P-0001","componente":"Resistencia 1k","cantidad":5,"estante":"A3"}`
5. Ver la confirmación en `ucab-tg-sf/robot/ordenes/ack`.
6. Detener o pausar la simulación y ver el aviso `desconectado` en `ucab-tg-sf/robot/conexion`.
7. Escribir `a` en el monitor de Wokwi y ver la alerta en `ucab-tg-sf/robot/alertas`.

Tópicos usados: ver `docs/arquitectura/topicos-mqtt.md`.

## 5. Criterio de éxito
- Se envían 50 órdenes con QoS 1 y llegan las 50.
- Al detener la simulación aparece "desconectado" en menos de 30 s.
- La alerta llega con QoS 2.

## 6. Resultado

| Prueba | Resultado | Evidencia |
|---|---|---|
| Estado periódico con QoS 0 | ✅ Pasó | `01-estado-qos0-mqttx.png` |
| Aviso "en linea" al conectar (retenido, QoS 1) | ✅ Pasó | `02-conexion-en-linea.jpg` |
| Aviso "desconectado" (LWT) al pausar la simulación | ✅ Pasó (llegó en pocos segundos) | `03-lwt-desconectado.jpg` |
| Reconexión automática al broker | ✅ Pasó | `04-wokwi-reconexion.png` |
| Orden recibida con QoS 1 | ✅ Pasó | `05-wokwi-orden-recibida.png` |
| Confirmación (ack) con QoS 1 y estado actualizado | ✅ Pasó | `06-mqttx-orden-y-ack.png` |
| Alerta con QoS 2 | ⏳ Pendiente | |
| 50 órdenes seguidas sin pérdida | ⏳ Pendiente | |

**Observación:** la confirmación llegó unos 8 s después de la orden. Wokwi corre más lento que el tiempo real, así que este tiempo no representa al robot real.

## 7. Qué se reutiliza en el robot real
- El árbol de tópicos y su QoS.
- Las funciones de conexión, reconexión y última voluntad (LWT).
- La forma de recibir órdenes y confirmarlas.

## 8. Qué falta validar con hardware
- Tiempo real de respuesta (orden → confirmación) con el ESP32 físico.
- Conexión desde el Wi‑Fi del laboratorio (H0).
- Cambiar a un broker privado con usuario, contraseña y TLS para las pruebas finales.

## 9. Para el tomo
- Tabla de tópicos y QoS (arquitectura de comunicación).
- Tabla de resultados de esta ficha.
- Capturas de MQTTX como figuras de la validación de la comunicación.
