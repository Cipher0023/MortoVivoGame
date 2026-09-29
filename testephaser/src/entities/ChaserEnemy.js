import PatrolEnemy from './PatrolEnemy.js';
import { ENEMY } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Perseguidor: patrulha como o inimigo comum; quando vê o Vivo (perto e mais
// ou menos na mesma altura), vai atrás dele — mais rápido, mas sem cair de
// beiradas nem atravessar paredes (para na borda esperando). Contorno branco
// = perseguindo.
export default class ChaserEnemy extends PatrolEnemy {
  constructor(scene, x, y, width, height, color, chaseSpeed) {
    super(scene, x, y, width, height, color);
    this.chaseSpeed = chaseSpeed;
    this.chasing = false;
  }

  act() {
    const target = this.target();
    const dx = target.x - this.x;
    const sees =
      Math.abs(dx) < this.blocks(ENEMY.CHASE_RANGE_X) &&
      Math.abs(target.body.bottom - this.body.bottom) < this.blocks(ENEMY.CHASE_RANGE_Y);

    if (!sees) {
      this.setChasing(false);
      this.patrol();
      return;
    }
    this.setChasing(true);
    if (Math.abs(dx) > 4) this.direction = Math.sign(dx);
    const blocked = this.direction > 0 ? this.body.blocked.right : this.body.blocked.left;
    const canGo = !blocked && Math.abs(dx) > 4 && this.scene.hasGroundAhead(this, this.direction);
    this.body.setVelocityX(canGo ? this.chaseSpeed * this.direction : 0);
  }

  setChasing(chasing) {
    if (chasing === this.chasing) return;
    this.chasing = chasing;
    if (chasing) {
      this.setStrokeStyle(3, 0xffffff);
      playSfx(this.scene, 'enemyAlert');
    } else {
      this.isStroked = false;
    }
  }

  stun(kind) {
    this.setChasing(false);
    super.stun(kind);
  }
}
