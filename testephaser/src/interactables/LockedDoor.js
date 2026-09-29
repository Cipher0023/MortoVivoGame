import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

export default class LockedDoor extends TexturedBlock {
  constructor(scene, x, y, width, height) {
    super(scene, x, y, width, height, { color: COLORS.DOOR });
    this.opened = false;
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    this.setVisible(false);
    this.body.enable = false;
    playSfx(this.scene, 'unlock');
    playSfx(this.scene, 'door');
  }
}
