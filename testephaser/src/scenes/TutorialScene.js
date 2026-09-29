import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';
import { createButton } from '../ui/Button.js';
import { playSfx } from '../audio/sfx.js';
import { onPadMenu } from '../input/gamepad.js';

// Tutorial de como entrar numa fase: escanear o QR code do livro. Três
// passos em cartões; o botão final abre a câmera (ScanScene).

const CARD_WIDTH = 540;
const CARD_HEIGHT = 600;
const CARD_GAP = 60;
const CARD_Y = 540;
const ICON_Y = -130; // relativo ao centro do cartão

const STEPS = [
  { text: 'Abra o livro na página da fase. Cada fase tem o seu QR code.', drawIcon: drawBookIcon },
  { text: 'Toque em ABRIR CÂMERA e deixe o jogo usar a câmera.', drawIcon: drawPhoneIcon },
  { text: 'Aponte para o QR code até ele caber no quadro. A fase abre sozinha!', drawIcon: drawScanIcon },
];

export default class TutorialScene extends Phaser.Scene {
  constructor() {
    super('Tutorial');
  }

  create() {
    this.add
      .text(GAME_WIDTH / 2, 110, 'Como entrar numa fase', {
        fontFamily: 'monospace',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffe066',
      })
      .setOrigin(0.5);

    const totalWidth = STEPS.length * CARD_WIDTH + (STEPS.length - 1) * CARD_GAP;
    STEPS.forEach((step, i) => {
      const x = (GAME_WIDTH - totalWidth) / 2 + CARD_WIDTH / 2 + i * (CARD_WIDTH + CARD_GAP);
      this.createCard(x, CARD_Y, i + 1, step);
    });

    createButton(this, GAME_WIDTH / 2 - 380, 960, 'VOLTAR', () => this.scene.start('MainMenu'), {
      width: 320,
      color: 0x333355,
      sound: 'back',
    });
    createButton(this, GAME_WIDTH / 2 + 170, 960, 'ABRIR CÂMERA', () => this.scene.start('Scan'), {
      width: 620,
    });

    const openCamera = () => {
      playSfx(this, 'confirm');
      this.scene.start('Scan');
    };
    const back = () => {
      playSfx(this, 'back');
      this.scene.start('MainMenu');
    };
    this.input.keyboard.once('keydown-ENTER', openCamera);
    this.input.keyboard.once('keydown-ESC', back);
    onPadMenu(this, { onConfirm: openCamera, onBack: back });
  }

  createCard(x, y, number, step) {
    const card = this.add.graphics();
    card.fillStyle(0x262645, 1);
    card.fillRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 28);
    card.lineStyle(4, 0x5555aa, 1);
    card.strokeRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 28);

    // número do passo no canto
    const badgeX = x - CARD_WIDTH / 2 + 56;
    const badgeY = y - CARD_HEIGHT / 2 + 56;
    card.fillStyle(0xffe066, 1);
    card.fillCircle(badgeX, badgeY, 36);
    this.add
      .text(badgeX, badgeY, String(number), {
        fontFamily: 'monospace',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#1a1a2e',
      })
      .setOrigin(0.5);

    step.drawIcon(this.add.graphics(), x, y + ICON_Y);

    this.add
      .text(x, y + 150, step.text, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: CARD_WIDTH - 70 },
      })
      .setOrigin(0.5);
  }
}

// ---------------------------------------------------------------------
// Ícones (formas simples, sem depender de arte)
// ---------------------------------------------------------------------

// QR code estilizado: os 3 quadrados de canto que todo QR tem + alguns
// módulos fixos no meio (padrão fixo, não aleatório, pra não mudar a cada vez).
function drawQrIcon(g, cx, cy, size) {
  const cell = size / 7;
  const left = cx - size / 2;
  const top = cy - size / 2;
  g.fillStyle(0xffffff, 1);
  g.fillRect(left - cell / 2, top - cell / 2, size + cell, size + cell);
  g.fillStyle(0x000000, 1);
  const finder = (fx, fy) => {
    g.fillRect(left + fx * cell, top + fy * cell, cell * 2, cell * 2);
  };
  finder(0, 0);
  finder(5, 0);
  finder(0, 5);
  for (const [mx, my] of [[3, 0], [3, 2], [2, 3], [4, 3], [6, 3], [3, 4], [5, 5], [3, 6], [6, 6], [5, 3]]) {
    g.fillRect(left + mx * cell, top + my * cell, cell, cell);
  }
}

function drawBookIcon(g, cx, cy) {
  // livro aberto: duas páginas levemente inclinadas + lombada
  g.fillStyle(0xf2e8d0, 1);
  g.fillPoints([{ x: cx - 190, y: cy - 90 }, { x: cx - 6, y: cy - 70 }, { x: cx - 6, y: cy + 110 }, { x: cx - 190, y: cy + 90 }], true);
  g.fillPoints([{ x: cx + 6, y: cy - 70 }, { x: cx + 190, y: cy - 90 }, { x: cx + 190, y: cy + 90 }, { x: cx + 6, y: cy + 110 }], true);
  g.fillStyle(0x6b3f1f, 1);
  g.fillRect(cx - 6, cy - 72, 12, 184);
  // linhas de texto na página esquerda
  g.fillStyle(0xb8ab8f, 1);
  for (let i = 0; i < 5; i++) g.fillRect(cx - 165, cy - 55 + i * 30, 130, 8);
  // QR code na página direita
  drawQrIcon(g, cx + 98, cy + 5, 105);
}

function drawPhoneIcon(g, cx, cy) {
  g.fillStyle(0x0f0f1e, 1);
  g.fillRoundedRect(cx - 80, cy - 125, 160, 250, 22);
  g.lineStyle(6, 0xffffff, 1);
  g.strokeRoundedRect(cx - 80, cy - 125, 160, 250, 22);
  // lente da câmera
  g.lineStyle(8, 0x33ff88, 1);
  g.strokeCircle(cx, cy - 5, 42);
  g.fillStyle(0x33ff88, 1);
  g.fillCircle(cx, cy - 5, 16);
  // "botão" de permitir
  g.fillStyle(0x33aa66, 1);
  g.fillRoundedRect(cx - 55, cy + 70, 110, 32, 8);
}

function drawScanIcon(g, cx, cy) {
  drawQrIcon(g, cx, cy, 130);
  // cantos da moldura de leitura, como no leitor de verdade
  const half = 105;
  const arm = 40;
  g.lineStyle(10, 0x33ff88, 1);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * half;
    const y = cy + sy * half;
    g.lineBetween(x, y, x - sx * arm, y);
    g.lineBetween(x, y, x, y - sy * arm);
  }
}
