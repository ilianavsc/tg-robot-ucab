# Capítulo III. Marco Metodológico

> **Borrador v0.1 · 19/11/2026 · pendiente de revisión por el tutor.**
> Las marcas **[POR COMPLETAR]** indican datos que aún no existen o que no están en el repositorio; las marcas **[VERIFICAR]** indican afirmaciones normativas o citas que hay que contrastar con la guía de Trabajo de Grado de la Escuela de Telecomunicaciones antes de entregar. Al final hay una lista de pendientes (sección III.7).

## III.1 Introducción

Este capítulo describe cómo se llevó a cabo el trabajo: el tipo de investigación, el diseño adoptado, las técnicas e instrumentos con los que se obtuvieron los datos y las fases en que se organizó el desarrollo de un robot móvil de bajo costo para la búsqueda y el transporte de componentes electrónicos en el laboratorio de Telecomunicaciones de la UCAB, junto con la aplicación que permite pedirlos y recibir avisos.

El capítulo responde al objetivo general y a los objetivos específicos planteados en el Capítulo I:

- **Objetivo general:** **[POR COMPLETAR: copiar del Capítulo I]**
- **Objetivos específicos:** **[POR COMPLETAR: copiar y numerar; en el repositorio solo está citado el Objetivo 2, la selección del hardware (`docs/tomo/objetivo-2-seleccion-hardware.md`)]**

## III.2 Nivel de la investigación: Proyecto Especial

### III.2.1 Definición y encuadre

Este trabajo se enmarca en la modalidad de **Proyecto Especial de Ingeniería**: su resultado principal no es solo conocimiento descriptivo o explicativo, sino un **producto tecnológico original** (un sistema robot + aplicación + protocolo de comunicación) que se diseña, se construye y se valida frente a requerimientos medibles. **[VERIFICAR: definición textual de "Proyecto Especial" en la normativa de Trabajo de Grado de la UCAB; no se encontró publicada con ese nombre (ver los documentos a consultar en la sección III.7).]**

En la clasificación de tipos de investigación de Hurtado de Barrera (2010), esta modalidad corresponde a la **investigación proyectiva**: la que, a partir de una indagación previa de la situación, propone y desarrolla una solución a una necesidad práctica, y no se limita a describirla o explicarla. Como el resultado es un artefacto, el trabajo tiene además carácter **aplicado** y se complementa con una evaluación experimental del prototipo (sección III.3).

### III.2.2 Justificación del nivel

| Criterio | Cómo se cumple en este trabajo |
|---|---|
| Hay una necesidad real y levantada en campo | En la entrevista del 14/11/2026 al encargado del taller se constató que el estudiante siempre debe ir a buscar el componente (el taller lo entrega, pero nunca lo lleva) y que **no existe ningún registro** de quién se llevó qué ni para qué. |
| Se produce un artefacto, no solo un diagnóstico | Robot móvil (ESP32, tracción diferencial, seguidor de línea, ultrasonidos), firmware, aplicación Flutter y contrato de mensajes MQTT. |
| La solución se valida contra criterios previos | Cada requerimiento (RF/RNF) tiene un criterio de aceptación definido **antes** de medir (sección III.3.3). |
| Hay iteración con evidencia | 13 prototipos (P01 a P13) con ficha, registro de decisiones y bitácora semanal. |

### III.2.3 Alcance y límites

**Dentro del alcance:** un prototipo funcional que circula por el pasillo del laboratorio entre las 7:00 y las 18:00, sigue una línea, se detiene ante obstáculos, recibe pedidos y órdenes por MQTT, informa su estado, genera alertas (obstáculo, fallo de sensor, batería, inactividad y antirrobo) y se carga en el cuarto de componentes.

**Fuera del alcance:** versión comercial o de producción, flota de varios robots, navegación en espacios sin línea guía, cambios en la infraestructura de red de la universidad y el mecanismo de carga de las piezas (bandeja o pinza), que sigue **abierto** hasta cerrar el estudio del pedido típico (3 o 4 piezas muy livianas).

