import { CAMERA } from '../config/constants.js';

export default class CharacterManager {
  constructor(scene, living, skeleton) {
    this.scene = scene;
    this.living = living;
    this.skeleton = skeleton;
    this.active = living;

    this.living.setActiveControl(true);
    this.skeleton.setActiveControl(false);

    this.followActive();
    // começa já enquadrado, sem a câmera "viajar" até o personagem
    scene.cameras.main.centerOn(this.active.x, this.active.y - CAMERA.FOLLOW_OFFSET_Y);
  }

  getActive() {
    return this.active;
  }

  getInactive() {
    return this.active === this.living ? this.skeleton : this.living;
  }

  switchCharacter() {
    this.active.setActiveControl(false);
    this.active = this.active === this.living ? this.skeleton : this.living;
    this.active.setActiveControl(true);
    // o lerp faz a câmera deslizar suavemente até o novo personagem
    this.followActive();
  }

  followActive() {
    const camera = this.scene.cameras.main;
    camera.startFollow(this.active, true, CAMERA.LERP_X, CAMERA.LERP_Y);
    camera.setFollowOffset(0, CAMERA.FOLLOW_OFFSET_Y);
  }
}
