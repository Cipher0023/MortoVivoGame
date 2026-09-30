import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Botão de parede: alvo que se aciona acertando de longe — bola chutada ou
// braço arremessado (ver colisões na PlayScene). Uma vez acionado, fica.
// Sólido pra bola e pro braço (eles batem nele); os personagens passam.
export default class WallButton extends TexturedBlock {
  constructor(scene, x, y, onActivate) {
    super(scene, x, y, 12, 44, { color: COLORS.WALL_BUTTON_UP });
    this.activated = false;
    this.onActivate = onActivate;
  }

  hit() {
    if (this.activated) return;
    this.activated = true;
    this.setColor(COLORS.WALL_BUTTON_DOWN);
    playSfx(this.scene, 'pressButton');
    this.onActivate();
  }
}
