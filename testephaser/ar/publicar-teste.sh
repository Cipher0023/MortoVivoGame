#!/bin/sh
# Publica o protótipo de AR em https://teste.cristiancobra.com.br/ar/
# Junta ar/prototipo/ com o que ele usa do jogo (códigos das fases e quadros
# do Guri), sem duplicar esses arquivos no repositório.
#
# Uso, a partir de testephaser/:   sh ar/publicar-teste.sh
set -e
cd "$(dirname "$0")/.."

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

cp ar/prototipo/index.html ar/prototipo/targets.mind ar/prototipo/alvos.json "$OUT/"
cp src/config/phases.js "$OUT/"
mkdir "$OUT/guri"
cp public/assets/boy/walk_*.png "$OUT/guri/"

rsync -a --delete --chmod=D755,F644 "$OUT/" cobra:/var/www/cristiancobra-teste/ar/

for file in "" targets.mind phases.js guri/walk_01.png; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://teste.cristiancobra.com.br/ar/$file")
  echo "$code  /ar/$file"
done
