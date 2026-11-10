#!/bin/sh
# Compila ar/paginas/ em ar/prototipo/targets.mind (ver compilar-alvos.mjs).
# Roda no Docker, sem precisar de Node na máquina. A 1ª vez instala as
# dependências em ar/ferramentas/node_modules/ (fora do git).
#
# Uso, a partir de testephaser/:   sh ar/ferramentas/compilar-alvos.sh
set -e
cd "$(dirname "$0")/../.."

docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:22 sh -c '
  set -e
  [ -d ar/ferramentas/node_modules/mind-ar ] || npm install --prefix ar/ferramentas --no-audit --no-fund
  node ar/ferramentas/compilar-alvos.mjs
'
