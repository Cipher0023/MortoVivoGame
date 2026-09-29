import FlyerEnemy from './FlyerEnemy.js';
import { ENEMY } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Mergulhador: voa como o voador; quando o Vivo passa embaixo dele, mergulha
// reto até o nível dos pés do Vivo (ou até bater no chão) e depois sobe de
// volta devagar pra altura de onde saiu, e continua voando.
export default class DiverEnemy extends FlyerEnemy {
  constructor(scene, x, y, width, height, color) {
    super(scene, x, y, width, height, color);
    this.state = 'fly'; // 'fly' | 'dive' | 'rise'
    this.diveTargetY = y;
  }

  act() {
    const body = this.body;

    if (this.state === 'dive') {
      body.setVelocity(0, ENEMY.DIVE_SPEED);
      if (body.blocked.down || this.y >= this.diveTargetY) this.state = 'rise';
      return;
    }

    if (this.state === 'rise') {
      body.setVelocity(0, -ENEMY.RISE_SPEED);
      if (this.y <= this.homeY || body.blocked.up) {
        if (this.y <= this.homeY) body.reset(this.x, this.homeY);
        this.state = 'fly';
      }
      return;
    }

    this.fly();
    const target = this.target();
    const below = target.body.bottom - this.body.bottom;
    if (Math.abs(target.x - this.x) < this.blocks(ENEMY.DIVE_TRIGGER_X) && below > 0 && below < this.blocks(ENEMY.DIVE_RANGE_Y)) {
      this.state = 'dive';
      // desce até os pés dele ficarem na altura da barriga do mergulhador
      this.diveTargetY = target.body.bottom - this.displayHeight / 2;
      playSfx(this.scene, 'dive');
    }
  }

  // acordou no meio do mergulho: volta pra altura de voo
  recover() {
    super.recover();
    if (this.y > this.homeY + 1) this.state = 'rise';
  }
}