## III.3 Diseño de la investigación: Prototipo

### III.3.1 Estrategia de diseño

Arias (2012) define el diseño de la investigación como la estrategia general que adopta el investigador para responder al problema planteado y lo clasifica en documental, de campo y experimental. Este trabajo combina el diseño **experimental** (el prototipo se mide bajo condiciones controladas, en simulación y en banco) con el de **campo** (la validación final en el laboratorio de la UCAB), apoyados en revisión **documental** (hojas de datos y normas).

El diseño es de **desarrollo de prototipos evolutivos con validación experimental**: el sistema se divide en prototipos pequeños, cada uno con un propósito medible; cada prototipo se simula, se construye, se mide y termina con una **ficha** y una **decisión documentada**. Se combinan tres entornos de validación:

| Entorno | Qué es | Ejemplos en el proyecto | Qué permite afirmar |
|---|---|---|---|
| **SIL** (*Software In the Loop*) | La lógica se ejecuta sin hardware: el firmware compilado en el PC con imitaciones del ESP32, o emulado en el navegador | `firmware/pruebas_pc/` (58 comprobaciones), P10 (ESP32 virtual), Modo Demo de la app, simuladores 3D de P01, P03 y P08 | Que la **lógica** y el **contrato de mensajes** son correctos |
| **HIL** (*Hardware In the Loop*) | El mismo firmware en el **ESP32 real** con los **sensores y motores reales** | Plantilla de mediciones `prototipos/P02-sensores/README.md` | Que el **sistema físico** cumple los criterios de aceptación |
| **Campo** | El robot completo en el laboratorio de la UCAB | Fases VI y VII | Que el sistema funciona en el **entorno real** (Wi-Fi, piso, luz, personas) |

Regla de rigor: un resultado solo pasa de "validado en simulación" a "validado" cuando tiene su registro HIL o de campo con fecha, condiciones y evidencia. Lo medido en SIL **no se extrapola** al robot físico.

### III.3.2 Prototipos

La numeración oficial es P01 a P13 (fuente: `datos/proyecto.js`). Estado al 19/11/2026:

| Código | Prototipo | Propósito | Estado |
|---|---|---|---|
| P01 | MQTT base | Comunicación robot ↔ app (QoS, confirmaciones, última voluntad) | Hecho (simulación): 7/7 pruebas, 50/50 pedidos |
| P02 | Los sentidos del robot | 4× TCRT5000 (línea) y 2× HC-SR04P (frente y atrás) | En pruebas (simulación); HIL en diciembre |
| P03 | Motores que van parejo | Tracción diferencial, PWM, encoders, PID | En pruebas (simulación) |
| P04 | ¿BLE o QR? | Re-localización en puntos de referencia | Pendiente (Fase II) |
| P05 | Robot virtual y puente | Puente MQTT a Firebase | Pendiente |
| P06 | Primera versión de la app | Pedidos y estado (con Firebase) | Pendiente |
| P07 | El cerebro completo | Firmware integrado (`robot_integrado.ino`) | En pruebas (lógica validada en PC) |
| P08 | Seguir la línea | Control PD a 100 Hz sobre 4 sensores | En pruebas (simulación) |
| P09 | Interfaz Web / Modo Demo | App Flutter Web: órdenes, telemetría, alertas y analítica | Hecho |
| P10 | Simulador ESP32 Virtual | Robot virtual en el navegador (gemelo digital) | Hecho |
| P11 | La alarma llega al teléfono | Centro de alertas en la app | En pruebas (simulación) |
| P12 | Pruebas y estadística | Analítica de sesión y reporte CSV | En pruebas (simulación) |
| P13 | Radar ultrasónico | Distancias frente y atrás, zonas de aviso y parada | En pruebas (simulación) |

> **P09 ≠ P10.** P09 es la aplicación que usa el operador; P10 es el robot virtual que le habla por MQTT. Juntos forman el *gemelo digital* con el que se valida el software antes de recibir el hardware (pedido de Amazon: llegada estimada a Miami entre el 15 y el 28 de diciembre de 2026).

