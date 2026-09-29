import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';

// Sensor: nunca é sólida, só detecta overlap (ver climbing na PlayScene).
export default class Ladder extends TexturedBlock {
  constructor(scene, x, y, width, height, options = {}) {
    super(scene, x, y, width, height, { color: COLORS.LADDER, alpha: 0.9 });
    this.dropped = options.startDropped === true;
    this.setVisible(this.dropped);
  }

  drop() {
    if (this.dropped) return;
    this.dropped = true;
    this.setVisible(true);
  }
}
