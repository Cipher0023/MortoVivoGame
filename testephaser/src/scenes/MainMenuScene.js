import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { createButton } from '../ui/Button.js';
import { addFullscreenButton } from '../ui/fullscreen.js';
import { addSoundButton } from '../ui/soundButton.js';
import { playSfx } from '../audio/sfx.js';
import { onPadMenu } from '../input/gamepad.js';
import { createBoyWalkAnimation, BOY_DRAWING_HEIGHT } from '../entities/Living.js';
import { createSkeletonWalkAnimation } from '../entities/Skeleton.js';
import { setLandscapeRequired } from '../ui/orientation.js';
import { addLogo, paintPaper, textStyle, CSS } from '../ui/theme.js';

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
    createMenuScenery(this);

    this.add
      .text(GAME_WIDTH / 2, 120, 'LIVRO INFANTIL + JOGO', textStyle(30, CSS.folha, { letterSpacing: 6 }))
      .setOrigin(0.5);
    addLogo(this, GAME_WIDTH / 2, 235, 150);
    this.add
      .text(GAME_WIDTH / 2, 355, 'Um jogo que continua nas páginas do livro', textStyle(42))
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
}

// Fundo de papel, chão e os dois personagens andando no lugar (menu e tela
// Começar do livro).
export function createMenuScenery(scene) {
  paintPaper(scene);
  // chão com os mesmos tiles da fase
  scene.add.tileSprite(GAME_WIDTH / 2, GROUND_TOP + 12, GAME_WIDTH, 24, 'ground-1');
  scene.add.tileSprite(GAME_WIDTH / 2, GROUND_TOP + 24 + 103, GAME_WIDTH, 206, 'dirt-1');

  // os dois personagens, lado a lado, andando no lugar
  createBoyWalkAnimation(scene);
  const boy = scene.add.sprite(GAME_WIDTH / 2 - 420, GROUND_TOP, 'boy-walk-01').setOrigin(0.5, 1);
  // ~237px de desenho, como antes (o quadro tem espaço em cima pro pulo)
  boy.setScale(237 / BOY_DRAWING_HEIGHT);
  if (scene.anims.exists('boy-walk')) boy.play('boy-walk');

  createSkeletonWalkAnimation(scene);
  const skeleton = scene.add.sprite(GAME_WIDTH / 2 + 420, GROUND_TOP, 'skeleton-walk-1').setOrigin(0.5, 1);
  skeleton.setScale(260 / skeleton.height);
  if (scene.anims.exists('skeleton-walk')) skeleton.play('skeleton-walk');
}
