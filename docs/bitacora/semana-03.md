# Semana 3 (9 al 13 de noviembre de 2026)

## Qué hicimos
- Plan de prototipos ajustado al cronograma.
- Revisión de la lista de materiales (versión 1).
- Repositorio en GitHub con estructura, 7 etapas, etiquetas y tareas de la Fase I.
- Sitio del proyecto reestructurado: inicio, cronograma, menú compartido y datos en un solo archivo.
- Banco de pruebas en el navegador para enviar pedidos y medir tiempos.
- P01 cerrado: 7 de 7 pruebas con evidencias y 50 de 50 pedidos confirmados.

## Qué falló o aprendimos
- QoS 1 necesita sesión persistente para no perder pedidos.
- PubSubClient solo publica con QoS 0; usamos la librería MQTT de Joel Gaehwiler.
- Wokwi no conecta con Proton VPN gratis; con el VPN de Opera sí.
- Wokwi pausa la simulación si la pestaña queda oculta: el broker avisó "desconectado" (sirvió para probar el LWT).

## Qué sigue
- Entrevistas en el laboratorio.
- Pedir los motores.
- Documento de requerimientos.
