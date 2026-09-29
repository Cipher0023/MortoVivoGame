import Phaser from 'phaser';
import { PHYSICS } from '../config/constants.js';
import { BOY_WALK_FRAME_COUNT } from '../config/assetManifest.js';

// Ciclo de caminhada do menino (ver playerController.js do game2.0): frameRate
// 16, sem frames de pulo no acervo — parado/no ar sempre volta pro frame 1.
const WALK_ANIM_KEY = 'boy-walk';
const WALK_FRAME_RATE = 16;
const MIN_WALK_ANIM_SCALE = 0.4;
const DISPLAY_HEIGHT = 84; // altura em tela; a original (291px) é grande demais pro mundo do jogo
const NATIVE_FRAME_HEIGHT = 291;
const BODY_WIDTH = 34;
const BODY_HEIGHT = 70;

function frameKey(n) {
  return `boy-walk-${String(n).padStart(2, '0')}`;
}

// Animação global (fica no AnimationManager do jogo): a primeira cena que
// precisar cria — fase, editor ou o menu principal.
export function createBoyWalkAnimation(scene) {
  if (scene.anims.exists(WALK_ANIM_KEY)) return;
  const frames = [];
  for (let i = 1; i <= BOY_WALK_FRAME_COUNT; i++) {
    const key = frameKey(i);
    if (scene.textures.exists(key)) frames.push({ key });
  }
  if (frames.length === 0) return;
  scene.anims.create({ key: WALK_ANIM_KEY, frames, frameRate: WALK_FRAME_RATE, repeat: -1 });
}

export default class Living extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, frameKey(1));
    this.scene = scene;
    this.characterName = 'living';
    this.hasKey = false;
    this.isActive = false;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const scale = DISPLAY_HEIGHT / NATIVE_FRAME_HEIGHT;
    this.setScale(scale);
    this.body.setCollideWorldBounds(true);
    // setSize recebe dimensões no espaço local (não escalado) do frame; o
    // terceiro parâmetro (center) deixa o Phaser centralizar a hitbox.
    this.body.setSize(BODY_WIDTH / scale, BODY_HEIGHT / scale, true);

    createBoyWalkAnimation(scene);
  }

  setActiveControl(active) {
    this.isActive = active;
    if (!active) {
      this.body.setVelocityX(0);
      // sem isso ele continua "andando" parado no lugar depois da troca
      this.anims.stop();
      this.setTexture(frameKey(1));
    }
  }

  // Chamado pro personagem controlado e também pro que está seguindo (ver
  // FollowSystem) — quem decide quem se move é a cena.
  // input.x: eixo de -1 a 1 (teclado dá -1/0/1; joystick, valores
  // intermediários = andar mais devagar).
  handleMovement(input) {
    const x = input.x;
    const isWalking = x !== 0;
    this.body.setVelocityX(PHYSICS.MOVE_SPEED * x);
    if (isWalking) this.setFlipX(x < 0);

    if (input.jump && this.body.blocked.down) {
      this.body.setVelocityY(PHYSICS.JUMP_VELOCITY);
    }

    if (this.body.blocked.down && isWalking) {
      this.play(WALK_ANIM_KEY, true);
      // passo acompanha a velocidade; com piso pra não virar câmera lenta
      this.anims.timeScale = Math.max(Math.abs(x), MIN_WALK_ANIM_SCALE);
    } else if (this.anims.isPlaying) {
      this.anims.stop();
      this.setTexture(frameKey(1));
    }
  }
}
