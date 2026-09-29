import TexturedBlock from '../entities/TexturedBlock.js';
import { PHYSICS } from '../config/constants.js';

// Caixa: cai com gravidade (pode tampar um buraco e virar degrau) e só se
// move quando o Vivo empurra ou puxa segurando a ação. pushable = false faz os
// personagens não conseguirem empurrá-la só andando contra ela — eles é que
// são separados — mas ela ainda colide normalmente com o chão.
export default class PushableBlock extends TexturedBlock {
  constructor(scene, x, y, width, height) {
    super(scene, x, y, width, height, { texture: 'caixa2', staticBody: false });
    this.body.pushable = false;
  }

  push(direction) {
    this.body.setVelocityX(direction * PHYSICS.BLOCK_PUSH_SPEED);
  }

  stop() {
    this.body.setVelocityX(0);
  }
}
