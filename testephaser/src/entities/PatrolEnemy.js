import Phaser from 'phaser';
import { COLORS } from '../config/constants.js';

// Inimigo de patrulha: anda de um lado pro outro sozinho e dá meia-volta ao
// bater em algo sólido ou chegar numa beirada — funciona em qualquer fase
// montada no editor, sem precisar marcar limites. Só mata o Vivo.
export default class PatrolEnemy extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, size = 36, speed = 80) {
    super(scene, x, y, size, size, COLORS.PATROL_ENEMY);
    this.scene = scene;
    this.speed = speed;
    this.direction = 1;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.allowGravity = false;
    this.body.setVelocityX(this.speed);
  }

  update() {
    const blocked = this.direction > 0 ? this.body.blocked.right : this.body.blocked.left;
    if (blocked || !this.scene.hasGroundAhead(this, this.direction)) {
      this.direction *= -1;
    }
    this.body.setVelocityX(this.speed * this.direction);
  }
}
