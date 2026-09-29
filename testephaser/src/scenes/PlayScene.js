import Phaser from 'phaser';
import { COLORS, PHYSICS, CAMERA, ATTACK, SKELETON, WATER, PULL_UP, SLOPE } from '../config/constants.js';
import Living from '../entities/Living.js';
import Skeleton from '../entities/Skeleton.js';
import { createEnemy, isEnemyType } from '../entities/enemyTypes.js';
import ThrownArm from '../entities/ThrownArm.js';
import SkullHead from '../entities/SkullHead.js';
import Hazard from '../hazards/Hazard.js';
import StaticWall from '../interactables/StaticWall.js';
import PushableBlock from '../interactables/PushableBlock.js';
import PressureButton from '../interactables/PressureButton.js';
import Lever from '../interactables/Lever.js';
import KeyItem from '../interactables/KeyItem.js';
import LockedDoor from '../interactables/LockedDoor.js';
import ExitButton from '../interactables/ExitButton.js';
import Ladder from '../interactables/Ladder.js';
import CharacterManager from '../systems/CharacterManager.js';
import FollowSystem from '../systems/FollowSystem.js';
import { buildLevelFromData, disableInternalFaces } from '../levels/LevelLoader.js';
import { supportY, surfaceY, slopeVelocity } from '../levels/slopes.js';
import { settingsFor, spriteArea } from '../levels/assetSettings.js';
import { ENTITY_SHAPES, entityCenter, createChannelMarker } from '../levels/entityCatalog.js';
import { isTouchEnabled } from './TouchControlsScene.js';
import { playSfx } from '../audio/sfx.js';
import { PadReader, PAD } from '../input/gamepad.js';

// Joga qualquer fase no formato do editor (tiles + decorações + peças de
// mecânica, ver entityCatalog). As fases oficiais (src/levels/data) e o
// "Testar" do editor passam por aqui.

