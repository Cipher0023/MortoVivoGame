import { playSfx } from '../audio/sfx.js';
import { PALETTE, CSS, FONT_TITLE, FONT_TEXT } from './theme.js';

// Botões no estilo da página "Sobre o projeto": pílula com contorno café e
// sombra dura embaixo. Ao apertar, o botão "afunda" na sombra.

// Botão pequeno de barra (HUD, canto do menu), ancorado pela direita: o x
// é a borda direita, pra enfileirar botões da direita pra esquerda.
// Devolve um container com .width e .setText(), como o texto antigo.
export function createSmallButton(scene, rightX, y, label, fontSize, onClick) {
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.3);
  const shadow = Math.max(3, Math.round(fontSize / 8));
  const line = Math.max(2, Math.round(fontSize / 12));

  const background = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_TEXT,
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: CSS.espresso,
    })
    .setOrigin(0.5);
  const button = scene.add.container(0, 0, [background, text]);

  let width = 0;
  let height = 0;
  let pressed = false;
  const draw = () => {
    const offset = pressed ? shadow - 1 : 0;
    background.clear();
    background.fillStyle(PALETTE.espresso, 1);
    background.fillRoundedRect(-width / 2, -height / 2 + shadow, width, height, height / 2);
    background.fillStyle(PALETTE.papel, 1);
    background.fillRoundedRect(-width / 2, -height / 2 + offset, width, height, height / 2);
    background.lineStyle(line, PALETTE.espresso, 1);
    background.strokeRoundedRect(-width / 2, -height / 2 + offset, width, height, height / 2);
    text.setY(offset);
  };
  const layout = () => {
    width = Math.ceil(text.width + padX * 2);
    height = Math.ceil(text.height + padY * 2);
    button.setSize(width, height + shadow);
    // mesmo ancoramento do texto antigo (origem 1,0): x é a borda direita
    button.setPosition(rightX - width / 2, y + height / 2);
    if (button.input) button.input.hitArea.setTo(0, 0, width, height + shadow);
    draw();
  };

  button.setText = (value) => {
    text.setText(value);
    layout();
    return button;
  };
  layout();

  button.setInteractive({ useHandCursor: true });
  button.on('pointerover', (pointer) => playHover(scene, pointer));
  button.on('pointerdown', () => {
    pressed = true;
    draw();
  });
  button.on('pointerout', () => {
    pressed = false;
    draw();
  });
  button.on('pointerup', () => {
    pressed = false;
    draw();
    playSfx(scene, 'click');
    onClick();
  });
  return button;
}

// Botão grande de menu, pensado pra toque.
// Dispara no pointerup — fullscreen e câmera só são liberados pelo navegador
// dentro de um gesto do usuário, e o up conta como gesto.
// sound: som do clique ('confirm' pra avançar, 'back' pra voltar).
// variant: 'primary' (creme, o botão principal) ou 'secondary' (papel).
export function createButton(scene, x, y, label, onClick, options = {}) {
  const { width = 460, height = 110, fontSize = 44, sound = 'confirm', variant = 'primary' } = options;
  const fill = options.color ?? (variant === 'secondary' ? PALETTE.papel : PALETTE.crema);
  const shadow = Math.round(height / 10);
  const line = Math.max(4, Math.round(height / 22));
  const radius = height / 2;

  const background = scene.add.graphics();
  let offset = 0;
  let hover = false;
  const draw = () => {
    background.clear();
    background.fillStyle(PALETTE.espresso, 1);
    background.fillRoundedRect(-width / 2, -height / 2 + shadow, width, height, radius);
    background.fillStyle(fill, 1);
    background.fillRoundedRect(-width / 2, -height / 2 + offset, width, height, radius);
    // brilho de cima, só no hover
    if (hover && offset === 0) {
      background.fillStyle(0xffffff, 0.18);
      background.fillRoundedRect(-width / 2 + line, -height / 2 + line, width - line * 2, height / 2 - line, {
        tl: radius - line,
        tr: radius - line,
        bl: 0,
        br: 0,
      });
    }
    background.lineStyle(line, PALETTE.espresso, 1);
    background.strokeRoundedRect(-width / 2, -height / 2 + offset, width, height, radius);
    text.setY(offset + fontSize * 0.06);
  };

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_TITLE,
      fontSize: `${fontSize}px`,
      color: CSS.espresso,
      padding: { x: 4, y: 6 },
    })
    .setOrigin(0.5);
  draw();

  const button = scene.add.container(x, y, [background, text]).setSize(width, height + shadow * 2);
  button.setInteractive({ useHandCursor: true });
  button.on('pointerover', (pointer) => {
    hover = true;
    draw();
    playHover(scene, pointer);
  });
  button.on('pointerout', () => {
    hover = false;
    offset = 0;
    draw();
  });
  button.on('pointerdown', () => {
    offset = shadow - 2;
    draw();
  });
  button.on('pointerup', () => {
    offset = 0;
    draw();
    playSfx(scene, sound);
    onClick();
  });
  return button;
}

// Passar o mouse faz um "tique"; no toque o over vem colado no clique, então não.
function playHover(scene, pointer) {
  if (!pointer.wasTouch) playSfx(scene, 'tick');
}
