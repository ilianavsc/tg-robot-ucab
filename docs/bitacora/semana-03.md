# Semana 3 (9 al 13 de noviembre de 2026)

## Qué hicimos
- Plan de prototipos ajustado al cronograma.
- Revisión de la lista de materiales (versión 1).
- Repositorio en GitHub con estructura, 7 etapas, etiquetas y tareas de la Fase I.
- P01 MQTT base en Wokwi: estado, órdenes, confirmación, aviso de desconexión y reconexión funcionando.

## Qué falló o aprendimos
- Wokwi pausa la simulación si la pestaña queda oculta: el broker avisó "desconectado" (sirvió para probar el LWT).
- La librería PubSubClient solo publica con QoS 0; usamos la librería MQTT de Joel Gaehwiler.

## Qué sigue
- P01: probar la alerta con QoS 2 y las 50 órdenes seguidas.
- Invitar a Andrea al repositorio.
- Confirmar con el laboratorio qué componentes tienen y pedir los motores.
