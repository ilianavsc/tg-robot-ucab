# Checklist de flasheo · Prueba física del ESP32

**Fecha:** jueves · **Firmware:** `firmware/robot_integrado.ino` (71 % flash · 15 % RAM)
**Placa:** ESP32 Dev Module (DevKit 30 pines, USB-C, CP2102) · **Core:** esp32 `3.3.12` · **CLI:** arduino-cli `1.6.0`

## 0. Antes de empezar (2 min)

- [ ] `firmware/secrets.h` tiene el SSID y la clave reales (si no existe, copia `secrets_ejemplo.h` y renómbralo a `secrets.h`)
- [ ] Cable USB-C **de datos** (no de solo carga)
- [ ] `arduino-cli version` responde (está en `C:\Users\ivsc\10112026\tools`)
- [ ] Hotspot 2,4 GHz del celular listo — la red de la UCAB es **WPA2-Enterprise** y este firmware no la soporta

## 1. Comandos exactos

```powershell
# 1) Ver el puerto del CP2102
arduino-cli board list

# 2) Compilar
arduino-cli compile -b esp32:esp32:esp32 --build-path "$env:TEMP\build_robot" "C:\Users\ivsc\10112026\robot_integrado"

# 3) Subir  (cambia COM5 por el puerto que mostró `board list`)
arduino-cli upload -b esp32:esp32:esp32 -p COM5 --build-path "$env:TEMP\build_robot" "C:\Users\ivsc\10112026\robot_integrado"

# 4) Monitor serie (Ctrl+C para cerrar)
arduino-cli monitor -p COM5 -c baudrate=115200
```

> `C:\Users\ivsc\10112026\robot_integrado` es un **junction** a la carpeta `firmware/`
> (Arduino exige que la carpeta se llame igual que el `.ino`). Si no existe, recréalo:
> ```powershell
> New-Item -ItemType Junction -Path "C:\Users\ivsc\10112026\robot_integrado" -Target "C:\Users\ivsc\10112026\tg-robot-ucab\firmware"
> ```

## 2. Cómo saber que arrancó bien

En el monitor debe aparecer, en este orden:
```
Red configurada: TU_SSID
Robot integrado listo.
Wi-Fi listo, IP 192.168.X.X
MQTT conectado
```
Luego, cada 2 s llega el `estado` (visible también en MQTTX suscrito a `ucab-tg-sf/robot/#`).

## 3. Fallos típicos

| Fallo | Causa | Solución rápida |
|---|---|---|
| **Wi-Fi no conecta** (`Wi-Fi: reintentando...` infinito) | red de 5 GHz, WPA2-Enterprise o credenciales mal | hotspot 2,4 GHz con clave normal; corregir `secrets.h` y reflashear |
| **MQTT rechaza** (conecta Wi-Fi pero nunca dice `MQTT conectado`) | broker caído o puerto 1883 bloqueado por la red | probar `broker.hivemq.com:1883` en MQTTX; si falla, cambiar `MQTT_BROKER` a `broker.emqx.io` en `secrets.h` |
| **Sensor no lee** (telemetría con `linea_mm` congelada o `PERDIDA` constante) | VCC a 5 V (quemó el ADC), GND común faltante o polaridad invertida | alimentar los TCRT5000 a **3,3 V**, unir todos los GND, medir `AO` (negro debe dar más tensión que blanco) |
