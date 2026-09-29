import Phaser from 'phaser';
import { COLORS, SKELETON } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

// Cabeça que a Esqueleto tira pra ficar fina. Cai com gravidade e fica onde
// parar; o Vivo pode subir nela (sólida só por cima, ver PlayScene) ou
// carregá-la. A Esqueleto põe de volta encostando e apertando a ação.
export default class SkullHead extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y) {
    super(scene, x, y, SKELETON.HEAD_SIZE, SKELETON.HEAD_SIZE, COLORS.SKELETON);
    this.scene = scene;
    this.carrier = null; // quem está carregando (o Vivo) ou null
    this.setStrokeStyle(2, 0x555544);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    // quem sobe nela não a afunda no chão (como a caixa)
    this.body.pushable = false;
    this.body.setCollideWorldBounds(true);
  }

  carry(carrier) {
    this.carrier = carrier;
    this.body.enable = false;
    playSfx(this.scene, 'headGrab');
  }

  dropAt(x, y) {
    this.carrier = null;
    this.body.enable = true;
    this.body.reset(x, y);
    playSfx(this.scene, 'headDrop');
  }

  // carregada: vai em cima da cabeça de quem carrega
  followCarrier() {
    if (!this.carrier) return;
    this.setPosition(this.carrier.x, this.carrier.body.top - SKELETON.HEAD_SIZE / 2 - 2);
  }

  update() {
    // parada no chão: sem deslizar
    if (!this.carrier && (this.body.blocked.down || this.body.touching.down)) this.body.setVelocityX(0);
  }
}
