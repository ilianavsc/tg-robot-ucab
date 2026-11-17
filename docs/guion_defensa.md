# Guion de defensa · demostración en 4 pasos

> **🎬 Respaldo visual sin internet:** Si la red del laboratorio falla el jueves, abre directamente **[`assets/evidencias/demo_respaldo.gif`](../assets/evidencias/demo_respaldo.gif)** (grabación de 12 s del flujo completo: P10 encendiendo el ESP32 Virtual y transmitiendo por MQTT → App P09 recibiendo telemetría en tiempo real y confirmando órdenes ACK en milisegundos).

**Duración:** 8 a 10 minutos · **Quién maneja la pantalla:** una sola persona · **Regla:** un paso, una pestaña, una frase.

**Idea central (decirla al inicio):** "Pides un componente desde la app y el robot lo lleva hasta tu puesto. Hoy mostramos que la comunicación app, broker y robot ya funciona y se mide."

---

## Antes de empezar (3 min, antes de que entre el jurado)

1. Abrir 4 pestañas, en este orden, y no cerrarlas:
   - Pestaña 1: `https://ilianavsc.github.io/tg-robot-ucab/`
   - Pestaña 2: `https://ilianavsc.github.io/tg-robot-ucab/prototipos/P10-simulador-esp32/index.html`
   - Pestaña 3: `https://ilianavsc.github.io/tg-robot-ucab/app/`
   - Pestaña 4: `https://ilianavsc.github.io/tg-robot-ucab/prototipos/P01-mqtt-base/simulador-3d/simulador.html`
2. Probar el internet abriendo la pestaña 2 y pulsando **Encender**. Debe decir `CONECTADO EN VIVO`. Luego pulsar **Detener**.
3. Cerrar el sonido del laptop y poner zoom al 110 %.

**Plan B si no hay internet:** la app (pestaña 3) tiene **Modo Demo** y el simulador 3D (pestaña 4) funciona sin red. Se salta el paso 2 y el paso 3 se hace en Modo Demo (decirlo en voz alta: la confirmación es simulada).

---

## Paso 1 · La web y el progreso (1,5 min) · pestaña 1

**Hacer:**
1. Mostrar la barra de avance: **5/12 prototipos listos**.
2. Bajar a la tarjeta de firmware y señalar la insignia **Firmware C++ validado (13/13 tests)**.
3. Abrir **Ver detalle técnico** (se despliega solo).

**Decir:**
- "Cada módulo se valida primero en simulador y luego en el robot físico."
- "Los 13 tests son del código C++ de órdenes y confirmaciones, probados en el PC. Falta la prueba con el ESP32 real: llega el pedido en diciembre."

**Debe verse:** barra 5/12, insignia verde, detalle desplegado con animación suave.

**Pasar al paso 2 con:** "Veamos cómo se comunica el robot."

---

## Paso 2 · El ESP32 Virtual (P10) (2 min) · pestaña 2

**Hacer:**
1. Pulsar **⚡ Encender ESP32 Virtual**.
2. Esperar el mensaje `CONECTADO EN VIVO · HiveMQ` (unos 2 s).
3. Señalar la consola: sale telemetría cada 2 s.

**Decir:**
- "Este navegador actúa como el ESP32: publica su estado cada 2 segundos en el broker."
- "Si HiveMQ falla, salta solo a EMQX y luego a Mosquitto."

**Debe verse:** punto verde, broker conectado, líneas nuevas en la consola cada 2 s.

**Si no conecta en 10 s:** mirar a qué broker intenta (aparece en pantalla). Si ninguno, pasar al Plan B.

**Dejar esta pestaña encendida.**

---

## Paso 3 · La App (P09): órdenes, ACK y latencia (3 min) · pestaña 3

