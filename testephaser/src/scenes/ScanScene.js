import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { findPhaseByScan } from '../config/phases.js';
import { createButton } from '../ui/Button.js';
import QrScannerOverlay from '../qr/QrScannerOverlay.js';
import { startPhase } from '../levels/startPhase.js';
import { playSfx } from '../audio/sfx.js';

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
      onCancel: () => {
        playSfx(this, 'back');
        // fecha já: com o celular em pé o jogo está pausado e a troca de
        // cena (que também fecharia o leitor) só roda ao girar o aparelho
        this.closeScanner();
        this.scene.start('MainMenu');
      },
    });
    this.scanner.open();

    // qualquer saída da cena (inclusive pelo navegador) desliga a câmera
    this.events.once('shutdown', () => this.closeScanner());
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
  }
}