### III.3.3 Variables, indicadores y criterios de aceptación

Los criterios provienen de los requerimientos (`datos/proyecto.js`, `docs/requerimientos/`). Un **?** indica un valor aún por definir con el tutor o con la visita al laboratorio.

| Variable (requerimiento) | Indicador | Instrumento de medición | Criterio de aceptación | Estado |
|---|---|---|---|---|
| Fiabilidad del canal de pedidos (RF-01, RNF-04) | Pedidos confirmados / enviados; latencia de la confirmación (s) | Registro de mensajes MQTT en CSV; banco de pruebas P01; MQTTX | 0 pedidos perdidos en 50 | Simulación: 0 perdidos, latencia media 4,1 s. Falta con ESP32 real |
| Periodicidad de la telemetría (RF-02) | Intervalo entre mensajes de estado | Campo `t` del mensaje y marca de tiempo de llegada | 1 mensaje cada 2 s | Validado en simulación |
| Detección de desconexión (RF-03) | Tiempo desde la caída hasta el aviso (última voluntad, LWT) | Cronómetro y registro del broker | Menos de 30 s | Simulación: 22 s |
| Seguimiento de línea (RF-04) | Error lateral al llegar (cm) y velocidad (m/s) | Campo `linea_mm`, cinta métrica, cronometraje | Error ≤ **? cm** | Simulación: da la vuelta a 0,41 m/s en una pista provisional |
| Detección de obstáculos (RF-05, RNF-07) | Distancia de parada (cm); tiempo de parada (ms) | HC-SR04P, cinta métrica, video | Se detiene a ≥ 20 cm | Lógica validada en SIL; HIL pendiente |
| Velocidad (RNF-03) | Velocidad en recta (m/s) | Encoders y cronometraje sobre distancia conocida | Entre 0,35 y 0,6 m/s | Estimada ~0,57 m/s (cálculo con L298N y carga) |
| Alarma (RF-08) | Alertas recibidas por evento; falsas alarmas por recorrido | Centro de alertas (P11) y registro | Llega 1 sola vez; ≤ **? falsas alarmas** en **N** recorridos | Pendiente |
| Energía (RNF-02) | Tensión de batería (V); autonomía (min) | Multímetro y campo `bateria_v` | Corte seguro a 9,90 V; cubrir la jornada, ≥ **? min** continuos | Autonomía estimada ~3 h (cálculo) |
| Repetibilidad (RNF-08) | Repeticiones por prueba | Plantillas HIL | Mínimo 20 | Fase VII |

### III.3.4 Unidad de estudio y entorno

La unidad de estudio es el **sistema completo** (robot, aplicación y canal MQTT) operando en el **pasillo del laboratorio de Telecomunicaciones de la UCAB**, desde el mostrador de entrega hasta los estantes. Los datos del entorno (distancias, ancho de pasillo, tipo de piso, luz, obstáculos, tomacorrientes) se levantan con la hoja de observación (sección III.4). **[POR COMPLETAR: resultados de la visita de observación y de la prueba H0 de Wi-Fi.]**

### III.3.5 Trazabilidad de las decisiones de diseño

Cada decisión técnica se registra con **fecha, decisión, razón y evidencia** (`TG.decisiones` en `datos/proyecto.js`, página *Decisiones* del portafolio). Ejemplos: umbrales de obstáculo (parada a 20 cm, aviso a 50 cm), fail-safe del modo manual (5 s sin órdenes: frena y se queda en manual), corte por batería a 9,90 V con rearme por encima de 10,10 V, y elección del motor *Speed 200* frente al *Speed 130*. El código fuente se versiona en Git, de modo que cada sesión de prueba puede ligarse al *commit* exacto del firmware.

## III.4 Técnicas e instrumentos de recolección de datos

### III.4.1 Técnicas e instrumentos

