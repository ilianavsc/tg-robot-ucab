# P03 · Avance 1 · ¿Qué tan rápido va el robot?
# Se corre en Google Colab (colab.research.google.com), una celda por bloque.

import math

# ---------- Celda 1: velocidad "en el papel" (12 V, sin peso) ----------
diametro_rueda = 0.065   # metros (65 mm)

for rpm in [100, 130, 170]:
    velocidad = math.pi * diametro_rueda * rpm / 60
    print(rpm, "rpm  ->", round(velocidad, 2), "m/s")

# Resultado (11 nov 2026):
# 100 rpm  -> 0.34 m/s
# 130 rpm  -> 0.44 m/s
# 170 rpm  -> 0.58 m/s


# ---------- Celda 2: velocidad estimada en el robot ----------
# Supuestos (se confirman midiendo en P03):
#  - La batería 3S da unos 11 V y el L298N se come unos 2 V -> al motor le llegan ~9 V
#  - El peso del robot lo frena cerca de 20 %
voltaje_motor = 9      # voltios que le llegan al motor con L298N
voltaje_nominal = 12   # voltios a los que el fabricante mide las rpm
por_peso = 0.8         # 80 % de la velocidad sin carga

for rpm in [100, 130, 170]:
    papel = math.pi * diametro_rueda * rpm / 60
    robot = papel * (voltaje_motor / voltaje_nominal) * por_peso
    print(rpm, "rpm  ->", round(robot, 2), "m/s en el robot")

# Resultado esperado:
# 100 rpm  -> 0.2 m/s en el robot
# 130 rpm  -> 0.27 m/s en el robot
# 170 rpm  -> 0.35 m/s en el robot
