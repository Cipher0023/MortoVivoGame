import Phaser from 'phaser';
import PreloadScene from './scenes/PreloadScene.js';
import PlayScene from './scenes/PlayScene.js';
import LevelEditorScene from './scenes/LevelEditorScene.js';
import TouchControlsScene from './scenes/TouchControlsScene.js';
import HudScene from './scenes/HudScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import TutorialScene from './scenes/TutorialScene.js';
import ScanScene from './scenes/ScanScene.js';
import { GAME_WIDTH, GAME_HEIGHT, PHYSICS } from './config/constants.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    // Nunca escala acima da resolução nativa (1920x1080): em telas normais o
    // FIT reduz (nítido); só em monitores maiores que isso sobra tarja preta,
    // em vez de ampliar o canvas e borrar a arte.
    max: { width: GAME_WIDTH, height: GAME_HEIGHT },
    // Tela cheia na página inteira (não só no canvas): assim o
    // #game-container continua controlando o encaixe e o aviso de girar a
    // tela continua aparecendo.
    fullscreenTarget: document.documentElement,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: PHYSICS.GRAVITY_Y },
      debug: false,
    },
  },
  // Padrão do Phaser é 1 toque: sem isso, segurar o joystick e apertar um
  // botão ao mesmo tempo não funciona.
  input: { activePointers: 3 },
  // Overlays (Hud, TouchControls) depois da fase na lista = desenhados por cima.
  scene: [
    PreloadScene,
    MainMenuScene,
    TutorialScene,
    ScanScene,
    PlayScene,
    LevelEditorScene,
    HudScene,
    TouchControlsScene,
  ],
};

const game = new Phaser.Game(config);
window.__game = game;

// Tela na vertical: o index.html cobre o jogo com o aviso de girar; aqui o
// jogo pausa junto, pra ninguém morrer enquanto gira o aparelho.
const portrait = window.matchMedia('(orientation: portrait)');
const syncOrientation = () => (portrait.matches ? game.pause() : game.resume());
portrait.addEventListener('change', syncOrientation);
game.events.once(Phaser.Core.Events.READY, syncOrientation);
