# Realidade aumentada: o conteúdo

O app reconhece a página do livro pela câmera, mostra os personagens animados
sobre ela e abre a fase daquela página. O código fica em `src/ar/`, e esta
pasta guarda só o **conteúdo**, que muda de um livro para outro. O Vite
empacota tudo daqui no build, então trocar uma animação ou acrescentar uma
página não exige mexer em código.

O fluxo completo, a acessibilidade e como fazer o seu livro estão em
[Docs/livro-com-realidade-aumentada.md](../../Docs/livro-com-realidade-aumentada.md).

## Pastas

- `paginas/`: imagens originais das páginas (ver o README de lá). Entram só na
  compilação, não no site.
- `alvos/`: o resultado da compilação (`targets.mind` e `alvos.json`). Não edite
  à mão.
- `animacoes/`: os personagens animados, uma pasta de quadros PNG por animação.
  O [README de lá](animacoes/README.md) explica como o ilustrador entrega os
  quadros e as opções do `cenas.json`.
- `cenas.json`: quais animações aparecem em cada página, com posição, tamanho e
  movimento.
- `ferramentas/`: o compilador das páginas.

## Trocar ou acrescentar uma página

1. Coloque a imagem em `paginas/` com o número da fase no nome (`fase2.png`).
2. Compile, a partir de `testephaser/` (precisa de Docker; a 1ª vez demora para
   instalar as dependências):

   ```bash
   sh ar/ferramentas/compilar-alvos.sh
   ```

   Para cada página, ele mostra quantos pontos o celular usa para reconhecer e
   para acompanhar a página, e gera um mapa em `ar/ferramentas/.cache/mapas/`.
   Poucos pontos em "acompanhar" fazem o personagem tremer. Áreas lisas,
   degradês e padrões repetidos não geram pontos.

3. Em `src/config/phases.js`, confira se a fase tem os 3 desenhos (`symbols`) e
   gere o material impresso com `npm run simbolos`.

## Testar

- **No celular:** `sh scripts/publicar-teste.sh` publica o app inteiro em
  https://teste.cristiancobra.com.br/. Aponte para a página impressa ou para a
  tela de outro aparelho.
- **Com `?debug=1`:** desenha a borda da página reconhecida, o que ajuda a ver se
  o encaixe treme.
- **No computador (`npm run dev`):** a câmera funciona em `localhost`.
