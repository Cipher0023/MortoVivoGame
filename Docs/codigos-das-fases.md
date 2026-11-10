# Códigos das fases — Morto Vivo game

> **Modo livro (padrão do site):** a criança entra pela câmera de realidade
> aumentada, que reconhece a própria página, ou pelo **código de desenhos**
> impresso num canto da página (tabela abaixo). Os QR codes por
> fase e o código digitado continuam valendo no **modo jogo** (`?modo=jogo`).
> Ver [livro-com-realidade-aumentada.md](livro-com-realidade-aumentada.md).
>
> | Fase | Desenhos (nesta ordem) | Arquivo para impressão |
> |------|------------------------|------------------------|
> | 1 | Sol, Coração, Folha | `testephaser/impressos/simbolos-fase-1.svg` |
> | 2 | Lua, Estrela, Gota | `testephaser/impressos/simbolos-fase-2.svg` |
> | 3 | Casa, Flor, Sol | `testephaser/impressos/simbolos-fase-3.svg` |
> | 4 | Coração, Lua, Casa | `testephaser/impressos/simbolos-fase-4.svg` |
>
> O QR code único do livro está em `testephaser/impressos/qr-livro.svg`.

Cada fase do livro é aberta por um QR code impresso na página da fase. O QR code
carrega o **código** abaixo. O mesmo código também pode ser **digitado à mão** no
jogo (botão "Digitar código" no leitor de QR), para quem não consegue usar a câmera.

| Fase | O que abre | Código | QR code | Situação |
|------|------------|--------|---------|----------|
| 1 | Fase 1 | `MORTOVIVO-FASE1-R7K2` | `testephaser/qrcodes/fase-1.svg` | Jogável (só com o Guri, para teste) |
| 2 | Fase 2 | `MORTOVIVO-FASE2-M4X9` | `testephaser/qrcodes/fase-2.svg` | Jogável (provisória: cópia da Fase 1 só com a Caveirinha) |
| 3 | Fase 3 | `MORTOVIVO-FASE3-T8B5` | `testephaser/qrcodes/fase-3.svg` | Jogável (provisória: cópia da Fase 1 com os dois) |
| 4 | Fase 4 | `MORTOVIVO-FASE4-Q3W6` | `testephaser/qrcodes/fase-4.svg` | Em construção |
| 5 | Editor de fases (computador) | `MORTOVIVO-FASE5-E2D8` | `testephaser/qrcodes/fase-5.svg` | Pronto |

"Em construção" significa que o código já funciona, mas a fase ainda não tem o
arquivo `.json` em `testephaser/src/levels/data/`. O jogo mostra o aviso "Essa fase
ainda está em construção". Basta salvar a fase no editor com o nome `fase2.json`,
`fase3.json` ou `fase4.json` e colocar nessa pasta para ela ficar jogável, sem
trocar o código nem o QR code.

## Regras importantes

- **Não mude um código depois que o livro for impresso.** Os QR codes impressos
  param de funcionar.
- O código não diferencia maiúsculas de minúsculas quando digitado
  (`mortovivo-fase1-r7k2` também vale).
- O final aleatório (`R7K2`, `M4X9`...) existe para ninguém abrir uma fase só
  adivinhando o nome. É preciso ter o livro.

## Arquivos dos QR codes

Ficam em `testephaser/qrcodes/`:

- `fase-N.svg`: vetor, **é este que vai para a gráfica/diagramação**.
- `fase-N.png`: 1024px, para conferir na tela ou testar com o celular.

Conferido em 29/09/2026: os cinco PNGs foram lidos e cada um contém exatamente o
código da tabela.

## Onde os códigos estão no projeto

A fonte oficial é `testephaser/src/config/phases.js`. O jogo e o gerador de QR
codes leem de lá. Para gerar os QR codes de novo:

```bash
cd testephaser
npm run qrcodes                                   # QR com o código puro (atual)
npm run qrcodes -- --base-url https://site.com    # QR com link para o site
```

Com `--base-url`, o QR vira um link (`https://site.com/?fase=<código>`) e a câmera
normal do celular já abre o jogo direto na fase. Só use depois que o site tiver
o endereço definitivo, porque o link fica impresso no livro.

## Testar sem escanear (só em desenvolvimento)

Com `npm run dev` rodando:

- `http://localhost:5173/?fase=1` abre a Fase 1 direto (vale `1` a `4`).
- `http://localhost:5173/?fase=MORTOVIVO-FASE1-R7K2` abre pelo código completo
  (no site publicado, só no modo jogo).
- `http://localhost:5173/?scene=editor` abre o editor.
