import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/constants.js';
import { createButton } from '../ui/Button.js';
import { addFullscreenButton } from '../ui/fullscreen.js';
import { addSoundButton } from '../ui/soundButton.js';
import { playSfx } from '../audio/sfx.js';
import { onPadMenu } from '../input/gamepad.js';
import { createBoyWalkAnimation } from '../entities/Living.js';
import { setLandscapeRequired } from '../ui/orientation.js';

// Primeira tela do site. JOGAR leva ao tutorial de como escanear os QR codes
// do livro (TutorialScene), que por sua vez abre a câmera (ScanScene).
// O menu funciona com o aparelho em pé ou deitado; o aviso de girar pra
// horizontal só aparece depois dele (ver ui/orientation.js).

const GROUND_TOP = GAME_HEIGHT - 230;

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    setLandscapeRequired(false);
    this.events.once('shutdown', () => setLandscapeRequired(true));
    this.createScenery();

    this.add
      .text(GAME_WIDTH / 2, 230, 'Morto Vivo game', {
        fontFamily: 'monospace',
        fontSize: '120px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 350, 'Um jogo que continua nas páginas do livro', {
        fontFamily: 'monospace',
        fontSize: '38px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, 540, 'JOGAR', () => this.scene.start('Tutorial'), {
      width: 520,
      height: 140,
      fontSize: 64,
    });

    const fullscreenButton = addFullscreenButton(this, GAME_WIDTH - 24, 24, 30);
    addSoundButton(this, GAME_WIDTH - 24 - (fullscreenButton ? fullscreenButton.width + 12 : 0), 24, 30);

    const play = () => {
      playSfx(this, 'confirm');
      this.scene.start('Tutorial');
    };
    this.input.keyboard.once('keydown-ENTER', play);
    onPadMenu(this, { onConfirm: play });
  }

  createScenery() {
    // chão com os mesmos tiles da fase
    this.add.tileSprite(GAME_WIDTH / 2, GROUND_TOP + 12, GAME_WIDTH, 24, 'ground-1');
    this.add.tileSprite(GAME_WIDTH / 2, GROUND_TOP + 24 + 103, GAME_WIDTH, 206, 'dirt-1');

    // os dois personagens, lado a lado, andando no lugar
    createBoyWalkAnimation(this);
    const boy = this.add.sprite(GAME_WIDTH / 2 - 420, GROUND_TOP, 'boy-walk-01').setOrigin(0.5, 1);
    boy.setScale(260 / boy.height);
    if (this.anims.exists('boy-walk')) boy.play('boy-walk');

    // Esqueleto ainda é um retângulo na fase: mesmo placeholder aqui
    this.add.rectangle(GAME_WIDTH / 2 + 420, GROUND_TOP, 90, 150, COLORS.SKELETON).setOrigin(0.5, 1);
  }
}
