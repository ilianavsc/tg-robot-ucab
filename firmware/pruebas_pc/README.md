# Pruebas del firmware en el PC (sin ESP32)

Compila `firmware/robot_integrado.ino` con `g++` usando *stubs* (imitaciones
mínimas) de `Arduino.h`, `WiFi.h` y `MQTT.h`, y ejecuta escenarios de
seguridad con un reloj simulado (ticks de 10 ms, disparos de ultrasonido cada
100 ms).

```bash
sh firmware/pruebas_pc/correr.sh
```

| Escenario | Qué verifica |
|---|---|
| T1 | Timeout manual de 5 s: frena, **se queda en MANUAL**, alerta `timeout_manual`, nunca pasa a autónomo |
| T2 | Ultrasonido frontal sin eco 500 ms: `sensorFrenteOk=false`, bloquea avance/giros/autónomo, permite retroceder, alerta `fallo_sensor_frente`, se recupera con 3 ecos |
| T3 | Sin objeto en 4 m (pulso de timeout ~38 ms): 0 cm **no** es fallo |
| T4 | Ultrasonido trasero sin eco: bloquea solo el retroceso |
| T5 | Obstáculo frontal 14 cm, retroceso permitido con atrás ≥ 20 cm, bloqueo total |
| T6 | Batería crítica 10,05 V (alerta preventiva) y 0,00 V sin alertas |
| T7 | Alertas sin broker: el robot frena igual y la alerta sale al reconectar |

**Límite:** esto valida la lógica, no el hardware. Falta compilar con el core
ESP32 real en el Arduino IDE y probar en el robot (diciembre). En particular,
hay que confirmar con los HC-SR04P reales que, sin objeto en rango, el módulo
entrega el pulso de timeout (si algún clon deja ECHO sin pulso, se verá como
`fallo_sensor_*` en espacios abiertos y habrá que ajustar `FALLO_ECO_MAX`).
