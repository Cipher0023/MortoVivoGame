# Livro com realidade aumentada: como funciona e como replicar

O Morto Vivo é um livro infantil que ganha vida no celular. A criança aponta a
câmera para uma página, os personagens aparecem animados sobre o papel e ela
joga a fase daquela página. Tudo roda no navegador do celular: não há app para
instalar, cadastro ou servidor com banco de dados.

Este guia explica o fluxo e mostra como outra pessoa pode usar o projeto para
fazer o próprio livro.

## O fluxo da criança

1. **Um único QR code no livro** (capa ou contracapa) abre
   `https://mortovivo.cristiancobra.com.br/livro-ar` na câmera normal do
   celular. Por enquanto esse endereço só redireciona para
   `https://mortovivo.cristiancobra.com.br`.
2. **Tela "Começar".** É um botão grande só. O toque libera de uma vez o som, a
   voz, a tela cheia com o celular deitado (no Android) e a câmera.
3. **Câmera de realidade aumentada.** A criança aponta para qualquer página com
   fase. O app reconhece a ilustração, os personagens "saltam" do papel e
   aparece o botão **▶ Jogar a Fase N**. Uma voz lê as instruções.
4. **A fase abre na hora, sem recarregar a página.** A câmera desliga.
5. **Fase concluída:** o botão **Escanear outra página** volta para a câmera.

As fases liberam **em sequência**: as fases 1 e 2 são tutoriais e a
dificuldade é progressiva. Se a criança escanear a página de uma fase de mais
adiante, a fase fica marcada como encontrada e aparece "Você achou uma fase
escondida! Termine a fase anterior para jogar". O progresso fica salvo no
próprio celular, sem cadastro. Para testar do zero, abra o site com
`?progresso=zerar`.

Para não ter que girar o celular no meio do caminho, o app é usado deitado do
começo ao fim. No iPhone, que não deixa o site travar a tela, aparece o aviso
"Gire o aparelho".

## Acessibilidade

O livro vai para crianças pequenas e crianças com necessidades especiais, e o
app foi pensado para elas:

- **Alternativa à câmera: o código de desenhos.** Cada página tem 3 desenhos
  impressos num canto (sol, lua, coração...). Quem não consegue usar a câmera,
  seja por celular sem câmera, pouca luz, dificuldade motora para segurar o
  aparelho parado ou permissão negada, toca em **"Não consegue? Use os
  desenhos"** e escolhe os mesmos 3 desenhos, na mesma ordem. Não precisa saber
  ler.
  - Se a câmera não abrir, ou se não achar nenhuma página em 20 segundos, essa
    alternativa vira o botão principal e a voz dá dicas (mais luz, a página
    inteira na tela).
  - Os desenhos diferem pela forma **e** pela cor, então dá para distinguir sem
    enxergar cores. Cada um tem o nome falado e lido por leitores de tela.
- **Voz:** as instruções são lidas em voz alta (a voz do próprio aparelho, em
  português). O botão 🔊 repete a última fala. Com o som desligado, a voz não
  fala.
- **Botões grandes** (48 px ou mais), alto contraste, pouco texto e foco
  visível para quem navega por teclado ou acionador.
- **Sem pressa:** o botão de jogar não some se a mão tremer e a página sair da
  tela. As animações pulsantes param quando o aparelho pede movimento reduzido.

## Sem o livro, não tem jogo

No modo livro (o padrão) não existe menu nem lista de fases. A fase só abre
pela página do livro, seja pela câmera ou pelos desenhos impressos nela, e só
depois de concluída a anterior.

### Modo jogo (oculto)

O menu, o tutorial, o leitor de QR, os links `?fase=<código>` e o editor
continuam no código, no **modo jogo**, com todas as fases liberadas. Ele serve para desenvolver e para uma
futura versão "jogo" do projeto:

- **Neste aparelho:** abra o site com `?modo=jogo`. O navegador lembra; para
  voltar ao normal, use `?modo=livro`.
