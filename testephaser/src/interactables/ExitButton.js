import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';

export default class ExitButton extends TexturedBlock {
  constructor(scene, x, y) {
    super(scene, x, y, 50, 14, { color: COLORS.EXIT_BUTTON });
  }
}