Siguiendo a Arias (2012), una **técnica** es el procedimiento o la forma particular de obtener datos o información, y un **instrumento** es el recurso, dispositivo o formato (en papel o digital) que se utiliza para obtener, registrar o almacenar esa información. La tabla separa ambos conceptos para cada fuente de datos del proyecto.

| # | Técnica | Instrumento | Qué se registra | Dónde queda |
|---|---|---|---|---|
| 1 | **Entrevista semiestructurada** | Guía de 13 preguntas en 5 bloques: el pedido de hoy, dónde están las cosas, quién y cómo, el robot en el laboratorio y material | Demanda, tamaño y peso de los pedidos, horarios, reglas, red Wi-Fi, carga, preocupaciones de seguridad | `docs/requerimientos/borrador-requerimientos.md`; `TG.entrevista` (realizada el 14/11/2026) |
| 2 | **Observación directa** | Hoja de observación de 10 aspectos (recorrido, pasillos, piso, luz, obstáculos, estantes, demanda, Wi-Fi, carga, fotos) | Medidas y condiciones del entorno de operación | `TG.observacion`; resultados **[POR COMPLETAR]** |
| 3 | **Revisión documental** | Hojas de datos de los componentes (ESP32-WROOM-32, JGA25-371, L298N, HC-SR04P, TCRT5000, BMS 3S) y la especificación MQTT 3.1.1 (Banks y Gupta, 2014) | Parámetros eléctricos y límites de operación | Capítulo II; `docs/tomo/objetivo-2-seleccion-hardware.md`; `docs/sensores.md` |
| 4 | **Experimentación en simulación (SIL)** | Banco de pruebas P01, simuladores 3D (P01, P03, P08), ESP32 virtual P10, pruebas del firmware en el PC (58 comprobaciones), pruebas de la app (`flutter test`) | Resultados de pruebas, tiempos, conteos de mensajes | `prototipos/*/evidencias/`, `prototipos/P01-mqtt-base/datos/*.csv`, `firmware/pruebas_pc/` |
| 5 | **Medición en banco y campo (HIL)** | Monitor Serie (115200), MQTTX, multímetro, cinta métrica, cronómetro y video; plantilla `prototipos/P02-sensores/README.md`; lista de cotejo eléctrica y de flasheo | Calibración ADC, exactitud de distancia, latencia de parada, tensión de corte, repeticiones | `docs/guia_pruebas_lab.md`, `docs/checklist_hardware.md`, `docs/checklist_flasheo.md`, `docs/sensores.md` |
| 6 | **Registro automático de sesión** | Analítica de Sesión de la app (P12) con exportación CSV | Velocidad media y máxima, distancia frontal mínima válida, error medio absoluto de línea, paquetes y paradas de emergencia | Archivo `sesion_robot_AAAAMMDD_HHMMSS.csv` por sesión |
| 7 | **Registro de proceso** | Bitácora semanal y registro de decisiones | Qué se hizo, qué se aprendió, qué sigue y por qué se decidió | Páginas *Bitácora* y *Decisiones*; historial de Git |

### III.4.2 Características de los instrumentos de medición

| Instrumento | Magnitud | Resolución / observación |
|---|---|---|
| Multímetro | Tensión de batería | **[POR COMPLETAR: modelo y resolución]**. Se usa para contrastar la lectura del ADC (divisor 100 kΩ / 22 kΩ) |
| Cinta métrica | Distancia de parada y exactitud de los HC-SR04P | Resolución de 1 mm; se registran 5 lecturas por distancia |
| Cronómetro / video | Tiempos de parada y de confirmación | **[POR COMPLETAR: resolución]**; el video permite medir cuadro a cuadro |
| HC-SR04P | Distancia (2 a 400 cm) | Los dos sensores se leen alternados cada 100 ms (cada uno cada 200 ms); fallo declarado tras 3 lecturas sin eco (600 ms) |
| Encoders de los motores | Velocidad de rueda | 937 cuentas por vuelta de rueda con cuadratura (11 × 21,3 × 4) |
| Reloj interno del ESP32 (`millis()`) | Marca de tiempo `t` de cada mensaje | Reloj del robot, distinto del reloj del teléfono: no se mezclan en el cálculo de latencias |

