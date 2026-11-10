// Desenhos do "código de desenhos": a alternativa para quem não consegue usar
// a câmera. Cada página do livro tem três destes desenhos impressos num canto
// (ver `symbols` em phases.js); a criança toca nos mesmos três, na mesma
// ordem, e a fase abre. Não precisa saber ler, e sem o livro não dá para
// adivinhar.
//
// Cada desenho tem forma E cor diferentes (dá para distinguir sem enxergar
// cores) e um nome curto, que é falado ao tocar e lido por leitores de tela.
// Os SVGs são os mesmos na tela e no material impresso
// (scripts/gerar-simbolos.mjs), então nunca ficam diferentes.
//
// Puro JS (sem Phaser nem import.meta.env) para também rodar no Node.
// NÃO mude um desenho depois que o livro for impresso.

export const SYMBOLS = {
  sol: {
    name: 'Sol',
    color: '#f6b80b',
    svg:
      '<circle cx="50" cy="50" r="22" fill="#f6b80b"/>' +
      '<g stroke="#f6b80b" stroke-width="8" stroke-linecap="round">' +
      '<line x1="50" y1="6" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="94"/>' +
      '<line x1="6" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="94" y2="50"/>' +
      '<line x1="19" y1="19" x2="27" y2="27"/><line x1="73" y1="73" x2="81" y2="81"/>' +
      '<line x1="19" y1="81" x2="27" y2="73"/><line x1="73" y1="27" x2="81" y2="19"/></g>',
  },
  lua: {
    name: 'Lua',
    color: '#4a6fe3',
    svg: '<path d="M62 10 A40 40 0 1 0 90 66 A32 32 0 1 1 62 10 Z" fill="#4a6fe3"/>',
  },
  estrela: {
    name: 'Estrela',
    color: '#f07c12',
    svg: '<polygon points="50,6 62,38 96,38 68,58 79,92 50,72 21,92 32,58 4,38 38,38" fill="#f07c12"/>',
  },
  coracao: {
    name: 'Coração',
    color: '#e0263e',
    svg: '<path d="M50 90 C20 68 6 52 6 34 A20 20 0 0 1 50 24 A20 20 0 0 1 94 34 C94 52 80 68 50 90 Z" fill="#e0263e"/>',
  },
  gota: {
    name: 'Gota',
    color: '#1aa3c9',
    svg: '<path d="M50 6 C66 32 80 48 80 64 A30 30 0 0 1 20 64 C20 48 34 32 50 6 Z" fill="#1aa3c9"/>',
  },
  folha: {
    name: 'Folha',
    color: '#2e9e44',
    svg:
      '<path d="M14 86 C10 40 40 10 88 12 C90 60 60 90 14 86 Z" fill="#2e9e44"/>' +
      '<path d="M18 82 L70 30" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>',
  },
  casa: {
    name: 'Casa',
    color: '#8a5a2b',
    svg:
      '<polygon points="50,8 94,46 82,46 82,92 18,92 18,46 6,46" fill="#8a5a2b"/>' +
      '<rect x="40" y="62" width="20" height="30" fill="#ffffff"/>',
  },
  flor: {
    name: 'Flor',
    color: '#b23cc4',
    svg:
      '<g fill="#b23cc4"><circle cx="50" cy="24" r="16"/><circle cx="76" cy="44" r="16"/>' +
      '<circle cx="66" cy="74" r="16"/><circle cx="34" cy="74" r="16"/><circle cx="24" cy="44" r="16"/></g>' +
      '<circle cx="50" cy="52" r="13" fill="#f6b80b"/>',
  },
};

export const SYMBOL_IDS = Object.keys(SYMBOLS);

// SVG completo de um desenho (viewBox 0 0 100 100).
export function symbolSvg(id, size = 100) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" ` +
    `role="img" aria-label="${SYMBOLS[id].name}">${SYMBOLS[id].svg}</svg>`
  );
}
