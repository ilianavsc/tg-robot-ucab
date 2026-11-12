# Cambios en la lista de materiales

| Fecha | Versión | Qué cambió | Por qué (prueba o motivo) |
|---|---|---|---|
| 10/11/2026 | v1 | Lista inicial proyectada | Primera versión |
| 11/11/2026 | v2 (borrador) | Divisor de batería 100 kΩ/22 kΩ (antes 1 kΩ/2 kΩ); motores de 100 a 170 rpm; fusible de acción lenta; acople metálico de 4 mm; HC-SR04P a 3,3 V | Revisión de la lista v1: el divisor anterior dañaba el pin del ESP32. Detalle en docs/requerimientos/borrador-requerimientos.md |
| 11/11/2026 | v3 | Motores: 2 kits Emoshayoga JGA25-371 con encoder, soporte, rueda de 65 mm y acople ([Amazon](https://www.amazon.com/dp/B0H2JP84J7)), versión Speed 200 recomendada. Se quitan las ruedas de Mercado Libre | Las ruedas de ML eran para eje TT. En ML no hay JGA25 de 12 V con encoder a buen precio. Cálculo de velocidad en prototipos/P03-motores/avance-01-colab |
| 11/11/2026 | v3 | Pilas: 3 × EVE INR18650-25P ([ML](https://articulo.mercadolibre.com.ve/MLV-1029451794)) | Marca real, 30 A de descarga. Las "9800 mAh" del listado original no son reales |
