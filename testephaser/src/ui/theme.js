// Linguagem visual do Morto Vivo, a mesma da página "Sobre o projeto"
// (mortovivo.cristiancobra.com.br/sobre/): papel creme, contorno café,
// botões em pílula com sombra dura embaixo e as fontes Luckiest Guy (títulos
// e botões) e Baloo 2 (textos). As fontes vêm do Google Fonts (index.html) e
// o main.js espera elas carregarem antes de criar o jogo.

export const PALETTE = {
  papel: 0xf6f0e7,
  papelEscuro: 0xefe5d6,
  espresso: 0x2b1d16,
  morto: 0x2e2582,
  vivo: 0x5c2a1e,
  folha: 0x3f6b55,
  crema: 0xd9a55b,
  cafeComLeite: 0xa47551,
};

// mesmas cores em texto CSS, para os estilos de texto do Phaser
export const CSS = Object.fromEntries(
  Object.entries(PALETTE).map(([name, value]) => [name, `#${value.toString(16).padStart(6, '0')}`])
);

export const FONT_TITLE = '"Luckiest Guy", "Arial Black", sans-serif';
export const FONT_TEXT = '"Baloo 2", system-ui, sans-serif';

// Título no estilo da página: maiúsculas da Luckiest Guy com contorno de
// papel, para ler bem em cima do cenário.
export function titleStyle(fontSize, color = CSS.vivo) {
  return {
    fontFamily: FONT_TITLE,
    fontSize: `${fontSize}px`,
    color,
    stroke: CSS.papel,
    strokeThickness: Math.round(fontSize / 9),
    padding: { x: 8, y: 8 },
  };
}

// Texto corrido (Baloo 2 em negrito, café).
export function textStyle(fontSize, color = CSS.espresso, extra = {}) {
  return {
    fontFamily: FONT_TEXT,
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color,
    ...extra,
  };
}

// "Morto" em roxo e "Vivo" em marrom, como no topo da página.
export function addLogo(scene, x, y, fontSize) {
  const morto = scene.add.text(0, 0, 'MORTO', titleStyle(fontSize, CSS.morto)).setOrigin(0, 0.5);
  const vivo = scene.add.text(0, 0, 'VIVO', titleStyle(fontSize, CSS.vivo)).setOrigin(0, 0.5);
  const gap = fontSize * 0.25;
  const total = morto.width + gap + vivo.width;
  morto.setPosition(x - total / 2, y);
  vivo.setPosition(x - total / 2 + morto.width + gap, y);
  return [morto, vivo];
}

// Fundo de papel das telas de menu (o resto do jogo usa o cenário da fase).
export function paintPaper(scene) {
  scene.cameras.main.setBackgroundColor(CSS.papel);
}

// Etiqueta de papel com contorno (status do HUD, avisos).
export function drawPaperPanel(graphics, x, y, width, height, radius = 18, options = {}) {
  const { fill = PALETTE.papel, stroke = PALETTE.espresso, shadow = 6, lineWidth = 4 } = options;
  graphics.fillStyle(stroke, 1);
  graphics.fillRoundedRect(x, y + shadow, width, height, radius);
  graphics.fillStyle(fill, 1);
  graphics.fillRoundedRect(x, y, width, height, radius);
  graphics.lineStyle(lineWidth, stroke, 1);
  graphics.strokeRoundedRect(x, y, width, height, radius);
}
