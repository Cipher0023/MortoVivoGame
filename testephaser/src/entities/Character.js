import Phaser from 'phaser';
import { PHYSICS } from '../config/constants.js';
import { playSfx } from '../audio/sfx.js';

export default class Character extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, width, height, color, name) {
    super(scene, x, y, width, height, color);
    this.scene = scene;
    this.characterName = name;
    this.baseWidth = width;
    this.baseHeight = height;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCollideWorldBounds(true);
    this.body.setSize(width, height);

    this.isActive = false;
    this.hasKey = false;
  }

  setActiveControl(active) {
    this.isActive = active;
    if (!active) {
      this.body.setVelocityX(0);
    }
  }

  // Chamado pro personagem controlado e também pro que está seguindo (ver
  // FollowSystem) — quem decide quem se move é a cena.
  // input.x: eixo de -1 a 1 (teclado dá -1/0/1; joystick, valores
  // intermediários = andar mais devagar).
  handleMovement(input) {
    this.body.setVelocityX(PHYSICS.MOVE_SPEED * input.x);

    if (input.jump && this.body.blocked.down) {
      this.body.setVelocityY(PHYSICS.JUMP_VELOCITY);
      playSfx(this.scene, 'jump');
    }
  }
}