### III.4.3 Plan de análisis de los datos

1. **Estadística descriptiva** por prueba: media, desviación estándar muestral, mínimo y máximo, con *n* ≥ 20 repeticiones (RNF-08).
2. **Comparación con el criterio de aceptación** definido en la sección III.3.3; se reporta cuántas repeticiones lo cumplen.
3. **Tasas de éxito con su incertidumbre.** Cero fallos en *n* repeticiones no prueba una tasa de fallo igual a cero: con *n* = 20 solo permite afirmar una tasa de fallo de **hasta ≈ 14 %** (límite superior unilateral al 95 %, método exacto de Clopper y Pearson, 1934); con *n* = 50, hasta **≈ 6 %**. Por eso el resultado de P01 (50/50 en simulación) se presenta como evidencia de la lógica del protocolo, no como la fiabilidad del sistema real. **[VERIFICAR con el tutor el método estadístico y el nivel de confianza.]**
4. **Presentación** en tablas y gráficos generados a partir de los CSV de cada sesión, que se conservan como anexo.
5. **Condiciones registradas en cada sesión:** fecha, responsable, *commit* del firmware, tensión inicial de batería, tipo de piso y luz.

## III.5 Fases de la metodología

### III.5.1 Visión general

El trabajo se organiza en **7 fases** durante **32 semanas** (26/10/2026 al 11/06/2027). La semana de parciales (11 al 16/01/2027) se usa como semana extra de trabajo de la Fase III.

| Fase | Período | Semanas | Objetivo | Hito |
|---|---|---|---|---|
| I. Revisión y levantamiento | 26 oct – 20 nov 2026 | 1 a 4 | Definir requerimientos y seleccionar el hardware | Documento de requerimientos y matriz de hardware |
| II. Diseño del sistema | 23 nov – 18 dic 2026 | 5 a 8 | Diseñar la arquitectura, el chasis y el esquema electrónico | Planos del chasis, diagramas y arquitectura de red |
| III. Construcción y firmware | 21 dic 2026 – 5 feb 2027 | 9 a 14 | Montar la plataforma y programar PID, sensores y cliente MQTT | Plataforma armada y firmware funcional |
| IV. Navegación progresiva | 8 feb – 12 mar 2027 | 15 a 19 | Mapeo relativo, fusión de sensores y re-localización | Navegación validada con medición de errores |
| V. App y backend | 15 mar – 16 abr 2027 | 20 a 24 | Aplicación, Firebase, notificaciones y trazabilidad | Aplicación integrada y funcional |
| VI. Integración y alertas | 19 abr – 7 may 2027 | 25 a 27 | Unir hardware y software; evaluar falsas alarmas | Prototipo integrado con alertas |
| VII. Pruebas y redacción final | 10 may – 11 jun 2027 | 28 a 32 | Ensayos con ≥ 20 repeticiones, análisis y redacción | Entrega del Trabajo de Grado |

### III.5.2 Ciclo que se repite en cada prototipo

1. **Definir** el requerimiento y su criterio de aceptación (sección III.3.3).
2. **Simular (SIL):** probar la lógica en el navegador o en el PC antes de tener el hardware.
3. **Implementar** en el firmware o en la aplicación, con control de versiones.
4. **Medir (HIL o campo)** con la plantilla de mediciones y el número de repeticiones previsto.
5. **Decidir y documentar:** registrar la decisión con su evidencia, actualizar la bitácora y la ficha del prototipo.
6. **Revisar:** cada cambio se integra mediante *Pull Request* revisado por la otra integrante del equipo.

### III.5.3 Detalle por fase

