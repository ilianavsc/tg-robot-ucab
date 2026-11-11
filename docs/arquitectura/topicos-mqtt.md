# Tópicos MQTT

Prefijo común: `ucab-tg-sf/robot/`

| Tópico | Quién lo envía | QoS | Retenido | Para qué |
|---|---|---|---|---|
| `ucab-tg-sf/robot/estado` | Robot → app | 0 | No | Batería, posición y qué está haciendo (cada 2 s) |
| `ucab-tg-sf/robot/ordenes` | App → robot | 1 | No | Pedidos de componentes |
| `ucab-tg-sf/robot/ordenes/ack` | Robot → app | 1 | No | Confirmación de pedido recibido |
| `ucab-tg-sf/robot/alertas` | Robot → app | 2 | No | Antirrobo, batería baja, camino bloqueado |
| `ucab-tg-sf/robot/conexion` | Robot (y broker por LWT) | 1 | Sí | "en linea" o "desconectado" |

## Ejemplo de orden
```json
{"id":"P-0001","componente":"Resistencia 1k","cantidad":5,"estante":"A3"}
```

## Por qué cada QoS
- **QoS 0 (estado):** se envía cada 2 s; si se pierde uno, llega el siguiente.
- **QoS 1 (órdenes y confirmaciones):** cada pedido debe llegar al menos una vez.
- **QoS 2 (alertas):** una alerta antirrobo debe llegar exactamente una vez.

Probado en el prototipo P01 (ver `prototipos/P01-mqtt-base`).
