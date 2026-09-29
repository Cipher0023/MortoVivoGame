import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

export default class Lever extends TexturedBlock {
  constructor(scene, x, y, onToggle) {
    super(scene, x, y, 16, 40, { color: COLORS.LEVER_OFF });
    this.pulled = false;
    this.onToggle = onToggle;
  }

  toggle() {
    if (this.pulled) return;
    this.pulled = true;
    this.setColor(COLORS.LEVER_ON);
    playSfx(this.scene, 'lever');
    if (this.onToggle) this.onToggle();
  }
}
