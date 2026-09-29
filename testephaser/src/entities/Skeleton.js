import Character from './Character.js';
import { COLORS, PHYSICS, SKELETON } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Esqueleto: pula 20% mais baixo que o Vivo. Tirando a cabeça (ver SkullHead)
// fica fina e passa em grades; pisada pelo Vivo, desmonta e fica imóvel por
// um tempo (a PlayScene cuida do tempo e da cabeça).
export default class Skeleton extends Character {
  constructor(scene, x, y) {
    super(scene, x, y, SKELETON.WIDTH, SKELETON.HEIGHT, COLORS.SKELETON, 'skeleton');
    this.jumpVelocity = PHYSICS.SKELETON_JUMP_VELOCITY;
    // sem a cabeça = fina (a colisão com a grade olha isto)
    this.isThin = false;
    this.collapsed = false;
    // só um dos braços pode ser arremessado: enquanto ele está fora, não
    // dá pra lançar de novo (ver ThrownArm)
    this.hasArm = true;
  }

  get hasHead() {
    return !this.isThin;
  }

  handleMovement(input) {
    if (this.collapsed) {
      this.body.setVelocityX(0);
      return;
    }
    super.handleMovement(input);
  }

  removeHead() {
    this.isThin = true;
    this.applyShape();
    playSfx(this.scene, 'thin');
  }

  attachHead() {
    this.isThin = false;
    this.applyShape();
    playSfx(this.scene, 'unthin');
  }

  // vira uma pilha de ossos (baixinha e imóvel) até reassemble()
  collapse() {
    this.collapsed = true;
    this.climbing = false;
    this.body.setVelocityX(0);
    this.applyShape();
    playSfx(this.scene, 'collapse');
  }

  reassemble() {
    if (!this.collapsed) return;
    this.collapsed = false;
    this.applyShape();
    playSfx(this.scene, 'reassemble');
  }

  // Tamanho conforme o estado, mantendo os pés no mesmo lugar.
  applyShape() {
    const width = this.isThin ? SKELETON.HEADLESS_WIDTH : SKELETON.WIDTH;
    const height = this.collapsed ? SKELETON.COLLAPSED_HEIGHT : this.isThin ? SKELETON.HEADLESS_HEIGHT : SKELETON.HEIGHT;
    const bottom = this.body.bottom;
    this.setSize(width, height);
    this.body.setSize(width, height, true);
    this.y = bottom - height / 2;
    this.setAlpha(this.collapsed ? 0.7 : 1);
  }
}
