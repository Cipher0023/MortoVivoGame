# Música do jogo

O jogo tem uma engine de música no estilo dos trackers usados no SNES: 8 canais,
padrões de linhas e uma ordem que diz em que sequência os padrões tocam. As músicas
são compostas dentro do próprio jogo, no editor de música.

## Abrir o editor

- No editor de fases: botão **Música (M)** ou a tecla M. Para voltar, use
  **Voltar ao editor de fases**: a fase e a música continuam como estavam.
- Direto: `http://localhost:5173/?scene=musica`

## Como uma música é organizada

- **Canais (8):** cada canal toca uma nota por vez, como as 8 vozes do SNES. O
  costume é um canal por função: melodia, baixo, acordes, bumbo, caixa, chimbal...
- **Célula:** `C-4 01 40 4A3` = nota, instrumento, volume (00 a 40) e efeito com
  parâmetro. Os números são hexadecimais, como nos trackers (10 = 16, 40 = 64).
- **Padrão:** uma grade de linhas (64 por padrão). Com 4 linhas por batida, 16
  linhas formam um compasso de 4 tempos. As faixas claras marcam as batidas.
- **Ordem:** a lista à esquerda (`posição · padrão`). Um padrão pode aparecer
  várias vezes sem ser copiado. **Repetir daqui** (↻) marca onde a música
  recomeça quando chega ao fim.
- **Instrumentos:** à direita. Cada um tem um timbre e os ajustes: volume, pan,
  envelope ADSR (ataque, decaimento, sustentação e soltura), afinação, eco,
  ambiente, coro, vibrato automático (profundidade, velocidade e atraso) e filtro.
- **Eco do SNES:** atraso, retorno e volume, valendo para a música inteira. Cada
  instrumento escolhe quanto manda para o eco.
- **Ambiente:** reverberação da música inteira (Sala, Floresta, Salão, Caverna ou
  Nenhum) e o volume dela. Cada instrumento escolhe quanto manda para o ambiente.

## Timbres

O botão **Timbres…** abre todos os timbres por categoria. Clicar escolhe e toca; com o
seletor aberto, o piano do teclado só toca, sem escrever na grade.

- **Gravados:** 33 instrumentos de verdade, como o SNES fazia (é daí que vem o som de
  jogos como os da série Donkey Kong Country): cordas, violoncelos, pizzicato,
  contrabaixo, harpa, flauta, clarinete, oboé, ocarina, trompa, trompete, trombone,
  tuba, marimba, xilofone, vibrafone, glockenspiel, kalimba, balafon, piano elétrico
  FM, tímpano e bateria/percussão (bumbo, cajón, caixa, chimbais, prato, conga,
  bongô, chocalho, pandeirola, palmas, bloco). Escolher um deles já ajusta envelope,
  ambiente e vibrato para aquele instrumento.
- **Sintetizados (chip):** as ondas de 8 bits (quadrada, pulsos, triangular...), para
  músicas no estilo NES/Game Boy.

Os gravados vêm das bibliotecas VSCO 2 CE e VCSL, de domínio público (CC0). Cada nota
foi medida e reafinada, convertida para mono em taxa baixa (como no SNES) e ganhou um
trecho de repetição sem estalo. Ficam em `public/assets/music/instrumentos/` (3,9 MB
no total; cada música baixa só os que usa, na primeira vez). Créditos e arquivos de
origem: `CREDITOS.md` na mesma pasta. Para refazer ou acrescentar instrumentos, edite a
lista em `scripts/gerar-banco-instrumentos.mjs` e rode `npm run banco`.

## Teclado

| Tecla | Faz |
|---|---|
| Z S X D C V G B H N J M | piano, oitava de baixo |
| Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P | piano, oitava de cima |
| 1 | solta a nota (`===`) |
| 0–9, A–F | instrumento, volume e efeito (nas colunas deles) |
| Setas, Tab, PgUp/PgDn, Home/End | andar pela grade |
| Del / Insert / Backspace | apagar / inserir linha / apagar a linha de cima |
| Espaço | toca ou para a música (Shift+Espaço: a partir da linha do cursor) |
| Enter | repete só o padrão aberto |
| − / + do teclado numérico | oitava |
| Ctrl+Z / Ctrl+Y | desfazer / refazer |
| Ctrl+C / Ctrl+V | copiar / colar o canal (com Shift: o padrão inteiro) |
| Ctrl+S | salvar |

