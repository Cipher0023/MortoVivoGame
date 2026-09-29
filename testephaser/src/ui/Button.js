import { playSfx } from '../audio/sfx.js';

// Botão pequeno de barra (HUD, canto do menu), ancorado pela direita: o x
// é a borda direita, pra enfileirar botões da direita pra esquerda.
export function createSmallButton(scene, rightX, y, label, fontSize, onClick) {
  return scene.add
    .text(rightX, y, label, {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#333355',
      padding: { x: 10, y: 8 },
    })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', (pointer) => playHover(scene, pointer))
    .on('pointerup', () => {
      playSfx(scene, 'click');
      onClick();
    });
}

// Botão grande de menu (retângulo arredondado + texto), pensado pra toque.
// Dispara no pointerup — fullscreen e câmera só são liberados pelo navegador
// dentro de um gesto do usuário, e o up conta como gesto.
// sound: som do clique ('confirm' pra avançar, 'back' pra voltar).
export function createButton(scene, x, y, label, onClick, options = {}) {
  const { width = 460, height = 110, color = 0x33aa66, fontSize = 44, sound = 'confirm' } = options;

  const background = scene.add.graphics();
  const draw = (alpha) => {
    background.clear();
    background.fillStyle(color, alpha);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 22);
    background.lineStyle(4, 0xffffff, 0.7);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 22);
  };
  draw(0.9);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
    })
    .setOrigin(0.5);

  const button = scene.add.container(x, y, [background, text]).setSize(width, height);
  button.setInteractive({ useHandCursor: true });
  button.on('pointerover', (pointer) => {
    draw(1);
    playHover(scene, pointer);
  });
  button.on('pointerout', () => {
    draw(0.9);
    button.setScale(1);
  });
  button.on('pointerdown', () => button.setScale(0.96));
  button.on('pointerup', () => {
    button.setScale(1);
    playSfx(scene, sound);
    onClick();
  });
  return button;
}

// Passar o mouse faz um "tique"; no toque o over vem colado no clique, então não.
function playHover(scene, pointer) {
  if (!pointer.wasTouch) playSfx(scene, 'tick');
}
