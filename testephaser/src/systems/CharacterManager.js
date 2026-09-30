import { CAMERA } from '../config/constants.js';

// Quem o jogador controla. Numa fase com um personagem só (o outro fica
// `absent`, ver PlayScene.removeFromLevel), não há troca.
export default class CharacterManager {
  constructor(scene, living, skeleton) {
    this.scene = scene;
    this.living = living;
    this.skeleton = skeleton;
    this.active = living.absent ? skeleton : living;

    for (const character of [living, skeleton]) character.setActiveControl(character === this.active);

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

  hasPartner() {
    return !this.getInactive().absent;
  }

  // Retorna false se não há com quem trocar.
  switchCharacter() {
    if (!this.hasPartner()) return false;
    this.active.setActiveControl(false);
    this.active = this.getInactive();
    this.active.setActiveControl(true);
    // o lerp faz a câmera deslizar suavemente até o novo personagem
    this.followActive();
    return true;
  }

  followActive() {
    const camera = this.scene.cameras.main;
    camera.startFollow(this.active, true, CAMERA.LERP_X, CAMERA.LERP_Y);
    camera.setFollowOffset(0, CAMERA.FOLLOW_OFFSET_Y);
  }
}