**Hacer:**
1. Pulsar **Conectar** y comprobar `Enlace MQTT · HiveMQ` (debe ser el mismo broker que el P10).
2. Se llenan las tarjetas de batería, modo y tracción: ese es el estado que manda el P10.
3. Pulsar **Adelante**. La caja de abajo pasa de gris a ámbar a verde: `confirmó "adelante" en N ms`.
4. Pulsar **Frenar** (rojo). Misma caja, nueva confirmación.
5. Pulsar **Auto · seguir la línea solo**. En la pestaña 2 el modo del P10 cambia a autónomo.
6. Repetir **Frenar** 3 veces seguidas y decir el rango de milisegundos que se ve.

**Decir:**
- "La app publica la orden con QoS 1: el robot tiene que confirmar. Esa confirmación es el ACK."
- "El número en verde es el tiempo entre pulsar y recibir la confirmación."

**Debe verse:** caja verde con milisegundos, y el cambio de modo en el P10.

**Importante:**
- Con el broker real, el número es medido (red + broker). En **Modo Demo** la confirmación es simulada (300 ms exactos): no presentarla como medida.
- No inventar una cifra: decir solo lo que muestra la pantalla. La mediana de 10 envíos se mide en la prueba física (`docs/centro_de_pruebas.md`).

---

## Paso 4 · Caída y reconexión (2 min)

**Parte A · La app se cae y vuelve (pestaña 3, 30 s)**
1. Pulsar **Desconectar**: el chip pasa a `DESCONECTADO` y los botones de orden se bloquean.
2. Pulsar **Conectar**: vuelve a `CONECTADO` y los botones se activan.

**Decir:** "Si se cae la red, la app lo avisa y no deja enviar órdenes que se perderían."

**Parte B · El robot se cae y el sistema lo detecta (pestaña 4, 1,5 min)**
1. Pulsar **Desconexión (LWT)**: el broker publica el testamento del robot y la pantalla se pone en alerta.
2. Pulsar **Reconectar el robot**: vuelve a `en línea`.

**Decir:**
- "LWT significa última voluntad: cuando el robot se cae sin avisar, el broker avisa por él."
- "En las pruebas con el broker, la caída se detectó en menos de 22 segundos, con 0 órdenes perdidas en 50 pedidos."

**Debe verse:** consola del simulador con el mensaje de desconexión y luego el de reconexión.

> Nota honesta: esta parte B es el simulador 3D de P01 (animación del protocolo). El P10 no envía testamento LWT cuando se pulsa Detener. Si el jurado pregunta, decirlo así.

---

## Cierre (30 s)

"Hoy mostramos la web, el ESP32 virtual, la app con órdenes confirmadas y la caída y reconexión. Lo que sigue: probar el mismo flujo con el ESP32 real y, cuando llegue el pedido, con motores y sensores."

---

## Preguntas probables (respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| ¿Por qué MQTT? | Es liviano, tiene niveles de entrega (QoS) y avisa cuando algo se cae (LWT). |
| ¿Qué es QoS 1? | Llega al menos una vez y el receptor confirma. Por eso existe el ACK. |
| ¿Esto corre en el robot real? | El mismo protocolo sí; el firmware está validado en PC (13/13). Falta la prueba con el ESP32 físico. |
| ¿Qué falta? | Motores, sensores y batería: el pedido llega a Miami entre el 15 y el 28 de diciembre. |
| ¿Y la red del laboratorio? | La red UCAB pide usuario y clave; el firmware usa Wi-Fi simple. Se prueba con la red interna del laboratorio (prueba H0). |

---

## Si algo sale mal (Ubicación / Causa / Solución)

| Ubicación | Causa | Solución |
|---|---|---|
| P10, se queda en `CONECTANDO` | Red bloquea WebSocket | Esperar el salto a EMQX o Mosquitto; si no, Plan B |
| App, no llegan datos | La app usa otro broker que el P10 | Desconectar y Conectar hasta ver el mismo broker |
| App, ACK siempre 300 ms | Está en Modo Demo | Salir del Modo Demo y pulsar Conectar |
| Simulador 3D en blanco | WebGL bloqueado | Recargar la página; si sigue, usar otro navegador |