const NO_TOUCH = { x: 0, y: 0, jump: false, action: false, attack: false };
// mundo nunca mais estreito que a visão da câmera com zoom (960px)
const MIN_WORLD_COLS = 16;
// a água "começa" um pouco abaixo do topo da célula da superfície: quem está
// em pé numa ponte logo acima não encosta nela
const WATER_SURFACE_INSET = 14;
// caiu tanto abaixo do fundo do mundo (não há chão lá): morte
const FALL_DEATH_MARGIN = 80;
// fração do joystick/teclado pra agarrar a escada
const CLIMB_GRAB = 0.3;
// limite de velocidade padrão de um corpo Arcade (fora d'água)
const NORMAL_MAX_VELOCITY = 10000;
// água desenhada por cima dos personagens (semitransparente): quem afunda
// aparece submerso
const WATER_DEPTH = 5;
// sons de movimento: intervalo entre passos/degraus/arrasto (ms) e a
// velocidade de queda mínima pra aterrissagem fazer barulho
const STEP_INTERVAL = 280;
const CLIMB_INTERVAL = 220;
const PUSH_INTERVAL = 160;
const LAND_MIN_FALL_SPEED = 200;

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('Play');
  }

  // data: { levelData, phase?, returnTo? }. returnTo = cena (dormindo) pra
  // onde voltar ao sair — é como o "Testar" do editor volta pro editor.
  // Num restart (morte) sem argumentos o Phaser repassa os mesmos dados.
  init(data) {
    this.levelData = data.levelData;
    this.phase = data.phase ?? null;
    this.returnTo = data.returnTo ?? null;
  }

  create() {
    this.isResetting = false;
    this.levelComplete = false;
    this.cellSize = this.levelData.tileSize;
    this.worldWidth = computeWorldWidth(this.levelData);
    this.worldHeight = this.levelData.grid.rows * this.cellSize;

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    // sem parede no fundo do mundo: cair num buraco é morte (ver update)
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setZoom(CAMERA.ZOOM);

    const level = buildLevelFromData(this, this.levelData);
    this.tileGroup = level.tileGroup;
    this.slopes = level.slopes;
    this.rampBlockers = level.rampBlockers;
    this.createEntities();
    this.createCharacters();
    this.createInput();
    this.createColliders();
    this.createHUD();
    this.pushSoundTimer = 0;
    // ms que o Vivo está na água (morre em WATER.DROWN_MS). Soma o delta,
    // como os timers do Phaser: com o jogo pausado (celular em pé) não conta.
    this.drownElapsed = 0;
    this.bubbleTimer = 0;
    this.aim = null; // mira do arremesso em andamento: { startTime, angle }
    this.arm = null; // braço arremessado (fora do corpo): { object, colliders }
    this.aimGfx = this.add.graphics().setDepth(50);
    this.head = null; // cabeça tirada da Esqueleto: { object, colliders }
    this.collapseTimer = null; // Esqueleto desmontada: quando se remonta
  }

  // ---------------------------------------------------------------------
  // Peças da fase
  // ---------------------------------------------------------------------
  createEntities() {
    const S = this.cellSize;
    this.levers = [];
    this.buttons = [];
    this.gates = [];
    this.grates = [];
    this.bridges = [];
    this.ladders = [];
    this.keyItems = [];
    this.doors = [];
    this.boxes = [];
    this.enemies = [];
    this.waters = [];
    this.exits = [];
    this.spawns = {};
    // cor de conexão -> ações dos alvos daquela cor
    this.channelTargets = new Map();

    const entities = this.levelData.entities;
    const waterCells = new Set(entities.filter((e) => e.type === 'water').map((e) => `${e.col},${e.row}`));

    for (const e of entities) {
      const { x, y } = entityCenter(e.type, e.col, e.row, S);
      const shape = ENTITY_SHAPES[e.type];
      if (isEnemyType(e.type)) {
        this.enemies.push(createEnemy(this, e.type, x, y));
        continue;
      }

      switch (e.type) {
        case 'living':
        case 'skeleton':
          this.spawns[e.type] = { x, bottom: (e.row + 1) * S };
          break;
        case 'exit':
          this.exits.push(new ExitButton(this, x, y));
          break;

        case 'water': {
          const inset = waterCells.has(`${e.col},${e.row - 1}`) ? 0 : WATER_SURFACE_INSET;
          const height = S - inset;
          const water = new Hazard(this, x, e.row * S + inset + height / 2, S, height, COLORS.WATER, ['living']);
          water.row = e.row; // pra achar a superfície (ver surfaceRow)
          water.setDepth(WATER_DEPTH);
          this.waters.push(water);
          break;
        }
        case 'box':
          this.boxes.push(new PushableBlock(this, x, y, shape.w, shape.h));
          break;
        case 'key': {
          const key = new KeyItem(this, x, y, { startRevealed: !e.channel });
          if (e.channel) this.onChannel(e.channel, () => key.reveal());
          this.keyItems.push(key);
          break;
        }
        case 'door': {
          const door = new LockedDoor(this, x, y, shape.w, shape.h);
          door.col = e.col;
          door.row = e.row;
          this.doors.push(door);
          break;
        }
        case 'lever': {
          const lever = new Lever(this, x, y, () => this.triggerChannel(e.channel));
          this.addTriggerMarker(lever, e.channel);
          this.levers.push(lever);
          break;
        }
        case 'button': {
          const button = new PressureButton(this, x, y, () => this.triggerChannel(e.channel));
          this.addTriggerMarker(button, e.channel);
          this.buttons.push(button);
          break;
        }
        case 'gate':
        case 'grate': {
          const wall = new StaticWall(this, x, y, shape.w, shape.h, shape.color);
          wall.col = e.col;
          wall.row = e.row;
          if (e.channel) {
            wall.setMarker(createChannelMarker(this, x, y - S / 2 + 12, e.channel));
            this.onChannel(e.channel, () => wall.destroyWall());
          }
          (e.type === 'gate' ? this.gates : this.grates).push(wall);
          break;
        }
        case 'bridge': {
          // plataforma de uma via: sólida por cima, atravessável por baixo e
          // pelos lados (dá pra subir nela vindo de uma escada)
          const bridge = new StaticWall(this, x, y, shape.w, shape.h, shape.color, { startSolid: !e.channel });
          bridge.body.checkCollision.down = false;
          bridge.body.checkCollision.left = false;
          bridge.body.checkCollision.right = false;
          if (e.channel) {
            this.onChannel(e.channel, () => {
              if (bridge.body.enable) return;
              bridge.setColor(COLORS.BRIDGE_ACTIVE);
              bridge.setSolid(true);
              playSfx(this, 'bridge');
            });
          }
          this.bridges.push(bridge);
          break;
        }
        case 'ladder': {
          const ladder = new Ladder(this, x, y, shape.w, shape.h, { startDropped: !e.channel });
          if (e.channel) this.onChannel(e.channel, () => ladder.drop());
          this.ladders.push(ladder);
          break;
        }
      }
    }

    // pilhas de portão/grade/porta: sem "teto" nas emendas (ver LevelLoader)
    for (const walls of [this.gates, this.grates, this.doors]) {
      disableInternalFaces(
        walls.map((wall) => ({ c0: wall.col, c1: wall.col, r0: wall.row, r1: wall.row, body: wall.body })),
        { horizontal: false }
      );
    }

    // o que conta como chão pro seguidor e pros inimigos não caírem
    this.floorObjects = new Set([
      ...this.tileGroup.getChildren(),
      ...this.bridges,
      ...this.boxes,
      ...this.gates,
      ...this.grates,
      ...this.doors,
    ]);
  }

  onChannel(channel, action) {
    if (!this.channelTargets.has(channel)) this.channelTargets.set(channel, []);
    this.channelTargets.get(channel).push(action);
  }

  // alavanca/botão acionado: tudo da mesma cor reage (as ações são
  // idempotentes, então dois gatilhos da mesma cor não dão problema)
  triggerChannel(channel) {
    for (const action of this.channelTargets.get(channel) ?? []) action();
  }

  addTriggerMarker(trigger, channel) {
    createChannelMarker(this, trigger.x, trigger.y - trigger.displayHeight / 2 - 12, channel);
  }

  // ---------------------------------------------------------------------
  // Personagens
  // ---------------------------------------------------------------------
  createCharacters() {
    const fallback = { x: this.cellSize * 1.5, bottom: this.cellSize * 2 };
    const livingSpawn = this.spawns.living ?? fallback;
    const skeletonSpawn = this.spawns.skeleton ?? fallback;
    // y = centro do corpo: pés na base da célula (corpo do Vivo 70px, Esqueleto 50px)
    this.living = new Living(this, livingSpawn.x, livingSpawn.bottom - 36);
    this.skeleton = new Skeleton(this, skeletonSpawn.x, skeletonSpawn.bottom - 26);
    this.characterManager = new CharacterManager(this, this.living, this.skeleton);
    this.followSystem = new FollowSystem(this);
  }

  // Tem chão logo à frente nessa direção? Usado pelo parceiro (não anda pra
  // fora de beirada) e pelos inimigos (dão meia-volta na beirada).
  hasGroundAhead(object, dir) {
    const body = object.body;
    const probeX = body.center.x + dir * (body.halfWidth + 8);
    const bodies = this.physics.overlapRect(probeX - 4, body.bottom, 8, 24, true, true);
    if (bodies.some((found) => found.enable && this.floorObjects.has(found.gameObject))) return true;
    // rampa à frente (subindo até um degrau, ou descendo até o fim da sonda)
    return this.slopes.some((slope) => {
      if (probeX < slope.x0 || probeX > slope.x1) return false;
      const y = surfaceY(slope, probeX);
      return y >= body.bottom - SLOPE.MAX_STEP * 2 && y <= body.bottom + 24;
    });
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  createInput() {
    const kb = this.input.keyboard;
    this.keys = {
      left: kb.addKey('LEFT'),
      leftA: kb.addKey('A'),
      right: kb.addKey('RIGHT'),
      rightD: kb.addKey('D'),
      up: kb.addKey('UP'),
      upW: kb.addKey('W'),
      down: kb.addKey('DOWN'),
      downS: kb.addKey('S'),
      jump: kb.addKey('SPACE'),
      switchKey: kb.addKey('Q'),
      wait: kb.addKey('F'),
      action: kb.addKey('E'),
      attack: kb.addKey('R'),
      head: kb.addKey('C'),
      back: kb.addKey('ESC'),
    };
    this.pad = new PadReader(this);

    // Controles touch: cena overlay que continua rodando entre restarts da
    // fase (morte) e é parada ao sair da fase (ver leaveTo()/exitLevel()).
    this.touchControls = null;
    if (isTouchEnabled(this.game)) {
      if (!this.scene.isActive('TouchControls')) this.scene.launch('TouchControls');
      this.touchControls = this.scene.get('TouchControls');
    }
  }

  // Sai da fase pra outra cena (ex.: leitor de QR), levando junto os overlays.
  leaveTo(sceneKey) {
    this.scene.stop('TouchControls');
    this.scene.stop('Hud');
    this.scene.start(sceneKey);
  }

  // Botão Menu/Voltar: no teste do editor volta pro editor (que ficou
  // dormindo com tudo como estava); no jogo normal vai pro menu.
  exitLevel() {
    if (!this.returnTo) {
      this.leaveTo('MainMenu');
      return;
    }
    this.scene.stop('TouchControls');
    this.scene.stop('Hud');
    this.scene.wake(this.returnTo);
    this.scene.stop();
  }

  getTouchState() {
    // state só existe depois do create() da cena overlay (1 frame após o launch)
    return this.touchControls?.state ?? NO_TOUCH;
  }

  consumeTouchPress(id) {
    return this.touchControls?.state ? this.touchControls.consumePress(id) : false;
  }

  // ---------------------------------------------------------------------
  // Colisões / overlaps
  // ---------------------------------------------------------------------
  createColliders() {
    const both = [this.living, this.skeleton];
    const solids = [this.tileGroup, ...this.gates, ...this.doors];

    this.physics.add.collider(both, solids);
    // ponte: plataforma de uma via (só depois de ativada, se tiver cor)
    this.physics.add.collider(both, this.bridges);
    // caixa: ambos colidem; só o Vivo empurra (ver handleBoxPush)
    this.physics.add.collider(both, this.boxes);
    // grade: o Vivo nunca passa; o Esqueleto passa apenas "fino"
    this.physics.add.collider(this.living, this.grates);
    this.physics.add.collider(this.skeleton, this.grates, null, (skeleton) => !skeleton.isThin);

    this.physics.add.collider(this.boxes, [...solids, ...this.grates, ...this.bridges, this.rampBlockers]);
    this.physics.add.collider(this.boxes, this.boxes);
    // inimigos e caixas não sobem rampa: pra eles, a rampa é um bloco
    this.physics.add.collider(this.enemies, [...solids, ...this.grates, ...this.boxes, this.rampBlockers]);

    // água funda: o Vivo se afoga com o tempo (ver updateWater); o Esqueleto
    // afunda sem dano
    // inimigos: só detectam o Vivo — que os derrota caindo em cima
    this.physics.add.overlap(this.living, this.enemies, (living, enemy) => this.onLivingTouchesEnemy(enemy));
    // Vivo caindo em cima da Esqueleto: ela desmonta
    this.physics.add.overlap(this.living, this.skeleton, () => this.onLivingTouchesSkeleton());

    // chave: qualquer um pega (uma por vez) e fica com quem pegou — é esse
    // personagem que precisa levá-la até a porta
    this.physics.add.overlap(both, this.keyItems, (character, key) => {
      if (key.revealed && !key.collected && !character.hasKey) {
        key.collect();
        character.hasKey = true;
      }
    });

    // botão de pressão: qualquer um dos dois aciona pisando em cima
    this.physics.add.overlap(both, this.buttons, (character, button) => button.press());

    // saída: qualquer personagem encerra a fase
    this.physics.add.overlap(both, this.exits, () => this.onExitReached());
  }

  createHUD() {
    // HUD em cena própria (ver HudScene). Diferente do touch, é reiniciado a
    // cada restart da fase — launch numa cena já ativa a reinicia — pra limpar
    // o "Fase concluída!".
    this.scene.launch('Hud');
    this.hud = this.scene.get('Hud');
  }

  // ---------------------------------------------------------------------
  // Loop principal
  // ---------------------------------------------------------------------
  update(time, delta) {
    const pad = this.pad;
    pad.update();
    const backKeyPressed = Phaser.Input.Keyboard.JustDown(this.keys.back);
    if (pad.pressed(PAD.SELECT) || backKeyPressed) {
      playSfx(this, 'back');
      this.exitLevel();
      return;
    }

    if (this.isResetting || this.levelComplete) return;

    // Teclado, controle e touch valem ao mesmo tempo. Movimento é um eixo de
    // -1 a 1: teclado dá -1/0/1 e tem prioridade; depois o controle; senão o
    // joystick da tela. No controle e no touch, pra cima só sobe escada; pulo
    // é sempre um botão (A / PULAR).
    const touch = this.getTouchState();
    const k = this.keys;
    const keyX = (k.right.isDown || k.rightD.isDown ? 1 : 0) - (k.left.isDown || k.leftA.isDown ? 1 : 0);
    const keyY = (k.down.isDown || k.downS.isDown ? 1 : 0) - (k.up.isDown || k.upW.isDown ? 1 : 0);
    const moveX = keyX || pad.x || touch.x;
    const climbY = keyY || pad.y || touch.y;
    // "pulo de verdade" (sem o ↑ do teclado): é o que solta da escada
    const jumpButton = k.jump.isDown || pad.held(PAD.A) || touch.jump;
    const jumpDown = jumpButton || k.up.isDown || k.upW.isDown;
    // (todos rodam: JustDown/consumePress só valem uma vez por aperto)
    const jumpKeyPressed = [k.jump, k.up, k.upW].map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    const jumpPressed = this.consumeTouchPress('jump') || jumpKeyPressed || pad.pressed(PAD.A);
    const actionHeld = k.action.isDown || pad.held(PAD.X) || touch.action;
    const attackHeld = k.attack.isDown || pad.held(PAD.B, PAD.RT) || touch.attack;
    const attackKeyPressed = Phaser.Input.Keyboard.JustDown(k.attack);
    const attackPressed = this.consumeTouchPress('attack') || attackKeyPressed || pad.pressed(PAD.B, PAD.RT);

    if (this.updateWater(delta)) return;
    this.updateSlopes();

    const active = this.characterManager.getActive();
    // mirando o braço, a Esqueleto fica parada (←/→ só viram o lado)
    const aiming = this.updateArmAim(active, attackHeld, attackPressed, moveX, time);
    // pular ao lado do parceiro 1 bloco acima: ele puxa (no lugar do pulo)
    const pulled = jumpPressed && !aiming && this.tryAutoPull(active);
    active.handleMovement({ x: aiming ? 0 : moveX, jump: aiming || pulled ? false : jumpDown });

    this.updateLadderClimbing(active, aiming ? 0 : climbY, jumpButton);

    // troca de personagem
    // (os dois lados do || sempre rodam, pra consumir o aperto do touch)
    const switchPressed = Phaser.Input.Keyboard.JustDown(k.switchKey);
    if (this.consumeTouchPress('switch') || switchPressed || pad.pressed(PAD.Y)) {
      this.characterManager.switchCharacter();
      playSfx(this, 'switch');
    }

    // parceiro: segue por padrão; F / botão ESPERAR manda esperar e libera
    const waitPressed = Phaser.Input.Keyboard.JustDown(k.wait);
    if (this.consumeTouchPress('wait') || waitPressed || pad.pressed(PAD.LB)) {
      this.followSystem.toggleWait(this.characterManager.getInactive());
      playSfx(this, this.followSystem.waiting ? 'wait' : 'follow');
    }
    this.followSystem.update(this.characterManager.getActive(), this.characterManager.getInactive());
    this.applySlopeSpeed();

    const actionKeyPressed = Phaser.Input.Keyboard.JustDown(k.action);
    const actionJustDown = this.consumeTouchPress('action') || actionKeyPressed || pad.pressed(PAD.X);

    if (actionJustDown) this.handleAction(active);

    // cabeça da Esqueleto: botão próprio (C / RB / CABEÇA), fora da ação
    const headKeyPressed = Phaser.Input.Keyboard.JustDown(k.head);
    if (this.consumeTouchPress('head') || headKeyPressed || pad.pressed(PAD.RB)) {
      if (!(active === this.skeleton && this.skeletonHandlesHead())) playSfx(this, 'nope');
    }

    this.handleBoxPush(active, moveX, actionHeld, delta);
    this.updateDoors();
    for (const enemy of this.enemies) enemy.update();
    this.updateThrownArm();
    this.updateHead();

    const fallLine = this.worldHeight + FALL_DEATH_MARGIN;
    if (this.living.body.top > fallLine || this.skeleton.body.top > fallLine) {
      this.triggerDeath('fall');
      return;
    }

    this.updateMovementSounds(this.living, 'step', delta);
    this.updateMovementSounds(this.skeleton, 'stepBone', delta);
    this.updateHUD(active);
  }

  // ---------------------------------------------------------------------
  // Rampas (ver levels/slopes.js): a física Arcade só tem caixas, então a
  // cada quadro quem está em cima de uma rampa é "apoiado" na superfície
  // (antes do movimento, pra o pulo ver o apoio) e a velocidade horizontal é
  // ajustada pela inclinação (depois do movimento).
  // ---------------------------------------------------------------------
  updateSlopes() {
    if (this.slopes.length === 0) return;
    const objects = [this.living, this.skeleton, this.head?.object, this.arm?.object];
    for (const object of objects) {
      if (!object?.body?.enable || object.beingPulled || object.climbing) continue;
      object.onSlope = this.snapToSlope(object);
      // braço voando que bate na rampa cai como numa parede
      if (object.onSlope && object === this.arm?.object) object.land();
    }
  }

  // Apoia o corpo na rampa sob ele (a mais alta, se houver duas). Mexe só no
  // corpo: o desenho acompanha no fim do quadro. Retorna a rampa ou null.
  snapToSlope(object) {
    const body = object.body;
    if (body.velocity.y < 0) return null; // pulando: solta da rampa
    // quem já estava na rampa é "puxado" pra ela ao descer andando
    const stick = object.onSlope ? SLOPE.STICK : 0;
    let best = null;
    let bestY = Infinity;
    for (const slope of this.slopes) {
      if (body.right <= slope.x0 || body.left >= slope.x1) continue;
      const y = supportY(slope, body);
      const sink = body.bottom - y;
      if (sink < -stick || sink > SLOPE.MAX_STEP || y >= bestY) continue;
      best = slope;
      bestY = y;
    }
    if (!best) return null;
    body.position.y += bestY - body.bottom;
    body.updateCenter();
    body.velocity.y = 0;
    // na íngreme não há apoio pra pular
    if (best.kind !== 'steep') body.blocked.down = true;
    return best;
  }

  applySlopeSpeed() {
    for (const character of [this.living, this.skeleton]) {
      const slope = character.onSlope;
      // escorregando: continua até sair dessa rampa (chegar ao pé dela)
      const wasSliding = Boolean(slope) && character.slidingOn === slope;
      character.slidingOn = null;
      if (!slope || character.beingPulled) continue;
      const { vx, sliding } = slopeVelocity(slope, character.body, character.body.velocity.x, wasSliding);
      character.body.setVelocityX(vx);
      if (sliding) character.slidingOn = slope;
    }
  }

  // ---------------------------------------------------------------------
  // Ataques
  // ---------------------------------------------------------------------
  // Pisão do Vivo: caindo e vindo de cima (os pés estavam acima do topo do
  // inimigo no quadro anterior) paralisa o inimigo e quica; qualquer outro
  // contato com um inimigo ativo mata o Vivo.
  // Paralisado, o inimigo não faz mal; pisar nele de novo quica e renova a
  // paralisia.
  onLivingTouchesEnemy(enemy) {
    const body = this.living.body;
    const previousBottom = body.prev.y + body.height;
    const fromAbove = body.velocity.y > 0 && previousBottom <= enemy.body.top + ATTACK.STOMP_TOLERANCE;
    if (!fromAbove) {
      if (!enemy.stunned) this.triggerDeath('enemy');
      return;
    }
    enemy.stun('stomp');
    playSfx(this, 'stomp');
    const jumpHeld = this.keys.jump.isDown || this.getTouchState().jump;
    body.setVelocityY(jumpHeld ? PHYSICS.JUMP_VELOCITY : ATTACK.STOMP_BOUNCE);
  }

  // Arremesso do braço (Esqueleto): segurar o ataque mostra a mira, que
  // oscila sozinha no arco; soltar arremessa no ângulo do momento. Só no
  // chão e com o braço no corpo. Retorna true enquanto está mirando.
  updateArmAim(active, held, pressed, moveX, time) {
    const skeleton = this.skeleton;
    const canAim =
      active === skeleton && skeleton.hasArm && !skeleton.collapsed && isOnGround(skeleton) && !skeleton.climbing;

    if (!this.aim) {
      if (!pressed) return false;
      if (!canAim) {
        // Vivo não arremessa (ataca pulando na cabeça); Esqueleto sem o
        // braço, no ar ou na escada também não
        playSfx(this, 'nope');
        return false;
      }
      this.aim = { startTime: time, angle: ATTACK.AIM_MIN_DEG };
      playSfx(this, 'aim');
    }

    if (!canAim) {
      this.cancelAim();
      return false;
    }
    if (moveX !== 0) skeleton.facing = Math.sign(moveX);

    // vai e volta entre as pontas do arco
    const sweep = ((time - this.aim.startTime) / ATTACK.AIM_SWEEP_MS) % 2;
    const t = sweep < 1 ? sweep : 2 - sweep;
    this.aim.angle = ATTACK.AIM_MIN_DEG + (ATTACK.AIM_MAX_DEG - ATTACK.AIM_MIN_DEG) * t;

    if (!held) {
      this.throwArm(this.aim.angle);
      this.cancelAim();
      return false;
    }
    this.drawAim();
    return true;
  }

  cancelAim() {
    this.aim = null;
    this.aimGfx.clear();
  }

  // ombro: de onde a mira sai e o braço é lançado
  shoulder() {
    return { x: this.skeleton.x + this.skeleton.facing * 8, y: this.skeleton.y - 12 };
  }

  // Trilho do arco (fraco) + seta no ângulo atual.
  drawAim() {
    const { x, y } = this.shoulder();
    const facing = this.skeleton.facing;
    const R = ATTACK.AIM_RADIUS;
    const point = (deg, radius) => {
      const rad = Phaser.Math.DegToRad(deg);
      return { x: x + facing * radius * Math.cos(rad), y: y - radius * Math.sin(rad) };
    };

    const g = this.aimGfx.clear();
    const track = [];
    for (let deg = ATTACK.AIM_MIN_DEG; deg <= ATTACK.AIM_MAX_DEG; deg += 5) track.push(point(deg, R));
    g.lineStyle(3, 0xffffff, 0.3).strokePoints(track);

    const tip = point(this.aim.angle, R);
    g.lineStyle(3, 0xffe066, 1).lineBetween(x, y, tip.x, tip.y);
    g.fillStyle(0xffe066, 1).fillCircle(tip.x, tip.y, 6);
  }

  throwArm(angle) {
    const { x, y } = this.shoulder();
    const object = new ThrownArm(this, x, y, angle, this.skeleton.facing);
    const solids = [this.tileGroup, ...this.gates, ...this.doors, ...this.bridges, ...this.boxes];
    // passa pela grade (é fino como a Esqueleto no modo fino)
    const colliders = [
      this.physics.add.collider(object, solids, () => object.land()),
      this.physics.add.overlap(object, this.enemies, (arm, enemy) => {
        if (!object.flying) return;
        enemy.stun('hit');
        object.bounceOff();
      }),
      // caído no chão: a Esqueleto pega de volta encostando
      this.physics.add.overlap(this.skeleton, object, () => {
        if (!object.flying) this.pickUpArm();
      }),
    ];
    this.arm = { object, colliders };
    this.skeleton.hasArm = false;
    playSfx(this, 'throw');
  }

  pickUpArm() {
    if (!this.arm) return;
    for (const collider of this.arm.colliders) collider.destroy();
    this.arm.object.destroy();
    this.arm = null;
    this.skeleton.hasArm = true;
    playSfx(this, 'armPickup');
  }

  updateThrownArm() {
    if (!this.arm) return;
    this.arm.object.update();
    // caiu num buraco: o braço volta sozinho (senão a fase travaria)
    if (this.arm.object.body.top > this.worldHeight + FALL_DEATH_MARGIN) this.pickUpArm();
  }

  // ---------------------------------------------------------------------
  // Ação (E / botão AÇÃO). Prioridade: alavanca > puxar o parceiro > (Vivo)
  // pegar/soltar a cabeça da Esqueleto ou agarrar caixa. Sem nada pra fazer:
  // som de "não dá". Tirar/pôr a cabeça é outro botão (ver update).
  // ---------------------------------------------------------------------
  handleAction(active) {
    const lever = this.levers.find((candidate) => this.physics.overlap(active, candidate));
    if (lever) {
      if (lever.pulled) playSfx(this, 'nope');
      else lever.toggle();
      return;
    }
    if (this.canPull(active, this.partnerOf(active))) {
      this.pullPartner(active);
      return;
    }
    const done = active === this.living && this.livingHandlesHead();
    // ao lado de uma caixa, a ação é agarrá-la (ver handleBoxPush)
    if (!done && !(active === this.living && this.boxesTouching(active).length > 0)) playSfx(this, 'nope');
  }

  livingHandlesHead() {
    const head = this.head?.object;
    if (!head) return false;
    if (head.carrier === this.living) {
      this.dropHeadFromLiving();
      return true;
    }
    if (head.carrier || !this.isNear(this.living, head)) return false;
    head.carry(this.living);
    return true;
  }

  skeletonHandlesHead() {
    const skeleton = this.skeleton;
    if (skeleton.collapsed) return false;
    if (skeleton.hasHead) {
      this.removeHead();
      return true;
    }
    const head = this.head.object;
    // voltar ao tamanho normal dentro da grade faria ela atravessá-la (a
    // sobreposição é grande demais pro Arcade separar)
    if (head.carrier || !this.isNear(skeleton, head) || !this.canAttachHead()) return false;
    this.attachHead();
    return true;
  }

  isNear(character, object) {
    return (
      Math.abs(character.x - object.x) < SKELETON.HEAD_REACH_X &&
      Math.abs(character.body.bottom - object.body.bottom) < SKELETON.HEAD_REACH_Y
    );
  }

  // A cabeça cai atrás da Esqueleto (pra ela seguir em frente) e fica lá.
  removeHead() {
    const skeleton = this.skeleton;
    const object = new SkullHead(this, skeleton.x - skeleton.facing * 20, skeleton.body.top);
    const solids = [this.tileGroup, ...this.gates, ...this.doors, ...this.grates, ...this.bridges, ...this.boxes];
    const colliders = [
      this.physics.add.collider(object, solids),
      // o Vivo sobe nela: sólida só pra quem vem de cima (passa por ela andando)
      this.physics.add.collider(this.living, object, null, (living) => {
        const body = living.body;
        return body.velocity.y >= 0 && body.prev.y + body.height <= object.body.top + 4;
      }),
    ];
    this.head = { object, colliders };
    skeleton.removeHead();
  }

  attachHead() {
    for (const collider of this.head.colliders) collider.destroy();
    this.head.object.destroy();
    this.head = null;
    this.skeleton.attachHead();
  }

  // Solta na frente do Vivo; se ali tem parede/grade, solta onde ele está.
  dropHeadFromLiving() {
    const living = this.living;
    const facing = living.flipX ? -1 : 1;
    const half = SKELETON.HEAD_SIZE / 2;
    let x = living.x + facing * 30;
    const y = living.body.bottom - half - 2;
    const blocked = this.physics
      .overlapRect(x - half, y - half, half * 2, half * 2, false, true)
      .some((body) => body.enable && this.isWall(body.gameObject));
    if (blocked) x = living.x;
    this.head.object.dropAt(x, y);
  }

  isWall(gameObject) {
    return (
      this.tileGroup.contains(gameObject) ||
      this.gates.includes(gameObject) ||
      this.doors.includes(gameObject) ||
      this.grates.includes(gameObject)
    );
  }

  updateHead() {
    const head = this.head?.object;
    if (!head) return;
    head.followCarrier();
    head.update();
    // caiu num buraco: volta pra Esqueleto (senão ela ficaria fina pra sempre)
    if (!head.carrier && head.body.top > this.worldHeight + FALL_DEATH_MARGIN) {
      if (!this.skeleton.collapsed && this.canAttachHead()) this.attachHead();
      else head.dropAt(this.skeleton.x, this.skeleton.body.top - SKELETON.HEAD_SIZE);
    }
  }

  // Vivo caindo em cima da Esqueleto (mesmo teste do pisão): ela desmonta —
  // pilha de ossos imóvel por SKELETON.COLLAPSE_MS — e o Vivo quica.
  onLivingTouchesSkeleton() {
    const skeleton = this.skeleton;
    if (skeleton.collapsed) return;
    const body = this.living.body;
    const previousBottom = body.prev.y + body.height;
    if (!(body.velocity.y > 0 && previousBottom <= skeleton.body.top + ATTACK.STOMP_TOLERANCE)) return;

    skeleton.collapse();
    body.setVelocityY(ATTACK.STOMP_BOUNCE);
    this.collapseTimer = this.time.delayedCall(SKELETON.COLLAPSE_MS, () => {
      this.collapseTimer = null;
      skeleton.reassemble();
    });
  }

  // ---------------------------------------------------------------------
  // Puxar o parceiro: quem está no chão, na borda, puxa o outro que está
  // logo abaixo (num degrau mais baixo ou na água) pra cima, ao seu lado.
  // ---------------------------------------------------------------------
  partnerOf(character) {
    return character === this.living ? this.skeleton : this.living;
  }

  // helper (em pé, em cima) pode puxar partner? Só com os pés de partner
  // PULL_UP.LEVEL_DIFF bloco abaixo dos de helper, e lado a lado. Na água,
  // vale qualquer profundidade até esse 1 bloco (mais fundo, ele se afoga).
  canPull(helper, partner) {
    if (helper.beingPulled || partner.beingPulled) return false;
    if (helper.collapsed || helper.climbing || helper.inWater || !isOnGround(helper)) return false;
    if (Math.abs(partner.x - helper.x) >= PULL_UP.REACH_X) return false;
    const levels = (partner.body.bottom - helper.body.bottom) / this.cellSize;
    const maxLevels = PULL_UP.LEVEL_DIFF + PULL_UP.LEVEL_TOLERANCE;
    if (partner.inWater) return levels > 0 && levels <= maxLevels;
    return Math.abs(levels - PULL_UP.LEVEL_DIFF) <= PULL_UP.LEVEL_TOLERANCE;
  }

  // O personagem controlado pulou: se o parceiro está 1 bloco acima, ao
  // lado, ele o puxa. Retorna true se puxou.
  tryAutoPull(active) {
    const partner = this.partnerOf(active);
    if (active.collapsed || !this.canPull(partner, active)) return false;
    this.pullPartner(partner);
    return true;
  }

  // Sobe o parceiro até ficar em pé ao lado de quem puxou (sem física
  // durante a subida, pra não enroscar na quina).
  pullPartner(helper) {
    const partner = this.partnerOf(helper);
    const target = { x: helper.x, y: helper.body.bottom - partner.body.height / 2 - 1 };
    partner.beingPulled = true;
    partner.climbing = false;
    partner.body.setVelocity(0, 0);
    partner.body.enable = false;
    playSfx(this, 'pullUp');
    this.tweens.add({
      targets: partner,
      x: target.x,
      y: target.y,
      duration: PULL_UP.DURATION_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        partner.body.enable = true;
        partner.body.reset(target.x, target.y);
        partner.beingPulled = false;
      },
    });
  }

  // Linha (célula) da superfície da água sob o personagem, ou null.
  surfaceRow(character) {
    const reach = this.cellSize / 2 + character.body.halfWidth;
    const rows = this.waters.filter((water) => Math.abs(water.x - character.x) < reach).map((water) => water.row);
    return rows.length > 0 ? Math.min(...rows) : null;
  }

  sinkSpeed(living) {
    const row = this.surfaceRow(living);
    const plungeTo = row === null ? -Infinity : (row + WATER.PLUNGE_DEPTH) * this.cellSize;
    return living.body.bottom < plungeTo ? WATER.PLUNGE_SPEED : WATER.SINK_SPEED;
  }

  // y dos pés além do qual o Vivo se afoga: mais que 1 bloco abaixo da borda
  // — exatamente onde o parceiro deixa de alcançá-lo pra puxar (canPull).
  drownDepth(living) {
    const row = this.surfaceRow(living);
    if (row === null) return Infinity;
    return (row + PULL_UP.LEVEL_DIFF + PULL_UP.LEVEL_TOLERANCE) * this.cellSize;
  }

  // ---------------------------------------------------------------------
  // Água: "tchibum" ao entrar (os dois). O Vivo não morre na hora: afunda
  // devagar, fica lento e sem pulo (ver Living) e se afoga depois de
  // WATER.DROWN_MS — tempo pro parceiro puxá-lo pra fora. Retorna true se
  // ele se afogou.
  // ---------------------------------------------------------------------
  updateWater(delta) {
    for (const character of [this.living, this.skeleton]) {
      if (character.beingPulled) continue;
      const inWater = this.waters.length > 0 && this.physics.overlap(character, this.waters);
      if (inWater && !character.wasInWater) playSfx(this, 'splash');
      character.wasInWater = inWater;
    }

    const living = this.living;
    living.inWater = Boolean(living.wasInWater) && !living.beingPulled;
    // mergulha até meio bloco e depois afunda devagar: o limite vale em cada
    // passo da física (que pode rodar mais de um passo por quadro)
    living.body.maxVelocity.y = living.inWater ? this.sinkSpeed(living) : NORMAL_MAX_VELOCITY;
    if (!living.inWater) {
      this.drownElapsed = 0;
      this.bubbleTimer = 0;
      living.clearTint();
      return false;
    }

    this.drownElapsed += delta;
    this.bubbleTimer -= delta;
    if (this.bubbleTimer <= 0) {
      playSfx(this, 'bubbles');
      this.bubbleTimer = WATER.BUBBLE_INTERVAL_MS;
    }
    // pisca azul enquanto se afoga
    if (Math.floor(this.drownElapsed / 250) % 2) living.setTint(0x6699ff);
    else living.clearTint();

    if (this.drownElapsed >= WATER.DROWN_MS || living.body.bottom > this.drownDepth(living)) {
      this.triggerDeath('water');
      return true;
    }
    return false;
  }

  getKeyHolder() {
    return [this.living, this.skeleton].find((character) => character.hasKey) ?? null;
  }

  // Escada: agarra ao apertar ↑/↓ (ou joystick) em cima dela; aí fica sem
  // gravidade subindo/descendo. Passar pela escada andando ou pulando não
  // agarra — senão o pulo morreria no meio dela. Pulo solta a escada.
  updateLadderClimbing(active, climbY, jumpButton) {
    for (const character of [this.living, this.skeleton]) {
      const onLadder = this.ladders.some((ladder) => ladder.dropped && this.physics.overlap(character, ladder));
      const isActive = character === active;

      if (!onLadder || (isActive && jumpButton) || character.collapsed) {
        character.climbing = false;
      } else if (isActive && Math.abs(climbY) > CLIMB_GRAB) {
        character.climbing = true;
      }

      character.body.allowGravity = !character.climbing;
      if (character.climbing) {
        character.body.setVelocityY(isActive ? PHYSICS.CLIMB_SPEED * climbY : 0);
      }
    }
  }

  // Voltar ao tamanho normal dentro de uma grade faria o Esqueleto
  // atravessá-la (a sobreposição é grande demais pro Arcade separar).
  canAttachHead() {
    return !this.grates.some((grate) => !grate.destroyed && this.physics.overlap(this.skeleton, grate));
  }

  // caixas encostadas no personagem, de qualquer lado
  boxesTouching(character) {
    return this.boxes.filter((box) => {
      const reach = box.displayWidth / 2 + character.body.halfWidth + 10;
      return Math.abs(box.x - character.x) < reach && Math.abs(box.y - character.y) < 50;
    });
  }

  // moveX: eixo de -1 a 1 — a caixa anda na mesma proporção que o Vivo.
  // Segurando a ação ao lado de uma caixa, o Vivo a agarra: andando pra ela
  // empurra; andando pro lado oposto puxa (e anda na velocidade da caixa,
  // senão se afastaria e soltaria).
  handleBoxPush(active, moveX, actionHeld, delta) {
    let pushed = null;
    if (active === this.living && actionHeld && moveX !== 0) {
      const living = this.living;
      const touching = this.boxesTouching(living);
      // a da frente (empurrar) tem preferência sobre a de trás (puxar)
      const ahead = touching.find((box) => Math.sign(box.x - living.x) === Math.sign(moveX));
      pushed = ahead ?? touching[0] ?? null;
      if (pushed && !ahead) living.body.setVelocityX(PHYSICS.BLOCK_PUSH_SPEED * moveX);
    }
    for (const box of this.boxes) {
      if (box === pushed) box.push(moveX);
      else box.stop();
    }

    // arrasto da caixa: som repetido enquanto empurra
    this.pushSoundTimer = pushed ? this.pushSoundTimer - delta : 0;
    if (pushed && this.pushSoundTimer <= 0) {
      playSfx(this, 'push');
      this.pushSoundTimer = PUSH_INTERVAL;
    }
  }

  // Passos no chão (ritmo acompanha a velocidade), degraus na escada e
  // baque ao aterrissar de uma queda. Vale pros dois personagens (o parceiro
  // seguindo também faz barulho).
  updateMovementSounds(character, stepSound, delta) {
    const body = character.body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround && !character.wasOnGround && (character.lastVelocityY ?? 0) > LAND_MIN_FALL_SPEED) {
      playSfx(this, 'land');
    }
    character.wasOnGround = onGround;
    character.lastVelocityY = body.velocity.y;

    let sound = null;
    let interval = 0;
    if (character.climbing && Math.abs(body.velocity.y) > 10) {
      sound = 'climb';
      interval = CLIMB_INTERVAL;
    } else if (onGround && Math.abs(body.velocity.x) > 10) {
      sound = stepSound;
      const speed = Math.abs(body.velocity.x) / PHYSICS.MOVE_SPEED;
      interval = STEP_INTERVAL / Math.max(speed, 0.4);
    }
    if (!sound) {
      character.stepTimer = 0;
      return;
    }
    character.stepTimer = (character.stepTimer ?? 0) - delta;
    if (character.stepTimer <= 0) {
      playSfx(this, sound);
      character.stepTimer = interval;
    }
  }

  // Porta: abre quando quem está com a chave encosta. Abre a coluna inteira
  // de células de porta encostadas e gasta a chave (uma chave, uma porta).
  updateDoors() {
    const holder = this.getKeyHolder();
    if (!holder) return;
    const touched = this.doors.find(
      (door) => !door.opened && Math.abs(door.x - holder.x) < 50 && Math.abs(door.y - holder.y) < 70
    );
    if (!touched) return;

    const column = this.doors.filter((door) => door.col === touched.col && !door.opened);
    const rows = new Set(column.map((door) => door.row));
    let top = touched.row;
    let bottom = touched.row;
    while (rows.has(top - 1)) top--;
    while (rows.has(bottom + 1)) bottom++;
    for (const door of column) {
      if (door.row >= top && door.row <= bottom) door.open();
    }
    holder.hasKey = false;
  }

  updateHUD(active) {
    const name = active === this.living ? 'Vivo (Bram)' : 'Esqueleto (Ossos)';
    const holder = this.getKeyHolder();
    const key = holder === this.living ? 'com o Vivo' : holder === this.skeleton ? 'com o Esqueleto' : 'Não';
    const skeleton = this.skeleton;
    const states = [];
    if (!skeleton.hasHead) states.push('sem cabeça');
    if (this.collapseTimer) states.push(`desmontada ${Math.ceil(this.collapseTimer.getRemaining() / 1000)}s`);
    const skeletonState = states.length ? ` [${states.join(', ')}]` : '';
    const arm = skeleton.hasArm ? 'no corpo' : 'arremessado (vá buscar)';
    const headCarrier = this.head?.object.carrier;
    const head = skeleton.hasHead ? 'no corpo' : headCarrier ? 'com o Vivo' : 'no chão';
    // o create() da HudScene só roda no frame seguinte ao launch
    if (!this.hud.statusText) return;
    const waiting = this.followSystem.waiting;
    const alerts = [];
    if (this.living.inWater) {
      // o que vier primeiro: o tempo acabar ou afundar demais
      const byTime = (WATER.DROWN_MS - this.drownElapsed) / 1000;
      // no fundo de uma piscina rasa não afunda mais: vale só o tempo
      const onBottom = this.living.body.blocked.down;
      const byDepth = onBottom ? Infinity : (this.drownDepth(this.living) - this.living.body.bottom) / WATER.SINK_SPEED;
      const left = Math.max(0, Math.ceil(Math.min(byTime, byDepth)));
      let rescue = 'chegue perto da borda, 1 bloco abaixo do parceiro';
      if (this.canPull(this.skeleton, this.living)) {
        rescue = active === this.living ? 'pule pra ser puxado' : 'aperte a ação pra puxar';
      }
      alerts.push(`O Vivo está se afogando! ${left}s (${rescue})`);
    }
    const partner = this.partnerOf(active);
    if (this.canPull(active, partner)) alerts.push('Ação: puxar o parceiro');
    else if (!this.living.inWater && this.canPull(partner, active)) alerts.push('Pule: o parceiro te puxa');
    this.hud.setStatus(
      [
        `Personagem: ${name}`,
        `Esqueleto: cabeça ${head}, braço ${arm}${skeletonState}`,
        `Chave: ${key}`,
        `Parceiro: ${waiting ? 'esperando' : 'seguindo'}`,
        ...alerts,
      ].join('\n')
    );
    // (setText ignora texto igual, então chamar todo frame é barato)
    if (this.touchControls?.buttons) {
      this.touchControls.setButtonLabel('wait', waiting ? 'SEGUIR' : 'ESPERAR');
    }
  }

  triggerDeath(reason) {
    if (this.isResetting || this.levelComplete) return;
    this.isResetting = true;
    this.lastDeathReason = reason || 'unknown';
    this.cancelAim();
    if (reason === 'water') playSfx(this, 'bubbles');
    if (reason === 'enemy') playSfx(this, 'hit');
    playSfx(this, reason === 'fall' ? 'fall' : 'death');
    this.physics.pause();
    this.cameras.main.flash(200, 200, 0, 0);
    this.time.delayedCall(350, () => this.scene.restart());
  }

  onExitReached() {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.physics.pause();
    playSfx(this, 'win');
    this.hud.showLevelComplete();
  }
}

// No chão (piso fixo ou em cima de caixa, que é corpo dinâmico).
function isOnGround(character) {
  return character.body.blocked.down || character.body.touching.down;
}

// Largura do mundo = até a última coluna usada (+1 de folga), não a grade
// inteira do editor (300 colunas): senão a câmera rolaria por um vazio enorme.
function computeWorldWidth(levelData) {
  const S = levelData.tileSize;
  let maxCol = 0;
  for (const sprite of levelData.tiles) {
    maxCol = Math.max(maxCol, spriteArea(sprite, settingsFor(levelData.assets, sprite)).c1);
  }
  for (const entity of levelData.entities) maxCol = Math.max(maxCol, entity.col);
  const cols = Phaser.Math.Clamp(maxCol + 2, MIN_WORLD_COLS, levelData.grid.cols);
  return cols * S;
}
