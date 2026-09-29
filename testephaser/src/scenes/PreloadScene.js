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
import { PHASES, findPhaseByScan } from '../config/phases.js';
import { startPhase } from '../levels/startPhase.js';

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
