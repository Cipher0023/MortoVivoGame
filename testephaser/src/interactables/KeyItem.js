import TexturedBlock from '../entities/TexturedBlock.js';
import { COLORS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Chave com física: cai com a gravidade e para no chão (colisões e rampas na
// PlayScene). Escondida (tem cor e o gatilho ainda não foi acionado), fica
// parada e sem corpo; ao aparecer, cai de onde estava. Caindo num buraco,
// volta pro lugar onde começou.
export default class KeyItem extends TexturedBlock {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y, 18, 18, { color: COLORS.KEY, staticBody: false });
    this.spawn = { x, y };
    this.collected = false;
    this.revealed = options.startRevealed !== false;
    this.body.setBounce(0, 0.2);
    this.body.setCollideWorldBounds(true);

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
    playSfx(this.scene, 'reveal');
  }

  respawn() {
    this.body.reset(this.spawn.x, this.spawn.y);
  }

  collect() {
    if (this.collected || !this.revealed) return;
    this.collected = true;
    this.setVisible(false);
    this.body.enable = false;
    playSfx(this.scene, 'key');
  }
}
