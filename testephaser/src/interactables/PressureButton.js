import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

export default class PressureButton extends TexturedBlock {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, 44, 12, { color: COLORS.BUTTON_UP });
    this.activated = false;
    this.onActivate = onActivate;
  }

  press() {
    if (this.activated) return;
    this.activated = true;
    this.setColor(COLORS.BUTTON_DOWN);
    playSfx(this.scene, 'pressButton');
    if (this.onActivate) this.onActivate();
  }
}
