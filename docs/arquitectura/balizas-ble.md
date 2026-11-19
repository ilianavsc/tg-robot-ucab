# Arquitectura: 1 ESP32 móvil + 2 ESP32 fijos (balizas BLE)

**Estado al 19/11/2026:** diseño y **simulación (SIL)**. El escaneo BLE y la lectura de la MPU-6050 están **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]**. Todos los umbrales y distancias de esta página son supuestos de simulación: **[PENDIENTE DE MEDICIÓN FÍSICA]**.

## Nodos

| Nodo | Hardware | Función |
|---|---|---|
| **Robot (móvil)** | 1 ESP32-WROOM-32, 4× TCRT5000, 2× HC-SR04P, MPU-6050, batería Li-Ion 3S | Sigue la línea, evita obstáculos, publica por MQTT y (previsto) escanea balizas BLE |
| **Baliza «Cuarto de Componentes»** | 1 ESP32 fijo | Anuncia por BLE (advertising); marca el inicio del trayecto |
| **Baliza «Laboratorio 1»** | 1 ESP32 fijo | Anuncia por BLE; marca el destino |

El pedido de hardware incluye 3 ESP32: uno para el robot y dos para las balizas. Es **un solo robot**. No hay LiDAR ni magnetómetro.

## Tramos sin cinta (reducción progresiva de cinta)

1. El robot sigue la cinta con los 4 TCRT5000.
2. Al acabarse la cinta (`TCRT5000 = [0,0,0,0]`), guarda el **rumbo relativo** que llevaba y lo mantiene con el giroscopio de la MPU-6050 (*heading hold*). No hay magnetómetro: no existe rumbo absoluto, solo el desvío respecto al rumbo guardado.
3. Mientras avanza, escanea la baliza del siguiente punto de control y mide su **RSSI**.
4. Cuando el RSSI supera un umbral durante varias lecturas seguidas, la baliza **confirma proximidad**: el robot reacopla la cinta (o se detiene en la estación).

## Supuestos usados en P10 (`p10_hibrido_modelo.js`)

| Parámetro | Valor simulado |
|---|---|
| RSSI lejos → cerca | −80 dBm → −52 dBm |
| Umbral de confirmación | ≥ −55 dBm en 3 lecturas seguidas (5 lecturas/s) |
| Distancia entre balizas | 9,0 m (la cinta se acaba tras 1 m; pista canónica `specs/pista_canonica.json`) |
| Velocidad sin cinta | 0,35 m/s |
| Sesgo del giroscopio / ganancia del hold | 0,30 °/s / 1,2 s⁻¹ |

El modelo se prueba con `node prototipos/P10-simulador-esp32/p10_hibrido_modelo.test.js` (10 pruebas, también en CI). En P10, el panel *Simulación Híbrida (SIL)* muestra la fase, los TCRT5000, el desvío relativo, la deriva con y sin hold, y el RSSI de cada baliza.

## Contrato MQTT

El firmware **no publica** nada de BLE. Para la simulación, P10 puede publicar `ucab-tg-sf/robot/ble_sim` (QoS 0): `{"baliza":"cuarto"|"lab1","rssi_dbm":-78.4,"simulado":true,"t":<ms>}`. Ese tópico **no existe en el contrato real** (`topicos-mqtt.md`) y la app no lo usa.

## En la app

- El **Aprendizaje de Ruta** (solo Administrador) permite hacer una pasada virtual, marcar puntos de control y ver la reducción progresiva de cinta. Es SIL en memoria: no envía rutas al robot (el firmware solo entiende `adelante`, `atras`, `izquierda`, `derecha`, `frenar` y `auto`).
- El Operador usa la ruta guardada: sus puntos de control aprendidos aparecen en el Mapa de Pista.

## Pendientes (HIL)

1. Integrar la lectura de la MPU-6050 y medir el sesgo real del giroscopio.
2. Escaneo BLE en el robot y anuncio en las 2 balizas; medir RSSI vs. distancia en el pasillo real.
3. Fijar umbrales de confirmación y tolerancia de deriva con mediciones (≥ 20 repeticiones).
4. Decidir con P04 si la re-localización final es BLE o QR.
