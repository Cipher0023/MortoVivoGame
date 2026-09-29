import TexturedBlock from '../entities/TexturedBlock.js';

export default class Hazard extends TexturedBlock {
  constructor(scene, x, y, width, height, color, harms, alpha = 0.55) {
    super(scene, x, y, width, height, { color, alpha });
    this.harms = harms; // array of characterName strings, e.g. ['living']
  }
}
