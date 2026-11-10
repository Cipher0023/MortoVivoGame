# MindAR 1.2.5 (cópia local)

Arquivos de distribuição do [MindAR](https://github.com/hiukim/mind-ar-js),
versão 1.2.5, licença MIT (ver `LICENSE`). Usados pela câmera de realidade
aumentada (`src/ar/ArScannerOverlay.js`).

Ficam no repositório, em vez de virem de um CDN ou do npm, por dois motivos:

- **Durabilidade:** o projeto continua funcionando mesmo que o CDN saia do ar
  ou a versão seja retirada.
- **Instalação simples:** o pacote `mind-ar` do npm puxa dependências nativas
  (como o `canvas`) que só servem para compilar as páginas e falham em muitas
  máquinas. O jogo só precisa destes três arquivos.

Copiados de `node_modules/mind-ar/dist/`:

- `mindar-image-three.prod.js`
- `controller-mGt1s8dJ.js`
- `ui-fBadYuor.js`

O compilador das páginas (`ar/ferramentas/`) continua usando o pacote do npm.
Para atualizar, copie os arquivos novos da mesma pasta e confira os nomes dos
`import` no `mindar-image-three.prod.js`. Depende do `three` 0.160.0 (no
`package.json`): versões mais novas removeram o `sRGBEncoding` que ele usa.
