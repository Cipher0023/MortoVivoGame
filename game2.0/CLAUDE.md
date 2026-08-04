# CLAUDE.md

## Sobre este projeto

`game2.0` (MortoVivo) é um projeto **Phaser Editor 2D v5**, não um projeto npm/vite tradicional. O desenvolvimento é feito **primariamente através do Phaser Editor v5** (app desktop), e o código aqui é editado diretamente apenas quando necessário (lógica customizada, scripts, ajustes pontuais).

## Regra principal: seguir a documentação oficial

Todo código escrito ou sugerido para este projeto deve se basear na documentação oficial, e não em padrões inventados ou "conhecimento geral" de Phaser:

- **Phaser (engine):** https://docs.phaser.io/
- **Phaser Editor:** https://docs.phaser.io/phaser-editor/

Antes de escrever ou alterar cenas, scripts ou qualquer código de gameplay, consulte a página relevante da documentação (ex: como `editorCreate()`, script nodes ou behaviors devem ser estruturados) em vez de assumir uma estrutura genérica. Use WebFetch/WebSearch em docs.phaser.io quando houver dúvida.

## Convenções específicas do projeto

- **Cenas são geradas pelo editor**: arquivos como `src/scenes/*.js` têm um método `editorCreate()` entre os marcadores `// START OF COMPILED CODE` / `// END OF COMPILED CODE`. **Não editar** o código dentro desses marcadores manualmente — ele é gerado pelo Phaser Editor. Código escrito à mão vai apenas nas seções `// START-USER-CODE` / `// END-USER-CODE`.
- **Script nodes**: comportamentos reutilizáveis ficam em `src/Scripts/` (ex: `gotoThisPage.js`), usando as bibliotecas `@phaserjs/editor-scripts-quick` e `@phaserjs/editor-scripts-base`.
- **Instalação vanilla JS, não npm**: este projeto NÃO tem `package.json`. As bibliotecas de scripts do editor devem ser instaladas copiando a pasta do bundle vanilla (browser) para a raiz do projeto, com imports relativos — nunca via `npm install`. Adicionar um `package.json` faz o editor tratar o projeto como projeto npm/bundler e quebra o botão "Run" (`Missing script: "start"`).
- **Como rodar o projeto**: sempre pelo botão "Run" do Phaser Editor v5 (app desktop). Não sugerir abrir `index.html` direto no navegador nem rodar um servidor estático genérico — isso não resolve os imports de bare-specifier (`@phaserjs/...`) usados pelos script nodes.

## Ao editar código aqui

1. Verifique se a mudança é compatível com o formato que o Phaser Editor espera (arquivos `.scene`, `.components`, estrutura de compiled code) — mudanças incompatíveis quebram o projeto para os colegas que usam o editor.
2. Priorize consultar a documentação oficial antes de aplicar padrões genéricos de Phaser encontrados em outros lugares.
3. Se precisar adicionar uma nova biblioteca de script node, confirme que ela será instalada do jeito vanilla JS (pasta copiada + imports relativos), não via npm.
