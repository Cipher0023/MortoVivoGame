import Phaser from 'phaser';
import { BALL } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Bola que o Vivo chuta mirando (ver PlayScene.updateAim): quica, rola com atrito no
// chão e gira conforme anda. Colisões, rampas e botões ficam na PlayScene.
// Caindo num buraco, volta pro lugar onde começou (senão a fase travaria).
export default class Ball extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'ball');
    this.spawn = { x, y };

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(BALL.RADIUS * 2, BALL.RADIUS * 2);
    // setCircle usa o tamanho da textura (sem escala)
    this.body.setCircle(this.width / 2);
    this.body.setBounce(BALL.BOUNCE, BALL.BOUNCE);
    this.body.setCollideWorldBounds(true);
    this.lastVelocityY = 0;
  }

  // dir: 1 = direita, -1 = esquerda; angleDeg: acima da horizontal
  kick(dir, angleDeg) {
    const rad = Phaser.Math.DegToRad(angleDeg);
    this.body.setVelocity(dir * BALL.KICK_SPEED * Math.cos(rad), -BALL.KICK_SPEED * Math.sin(rad));
    playSfx(this.scene, 'kick');
  }

  respawn() {
    this.body.reset(this.spawn.x, this.spawn.y);
    this.setAngle(0);
  }

  isOnGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(delta) {
    const body = this.body;
    const dt = delta / 1000;
    const onGround = this.isOnGround();
    if (onGround) {
      // quicou forte: barulho
      if (this.lastVelocityY > BALL.BOUNCE_SOUND_SPEED) playSfx(this.scene, 'ballBounce');
      body.velocity.x *= Math.pow(BALL.GROUND_KEEP_PER_S, dt);
      if (Math.abs(body.velocity.x) < BALL.STOP_SPEED) body.velocity.x = 0;
    }
    this.lastVelocityY = body.velocity.y;
    // gira rolando (ângulo = distância / raio)
    this.angle += Phaser.Math.RadToDeg((body.velocity.x * dt) / BALL.RADIUS);
  }
}
