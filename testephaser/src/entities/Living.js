import Phaser from 'phaser';
import { PHYSICS, WATER } from '../config/constants.js';
import { BOY_WALK_FRAME_COUNT } from '../config/assetManifest.js';
import { playSfx } from '../audio/sfx.js';

// Menino ("Vivo"): corrida de 12 quadros (frameRate 16, acompanha a
// velocidade do analógico) e pulo de 6 poses. Os quadros têm todos a mesma
// tela (210x344) com os pés na base — ver BOY_WALK_MANIFEST.
const WALK_ANIM_KEY = 'boy-walk';
const WALK_FRAME_RATE = 16;
const MIN_WALK_ANIM_SCALE = 0.4;
// Escala do desenho: mesmo tamanho de antes (291px de quadro = 84px na tela).
const SCALE = 84 / 291;
// altura do desenho em pé dentro do quadro (o resto, em cima, é folga do pulo)
export const BOY_DRAWING_HEIGHT = 265;
const BODY_WIDTH = 34;
const BODY_HEIGHT = 70;

// Pulo: 1 agachar (no impulso), 2 decolar, 3 subindo, 4 no alto,
// 5 caindo, 6 aterrissar. No ar, a pose vem da velocidade vertical (px/s,
// negativa = subindo) — assim cair de uma beirada também usa a pose 5.
const JUMP = {
  CROUCH_MS: 70, // pose 1 logo no impulso (sem atrasar o pulo)
  LAND_MS: 110, // pose 6 ao tocar o chão
  LAND_MIN_FALL: 250, // só "aterrissa" se vinha caindo pelo menos a isso
  TAKEOFF_VY: -330, // abaixo disso: decolando (pose 2)
  APEX_VY: 110, // |vy| abaixo disso: no alto (pose 4)
};

function frameKey(n) {
  return `boy-walk-${String(n).padStart(2, '0')}`;
}

function jumpKey(n) {
  return `boy-jump-${n}`;
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
    // na água funda (a PlayScene atualiza a cada quadro): lento e sem pulo
    this.inWater = false;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(SCALE);
    this.body.setCollideWorldBounds(true);
    // setSize/setOffset usam o espaço local (não escalado) do quadro: hitbox
    // centrada na horizontal e com a base nos pés (base do quadro).
    const bodyW = BODY_WIDTH / SCALE;
    const bodyH = BODY_HEIGHT / SCALE;
    this.body.setSize(bodyW, bodyH, false);
    this.body.setOffset((this.width - bodyW) / 2, this.height - bodyH);
    // a posição (x, y) do sprite continua sendo o centro da hitbox, como era
    // antes — o resto da fase (caixa, cabeça carregada, início) conta com isso
    this.setOrigin(0.5, (this.height - bodyH / 2) / this.height);
    this.wasOnGround = true;
    this.fallSpeed = 0;
    this.poseUntil = 0; // até quando a pose de impulso/aterrissagem fica
    this.pose = null;

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

  // Pose parada (sem animação rodando).
  showFrame(key) {
    if (this.anims.isPlaying) this.anims.stop();
    if (this.texture.key !== key) this.setTexture(key);
  }

  // Chamado pro personagem controlado e também pro que está seguindo (ver
  // FollowSystem) — quem decide quem se move é a cena.
  // input.x: eixo de -1 a 1 (teclado dá -1/0/1; joystick, valores
  // intermediários = andar mais devagar).
  handleMovement(input) {
    const x = this.inWater ? input.x * WATER.MOVE_FACTOR : input.x;
    const isWalking = x !== 0;
    this.body.setVelocityX(PHYSICS.MOVE_SPEED * x);
    if (isWalking) this.setFlipX(x < 0);

    let jumped = false;
    if (input.jump && this.body.blocked.down && !this.inWater) {
      this.body.setVelocityY(PHYSICS.JUMP_VELOCITY);
      playSfx(this.scene, 'jump');
      jumped = true;
    }
    this.updatePose(isWalking, Math.abs(x), jumped);
  }

  // Escolhe o que mostrar: corrida, parado ou uma pose do pulo.
  updatePose(isWalking, speed, jumped) {
    const body = this.body;
    const now = this.scene.time.now;
    const onGround = !jumped && (body.blocked.down || body.touching.down || Boolean(this.onSlope));

    // escada e sendo puxado pelo parceiro: parado, sem pose de pulo
    if (this.climbing || this.beingPulled) {
      this.pose = null;
      this.wasOnGround = true;
      this.showFrame(frameKey(1));
      return;
    }

    if (jumped) {
      this.pose = 'crouch';
      this.poseUntil = now + JUMP.CROUCH_MS;
    } else if (onGround && !this.wasOnGround && this.fallSpeed > JUMP.LAND_MIN_FALL) {
      this.pose = 'land';
      this.poseUntil = now + JUMP.LAND_MS;
    }
    if (!onGround) this.fallSpeed = Math.max(0, body.velocity.y);
    this.wasOnGround = onGround;
    if (this.pose && now >= this.poseUntil) this.pose = null;

    if (this.pose === 'crouch') return this.showFrame(jumpKey(1));
    if (this.pose === 'land' && !isWalking) return this.showFrame(jumpKey(6));
    this.pose = null;

    if (!onGround) {
      const vy = body.velocity.y;
      let n = 5;
      if (vy < JUMP.TAKEOFF_VY) n = 2;
      else if (vy < -JUMP.APEX_VY) n = 3;
      else if (vy <= JUMP.APEX_VY) n = 4;
      return this.showFrame(jumpKey(n));
    }

    if (isWalking) {
      this.play(WALK_ANIM_KEY, true);
      // passo acompanha a velocidade; com piso pra não virar câmera lenta
      this.anims.timeScale = Math.max(speed, MIN_WALK_ANIM_SCALE);
      return;
    }
    this.showFrame(frameKey(1));
  }
}
