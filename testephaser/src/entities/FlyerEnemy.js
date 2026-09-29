import Enemy from './Enemy.js';
import { ENEMY } from '../config/constants.js';

// Voador: vai e volta em linha reta na horizontal, até ENEMY.FLY_RANGE
// blocos pra cada lado de onde foi colocado (ou antes, se bater numa parede).
// Ignora beiradas — voa por cima de buracos e água.
export default class FlyerEnemy extends Enemy {
  constructor(scene, x, y, width, height, color, speed = ENEMY.FLY_SPEED) {
    super(scene, x, y, width, height, color);
    this.speed = speed;
  }

  act() {
    this.fly();
  }

  fly() {
    const body = this.body;
    const hitWall = this.direction > 0 ? body.blocked.right : body.blocked.left;
    const tooFar = (this.x - this.homeX) * this.direction >= this.blocks(ENEMY.FLY_RANGE);
    if (hitWall || tooFar) this.direction *= -1;
    body.setVelocity(this.speed * this.direction, 0);
  }
}
