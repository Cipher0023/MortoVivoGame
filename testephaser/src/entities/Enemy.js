import Phaser from 'phaser';
import { ENEMY } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Base de todos os inimigos: corpo sem gravidade (andam "apoiados" no chão da
// célula ou voam), só machucam o Vivo e não morrem — o pisão e o braço os
// paralisam por um tempo. Cada tipo implementa act(), chamado todo quadro
// enquanto não está paralisado.
export default class Enemy extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, width, height, color) {
    super(scene, x, y, width, height, color);
    this.scene = scene;
    this.direction = 1;
    this.homeX = x;
    this.homeY = y;
    this.stunned = false;
    this.stunTimer = null;
    this.blinkTween = null;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.allowGravity = false;
  }

  update() {
    if (!this.stunned) this.act();
  }

  act() {}

  // o Vivo, que é quem os inimigos enxergam
  target() {
    return this.scene.living;
  }

  // distâncias da config estão em blocos
  blocks(amount) {
    return amount * this.scene.cellSize;
  }

  // kind: 'stomp' (achatado) ou 'hit' (tombado). Paralisar de novo um
  // inimigo já paralisado recomeça a contagem.
  stun(kind) {
    this.stunned = true;
    this.body.setVelocity(0, 0);
    this.stunTimer?.remove();
    this.blinkTween?.remove();
    this.blinkTween = null;
    this.setAlpha(0.6);
    if (kind === 'stomp') {
      this.setScale(1.2, 0.45);
      this.setAngle(0);
    } else {
      this.setScale(1);
      this.setAngle(90 * this.direction);
    }
    playSfx(this.scene, 'enemyStun');

    const time = this.scene.time;
    this.stunTimer = time.delayedCall(ENEMY.STUN_MS - ENEMY.BLINK_MS, () => {
      // aviso: pisca antes de acordar
      this.blinkTween = this.scene.tweens.add({ targets: this, alpha: 0.15, duration: 120, yoyo: true, repeat: -1 });
      this.stunTimer = time.delayedCall(ENEMY.BLINK_MS, () => this.recover());
    });
  }

  recover() {
    this.stunned = false;
    this.stunTimer = null;
    this.blinkTween?.remove();
    this.blinkTween = null;
    this.setAlpha(1).setScale(1).setAngle(0);
    playSfx(this.scene, 'enemyRecover');
  }
}
