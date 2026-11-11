// As fases do livro. Cada QR code impresso carrega o `code` da fase; o
// scanner do jogo (ScanScene) e o gerador de QR codes
// (scripts/generate-qrcodes.mjs) leem daqui, então este é o único lugar que
// liga um QR code a uma fase.
//
// Puro JS (sem Phaser nem import.meta.env) pra também rodar no Node.
//
// `code` tem um sufixo aleatório pra ninguém abrir a fase 4 só adivinhando
// "FASE-4" — é preciso ter o livro. NÃO mude um code depois que o livro for
// impresso: os QR codes antigos param de funcionar.
//
// Cada fase ou é uma fase jogável (`level`: nome do arquivo em
// src/levels/data/, montado no editor — sem o arquivo, o jogo avisa "em
// construção") ou abre uma cena própria (`sceneKey`, ex.: o editor).

//
// `music`: id da música da fase (arquivo src/audio/songs/<id>.json, feito
// no editor de música). Sem o arquivo, a fase fica sem música.
//
// `symbols`: o código de desenhos impresso num canto da página (ver
// symbols.js). É a entrada de quem não consegue usar a câmera. Mesma regra do
// `code`: não mude depois que o livro for impresso. Gere as imagens para o
// ilustrador com `npm run simbolos`.

export const PHASES = [
  { number: 1, title: 'Fase 1', level: 'fase1', music: 'fase1', code: 'MORTOVIVO-FASE1-R7K2', symbols: ['sol', 'coracao', 'folha'] },
  { number: 2, title: 'Fase 2', level: 'fase2', music: 'fase2', code: 'MORTOVIVO-FASE2-M4X9', symbols: ['lua', 'estrela', 'gota'] },
  { number: 3, title: 'Fase 3', level: 'fase3', music: 'fase3', code: 'MORTOVIVO-FASE3-T8B5', symbols: ['casa', 'flor', 'sol'] },
  { number: 4, title: 'Fase 4', level: 'fase4', music: 'fase4', code: 'MORTOVIVO-FASE4-Q3W6', symbols: ['coracao', 'lua', 'casa'] },
  // Fase 5: o editor de fases (uso no computador; só no modo jogo)
  { number: 5, title: 'Editor de fases', sceneKey: 'LevelEditor', code: 'MORTOVIVO-FASE5-E2D8' },
];

// A fase cujo código de desenhos é exatamente `ids` (na ordem), ou null.
export function findPhaseBySymbols(ids) {
  return PHASES.find((phase) => phase.symbols?.join() === ids.join()) ?? null;
}

// Aceita o código puro (QR do livro ou digitado à mão) ou uma URL com
// ?fase=<código> — assim, se um dia os QR codes virarem links pro site, o
// mesmo scanner continua funcionando. Retorna a fase ou null.
export function findPhaseByScan(text) {
  if (!text) return null;
  let code = text.trim();
  try {
    const fromUrl = new URL(code).searchParams.get('fase');
    if (fromUrl) code = fromUrl;
  } catch {
    // não é URL: é o código puro
  }
  code = code.toUpperCase();
  return PHASES.find((phase) => phase.code === code) ?? null;
}
