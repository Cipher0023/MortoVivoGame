#!/bin/sh
# Publica o app inteiro (jogo + realidade aumentada) no site de teste
# https://teste.cristiancobra.com.br/, para conferir no celular antes da
# produção. Faz o build no Docker (sem precisar de Node na máquina) e envia
# por rsync, sem sudo (a pasta é do usuário cristiancobra no COBRA).
#
# Uso, a partir de testephaser/:   sh scripts/publicar-teste.sh
#
# Para outro servidor, troque DESTINO e SITE (ou passe pelo ambiente).
set -e
cd "$(dirname "$0")/.."

DESTINO=${DESTINO:-cobra:/var/www/cristiancobra-teste/}
SITE=${SITE:-https://teste.cristiancobra.com.br}

docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:22-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx vite build'

# o site de teste é só isto: --delete apaga da raiz o que não veio do build
rsync -az --delete --chmod=D755,F644 dist/ "$DESTINO"

# confere se o essencial responde (falha o script se algo não abrir)
erro=0
for caminho in "" livro-ar/ "$(cd dist && ls assets/*.mind | head -1)"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE/$caminho")
  echo "$code  /$caminho"
  [ "$code" = 200 ] || erro=1
done
[ "$erro" = 0 ] || { echo "ERRO: algum endereço não respondeu 200."; exit 1; }
echo "Publicado em $SITE"
