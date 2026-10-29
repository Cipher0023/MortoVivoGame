import Phaser from 'phaser';
import Character from './Character.js';
import { COLORS, PHYSICS, SKELETON } from '../config/constants.js';
import { SKELETON_WALK_FRAME_COUNT } from '../config/assetManifest.js';
import { playSfx } from '../audio/sfx.js';

// Caminhada da menina caveira (cav-run-1 a 4). Parada/no ar volta pro frame 1.
const WALK_ANIM_KEY = 'skeleton-walk';
const WALK_FRAME_RATE = 10;
const MIN_WALK_ANIM_SCALE = 0.4;
const DISPLAY_HEIGHT = 84; // altura em tela, igual à do Vivo (o frame mais alto tem 298px)
const NATIVE_FRAME_HEIGHT = 298;
// sem a cabeça: só o corpo, do pescoço pra baixo (fração da altura do frame)
const HEADLESS_CROP_TOP = 0.66;
// desmontada: a arte achatada vira a "pilha de ossos"
const COLLAPSED_SCALE_Y = 0.3;

function frameKey(n) {
  return `skeleton-walk-${n}`;
}

// Animação global (AnimationManager do jogo): quem precisar primeiro cria.
export function createSkeletonWalkAnimation(scene) {
  if (scene.anims.exists(WALK_ANIM_KEY)) return;
  const frames = [];
  for (let i = 1; i <= SKELETON_WALK_FRAME_COUNT; i++) {
    const key = frameKey(i);
    if (scene.textures.exists(key)) frames.push({ key });
  }
  if (frames.length === 0) return;
  scene.anims.create({ key: WALK_ANIM_KEY, frames, frameRate: WALK_FRAME_RATE, repeat: -1 });
}

// Esqueleto: pula o mesmo tanto que o Vivo. Tirando a cabeça (ver SkullHead)
// fica fina e passa em grades; pisada pelo Vivo, desmonta e fica imóvel por
// um tempo (a PlayScene cuida do tempo e da cabeça).
// A colisão continua sendo o retângulo (invisível, tamanhos em SKELETON); a
// arte é um sprite à parte que acompanha os pés dele a cada quadro.
export default class Skeleton extends Character {
  constructor(scene, x, y) {
    super(scene, x, y, SKELETON.WIDTH, SKELETON.HEIGHT, COLORS.SKELETON, 'skeleton');
    // sem a cabeça = fina (a colisão com a grade olha isto)
    this.isThin = false;
    this.collapsed = false;
    // só um dos braços pode ser arremessado: enquanto ele está fora, não
    // dá pra lançar de novo (ver ThrownArm)
    this.hasArm = true;

    this.isFilled = false;
    createSkeletonWalkAnimation(scene);
    this.sprite = scene.add.sprite(x, this.body.bottom, frameKey(1)).setOrigin(0.5, 1);
    this.baseScale = DISPLAY_HEIGHT / NATIVE_FRAME_HEIGHT;
    this.sprite.setScale(this.baseScale);

    // depois do passo da física (o corpo já moveu o retângulo neste quadro)
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncSprite, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncSprite, this);
      this.sprite.destroy();
    });
  }

  get hasHead() {
    return !this.isThin;
  }

  handleMovement(input) {
    if (this.collapsed) {
      this.body.setVelocityX(0);
      return;
    }
    super.handleMovement(input);
  }

  syncSprite() {
    const sprite = this.sprite;
    sprite.setVisible(this.visible);
    if (!this.visible) return;
    sprite.setPosition(this.x, this.body.bottom);
    sprite.setDepth(this.depth);
    sprite.setAlpha(this.alpha);
    sprite.setFlipX(this.facing < 0);

    const body = this.body;
    const grounded = body.blocked.down || Boolean(this.onSlope);
    const walking = grounded && !this.collapsed && !this.climbing && Math.abs(body.velocity.x) > 5;
    if (walking) {
      sprite.play(WALK_ANIM_KEY, true);
      sprite.anims.timeScale = Math.max(Math.abs(body.velocity.x) / PHYSICS.MOVE_SPEED, MIN_WALK_ANIM_SCALE);
    } else if (sprite.anims.isPlaying || sprite.texture.key !== frameKey(1)) {
      sprite.anims.stop();
      sprite.setTexture(frameKey(1));
    }

    sprite.setScale(this.baseScale, this.baseScale * (this.collapsed ? COLLAPSED_SCALE_Y : 1));
    if (this.isThin) {
      const { width, height } = sprite.frame;
      const top = Math.round(height * HEADLESS_CROP_TOP);
      sprite.setCrop(0, top, width, height - top);
    } else if (sprite.isCropped) {
      sprite.setCrop();
    }
  }

  removeHead() {
    this.isThin = true;
    this.applyShape();
    playSfx(this.scene, 'thin');
  }

  attachHead() {
    this.isThin = false;
    this.applyShape();
    playSfx(this.scene, 'unthin');
  }

  // vira uma pilha de ossos (baixinha e imóvel) até reassemble()
  collapse() {
    this.collapsed = true;
    this.climbing = false;
    this.body.setVelocityX(0);
    this.applyShape();
    playSfx(this.scene, 'collapse');
  }

  reassemble() {
    if (!this.collapsed) return;
    this.collapsed = false;
    this.applyShape();
    playSfx(this.scene, 'reassemble');
  }

  // Tamanho conforme o estado, mantendo os pés no mesmo lugar.
  applyShape() {
    const width = this.isThin ? SKELETON.HEADLESS_WIDTH : SKELETON.WIDTH;
    const height = this.collapsed ? SKELETON.COLLAPSED_HEIGHT : this.isThin ? SKELETON.HEADLESS_HEIGHT : SKELETON.HEIGHT;
    const bottom = this.body.bottom;
    this.setSize(width, height);
    this.body.setSize(width, height, true);
    this.y = bottom - height / 2;
    this.setAlpha(this.collapsed ? 0.7 : 1);
  }
}