- **Num build inteiro:** `VITE_MODO=jogo npx vite build`, que publica com o
  jogo como padrão.
- O editor continua abrindo direto por `?scene=editor`.

## Por que o endereço é fixo (/livro-ar)

O endereço impresso no QR não pode mudar nunca: o livro já estará na mão das
crianças. Por isso o QR aponta para `/livro-ar`, e não para a raiz. Por
enquanto, `/livro-ar` só redireciona para a raiz. Se um dia a
raiz do site virar outra coisa, por exemplo um jogo maior, basta mudar o que
`/livro-ar` abre (`testephaser/public/livro-ar/index.html`).

O site fica num subdomínio de um servidor que já existe por outros motivos.
Assim, depois que o projeto e a verba acabarem, ele continua no ar sem custo de
domínio e de hospedagem.

## Tecnologia (tudo aberto e gratuito)

| Parte | Ferramenta | Licença |
|-------|------------|---------|
| Jogo | [Phaser](https://phaser.io) 3 | MIT |
| Reconhecer a página | [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5 (cópia em `src/vendor/mind-ar/`) | MIT |
| Personagens sobre a página | [three.js](https://threejs.org) 0.160 | MIT |
| Build | [Vite](https://vitejs.dev) | MIT |
| Sons | Kenney e rubberduck | CC0 |

O MindAR, o three.js e os quadros das animações só são baixados quando a câmera
abre. O site é 100% estático, com uma pasta de arquivos que qualquer hospedagem
serve.

## Fazer o seu livro

Tudo o que muda de um livro para outro fica em `testephaser/ar/` e em
`testephaser/src/config/phases.js`. Não é preciso mexer no código.

1. **Páginas.** Coloque a imagem de cada página em `testephaser/ar/paginas/`,
   com o número da fase no nome (`fase1.png`, `fase2.jpg`...).
2. **Compile as páginas** (precisa de Docker):

   ```bash
   cd testephaser
   sh ar/ferramentas/compilar-alvos.sh
   ```

   Para cada página, o compilador mostra quantos pontos a câmera usa para
   reconhecer e acompanhar e gera um mapa em `ar/ferramentas/.cache/mapas/`.
   Ilustrações com detalhe e contraste funcionam melhor. Áreas lisas, degradês
   e padrões repetidos não geram pontos. Faça isso **antes** de mandar o livro
   para a gráfica: ainda dá para ajustar a arte.
3. **Animações.** Uma pasta de quadros PNG por animação em `ar/animacoes/`
   (ver o [README de lá](../testephaser/ar/animacoes/README.md)). Em
   `ar/cenas.json`, diga o que aparece em cada página e onde.
4. **Fases e códigos de desenhos.** Em `src/config/phases.js`, cada fase tem o
   arquivo da fase (`level`) e os 3 desenhos (`symbols`). Os desenhos
   disponíveis estão em `src/config/symbols.js`.
5. **Material impresso.** Gere o QR do livro e os desenhos de cada página:

   ```bash
   npm run simbolos -- --url https://seu-endereco/livro-ar
   ```

   Os arquivos saem em `testephaser/impressos/`. O QR vai na contracapa e os
   desenhos de cada fase vão num canto da página, fora da ilustração principal.
6. **Publique.** `npm run build` gera a pasta `dist/`. Copie essa pasta para
   qualquer hospedagem estática com HTTPS, porque a câmera só funciona com
   HTTPS. Funciona até no GitHub Pages: para publicar numa subpasta, use
   `npx vite build --base=/nome-da-pasta/`.

Para conferir no celular antes de publicar de verdade, existe um site de teste
(`sh scripts/publicar-teste.sh`). Os detalhes do servidor de produção estão em
`Docs/deploy-cobra.md`.

## Licença

O código deste repositório está sob a licença MIT (arquivo `LICENSE` na raiz).
As ilustrações, os textos do livro e as animações dos personagens são dos seus
autores e **não** estão cobertos pela licença MIT. A licença deles (por exemplo,
uma Creative Commons) ainda vai ser definida com os autores.
