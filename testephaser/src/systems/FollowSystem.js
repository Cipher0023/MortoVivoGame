// Parceiro estilo Tails (Sonic 2): o personagem que NÃO está sendo
// controlado segue o controlado por padrão. O jogador pode mandá-lo esperar
// (fica parado onde está, ex.: em cima de um botão de pressão) e depois
// liberá-lo pra seguir de novo. Seguindo, ele para perto do líder, pula
// quando bate num obstáculo e nunca anda pra fora de uma borda (senão o Vivo
// seguiria o Esqueleto rio adentro e morreria).

// Histerese: começa a andar acima de START, para abaixo de STOP — evita o
// seguidor ficar "tremendo" parado/andando na mesma distância.
const START_DISTANCE = 110;
const STOP_DISTANCE = 70;

export default class FollowSystem {
  constructor(scene) {
    this.scene = scene;
    this.waiting = false;
    this.moving = false;
  }

  // alterna entre seguir e esperar
  toggleWait(follower) {
    this.waiting = !this.waiting;
    this.moving = false;
    // mandou esperar: o parceiro para onde está
    if (this.waiting) follower.setActiveControl(false);
  }

  update(leader, follower) {
    if (this.waiting) return;

    const dx = leader.x - follower.x;
    const distance = Math.abs(dx);
    if (this.moving ? distance < STOP_DISTANCE : distance > START_DISTANCE) {
      this.moving = !this.moving;
    }

    let dir = this.moving ? Math.sign(dx) : 0;
    if (dir !== 0 && !this.scene.hasGroundAhead(follower, dir)) dir = 0;

    const blocked = (dir < 0 && follower.body.blocked.left) || (dir > 0 && follower.body.blocked.right);
    follower.handleMovement({ x: dir, jump: blocked });
  }
}
