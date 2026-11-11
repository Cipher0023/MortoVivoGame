import Phaser from 'phaser';
import PreloadScene from './scenes/PreloadScene.js';
import PlayScene from './scenes/PlayScene.js';
import LevelEditorScene from './scenes/LevelEditorScene.js';
import MusicEditorScene from './scenes/MusicEditorScene.js';
import TouchControlsScene from './scenes/TouchControlsScene.js';
import HudScene from './scenes/HudScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import TutorialScene from './scenes/TutorialScene.js';
import ScanScene from './scenes/ScanScene.js';
import BookStartScene from './scenes/BookStartScene.js';
import ArScanScene from './scenes/ArScanScene.js';
import { GAME_WIDTH, GAME_HEIGHT, PHYSICS } from './config/constants.js';
import { initOrientation } from './ui/orientation.js';
import { initMode } from './config/mode.js';

// modo livro (padrão) ou modo jogo (?modo=jogo): ver config/mode.js
initMode();

// Versão nova publicada com a página aberta: o deploy apaga os arquivos da
// versão anterior, e a câmera de AR (baixada só na hora) pedia um arquivo que
// não existe mais. Recarrega a página para pegar a versão nova. No máximo uma
// vez por minuto, para nunca entrar em ciclo se o arquivo faltar de verdade.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'mortovivo-recarregou';
  try {
    const last = Number(window.sessionStorage.getItem(KEY));
    if (Date.now() - last < 60000) return; // deixa o erro seguir para o aviso
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#2b1d16',
  scale: {
    mode: Phaser.Scale.FIT,
    // Quem centraliza é o CSS (#game-container é flex): centralizar aqui
    // também somava a margem do Phaser à do flex e deslocava o jogo.
    autoCenter: Phaser.Scale.NO_CENTER,
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
  input: { activePointers: 3, gamepad: true },
  // Overlays (Hud, TouchControls) depois da fase na lista = desenhados por cima.
  scene: [
    PreloadScene,
    BookStartScene,
    ArScanScene,
    MainMenuScene,
    TutorialScene,
    ScanScene,
    PlayScene,
    LevelEditorScene,
    MusicEditorScene,
    HudScene,
    TouchControlsScene,
  ],
};

// O Phaser desenha os textos no canvas na hora em que são criados: se a fonte
// ainda não chegou, fica a fonte reserva para sempre. Espera as fontes da
// página (Luckiest Guy e Baloo 2), mas no máximo 2,5 s — sem internet, segue
// com a reserva.
async function waitForFonts() {
  if (!document.fonts?.load) return;
  const fonts = Promise.all([
    document.fonts.load('40px "Luckiest Guy"'),
    document.fonts.load('bold 40px "Baloo 2"'),
    document.fonts.load('500 40px "Baloo 2"'),
  ]).catch(() => {});
  await Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]);
}

waitForFonts().then(() => {
  const game = new Phaser.Game(config);
  window.__game = game;

  // aviso de girar só depois do menu, pausa e reencaixe ao girar (ver orientation.js)
  initOrientation(game);
});
