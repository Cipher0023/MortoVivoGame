import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { findPhaseByScan } from '../config/phases.js';
import { createButton } from '../ui/Button.js';
import QrScannerOverlay from '../qr/QrScannerOverlay.js';
import { startPhase } from '../levels/startPhase.js';
import { playSfx } from '../audio/sfx.js';
import { onPadMenu } from '../input/gamepad.js';
import { setLandscapeRequired } from '../ui/orientation.js';

// Abre a câmera (QrScannerOverlay, por cima do canvas) e manda o jogador pra
// fase do QR code lido. Fase ainda não construída = aviso "em construção".
export default class ScanScene extends Phaser.Scene {
  constructor() {
    super('Scan');
  }

  create() {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Abrindo a câmera…', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.scanner = new QrScannerOverlay({
      onScan: (text) => this.handleScan(text),
      onSound: (id) => playSfx(this, id),
      onCancel: () => this.cancel(),
    });
    this.scanner.open();
    // controle: B/Select = Voltar
    this.removePadMenu = onPadMenu(this, { onBack: () => this.cancel() });

    // qualquer saída da cena (inclusive pelo navegador) desliga a câmera
    this.events.once('shutdown', () => this.closeScanner());
  }

  cancel() {
    playSfx(this, 'back');
    this.closeScanner();
    // o menu funciona em pé: libera já, senão, com o celular em pé, fechar o
    // leitor mostraria o aviso de girar e pausaria o jogo antes de a troca
    // de cena rodar
    setLandscapeRequired(false);
    this.scene.start('MainMenu');
  }

  closeScanner() {
    this.scanner?.close();
    this.scanner = null;
  }

  handleScan(text) {
    const phase = findPhaseByScan(text);
    if (!phase) {
      playSfx(this, 'error');
      return 'Esse QR code não é de uma fase do livro. Procure o QR code na página da fase.';
    }

    this.closeScanner();
    if (startPhase(this, phase)) {
      playSfx(this, 'scanOk');
    } else {
      playSfx(this, 'comingSoon');
      this.showComingSoon(phase);
    }
    return true;
  }

  showComingSoon(phase) {
    this.children.removeAll(true);
    this.removePadMenu();
    this.add
      .text(GAME_WIDTH / 2, 360, `${phase.title}`, {
        fontFamily: 'monospace',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#ffe066',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 490, 'Essa fase ainda está em construção.\nVolte em breve!', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2 - 300, 760, 'MENU', () => this.scene.start('MainMenu'), {
      width: 400,
      color: 0x333355,
      sound: 'back',
    });
    createButton(this, GAME_WIDTH / 2 + 250, 760, 'ESCANEAR OUTRA', () => this.scene.restart(), { width: 560 });
    // controle: A = escanear outra, B/Select = menu
    onPadMenu(this, {
      onConfirm: () => {
        playSfx(this, 'confirm');
        this.scene.restart();
      },
      onBack: () => {
        playSfx(this, 'back');
        this.scene.start('MainMenu');
      },
    });
  }
}
