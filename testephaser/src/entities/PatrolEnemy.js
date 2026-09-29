import Enemy from './Enemy.js';
import { COLORS, ENEMY } from '../config/constants.js';

// Inimigo de patrulha: anda de um lado pro outro sozinho e dá meia-volta ao
// bater em algo sólido ou chegar numa beirada — funciona em qualquer fase
// montada no editor, sem precisar marcar limites. Baixo ou alto (só muda o
// tamanho).
export default class PatrolEnemy extends Enemy {
  constructor(scene, x, y, width = 36, height = width, color = COLORS.PATROL_ENEMY, speed = ENEMY.PATROL_SPEED) {
    super(scene, x, y, width, height, color);
    this.speed = speed;
    this.body.setVelocityX(this.speed);
  }

  act() {
    this.patrol();
  }

  patrol() {
    const blocked = this.direction > 0 ? this.body.blocked.right : this.body.blocked.left;
    if (blocked || !this.scene.hasGroundAhead(this, this.direction)) {
      this.direction *= -1;
    }
    this.body.setVelocityX(this.speed * this.direction);
  }
}
