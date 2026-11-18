#!/usr/bin/env sh
# Compila firmware/robot_integrado.ino en el PC (g++ + stubs del core ESP32)
# con -Wall -Wextra -Werror y corre los escenarios de seguridad.
# Uso:  sh firmware/pruebas_pc/correr.sh
set -e
cd "$(dirname "$0")"
g++ -std=gnu++17 -Wall -Wextra -Wno-unused-parameter -Werror -Istubs \
    -o pruebas_seguridad pruebas_seguridad.cpp
./pruebas_seguridad
