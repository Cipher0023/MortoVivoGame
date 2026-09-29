import Character from './Character.js';
import { COLORS } from '../config/constants.js';

export default class Skeleton extends Character {
  constructor(scene, x, y) {
    super(scene, x, y, 30, 50, COLORS.SKELETON, 'skeleton');
    this.isThin = false;
  }

  toggleThin() {
    this.isThin = !this.isThin;
    const width = this.isThin ? 14 : this.baseWidth;
    this.setSize(width, this.baseHeight);
    this.body.setSize(width, this.baseHeight, true);
    this.setAlpha(this.isThin ? 0.55 : 1);
  }
}
