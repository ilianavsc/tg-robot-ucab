# Cambios en la lista de materiales

| Fecha | Versión | Qué cambió | Por qué (prueba o motivo) |
|---|---|---|---|
| 10/11/2026 | v1 | Lista inicial proyectada | Primera versión |
| 11/11/2026 | v2 (borrador) | Divisor de batería 100 kΩ/22 kΩ (antes 1 kΩ/2 kΩ); motores de 100 a 170 rpm; fusible de acción lenta; acople metálico de 4 mm; HC-SR04P a 3,3 V | Revisión de la lista v1: el divisor anterior dañaba el pin del ESP32. Detalle en docs/requerimientos/borrador-requerimientos.md |
| 11/11/2026 | v3 | Motores: 2 kits Emoshayoga JGA25-371 con encoder, soporte, rueda de 65 mm y acople ([Amazon](https://www.amazon.com/dp/B0H2JP84J7)), versión Speed 200 recomendada. Se quitan las ruedas de Mercado Libre | Las ruedas de ML eran para eje TT. En ML no hay JGA25 de 12 V con encoder a buen precio. Cálculo de velocidad en prototipos/P03-motores/avance-01-colab |
| 11/11/2026 | v3 | Pilas: 3 × EVE INR18650-25P ([ML](https://articulo.mercadolibre.com.ve/MLV-1029451794-eve-inr18650-25p-2500mah-37v-pilas-recargables-cilindricas-_JM)) | Marca real, 30 A de descarga. Las "9800 mAh" del listado original no son reales |
| 11/11/2026 | v3 | ESP32: paquete de 3 AITRIP de 30 pines, USB-C, con placa de borneras ([Amazon](https://www.amazon.com/dp/B0FBV7QGC4)), en el mismo pedido que los motores | Una para el robot y dos como balizas de inicio y fin (calibración y P04). Cada una sale en US$ 6,66 |
| 11/11/2026 | v3 | BMS: 3S 25 A con balanceo, daier, 2 placas ([Amazon](https://www.amazon.com/dp/B07JMY631D)), en el pedido de Amazon | Dice "W/Balance" y tiene 717 opiniones; en Mercado Libre la mayoría de los 3S 20A no tienen balanceo |
| 11/11/2026 | v3 | Porta pilas 3 × 18650 con cables, 2 unidades ([ML](https://articulo.mercadolibre.com.ve/MLV-918553422-porta-bateria-18650-x3-2-unidades-_JM)) | Uno para el robot y uno de repuesto; el de 5 unidades de Amazon era demasiado |
