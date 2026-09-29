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

export const PHASES = [
  { number: 1, title: 'Fase 1', level: 'fase1', code: 'MORTOVIVO-FASE1-R7K2' },
  { number: 2, title: 'Fase 2', level: 'fase2', code: 'MORTOVIVO-FASE2-M4X9' },
  { number: 3, title: 'Fase 3', level: 'fase3', code: 'MORTOVIVO-FASE3-T8B5' },
  { number: 4, title: 'Fase 4', level: 'fase4', code: 'MORTOVIVO-FASE4-Q3W6' },
  // Fase 5: o editor de fases (uso no computador)
  { number: 5, title: 'Editor de fases', sceneKey: 'LevelEditor', code: 'MORTOVIVO-FASE5-E2D8' },
];

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
