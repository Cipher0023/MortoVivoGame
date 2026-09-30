import Phaser from 'phaser';
import {
  TILES_PATH,
  OBJECTS_PATH,
  BOY_PATH,
  BLOCKS_PATH,
  TILE_MANIFEST,
  OBJECT_MANIFEST,
  BOY_WALK_MANIFEST,
  BLOCK_MANIFEST,
  SOUNDS_PATH,
  SOUND_MANIFEST,
} from '../config/assetManifest.js';
import { restoreMute, sfxKey } from '../audio/sfx.js';
import { BALL, COLORS } from '../config/constants.js';
import { PHASES, findPhaseByScan } from '../config/phases.js';
import { startPhase } from '../levels/startPhase.js';

// Bola desenhada (ainda sem arte): branca com gomos escuros, pra dar pra ver
// ela girando ao rolar. Usada no jogo e no editor.
function createBallTexture(scene) {
  if (scene.textures.exists('ball')) return;
  const r = BALL.RADIUS;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(COLORS.BALL, 1).fillCircle(r, r, r);
  g.fillStyle(COLORS.BALL_PATCH, 1);
  g.fillCircle(r, r, r * 0.3);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillCircle(r + Math.cos(a) * r * 0.78, r + Math.sin(a) * r * 0.78, r * 0.2);
  }
  g.lineStyle(2, COLORS.BALL_PATCH, 1).strokeCircle(r, r, r - 1);
  g.generateTexture('ball', r * 2, r * 2);
  g.destroy();
}

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    for (const tile of TILE_MANIFEST) {
      this.load.image(tile.key, TILES_PATH + tile.file);
    }
    for (const obj of OBJECT_MANIFEST) {
      this.load.image(obj.key, OBJECTS_PATH + obj.file);
    }
    for (const frame of BOY_WALK_MANIFEST) {
      this.load.image(frame.key, BOY_PATH + frame.file);
    }
    for (const block of BLOCK_MANIFEST) {
      this.load.image(block.key, BLOCKS_PATH + block.file);
    }
    for (const sound of SOUND_MANIFEST) {
      sound.files.forEach((file, i) => this.load.audio(sfxKey(sound.id, i), SOUNDS_PATH + file));
    }
  }

  create() {
    restoreMute(this.game);
    createBallTexture(this);

    const params = new URLSearchParams(window.location.search);
    if (params.get('scene') === 'editor') {
      this.scene.start('LevelEditor');
      return;
    }

    // Link direto pra fase (?fase=<código>): é o que um QR code com URL
    // abre pela câmera nativa do celular. Em desenvolvimento, ?fase=1..4
    // também vale, pra testar sem escanear.
    const fromLink = findPhaseByScan(window.location.href);
    const devNumber = import.meta.env.DEV ? Number(params.get('fase')) : NaN;
    const phase = fromLink ?? PHASES.find((p) => p.number === devNumber);
    if (phase && startPhase(this, phase)) return;

    this.scene.start('MainMenu');
  }
}
