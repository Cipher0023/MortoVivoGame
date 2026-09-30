// Parceiro estilo Tails (Sonic 2): o personagem que NÃO está sendo
// controlado segue o controlado por padrão. O jogador pode mandá-lo esperar
// (fica parado onde está, ex.: em cima de um botão de pressão) e depois
// liberá-lo pra seguir de novo.
//
// Seguindo, ele:
// - puxa o líder que caiu na água, se estiver na beirada ao lado dele (e,
//   se ele mesmo cair, pede pro líder puxá-lo);
// - anda até perto do líder e pula quando bate num degrau/parede;
// - numa beirada, desce atrás do líder que está mais embaixo, ou pula o vão
//   atrás do líder que já passou — mas só se o pouso for seguro (sem água,
//   buraco ou, pro Vivo, inimigo). Senão, espera na beirada: nunca segue o
//   líder pra dentro d'água;
// - pula pra alcançar o líder numa plataforma logo acima, se alcançar;
// - não anda na direção de um inimigo acordado (só o Vivo se machuca).
// As consultas ao mapa (landingAt, planEdge...) ficam na PlayScene.

// Histerese: começa a andar acima de START, para abaixo de STOP — evita o
// seguidor ficar "tremendo" parado/andando na mesma distância.
const START_DISTANCE = 110;
const STOP_DISTANCE = 70;

function isOnGround(character) {
  return character.body.blocked.down || character.body.touching.down;
}

export default class FollowSystem {
  constructor(scene) {
    this.scene = scene;
    this.waiting = false;
    this.moving = false;
    // direção mantida no ar (senão pararia no meio do pulo/queda)
    this.airDir = 0;
  }

  // alterna entre seguir e esperar
  toggleWait(follower) {
    this.waiting = !this.waiting;
    this.moving = false;
    // mandou esperar: o parceiro para onde está
    if (this.waiting) follower.setActiveControl(false);
  }

  update(leader, follower) {
    if (this.waiting || follower.absent || leader.absent || follower.beingPulled) return;
    const scene = this.scene;
    // puxando o líder: fica parado (senão continuaria andando pra beirada)
    if (leader.beingPulled) {
      follower.handleMovement({ x: 0, jump: false });
      return;
    }

    // resgate na beirada
    if (leader.inWater && scene.canPull(follower, leader)) {
      scene.pullPartner(follower);
      return;
    }
    if (follower.inWater && scene.canPull(leader, follower)) {
      scene.pullPartner(leader);
      return;
    }

    // no ar: continua na direção em que pulou/desceu
    if (!isOnGround(follower) && !follower.climbing) {
      follower.handleMovement({ x: this.airDir, jump: false });
      return;
    }

    const S = scene.cellSize;
    const dx = leader.x - follower.x;
    const distance = Math.abs(dx);
    if (this.moving ? distance < STOP_DISTANCE : distance > START_DISTANCE) {
      this.moving = !this.moving;
    }

    let dir = this.moving ? Math.sign(dx) : 0;
    let jump = false;

    // líder numa plataforma logo acima: chega embaixo da beirada e pula
    const rise = follower.body.bottom - leader.body.bottom;
    const jumpHeight = scene.jumpHeightOf(follower);
    if (rise > S / 2 && rise < jumpHeight - 8 && isOnGround(leader) && distance < S * 2) {
      if (distance > 8) dir = Math.sign(dx);
      jump = true;
    }

    if (dir !== 0 && scene.dangerAhead(follower, dir)) {
      dir = 0;
      jump = false;
    } else if (dir !== 0 && !scene.hasGroundAhead(follower, dir)) {
      const plan = scene.planEdge(follower, leader, dir);
      if (plan === 'jump') jump = true;
      else if (plan !== 'drop') {
        dir = 0;
        jump = false;
      }
    } else if (dir !== 0) {
      // degrau ou parede na frente
      const blocked = (dir < 0 && follower.body.blocked.left) || (dir > 0 && follower.body.blocked.right);
      jump = jump || blocked;
    }

    this.airDir = dir;
    follower.handleMovement({ x: dir, jump });
  }
}
