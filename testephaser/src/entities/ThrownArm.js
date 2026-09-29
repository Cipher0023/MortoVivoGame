import Phaser from 'phaser';
import { ATTACK, COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Braço arremessado pela Esqueleto: projétil com a gravidade do mundo
// (movimento uniformemente variado). Voando, derruba o primeiro inimigo que
// tocar; ao bater em algo sólido cai e fica no chão até ela ir buscar.
// Colisões e coleta ficam na PlayScene (throwArm/pickUpArm).
export default class ThrownArm extends Phaser.GameObjects.Rectangle {
  // angleDeg: acima da horizontal; facing: 1 = direita, -1 = esquerda
  constructor(scene, x, y, angleDeg, facing) {
    super(scene, x, y, 22, 6, COLORS.SKELETON);
    this.scene = scene;
    this.flying = true;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    // no ar gira; a caixa de colisão continua reta (Arcade não gira corpos)
    this.body.setSize(14, 14);
    this.body.setCollideWorldBounds(true);
    const rad = Phaser.Math.DegToRad(angleDeg);
    this.body.setVelocity(facing * ATTACK.ARM_SPEED * Math.cos(rad), -ATTACK.ARM_SPEED * Math.sin(rad));
    this.body.setAngularVelocity(facing * ATTACK.ARM_SPIN);
  }

  // Bateu em algo sólido (ou na borda do mundo): para de girar e cai reto.
  land() {
    if (!this.flying) return;
    this.flying = false;
    this.body.setVelocityX(0);
    this.body.setAngularVelocity(0);
    this.setAngle(0);
    playSfx(this.scene, 'armLand');
  }

  // Acertou um inimigo: ricocheteia um pouco pra trás e cai.
  bounceOff() {
    if (!this.flying) return;
    this.flying = false;
    this.body.setVelocity(-this.body.velocity.x * 0.25, -180);
    this.body.setAngularVelocity(0);
    this.setAngle(0);
    playSfx(this.scene, 'armHit');
  }

  update() {
    const b = this.body;
    if (this.flying && (b.blocked.left || b.blocked.right || b.blocked.down || b.blocked.up)) this.land();
    // parado no chão: sem deslizar
    if (!this.flying && (b.blocked.down || b.touching.down)) b.setVelocityX(0);
  }
}