**Fase I · Revisión y levantamiento (en curso)**
- *Actividades:* revisión documental, entrevista al encargado del taller (14/11/2026), observación en el laboratorio, prueba H0 de Wi-Fi, selección y compra de hardware, prototipos P01, P03 y P08 en simulación, firmware integrado y gemelo digital (P09 y P10).
- *Instrumentos:* guía de entrevista, hoja de observación, hojas de datos, banco de pruebas P01.
- *Producto:* documento de requerimientos y matriz de hardware v2 (20/11/2026).
- *Criterio de cierre:* requerimientos con criterio de aceptación; hardware pedido; P01 cerrado (7/7 pruebas, 50/50 pedidos en simulación).

**Fase II · Diseño del sistema**
- *Actividades:* especificación de tópicos MQTT y QoS (`docs/arquitectura/topicos-mqtt.md`), modelado CAD del chasis, esquemas electrónicos, P04 (¿BLE o QR?), compilación del firmware con el core ESP32 en el Arduino IDE. El hardware pedido llega a Miami entre el 15 y el 28 de diciembre de 2026 (luego falta el envío a Venezuela), por lo que las primeras mediciones HIL caen entre el final de esta fase y el inicio de la siguiente.
- *Criterio de cierre:* planos y esquemas revisados por el tutor; arquitectura MQTT documentada; firmware compilado sin errores en el Arduino IDE.

**Fase III · Construcción y firmware**
- *Actividades:* impresión 3D y montaje, calibración inicial de sensores (`prototipos/P02-sensores/README.md`), calibración del PID (primero KP y luego KD), pruebas H1 a H10 de seguridad (obstáculos, fallo de sensor, inactividad, corte por batería, órdenes duplicadas).
- *Criterio de cierre:* plataforma armada, calibración registrada y firmware pasando las pruebas HIL de seguridad con repeticiones anotadas.

**Fase IV · Navegación progresiva**
- *Actividades:* mapeo relativo, pruebas híbridas, fusión de sensores (filtro de Kalman) y re-localización con la técnica elegida en P04.
- *Criterio de cierre:* error de posición medido y dentro del criterio de RF-04 (**[POR COMPLETAR: valor en cm]**).

**Fase V · App y backend**
- *Actividades:* aplicación Flutter con usuarios y dos roles (solicitante y encargado), Firebase, notificaciones, historial de pedidos y entregas (RF-09 a RF-11).
- *Criterio de cierre:* notificación en ≤ 5 s y registro consultable de cada pedido y entrega.

**Fase VI · Integración y alertas**
- *Actividades:* integración completa, calibración del acelerómetro y evaluación de falsas alarmas antirrobo (RF-08), broker privado con usuario, contraseña y TLS (RNF-05).
- *Criterio de cierre:* prototipo integrado; falsas alarmas ≤ **[POR COMPLETAR]** en **[POR COMPLETAR]** recorridos.

**Fase VII · Pruebas y redacción final**
- *Actividades:* ensayos con al menos 20 repeticiones por prueba (RNF-08), análisis estadístico según la sección III.4.3, redacción del tomo y preparación de la defensa.
- *Criterio de cierre:* todos los requerimientos con su registro HIL o de campo y entrega del Trabajo de Grado el 11/06/2027.

## III.6 Validez, confiabilidad y limitaciones

**Validez.** Los criterios de aceptación se fijan antes de medir. La simulación (SIL) y la prueba física (HIL) se reportan por separado y no se mezclan. Los parámetros supuestos del simulador (por ejemplo, el factor de carga del motor, 0,8, y los valores ADC de piso y cinta, 500 y 3300) se declaran como supuestos y se reemplazan por valores medidos.

**Confiabilidad.** Repetibilidad con al menos 20 repeticiones, condiciones de cada sesión registradas y datos crudos conservados (CSV). El código de las pruebas automáticas se ejecuta en cada *push* mediante GitHub Actions, de modo que la lógica validada en SIL no cambia sin que se note.

**Limitaciones conocidas** (todas documentadas en el repositorio):