M e S, no topo de cada canal, deixam o canal mudo ou sozinho (só vale para ouvir no
editor, não é salvo). **Passo** é quantas linhas o cursor desce depois de cada nota.

## Efeitos

Valem só na linha em que aparecem. Para um vibrato longo, repita o efeito nas linhas
seguintes (com parâmetro 00 ele repete o último valor usado).

| Efeito | O que faz |
|---|---|
| `0xy` | arpejo: alterna a nota com +x e +y semitons (acorde de videogame) |
| `1xx` / `2xx` | sobe / desce xx/16 semitons durante a linha |
| `3xx` | desliza da nota anterior até a nova (xx/16 semitons por linha) |
| `4xy` | vibrato: x = velocidade, y = profundidade |
| `8xx` | pan: 00 esquerda, 80 centro, FF direita |
| `Axy` | volume sobe x ou desce y durante a linha |
| `Bxx` | depois desta linha, pula para a posição xx da ordem |
| `Dxx` | termina o padrão e segue na linha xx do próximo |
| `Fxx` | muda o andamento (BPM em hexadecimal, 20 a FF) |

## Salvar e ligar a música a uma fase

1. Com `npm run dev` rodando, use **Salvar no jogo** e dê o nome da fase (ex.:
   `fase1`). O arquivo vai para `testephaser/src/audio/songs/fase1.json` e o jogo já
   passa a usá-lo, sem recarregar a página. Só funciona no próprio computador.
2. Sem o servidor de desenvolvimento, use **Baixar .json** e coloque o arquivo nessa
   mesma pasta.
3. Em `src/config/phases.js`, o campo `music` de cada fase diz qual música toca. As
   fases 1 a 4 já apontam para `fase1` a `fase4`: basta o arquivo existir. Fase sem
   arquivo fica em silêncio.

**Modelos** abre qualquer música da pasta. Nenhuma das duas está ligada a uma fase:
`exemplo` usa os instrumentos gravados (flauta, contrabaixo, kalimba, cordas, congas,
ambiente de floresta) e `exemplo-chip` mostra os efeitos no som de 8 bits (arpejo,
vibrato, deslizar, eco).

O editor guarda um rascunho automático a cada 15 segundos. Se a aba fechar sem
salvar, ele oferece restaurar na próxima vez.

## No jogo

- A música da fase começa quando a fase abre. Morrer e recomeçar não reinicia a
  música. Ao sair ela some aos poucos, e ao vencer ela abaixa para a vinheta de
  vitória tocar.
- O botão de som do jogo desliga a música junto com os efeitos.
- **Camadas:** `setMusicChannel(scene, canal, ligado)` (em `src/audio/music.js`) liga
  ou desliga um canal durante o jogo. Serve, por exemplo, para a bateria entrar só
  quando um inimigo aparece. Ainda não está ligado a nenhum evento do jogo.

## Onde fica o código

- `src/audio/music/song.js`: formato do arquivo, limites e efeitos
- `src/audio/music/instruments.js`: vozes (amostras e ondas, envelope, coro, vibrato)
- `src/audio/music/sampleBank.js` e `instrumentBank.json`: o banco de instrumentos gravados
- `src/audio/music/MusicPlayer.js`: o tocador (agenda as linhas à frente, efeitos, eco,
  ambiente, limitador suave)
- `scripts/gerar-banco-instrumentos.mjs`: gera o banco (`npm run banco`)
- `src/audio/music.js`: música do jogo (`playMusic`, `stopMusic`, `setMusicChannel`)
- `src/audio/songLibrary.js`: lê `src/audio/songs/*.json`
- `src/scenes/MusicEditorScene.js`: o editor
- `vite.config.js`: o **Salvar no jogo** (só no `npm run dev`)
