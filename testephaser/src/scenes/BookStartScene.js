import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants.js';
import { createButton } from '../ui/Button.js';
import { addSoundButton } from '../ui/soundButton.js';
import { playSfx } from '../audio/sfx.js';
import { onPadMenu } from '../input/gamepad.js';
import { setLandscapeRequired } from '../ui/orientation.js';
import { createMenuScenery } from './MainMenuScene.js';

// Primeira tela do modo livro (ver config/mode.js): é o que abre o QR code
// impresso no livro. Um botão só, COMEÇAR. Esse toque libera de uma vez o que
// o navegador só libera com um gesto: som, voz, tela cheia e trava na
// horizontal (Android) e a câmera.
//
// O app é usado deitado desde a primeira tela. Com o celular em pé aparece o
// aviso de girar. No Android o aviso também tem um botão Começar, que deita a
// tela sozinho e já começa. No iPhone, que não deixa o site girar a tela, a
// criança gira o aparelho.

export default class BookStartScene extends Phaser.Scene {
  constructor() {
    super('Inicio');
  }

  create() {
    // O Phaser reaproveita a mesma instância da cena: sem zerar aqui, voltar
    // da câmera (botão ✕) deixava o Começar travado como "já começou".
    this.starting = false;
    setLandscapeRequired(true);
    this.setupRotateButton();
    createMenuScenery(this);

    this.add
      .text(GAME_WIDTH / 2, 210, 'Morto Vivo', {
        fontFamily: 'monospace',
        fontSize: '140px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 340, 'Abra o livro e toque em Começar', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, 540, '▶ COMEÇAR', () => this.start(), {
      width: 640,
      height: 170,
      fontSize: 76,
    });

    addSoundButton(this, GAME_WIDTH - 24, 24, 34);

    this.input.keyboard.once('keydown-ENTER', () => {
      playSfx(this, 'confirm');
      this.start();
    });
    onPadMenu(this, {
      onConfirm: () => {
        playSfx(this, 'confirm');
        this.start();
      },
    });
  }

  // Botão Começar dentro do aviso de girar, só onde dá para travar a tela.
  setupRotateButton() {
    const button = document.getElementById('rotate-start');
    const canLock = Boolean(document.documentElement.requestFullscreen && window.screen.orientation?.lock);
    if (!button || !canLock) return;
    const onClick = async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        await window.screen.orientation.lock('landscape');
      } catch {
        // não deixou: fica o aviso, e a criança gira o aparelho
        return;
      }
      playSfx(this, 'confirm');
      this.start();
    };
    button.hidden = false;
    button.addEventListener('click', onClick);
    this.events.once('shutdown', () => {
      button.hidden = true;
      button.removeEventListener('click', onClick);
    });
  }

  start() {
    if (this.starting) return;
    this.starting = true;
    // Ainda dentro do toque: tela cheia e trava na horizontal onde o
    // navegador deixa (Android/Chrome). No iPhone não existe; segue sem.
    if (this.sys.game.device.fullscreen.available && !this.scale.isFullscreen) {
      try {
        this.scale.startFullscreen();
        window.screen.orientation?.lock?.('landscape').catch(() => {});
      } catch {
        // sem tela cheia: segue normal
      }
    }
    this.scene.start('ArScan');
  }
}
