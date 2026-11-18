# Pruebas del firmware en el PC (sin ESP32)

Compila `firmware/robot_integrado.ino` con `g++ -Wall -Wextra -Werror` usando
*stubs* (imitaciones mínimas) de `Arduino.h`, `WiFi.h` y `MQTT.h`, y ejecuta
escenarios de seguridad con un reloj simulado (ticks de 10 ms, un disparo de
ultrasonido cada 100 ms alternando frente/atrás). Es una prueba **SIL**
(*Software In the Loop*); las pruebas **HIL** con el robot van en
`prototipos/P02-sensores/README.md`. GitHub Actions la corre en cada push a `main`.

```bash
sh firmware/pruebas_pc/correr.sh
```

| Escenario | Qué verifica |
|---|---|
| T1 | Timeout manual de 5 s: frena, **se queda en MANUAL**, alerta `timeout_manual`, nunca pasa a autónomo |
| T2 | Ultrasonido frontal sin eco 600 ms (3 lecturas propias): `sensorFrenteOk=false`, bloquea avance/giros/autónomo, permite retroceder, alerta `fallo_sensor_frente`, se recupera con 2 ecos |
| T3 | Sin objeto en 4 m (pulso de timeout ~38 ms): 0 cm **no** es fallo |
| T4 | Ultrasonido trasero sin eco: bloquea solo el retroceso |
| T5 | Obstáculo frontal 14 cm, retroceso permitido con atrás ≥ 20 cm, bloqueo total |
| T6 | Aviso preventivo `bateria_baja` a 10,05 V sin corte; 0,00 V (USB) ni alerta ni corta |
| T7 | Alertas sin broker: el robot frena igual y la alerta sale al reconectar |
| T8 | Corte por batería ≤ 9,90 V: un bajón de 200 ms no corta; sostenido frena y publica `bateria_critica`; a 10,05 V sigue bloqueado (histéresis); a 10,40 V se rearma pero solo arranca con una orden nueva |
| T9 | Duplicados QoS 1: el mismo `id` no se cuenta ni renueva el timeout, se reconfirma con el mismo `recibidas`; solo compara con el último `id`; sin `id` no se deduplica |
| T10 | Lectura alternada: cada sensor se lee cada 200 ms, el turno cambia cada ciclo y la ISR ignora el eco del sensor fuera de turno |

**Límite:** esto valida la lógica, no el hardware. Falta compilar con el core
ESP32 real en el Arduino IDE y probar en el robot (diciembre). En particular,
hay que confirmar con los HC-SR04P reales que, sin objeto en rango, el módulo
entrega el pulso de timeout (si algún clon deja ECHO sin pulso, se verá como
`fallo_sensor_*` en espacios abiertos y habrá que ajustar `FALLO_ECO_MAX`).
También hay que medir la latencia real de parada: con la lectura alternada cada
sensor se refresca cada 200 ms (≈ 10 cm recorridos a 0,5 m/s) dentro del margen
de 20 cm de RF-05.
