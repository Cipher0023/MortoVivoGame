import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Botão de segurar: fica apertado só enquanto tem peso em cima (personagem,
// caixa, bola, cabeça da Esqueleto). Quem decide o peso é a PlayScene
// (updateHoldButtons); onChange(true/false) liga/desliga a cor de conexão.
export default class HoldButton extends TexturedBlock {
  constructor(scene, x, y, onChange) {
    super(scene, x, y, 44, 12, { color: COLORS.HOLD_BUTTON_UP });
    this.held = false;
    this.onChange = onChange;
  }

  setHeld(held) {
    if (held === this.held) return;
    this.held = held;
    this.setColor(held ? COLORS.HOLD_BUTTON_DOWN : COLORS.HOLD_BUTTON_UP);
    // afunda um pouco quando apertado
    this.setDisplaySize(44, held ? 6 : 12);
    this.y += held ? 3 : -3;
    playSfx(this.scene, held ? 'pressButton' : 'releaseButton');
    this.onChange(held);
  }
}
