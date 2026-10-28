# Realidade aumentada (protótipo)

O celular reconhece a página do livro, o Guri aparece caminhando sobre ela e
um botão abre a fase correspondente no jogo. Por enquanto é um protótipo
separado do jogo, publicado na raiz de https://teste.cristiancobra.com.br/.

Usa o [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5 com three.js,
carregados de CDN.

## Pastas

- `paginas/`: imagens originais das páginas (ver o README de lá). Não são publicadas.
- `animacoes/`: os personagens animados, uma pasta de quadros PNG por animação.
  O [README de lá](animacoes/README.md) explica como o ilustrador entrega os quadros.
- `cenas.json`: quais animações aparecem em cada página, com posição, tamanho e
  movimento. Trocar ou acrescentar uma animação não exige mexer em código.
- `prototipo/`: a página de AR. O `targets.mind` e o `alvos.json` são gerados
  pelo compilador. Não edite esses dois arquivos à mão.
- `ferramentas/`: o compilador dos alvos.

## Trocar ou acrescentar uma página

1. Coloque a imagem em `paginas/` com o número da fase no nome (`fase2.png`).
2. Compile, a partir de `testephaser/` (precisa de Docker; a 1ª vez demora
   para instalar as dependências):

   ```bash
   sh ar/ferramentas/compilar-alvos.sh
   ```

   Para cada página, ele mostra quantos pontos o celular usa para reconhecer e
   para acompanhar a página, e gera um mapa em
   `ar/ferramentas/.cache/mapas/`. Poucos pontos em "acompanhar" fazem o
   personagem tremer. Áreas lisas, degradês e padrões repetidos não geram pontos.

3. Publique:

   ```bash
   sh ar/publicar-teste.sh
   ```

   O script junta o protótipo, as animações, o `cenas.json` e os códigos das
   fases (`src/config/phases.js`) e envia tudo para a raiz do site, substituindo
   o que estiver lá.

## Testar

Abra https://teste.cristiancobra.com.br/ no celular e aponte para a página,
impressa ou na tela de outro aparelho. Com `?debug=1`, o protótipo desenha a
borda da página reconhecida, o que ajuda a ver se o encaixe treme.
