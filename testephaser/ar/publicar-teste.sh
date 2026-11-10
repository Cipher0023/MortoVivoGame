#!/bin/sh
# Publica o protótipo de AR em https://teste.cristiancobra.com.br/
# Junta ar/prototipo/ com as animações (ar/animacoes/), o que aparece em cada
# página (ar/cenas.json) e os códigos das fases do jogo (src/config/phases.js).
#
# Uso, a partir de testephaser/:   sh ar/publicar-teste.sh
set -e
cd "$(dirname "$0")/.."

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

cp ar/prototipo/index.html ar/prototipo/targets.mind ar/prototipo/alvos.json "$OUT/"
cp ar/cenas.json "$OUT/"
cp src/config/phases.js "$OUT/"

# animacoes.json: { "guri-andando": ["01.png", "02.png", ...], ... }
# (o navegador não lista pastas: o protótipo descobre os quadros por aqui)
mkdir "$OUT/animacoes"
{
  printf '{'
  sep=''
  for dir in ar/animacoes/*/; do
    name=$(basename "$dir")
    files=$(cd "$dir" && ls *.png 2>/dev/null | sort)
    [ -n "$files" ] || continue
    mkdir "$OUT/animacoes/$name"
    cp "$dir"*.png "$OUT/animacoes/$name/"
    printf '%s\n  "%s": [%s]' "$sep" "$name" "$(echo "$files" | sed 's/.*/"&"/' | paste -sd, -)"
    sep=','
  done
  printf '\n}\n'
} > "$OUT/animacoes.json"

# toda animação citada no cenas.json precisa ter a pasta com quadros
missing=0
for name in $(grep -o '"animacao" *: *"[^"]*"' ar/cenas.json | sed 's/.*"\([^"]*\)"$/\1/' | sort -u); do
  if [ ! -d "$OUT/animacoes/$name" ]; then
    echo "ERRO: o cenas.json usa a animação \"$name\", mas ar/animacoes/$name/ não existe ou não tem PNG."
    missing=1
  fi
done
[ "$missing" = 0 ] || exit 1

# o protótipo ocupa o site inteiro: --delete apaga da raiz o que não veio daqui
rsync -a --delete --chmod=D755,F644 "$OUT/" cobra:/var/www/cristiancobra-teste/

for file in "" targets.mind cenas.json animacoes.json phases.js; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://teste.cristiancobra.com.br/$file")
  echo "$code  /$file"
done
