# Firmware integrado del robot

Archivo: **`robot_integrado.ino`**

Es la fusión de los tres prototipos en un solo firmware:

| Prototipo | Qué aporta |
|---|---|
| P01 MQTT base | Wi-Fi, MQTT, pedidos + confirmación, alertas QoS 2, batería |
| P03 Motores | PWM del L298N, encoders por interrupción, PID (apagado) |
| P08 Seguidor de línea | Control PD a 100 Hz con 4 sensores TCRT5000 |

## Qué hace

- Arranca en **modo autónomo**: sigue la línea con el PD.
- Si llega una orden MQTT con `"cmd"`, pasa a **modo manual**.
- Si en manual pasan **5 s sin órdenes**, **frena y se queda detenido en manual**
  (fail-safe). Nunca vuelve solo a autónomo: hace falta la orden `auto`.
- **Obstáculo frontal < 20 cm:** frena avance, giros y autónomo; solo deja
  retroceder si el ultrasonido trasero es válido y marca ≥ 20 cm (o nada en rango).
- **Ultrasonidos alternados:** frente en ciclos pares y atrás en impares (100 ms
  por ciclo; cada sensor cada 200 ms). Cada módulo tiene su propio TRIG (frente
  GPIO 23, atrás GPIO 15), así que solo emite el sensor de turno.
- **Fallo de ultrasonido:** 3 lecturas propias seguidas sin eco (600 ms) marcan
  el sensor en fallo (`frente_ok`/`atras_ok = false`), bloquean el movimiento en
  esa dirección y publican `fallo_sensor_frente` / `fallo_sensor_atras`.
- **Corte por batería:** con ≤ 9,90 V (`VOLTAJE_CORTE_V`, 3 lecturas de 200 ms
  seguidas) frena, publica `bateria_critica` y no se mueve hasta superar
  10,10 V **y** recibir una orden nueva. Con ≤ 10,30 V avisa antes
  (`bateria_baja`). Con ≤ 1 V (USB, sin batería) no corta.
- **Órdenes duplicadas:** si llega el mismo `id` que la última orden (reentrega
  QoS 1), no se ejecuta ni se cuenta; solo se reconfirma.
- Manda el estado cada 2 s (con el campo `parada`) y las alertas con **QoS 2**,
  desde una cola en `loop()`: primero frena, después avisa.
- Pruebas de la lógica en el PC (SIL): [`pruebas_pc/`](pruebas_pc/) (10 escenarios T1–T10). También corren en GitHub Actions antes de cada despliegue.
- **No usa `delay()`**: todo el tiempo se maneja con `millis()`.

## Librerías que hay que instalar

| Librería | Dónde | Nota |
|---|---|---|
| **MQTT** de Joel Gaehwiler (256dpi) | Arduino IDE → Gestor de librerías → buscar "MQTT" | Es la misma de Wokwi |
| **WiFi** | Ya viene con el core del ESP32 | No instalar nada |
| ~~PubSubClient~~ | — | **No usar**: solo publica con QoS 0 |

Para la IMU (más adelante): **Adafruit MPU6050** (instala sola sus dependencias).

## Requisitos

- Arduino IDE 2.x.
- Core **esp32** de Espressif 3.x (probado con **3.3.12**).
  Boards Manager → buscar "esp32" → instalar.
- Placa seleccionada: **"ESP32 Dev Module"** (DevKit de 30 pines, USB-C, CP2102).

## Pasos para cargarlo

1. **Preparar la carpeta:** el archivo debe estar en una carpeta llamada `robot_integrado`
   (Arduino exige que la carpeta se llame igual que el `.ino`). Si abres
   `firmware/robot_integrado.ino`, el IDE te ofrecerá moverlo: acepta.
2. **Instalar la librería MQTT** (tabla de arriba).
3. **Poner tu red** en el código:
   ```cpp
   const char* WIFI_RED   = "TU_RED_WIFI";
   const char* WIFI_CLAVE = "TU_CLAVE_WIFI";
   ```
   No subas la clave al repositorio.
4. **Elegir placa y puerto:** Herramientas → Placa → ESP32 Dev Module;
   Herramientas → Puerto → el del ESP32.
5. **Compilar y subir** con el botón ➡️ (Subir).
6. **Abrir el Monitor Serie a 115200** para ver la telemetría.

## Cómo se maneja

| Tecla (Monitor Serie) | Acción |
|---|---|
| `w` / `s` | adelante / atrás |
| `a` / `d` | izquierda / derecha |
| `espacio` o `x` | frenar |
| `+` / `-` | subir / bajar velocidad 5 % |
| `o` | volver a modo autónomo |
| `t` | alarma de prueba (QoS 2) |

Botón **BOOT** (GPIO 0): también manda una alarma de prueba.

Órdenes por MQTT (mismos tópicos de P01):

```json
{"id":"P-0001","cmd":"adelante"}
{"id":"P-0002","cmd":"izquierda","vel":0.6}
{"id":"P-0003","cmd":"frenar"}
{"id":"P-0004","cmd":"auto"}
```

Una orden **sin** `cmd` es un pedido de componente: solo se confirma (ack).

## Mapa de pines

| Uso | GPIO |
|---|---|
| Motor izq.: ENA / IN1 / IN2 | 25 / 26 / 27 |
| Motor der.: ENB / IN3 / IN4 | 14 / 4 / 13 |
| Encoders izq.: A / B | 18 / 19 |
| Encoders der.: A / B | 16 / 17 |
| Sensores de línea (ADC1) | 36, 39, 34, 35 |
| Batería (divisor 100 kΩ / 22 kΩ) | 32 (ADC1) |
| Botón de prueba | 0 (BOOT) |
| IMU reservada (futuro): SDA / SCL / INT | 21 / 22 / 2 |

## Prueba rápida

1. Con el robot apagado, subir el firmware.
2. Abrir MQTTX en `broker.hivemq.com:1883`, suscribirse a `ucab-tg-sf/robot/#`.
3. Ver el estado cada 2 s y la telemetría en el Monitor Serie.
4. Enviar `{"id":"P-0001","cmd":"adelante"}` y ver que el robot obedece y confirma.
5. Soltar el robot sobre la línea y ver el modo autónomo.

## Notas

- La red de la UCAB pide usuario y contraseña (WPA2-Enterprise). Este firmware usa
  Wi-Fi normal: para las pruebas usa la red del laboratorio o el hotspot de un teléfono.
- El broker `broker.hivemq.com` es público: sirve para probar, no para el sistema final.
- Compilado de referencia: flash **71 %** y RAM **15 %** para el ESP32 de 4 MB.
