import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { createButton } from '../ui/Button.js';
import ArScannerOverlay from '../ar/ArScannerOverlay.js';
import SymbolCodeOverlay from '../ar/SymbolCodeOverlay.js';
import { startPhase } from '../levels/startPhase.js';
import { playSfx } from '../audio/sfx.js';
import { onPadMenu } from '../input/gamepad.js';
import { speak } from '../ui/speech.js';
import { isUnlocked, markFound } from '../config/progress.js';
import { paintPaper, titleStyle, textStyle } from '../ui/theme.js';

// Modo livro: a câmera de realidade aumentada (ArScannerOverlay, por cima do
// canvas). Achou a página → personagens animados → "Jogar" → a fase abre aqui
// mesmo, sem recarregar a página (a tela cheia e o som continuam liberados).
// Quem não consegue usar a câmera vai pro código de desenhos.
export default class ArScanScene extends Phaser.Scene {
  constructor() {
    super('ArScan');
  }

  create() {
    paintPaper(this);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Abrindo a câmera…', textStyle(52))
      .setOrigin(0.5);

    this.overlay = null;
    this.openCamera();
    // qualquer saída da cena (inclusive pelo navegador) desliga a câmera
    this.events.once('shutdown', () => this.closeOverlay());
  }

  openCamera() {
    this.closeOverlay();
    this.overlay = new ArScannerOverlay({
      onPlay: (phase) => this.play(phase),
      onHelp: () => this.openSymbols(),
      onBack: () => {
        playSfx(this, 'back');
        this.scene.start('Inicio');
      },
      onSound: (id) => playSfx(this, id),
    });
    this.overlay.open();
  }

  openSymbols() {
    this.closeOverlay();
    this.overlay = new SymbolCodeOverlay({
      onPhase: (phase) => this.play(phase),
      onBack: () => {
        playSfx(this, 'back');
        this.openCamera();
      },
      onSound: (id) => playSfx(this, id),
    });
    this.overlay.open();
  }

  closeOverlay() {
    this.overlay?.close();
    this.overlay = null;
  }

  play(phase) {
    this.closeOverlay();
    markFound(phase.number);
    if (!isUnlocked(phase)) {
      // pelo código de desenhos (a câmera já esconde o botão de jogar)
      playSfx(this, 'comingSoon');
      this.showMessage(
        'Fase escondida!',
        `Você achou a ${phase.title}.\nTermine a Fase ${phase.number - 1} para jogar.`,
        `Você achou uma fase escondida! Termine a Fase ${phase.number - 1} para jogar.`
      );
      return;
    }
    if (startPhase(this, phase)) {
      playSfx(this, 'confirm');
      return;
    }
    playSfx(this, 'comingSoon');
    this.showMessage(
      phase.title,
      'Essa fase ainda está em construção.\nVolte em breve!',
      `A ${phase.title} ainda está em construção. Volte em breve!`
    );
  }

  // Tela de aviso (fase trancada ou em construção) com "escanear outra".
  showMessage(title, text, spoken) {
    this.children.removeAll(true);
    this.add
      .text(GAME_WIDTH / 2, 360, title.toUpperCase(), titleStyle(104))
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 490, text, {
        ...textStyle(46),
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);
    speak(spoken);

    const again = () => this.scene.restart();
    createButton(this, GAME_WIDTH / 2, 760, 'ESCANEAR OUTRA PÁGINA', again, { width: 820 });
    onPadMenu(this, {
      onConfirm: () => {
        playSfx(this, 'confirm');
        again();
      },
    });
  }
}
