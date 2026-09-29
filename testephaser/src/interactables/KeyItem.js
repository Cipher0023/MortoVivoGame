import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';

export default class KeyItem extends TexturedBlock {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y, 18, 18, { color: COLORS.KEY });
    this.collected = false;
    this.revealed = options.startRevealed !== false;

    if (!this.revealed) {
      this.setVisible(false);
      this.body.enable = false;
    }
  }

  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.setVisible(true);
    this.body.enable = true;
  }

  collect() {
    if (this.collected || !this.revealed) return;
    this.collected = true;
    this.setVisible(false);
    this.body.enable = false;
  }
}