- Los resultados de P01 (50/50 pedidos, 22 s de detección de desconexión) son de **simulación**; falta repetirlos con el ESP32 real.
- Se usa un **broker público** (HiveMQ, EMQX o Mosquitto) solo para desarrollo; la latencia depende de internet y no se garantiza en la prueba final. Para esta se prevé un broker privado con TLS.
- La red Wi-Fi de la UCAB pide usuario y clave (WPA2-Enterprise) y el firmware actual usa Wi-Fi simple: se probará con la red interna del laboratorio y se evaluará soporte empresarial.
- La pista del simulador es **provisional** hasta medir el laboratorio.
- Con los ultrasonidos alternados, cada sensor se refresca cada 200 ms; el efecto sobre la distancia de parada debe medirse (prueba H2).
- No se ha comprobado con los módulos reales que, sin objeto en rango, el HC-SR04P entregue el pulso de espera que el firmware interpreta como sensor sano.

**Consideraciones éticas.** La entrevista se realizó a personal de la universidad con fines académicos. **[POR COMPLETAR: consentimiento informado, uso del nombre del entrevistado, permiso para fotografías en el laboratorio.]** El repositorio no contiene credenciales: las claves de Wi-Fi y del broker viven en un archivo local excluido del control de versiones.

## III.7 Referencias del capítulo y pendientes

### Referencias

> Citas en estilo autor-año (APA 7.ª ed.) en todo el capítulo. **[VERIFICAR: añadir la página a las citas de Arias (2012) y Hurtado de Barrera (2010) y confirmar la editorial en la portada del ejemplar.]** El Capítulo II usa referencias numeradas (por ejemplo [26]) y debe migrarse al mismo estilo.

- Arias, F. G. (2012). *El proyecto de investigación: Introducción a la metodología científica* (6.ª ed.). Episteme.
- Banks, A., y Gupta, R. (Eds.). (2014). *MQTT version 3.1.1* (OASIS Standard). OASIS. https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html
- Clopper, C. J., y Pearson, E. S. (1934). The use of confidence or fiducial limits illustrated in the case of the binomial. *Biometrika, 26*(4), 404–413. https://doi.org/10.2307/2331986
- Hurtado de Barrera, J. (2010). *Metodología de la investigación: Guía para una comprensión holística de la ciencia* (4.ª ed.). Quirón Ediciones.

### Pendientes para cerrar el capítulo

1. Copiar el objetivo general y los específicos del Capítulo I (sección III.1).
2. Confirmar con la Escuela el término y la definición oficial de "Proyecto Especial" y citarla en la sección III.2.1. Con una búsqueda pública no se encontró una definición publicada con ese nombre. Documentos a consultar: la [página de Trabajo de Grado de la Escuela](https://ingenieria.ucab.edu.ve/telecomunicaciones/la-escuela/caracas/procesos-academicos/trabajo-de-grado/), el [Reglamento del Trabajo de Grado de la Facultad de Ingeniería](https://ingenieria.ucab.edu.ve/telecomunicaciones/wp-content/uploads/sites/5/2022/06/1.-Reglamento-del-TG-de-la-Facultad-de-Ingenieria.pdf) y el [Instructivo para elaborar el documento del TG](https://ingenieria.ucab.edu.ve/telecomunicaciones/wp-content/uploads/sites/5/2022/06/5.-Instructivo-para-Elaborar-Documento-Libro-Articulo-y-CD-del-TG-de-la-Escuela-de-Ingenieria-en-Telecomunicaciones.pdf) (este último puede indicar el estilo de citas exigido).
3. Completar los resultados de la visita de observación y de la prueba H0 de Wi-Fi (sección III.3.4).
4. Definir los valores marcados con **?** en la tabla III.3.3: error de posición (RF-04), falsas alarmas y recorridos (RF-08), autonomía mínima (RNF-02).
5. Anotar modelo y resolución del multímetro y del cronómetro (sección III.4.2).
6. Redactar las consideraciones éticas (consentimiento y fotografías).
7. Confirmar con el tutor el método estadístico (sección III.4.3).
8. Añadir la página a las citas de Arias (2012) y Hurtado de Barrera (2010), confirmar la editorial de esta última y migrar el Capítulo II al estilo autor-año.
