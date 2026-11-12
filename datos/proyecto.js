/*
  DATOS DEL PROYECTO
  Este es el único archivo que hay que editar para actualizar el sitio.
  Fechas siempre en formato AAAA-MM-DD.
*/
window.TG = {
  titulo: "Robot móvil de búsqueda y transporte",
  autoras: "Iliana Semprun y Andrea Ferrer",
  tutor: "Ing. Biagio Cante",
  repo: "https://github.com/ilianavsc/tg-robot-ucab",
  inicio: "2026-10-26",
  fin: "2027-06-11",
  totalSemanas: 32,

  fases: [
    { id: "I", nombre: "Revisión y levantamiento", inicio: "2026-10-26", fin: "2026-11-20", semanas: "1 a 4",
      que: "Revisión documental, entrevistas al personal técnico y observación directa en el laboratorio para definir requerimientos y seleccionar el hardware.",
      hito: "Documento de requerimientos y matriz de hardware" },
    { id: "II", nombre: "Diseño del sistema", inicio: "2026-11-23", fin: "2026-12-18", semanas: "5 a 8",
      que: "Arquitectura MQTT (tópicos y QoS), modelado CAD del chasis y esquema electrónico del ESP32.",
      hito: "Planos del chasis, diagramas y arquitectura de red" },
    { id: "III", nombre: "Construcción y firmware", inicio: "2026-12-21", fin: "2027-02-05", semanas: "9 a 14",
      que: "Impresión 3D y montaje del chasis. Programación del PID, los sensores y el cliente MQTT en el ESP32.",
      hito: "Plataforma armada y firmware funcional" },
    { id: "IV", nombre: "Navegación progresiva", inicio: "2027-02-08", fin: "2027-03-12", semanas: "15 a 19",
      que: "Mapeo relativo, pruebas híbridas, fusión de sensores (Kalman) y re-localización con QR o BLE.",
      hito: "Navegación validada con medición de errores" },
    { id: "V", nombre: "App y backend", inicio: "2027-03-15", fin: "2027-04-16", semanas: "20 a 24",
      que: "App en Flutter, integración con Firebase, notificaciones y trazabilidad.",
      hito: "Aplicación integrada y funcional" },
    { id: "VI", nombre: "Integración y alertas", inicio: "2027-04-19", fin: "2027-05-07", semanas: "25 a 27",
      que: "Unión de hardware y software. Calibración del acelerómetro y evaluación de falsas alarmas antirrobo.",
      hito: "Prototipo integrado con alertas" },
    { id: "VII", nombre: "Pruebas y redacción final", inicio: "2027-05-10", fin: "2027-06-11", semanas: "28 a 32",
      que: "Ensayos en maqueta (mínimo 20 repeticiones), análisis estadístico, redacción del tomo y preparación de la defensa.",
      hito: "Entrega del Trabajo de Grado" }
  ],

  eventos: [
    { nombre: "Semana extra (parciales)", inicio: "2027-01-11", fin: "2027-01-16", tipo: "extra",
      nota: "Era pausa por exámenes, pero seguimos trabajando: es una semana de ventaja para la Fase III." },
    { nombre: "Ventana de oro", inicio: "2027-03-15", fin: "2027-04-09", tipo: "oro",
      nota: "Sin clases: tiempo para el trabajo pesado." }
  ],

  /* estado: "hecho" | "pruebas" | "pendiente" */
  prototipos: [
    { codigo: "P01", nombre: "Así se hablan el robot y la app", tema: "MQTT", semana: 3, estado: "hecho", url: "prototipos/P01-mqtt-base/" },
    { codigo: "H0", nombre: "Wi-Fi del laboratorio", tema: "Red", semana: 4, estado: "pendiente" },
    { codigo: "P02", nombre: "Los sentidos del robot", tema: "Sensores", semana: 5, estado: "pendiente" },
    { codigo: "P03", nombre: "Motores que van parejo", tema: "PID", semana: 6, estado: "pendiente", url: "prototipos/P03-motores/avance-01-colab/" },
    { codigo: "P04", nombre: "¿BLE o QR?", tema: "Ubicación", semana: 7, estado: "pendiente" },
    { codigo: "P05", nombre: "Robot virtual y puente", tema: "Firebase", semana: 9, estado: "pendiente" },
    { codigo: "P06", nombre: "Primera versión de la app", tema: "Flutter", semana: 10, estado: "pendiente" },
    { codigo: "P07", nombre: "El cerebro completo", tema: "Firmware", semana: 12, estado: "pendiente" },
    { codigo: "P08", nombre: "Seguir la línea", tema: "Webots", semana: 13, estado: "pendiente" },
    { codigo: "P09", nombre: "Saber dónde está", tema: "Kalman", semana: 15, estado: "pendiente" },
    { codigo: "P10", nombre: "La app completa", tema: "Flutter", semana: 21, estado: "pendiente" },
    { codigo: "P11", nombre: "La alarma llega al teléfono", tema: "Alertas", semana: 23, estado: "pendiente" },
    { codigo: "P12", nombre: "Pruebas y estadística", tema: "Análisis", semana: 27, estado: "pendiente" }
  ],

  /* Lo que hay que hacer ya. hecho: true cuando se cumpla */
  pendientes: [
    { que: "Cerrar P01: alarma con QoS 2 y 50 órdenes seguidas", fecha: "2026-11-13", hecho: true },
    { que: "Confirmar con el laboratorio qué componentes tienen", fecha: "2026-11-13", hecho: false },
    { que: "Pedido de Amazon: 2 kits de motor (<a href=\"https://www.amazon.com/dp/B0H2JP84J7\">Emoshayoga JGA25-371</a>, Speed 200), 3 ESP32 (<a href=\"https://www.amazon.com/dp/B0FBV7QGC4\">AITRIP</a>), el BMS (<a href=\"https://www.amazon.com/dp/B07JMY631D\">daier 3S 25 A</a>) y el cargador (<a href=\"https://www.amazon.com/dp/B07P8DMSZ8\">TalentCell 12,6 V</a>)", fecha: "2026-11-13", hecho: false },
    { que: "Ajustar el Capítulo II (<a href=\"docs/tomo/capitulo-ii-cambios.md\">lista de cambios</a>)", fecha: "2026-11-13", hecho: false },
    { que: "Entrevistas y observación en el laboratorio + prueba H0", fecha: "2026-11-18", hecho: false },
    { que: "Documento de requerimientos y matriz de hardware v2", fecha: "2026-11-20", hecho: false }
  ],

  /* ---------- REQUERIMIENTOS ----------
     estado: "validado" | "pendiente". Un "?" en el criterio = dato por definir en la visita al laboratorio */
  requerimientos: [
    { id: "RF-01", tipo: "RF", texto: "Recibir pedidos desde la app (componente, cantidad, ubicación) y confirmarlos", criterio: "Cada confirmación trae el número del pedido; 0 pedidos perdidos en 50", valida: ["P01"], estado: "validado", nota: "Validado en simulación (T3 y T4)" },
    { id: "RF-02", tipo: "RF", texto: "Informar su estado de forma periódica", criterio: "Un mensaje cada 2 s", valida: ["P01"], estado: "validado", nota: "Validado en simulación (T2)" },
    { id: "RF-03", tipo: "RF", texto: "Avisar si el robot se desconecta", criterio: "Aviso en menos de 30 s", valida: ["P01"], estado: "validado", nota: "Validado en simulación: 22 s (T6)" },
    { id: "RF-04", tipo: "RF", texto: "Ir por la línea del mostrador al estante y volver", criterio: "Error de posición ≤ ? cm al llegar", valida: ["P08", "H4"], estado: "pendiente" },
    { id: "RF-05", tipo: "RF", texto: "Detectar un obstáculo y detenerse", criterio: "Se detiene a ≥ 20 cm del obstáculo", valida: ["P02"], estado: "pendiente" },
    { id: "RF-06", tipo: "RF", texto: "Re-localizarse en puntos de referencia", criterio: "Corrige su posición en cada punto (BLE o QR)", valida: ["P04", "P09"], estado: "pendiente" },
    { id: "RF-07", tipo: "RF", texto: "Transportar los componentes pedidos", criterio: "Carga hasta ? g sin perder la línea", valida: ["H5"], estado: "pendiente" },
    { id: "RF-08", tipo: "RF", texto: "Alarmar si alguien lo levanta o lo mueve sin una orden", criterio: "La alarma llega a la app 1 sola vez; ≤ ? falsas alarmas en N recorridos", valida: ["P11", "H6"], estado: "pendiente" },
    { id: "RF-09", tipo: "RF", texto: "Permitir pedir, ver el estado y recibir avisos desde la app", criterio: "Notificación en ≤ 5 s", valida: ["P06", "P10"], estado: "pendiente" },
    { id: "RF-10", tipo: "RF", texto: "Registrar quién pidió qué y cuándo", criterio: "Historial consultable en la app", valida: ["P10"], estado: "pendiente", nota: "Confirmar en la entrevista" },
    { id: "RF-11", tipo: "RF", texto: "Pedir usuario para entrar a la app", criterio: "Solo usuarios autorizados hacen pedidos", valida: ["P06"], estado: "pendiente", nota: "Definir roles en la entrevista" },
    { id: "RNF-01", tipo: "RNF", texto: "Bajo costo", criterio: "Total ≤ US$ ? (compras proyectadas: unos US$ 90, más lo que preste el laboratorio)", valida: ["Lista v1"], estado: "pendiente" },
    { id: "RNF-02", tipo: "RNF", texto: "Autonomía", criterio: "≥ ? min de trabajo continuo", valida: ["Entrevista"], estado: "pendiente" },
    { id: "RNF-03", tipo: "RNF", texto: "Velocidad", criterio: "Entre 0,35 y 0,6 m/s", valida: ["P03"], estado: "pendiente", nota: "Motor elegido: Speed 200 (280 rpm sin carga). Estimado con L298N y peso: ~0,57 m/s. Ver P03 avances 1 y 2" },
    { id: "RNF-04", tipo: "RNF", texto: "Comunicación confiable", criterio: "0 pedidos perdidos; confirmación en ≤ ? s con el ESP32 real", valida: ["P01"], estado: "pendiente", nota: "En simulación: 0 perdidos, promedio 4,1 s con VPN" },
    { id: "RNF-05", tipo: "RNF", texto: "Seguridad de la comunicación", criterio: "Broker privado con usuario, contraseña y TLS para las pruebas finales", valida: ["Fase VI"], estado: "pendiente" },
    { id: "RNF-06", tipo: "RNF", texto: "Funcionar en la red del laboratorio", criterio: "El ESP32 llega al broker desde el Wi-Fi de la UCAB", valida: ["H0"], estado: "pendiente" },
    { id: "RNF-07", tipo: "RNF", texto: "Convivir con las personas", criterio: "Se detiene ante obstáculos y respeta las reglas del laboratorio", valida: ["P02", "Entrevista"], estado: "pendiente" },
    { id: "RNF-08", tipo: "RNF", texto: "Resultados confiables", criterio: "Mínimo 20 repeticiones por prueba", valida: ["Fase VII"], estado: "pendiente" }
  ],

  /* ---------- VISITA AL LABORATORIO ---------- */
  entrevista: [
    { grupo: "El pedido de hoy", preguntas: ["¿Qué componentes piden más los estudiantes? Nombren los 10 más pedidos.", "¿Cómo se pide un componente hoy y cuánto tarda la entrega?", "¿Cómo es un pedido típico: cuántas piezas, de qué tamaño y peso?", "¿A qué horas hay más pedidos?"] },
    { grupo: "Dónde están las cosas", preguntas: ["¿Dónde se guardan (estantes, gavetas, cajas)? ¿Se pueden etiquetar o numerar?", "¿Qué pasa cuando un componente no está o se acabó?"] },
    { grupo: "Quién y cómo", preguntas: ["¿Quién debería poder pedir (estudiantes, profesores) y quién aprueba?", "¿Hay que registrar quién se llevó qué y cuándo lo devolvió?"] },
    { grupo: "El robot en el laboratorio", preguntas: ["¿Se permitiría un robot circulando? ¿Hay horarios, zonas o reglas de seguridad?", "¿Qué red Wi-Fi podría usar? ¿Pide usuario o una página de acceso?", "¿Dónde podría cargar su batería?", "¿Qué preocupa más: robo, pérdida o daño? ¿Qué debería hacer la alarma y a quién avisar?"] },
    { grupo: "Material", preguntas: ["¿Qué componentes de nuestra lista nos pueden prestar durante todo el TG (sobre todo el ESP32)?"] }
  ],
  observacion: [
    ["Recorrido", "Distancia del mostrador a cada estante (m)"],
    ["Pasillos", "Ancho más angosto (cm)"],
    ["Piso", "Tipo y color, para elegir el color de la cinta"],
    ["Luz", "Natural o artificial, reflejos en el piso"],
    ["Obstáculos", "Sillas, mochilas, cables, escalones o rampas"],
    ["Estantes", "Altura de la repisa más baja y más alta (cm)"],
    ["Demanda", "Pedidos contados en 1 hora de mucho movimiento"],
    ["Wi-Fi (H0)", "Nombre de la red y si el ESP32 o el teléfono llega al broker en cada punto"],
    ["Carga", "Tomacorrientes cerca del punto de partida"],
    ["Fotos", "Planta del laboratorio, estantes y pasillos"]
  ],

  /* ---------- HARDWARE (matriz v2) ----------
     estado: "por pedir" | "por comprar" | "preguntar al lab" | "corregido" | "abierta" | "listo" */
  materiales: [
    { componente: "Microcontrolador", eleccion: "3 × ESP32-WROOM-32 DevKit de 30 pines, USB-C, CP2102 (AITRIP, con placa de borneras)", alternativa: "Pedirla prestada al laboratorio", porque: "Mismo chip que en Wokwi; 8 entradas analógicas ADC1. Una va en el robot y dos como balizas de inicio y fin para calibrar tiempo y distancia (P04). Con la placa de borneras ocupa 6,3 × 6,6 cm", estado: "por pedir", cuando: "13 nov, en el mismo pedido de Amazon que los motores (US$ 19,99 las 3)", link: "https://www.amazon.com/dp/B0FBV7QGC4" },
    { componente: "Motores", eleccion: "2 kits Emoshayoga JGA25-371, 12 V, con encoder: Speed 200 (280 rpm sin carga, caja 1:21,3, 234 pulsos por vuelta de rueda)", alternativa: "Speed 130 (170 rpm sin carga, caja 1:35,5): más fuerza, pero con L298N queda justo en 0,35 m/s", porque: "Cada kit trae motor con encoder, soporte, rueda de 65 mm y acople. Con L298N y peso: ~0,57 m/s. En Mercado Libre no hay JGA25 de 12 V con encoder a buen precio", estado: "por pedir", cuando: "13 nov (Amazon, US$ 22,39 c/u, llega 27 nov)", link: "https://www.amazon.com/dp/B0H2JP84J7" },
    { componente: "Driver", eleccion: "L298N (módulo rojo con disipador)", alternativa: "TB6612FNG", porque: "Pierde cerca de 2 V, pero aguanta 2 A por motor; cada motor Speed 200 pide hasta 1,8 A trabado, más de lo que soporta el TB6612FNG (1,2 A). Un solo módulo mueve los dos motores. Respaldo en Mercado Libre si el laboratorio no tiene (INNOVTRONIKS, 5 estrellas, más de 100 vendidos)", estado: "preguntar al lab", cuando: "Visita del 16 al 18 nov; si no hay, ML US$ 4", link: "https://articulo.mercadolibre.com.ve/MLV-580141623-l298n-l298-modulo-driver-motor-dc-y-motor-de-pasos-bipolar-_JM" },
    { componente: "Batería", eleccion: "3 × EVE INR18650-25P (2500 mAh, hasta 30 A), en serie (3S)", alternativa: "Samsung INR18650-35E (3500 mAh, US$ 10,50 c/u)", porque: "Marca real y aguanta de sobra el arranque de los motores (hasta 3,6 A los dos). Unas 3 h de autonomía estimada. Las de 9800 mAh son falsas", estado: "por comprar", cuando: "Antes de fin de noviembre (ML, US$ 4,80 c/u, vendedor TECNOPEPIN)", link: "https://articulo.mercadolibre.com.ve/MLV-1029451794-eve-inr18650-25p-2500mah-37v-pilas-recargables-cilindricas-_JM" },
    { componente: "Porta pilas", eleccion: "Porta pilas para 3 × 18650 con cables (2 unidades)", alternativa: "\"Porta Bateria Pila 18650 3s 11.1v Serie\" (ML, US$ 5,70)", porque: "Las pilas se encajan sin soldar. Por detrás se sueldan B1 y B2 del BMS en las láminas entre pila y pila. Al llegar: medir entre el cable rojo y el negro, debe dar 11 a 12,6 V (serie)", estado: "por comprar", cuando: "Mercado Libre, GLAXIAL SUMINISTROS (US$ 3,90 los 2; tienda en Chacaíto)", link: "https://articulo.mercadolibre.com.ve/MLV-918553422-porta-bateria-18650-x3-2-unidades-_JM" },
    { componente: "BMS", eleccion: "BMS 3S 12,6 V 25 A con balanceo (daier, 2 placas)", alternativa: "Mercado Libre: \"3s 25a Bms Carga Proteccion Balanceador\" (US$ 8,45), si se quiere armar la batería antes", porque: "Protege y equilibra las celdas. 25 A seguidos y 34-40 A de pico, de sobra para los 3,6 A de los motores. Corta cada pila entre 2,3 y 3,0 V: el ESP32 debe avisar antes, a 9,9 V en total. Después de conectarlo hay que cargarlo una vez para que dé salida", estado: "por pedir", cuando: "13 nov, en el mismo pedido de Amazon (US$ 9,59 las 2)", link: "https://www.amazon.com/dp/B07JMY631D" },
    { componente: "Cargador", eleccion: "TalentCell 12,6 V / 2 A para baterías de litio 3S (punta 5,5 × 2,1 mm)", alternativa: "Módulo USB-C 3S de ERYTECH (Mercado Libre, US$ 3)", porque: "Cargador de litio de verdad (no una fuente de 12 V): luz roja al cargar y verde al terminar, carga en ~2 h. Necesita un jack DC hembra 5,5 × 2,1 mm en el chasis, conectado a P+ y P- del BMS; se carga con el robot apagado. La fuente de 12 V / 0,5 A que tenemos sirve solo para pruebas en la mesa (sin motores)", estado: "por pedir", cuando: "13 nov, en el mismo pedido de Amazon (US$ 14,99)", link: "https://www.amazon.com/dp/B07P8DMSZ8" },
    { componente: "Puerto de carga", eleccion: "Jack DC hembra 5,5 × 2,1 mm para panel", alternativa: "", porque: "Para enchufar el cargador al robot como una laptop", estado: "preguntar al lab", cuando: "Antes del 18 dic (o ML, menos de US$ 1)" },
    { componente: "Regulador", eleccion: "LM2596 (step down) ajustado a 5 V antes de conectar", alternativa: "Versión con pantalla de voltaje (ML, US$ 7)", porque: "Alimenta el ESP32 y los ultrasónicos. Viene ajustado a cualquier voltaje: girar el potenciómetro midiendo la salida hasta 5,0 V antes de conectar el ESP32, o se quema. Respaldo en ML si el laboratorio no tiene (RAM15D, 4,9 estrellas, más de 100 vendidos)", estado: "preguntar al lab", cuando: "Visita del 16 al 18 nov; si no hay, ML US$ 2,45", link: "https://articulo.mercadolibre.com.ve/MLV-919789104-lm2596-modulo-reductor-convertidor-de-voltaje-dc-ajustable-_JM" },
    { componente: "Medición de batería", eleccion: "Divisor de 100 kΩ y 22 kΩ", alternativa: "INA219", porque: "Deja unos 2,3 V en el pin con la batería llena (1 kΩ y 2 kΩ dañaba el pin)", estado: "corregido", cuando: "" },
    { componente: "Protección", eleccion: "Portafusible aéreo con cables + fusible de 3 A de acción lenta (soplado lento)", alternativa: "", porque: "Aguanta el pico de arranque de los motores. Va en el cable de la batería, sin placa. Ojo: muchos portafusibles aéreos blancos son para fusibles de 6 × 30 mm; el fusible debe ser del mismo tamaño que el portafusible", estado: "preguntar al lab", cuando: "Visita del 16 al 18 nov; si no hay, ML (Solo Carro, US$ 2,20; entrega a acordar)", link: "https://articulo.mercadolibre.com.ve/MLV-1027312578-portafusible-vidrio-1pz-_JM" },
    { componente: "Interruptor", eleccion: "Interruptor basculante redondo con luz, 20 A / 12 V", alternativa: "", porque: "Enciende y apaga el robot; va después del BMS y el fusible. Tiene 3 patas: entrada (+ de la batería), salida (hacia el robot) y tierra, que solo prende la lucecita", estado: "preguntar al lab", cuando: "Visita del 16 al 18 nov; si no hay, ML US$ 3,20 (entrega a acordar, Baruta)", link: "https://articulo.mercadolibre.com.ve/MLV-573931152-switch-interruptor-basculante-de-colores-20a12v-_JM" },
    { componente: "Sensores de línea", eleccion: "4 × módulo TCRT5000 azul de 4 pines (con salida A0) a 3,3 V en pines ADC1", alternativa: "QTR-8A", porque: "La salida A0 dice cuánto se salió de la línea (el PID sigue suave); los módulos negros de 3 pines solo dan sí/no. Los pines ADC2 no leen con el Wi-Fi encendido. Respaldo en ML si el laboratorio no tiene (SFV Security Factory, 5 estrellas; entrega a acordar, Naguanagua)", estado: "preguntar al lab", cuando: "Visita del 16 al 18 nov; si no hay, ML US$ 3,08 c/u (4 o 5)", link: "https://articulo.mercadolibre.com.ve/MLV-550874245-sensor-infrarrojo-tcrt5000-sensor-de-linea-_JM" },
    { componente: "Obstáculos", eleccion: "2 × HC-SR04P (3 a 5,5 V)", alternativa: "HC-SR04 con divisor de 1 kΩ y 2 kΩ", porque: "Funciona a 3,3 V: va directo al ESP32, sin divisor. Respaldo en Amazon (2 piezas con cables, 4,5 estrellas); en ML el mismo par cuesta US$ 22,88", estado: "preguntar al lab", cuando: "Si el lab no tiene: Amazon US$ 6,79 las 2 (puede ir en el pedido del 13 nov)", link: "https://www.amazon.com/dp/B0GL8NJCVT" },
    { componente: "Movimiento y alarma", eleccion: "MPU6050 (GY-521)", alternativa: "", porque: "Odometría y detección de levantamiento. Respaldo en ML si el laboratorio no tiene (INNOVTRONIKS, el mismo vendedor del L298N; 5 estrellas)", estado: "preguntar al lab", cuando: "Visita del 16 al 18 nov; si no hay, ML US$ 5,50", link: "https://articulo.mercadolibre.com.ve/MLV-701887425-giroscopio-gy-521-mpu-6050-modulo-acelerometro-_JM" },
    { componente: "Ruedas", eleccion: "65 mm con acople metálico de 4 mm, incluidas en el kit de motor", alternativa: "Cubo impreso en PLA", porque: "Las de Mercado Libre eran para eje TT y no encajaban en el eje D de 4 mm", estado: "corregido", cuando: "Llegan con los motores", link: "https://www.amazon.com/dp/B0H2JP84J7" },
    { componente: "Rueda loca", eleccion: "Altura igual al eje de las ruedas", alternativa: "", porque: "Mantiene los TCRT5000 a pocos mm del piso", estado: "por comprar", cuando: "Inicio de diciembre" },
    { componente: "Re-localización", eleccion: "ESP32-C3 SuperMini como balizas BLE", alternativa: "Lector de QR (GM65)", porque: "Se decide con la prueba P04", estado: "abierta", cuando: "Fase II (P04); compra en febrero" },
    { componente: "Mecanismo de carga", eleccion: "? (bandeja o pinza)", alternativa: "", porque: "Depende del pedido típico (entrevista)", estado: "abierta", cuando: "Después de la entrevista" }
  ],

  /* ---------- DECISIONES (la más nueva primero) ----------
     estado: "tomada" | "abierta" */
  decisiones: [
    { fecha: "2026-11-11", titulo: "Driver L298N", estado: "tomada",
      decision: "Usar un módulo L298N para los dos motores.",
      porque: "Según la tabla del kit, cada motor Speed 200 pide hasta 1,8 A trabado; el TB6612FNG aguanta 1,2 A seguidos por motor y el L298N 2 A. Se acepta la pérdida de ~2 V: con Speed 200 el robot igual llega a ~0,57 m/s.",
      evidencia: "prototipos/P03-motores/avance-02-simulador-3d/" },
    { fecha: "2026-11-11", titulo: "Motor Speed 200 (280 rpm sin carga)", estado: "tomada",
      decision: "2 kits Emoshayoga JGA25-371 de 12 V con encoder, versión Speed 200 (caja 1:21,3).",
      porque: "En el anuncio \"Speed\" es la velocidad con carga. Con L298N y el peso del robot da ~0,57 m/s, dentro de la meta de 0,35 a 0,6 m/s con cualquier driver, y se frena con PWM. Fuerza nominal 0,4 kg·cm contra ~0,2 kg·cm estimados en piso plano (se confirma en P03). Bloqueado pide 1,8 A por motor.",
      evidencia: "prototipos/P03-motores/avance-02-simulador-3d/" },
    { fecha: "2026-11-11", titulo: "Tres ESP32: robot y dos balizas", estado: "tomada",
      decision: "Comprar un paquete de 3 ESP32-WROOM-32 de 30 pines: una en el robot, una baliza al inicio y otra al final del recorrido.",
      porque: "Las balizas marcan el tiempo de cada recorrido (velocidad real, RNF-03), calibran la distancia de los encoders entre dos puntos medidos y permiten la prueba P04 sin comprar más. La orientación la miden el MPU6050 y los encoders, no las balizas. Si en P04 gana el QR, quedan de repuesto y para pruebas en la mesa.",
      evidencia: "hardware.html" },
    { fecha: "2026-11-11", titulo: "ESP32 de 30 pines", estado: "tomada",
      decision: "DevKit de 30 pines con USB-C y CP2102.",
      porque: "Alcanzan los pines ADC1 para los sensores de línea y es la versión del paquete con placa de borneras, que evita cables sueltos en el robot.",
      evidencia: "hardware.html" },
    { fecha: "2026-11-11", titulo: "Sesión persistente en MQTT", estado: "tomada",
      decision: "El robot se conecta con clean session = false, keep alive 15 s y espera de 10 s.",
      porque: "Con sesión limpia se perdieron 37 de 50 pedidos cuando la red fue lenta. Con sesión persistente: 50 de 50.",
      evidencia: "prototipos/P01-mqtt-base/#t-50" },
    { fecha: "2026-11-11", titulo: "Usar el VPN de Opera para Wokwi", estado: "tomada",
      decision: "Las simulaciones de Wokwi se corren con el VPN de Opera, no con Proton.",
      porque: "Con Proton VPN (plan gratis) el Wi-Fi simulado no conectó a internet; con el de Opera sí.",
      evidencia: "" },
    { fecha: "2026-11-11", titulo: "La semana de parciales es semana de trabajo", estado: "tomada",
      decision: "Del 11 al 16 de enero seguimos trabajando: es una semana extra para la Fase III.",
      porque: "Vamos bien en las materias y la Fase III es la más cargada.",
      evidencia: "cronograma.html" },
    { fecha: "2026-11-11", titulo: "Banco de pruebas en el navegador", estado: "tomada",
      decision: "Las pruebas de comunicación se hacen con una página propia en vez de MQTTX.",
      porque: "Mide tiempos, cuenta pérdidas y repetidos, y descarga los resultados en CSV para el tomo.",
      evidencia: "prototipos/P01-mqtt-base/banco.html" },
    { fecha: "2026-11-11", titulo: "Corregir el divisor de la batería", estado: "tomada",
      decision: "Usar 100 kΩ y 22 kΩ en lugar de 1 kΩ y 2 kΩ.",
      porque: "Con 1 kΩ y 2 kΩ llegarían entre 4,2 y 8,4 V al pin del ESP32, que aguanta 3,3 V.",
      evidencia: "hardware.html" },
    { fecha: "2026-11-10", titulo: "Librería MQTT de Joel Gaehwiler", estado: "tomada",
      decision: "Usar la librería MQTT (lwmqtt) en lugar de PubSubClient.",
      porque: "PubSubClient solo publica con QoS 0, y las alarmas necesitan QoS 2.",
      evidencia: "prototipos/P01-mqtt-base/" },
    { fecha: "2026-11-10", titulo: "Tópicos con prefijo propio y QoS según importancia", estado: "tomada",
      decision: "Estado con QoS 0, pedidos y confirmaciones con QoS 1, alarmas con QoS 2, conexión retenida con LWT.",
      porque: "Perder un estado no importa (llega otro en 2 s); un pedido sí; una alarma debe llegar una sola vez.",
      evidencia: "arquitectura.html" },
    { fecha: "2026-11-10", titulo: "Broker público solo para desarrollo", estado: "tomada",
      decision: "broker.hivemq.com mientras se desarrolla; broker privado con clave y TLS para las pruebas finales.",
      porque: "En el público cualquiera que adivine el tópico podría enviar órdenes o falsas alarmas.",
      evidencia: "" },
    { fecha: "2026-11-10", titulo: "ESP32 clásico y no S2, S3 ni C3", estado: "tomada",
      decision: "ESP32-WROOM-32 para el robot.",
      porque: "Es igual al de Wokwi, tiene Bluetooth (el S2 no) y suficientes pines (el C3 no).",
      evidencia: "hardware.html" },
        { fecha: "", titulo: "Re-localización con BLE o con QR", estado: "abierta", decision: "", porque: "Se decide con la prueba P04 en la Fase II.", evidencia: "" },
    { fecha: "", titulo: "Bandeja o pinza", estado: "abierta", decision: "", porque: "Depende del pedido típico (entrevista en el laboratorio).", evidencia: "" }
  ],

  /* Una entrada por semana, la más nueva primero */
  bitacora: [
    { semana: 3, fechas: "9 al 13 nov 2026",
      hicimos: ["Plan de prototipos ajustado al cronograma", "Repositorio y sitio en GitHub", "Banco de pruebas en el navegador", "P01 cerrado: 7 de 7 pruebas, 50 de 50 pedidos", "Primera simulación en Google Colab: <a href=\"prototipos/P03-motores/avance-01-colab/\">velocidad de los motores</a>", "Simulador 3D de la tracción: <a href=\"prototipos/P03-motores/avance-02-simulador-3d/\">ESP32, puente H, motor y encoder</a>"],
      aprendimos: ["QoS 1 necesita sesión persistente para no perder pedidos", "PubSubClient solo publica con QoS 0", "Wokwi no conecta con Proton VPN gratis; con el VPN de Opera sí", "Wokwi pausa la simulación si la pestaña queda oculta: el broker avisó \"desconectado\" (sirvió para probar el LWT)", "Las rpm de la caja son con 12 V y sin peso; en el robot el motor va cerca de 40 % más lento", "El puente H decide el sentido con 4 interruptores; el PWM decide la fuerza; el encoder da 1 496 cuentas por vuelta de rueda"],
      sigue: ["Entrevistas en el laboratorio", "Pedir los motores", "Documento de requerimientos"] }
  ]
};
