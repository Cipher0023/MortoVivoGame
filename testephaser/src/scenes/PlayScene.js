import Phaser from 'phaser';
import { COLORS, PHYSICS, CAMERA } from '../config/constants.js';
import Living from '../entities/Living.js';
import Skeleton from '../entities/Skeleton.js';
import PatrolEnemy from '../entities/PatrolEnemy.js';
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
import { settingsFor, spriteArea } from '../levels/assetSettings.js';
import { ENTITY_SHAPES, entityCenter, createChannelMarker } from '../levels/entityCatalog.js';
import { isTouchEnabled } from './TouchControlsScene.js';
import { playSfx } from '../audio/sfx.js';

// Joga qualquer fase no formato do editor (tiles + decorações + peças de
// mecânica, ver entityCatalog). As fases oficiais (src/levels/data) e o
// "Testar" do editor passam por aqui.

const NO_TOUCH = { x: 0, y: 0, jump: false, action: false };
// mundo nunca mais estreito que a visão da câmera com zoom (960px)
const MIN_WORLD_COLS = 16;
// a água "começa" um pouco abaixo do topo da célula da superfície: quem está
// em pé numa ponte logo acima não encosta nela
const WATER_SURFACE_INSET = 14;
// caiu tanto abaixo do fundo do mundo (não há chão lá): morte
const FALL_DEATH_MARGIN = 80;
// fração do joystick/teclado pra agarrar a escada
const CLIMB_GRAB = 0.3;
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

    this.tileGroup = buildLevelFromData(this, this.levelData).tileGroup;
    this.createEntities();
    this.createCharacters();
    this.createInput();
    this.createColliders();
    this.createHUD();
    this.pushSoundTimer = 0;
    this.skeletonInWater = false;
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

      switch (e.type) {
        case 'living':
        case 'skeleton':
          this.spawns[e.type] = { x, bottom: (e.row + 1) * S };
          break;
        case 'exit':
          this.exits.push(new ExitButton(this, x, y));
          break;
        case 'enemy':
          this.enemies.push(new PatrolEnemy(this, x, y, shape.w));
          break;
        case 'water': {
          const inset = waterCells.has(`${e.col},${e.row - 1}`) ? 0 : WATER_SURFACE_INSET;
          const height = S - inset;
          this.waters.push(new Hazard(this, x, e.row * S + inset + height / 2, S, height, COLORS.WATER, ['living']));
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
    return bodies.some((found) => found.enable && this.floorObjects.has(found.gameObject));
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
      back: kb.addKey('ESC'),
    };

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

    this.physics.add.collider(this.boxes, [...solids, ...this.grates, ...this.bridges]);
    this.physics.add.collider(this.boxes, this.boxes);
    this.physics.add.collider(this.enemies, [...solids, ...this.grates, ...this.boxes]);

    // água funda: mata o Vivo; o Esqueleto afunda sem dano
    this.physics.add.overlap(this.living, this.waters, () => this.triggerDeath('water'));
    // inimigos: só detectam o Vivo
    this.physics.add.overlap(this.living, this.enemies, () => this.triggerDeath('enemy'));

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
    if (Phaser.Input.Keyboard.JustDown(this.keys.back)) {
      playSfx(this, 'back');
      this.exitLevel();
      return;
    }

    if (this.isResetting || this.levelComplete) return;

    // Teclado e touch valem ao mesmo tempo. Movimento é um eixo de -1 a 1:
    // teclado dá -1/0/1 e tem prioridade; senão vale o joystick analógico.
    // No touch, joystick pra cima só sobe escada; pulo é sempre o botão PULAR.
    const touch = this.getTouchState();
    const k = this.keys;
    const keyX = (k.right.isDown || k.rightD.isDown ? 1 : 0) - (k.left.isDown || k.leftA.isDown ? 1 : 0);
    const keyY = (k.down.isDown || k.downS.isDown ? 1 : 0) - (k.up.isDown || k.upW.isDown ? 1 : 0);
    const moveX = keyX !== 0 ? keyX : touch.x;
    const climbY = keyY !== 0 ? keyY : touch.y;
    // "pulo de verdade" (sem o ↑ do teclado): é o que solta da escada
    const jumpButton = k.jump.isDown || touch.jump;
    const jumpDown = jumpButton || k.up.isDown || k.upW.isDown;
    const actionHeld = k.action.isDown || touch.action;

    const active = this.characterManager.getActive();
    active.handleMovement({ x: moveX, jump: jumpDown });

    this.updateLadderClimbing(active, climbY, jumpButton);

    // troca de personagem
    // (os dois lados do || sempre rodam, pra consumir o aperto do touch)
    const switchPressed = Phaser.Input.Keyboard.JustDown(k.switchKey);
    if (this.consumeTouchPress('switch') || switchPressed) {
      this.characterManager.switchCharacter();
      playSfx(this, 'switch');
    }

    // parceiro: segue por padrão; F / botão ESPERAR manda esperar e libera
    const waitPressed = Phaser.Input.Keyboard.JustDown(k.wait);
    if (this.consumeTouchPress('wait') || waitPressed) {
      this.followSystem.toggleWait(this.characterManager.getInactive());
      playSfx(this, this.followSystem.waiting ? 'wait' : 'follow');
    }
    this.followSystem.update(this.characterManager.getActive(), this.characterManager.getInactive());

    const actionKeyPressed = Phaser.Input.Keyboard.JustDown(k.action);
    const actionJustDown = this.consumeTouchPress('action') || actionKeyPressed;

    // prioridade de interação: alavancas > modo fino (Esqueleto)
    if (actionJustDown) {
      const lever = this.levers.find((candidate) => this.physics.overlap(active, candidate));
      if (lever && !lever.pulled) {
        lever.toggle();
      } else if (!lever && active === this.skeleton && this.canToggleThin()) {
        this.skeleton.toggleThin();
      } else {
        // nada pra fazer aqui (alavanca já puxada, Vivo sem alvo, Esqueleto
        // preso fino dentro da grade): som de "não dá"
        playSfx(this, 'nope');
      }
    }

    this.handleBoxPush(active, moveX, actionHeld, delta);
    this.updateDoors();
    for (const enemy of this.enemies) enemy.update();

    const fallLine = this.worldHeight + FALL_DEATH_MARGIN;
    if (this.living.body.top > fallLine || this.skeleton.body.top > fallLine) {
      this.triggerDeath('fall');
      return;
    }

    this.updateMovementSounds(this.living, 'step', delta);
    this.updateMovementSounds(this.skeleton, 'stepBone', delta);
    this.updateWaterSplash();
    this.updateHUD(active);
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

      if (!onLadder || (isActive && jumpButton)) {
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
  canToggleThin() {
    if (!this.skeleton.isThin) return true;
    return !this.grates.some((grate) => !grate.destroyed && this.physics.overlap(this.skeleton, grate));
  }

  // moveX: eixo de -1 a 1 — a caixa anda na mesma proporção que o Vivo.
  // Empurra a caixa encostada no Vivo, do lado pra onde ele está indo.
  handleBoxPush(active, moveX, actionHeld, delta) {
    let pushed = null;
    if (active === this.living && actionHeld && moveX !== 0) {
      const living = this.living;
      pushed = this.boxes.find((box) => {
        const dx = box.x - living.x;
        const reach = box.displayWidth / 2 + living.body.halfWidth + 10;
        return Math.sign(dx) === Math.sign(moveX) && Math.abs(dx) < reach && Math.abs(box.y - living.y) < 50;
      });
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

  // O Esqueleto afunda na água sem dano, mas faz "tchibum" ao entrar.
  updateWaterSplash() {
    const inWater = this.waters.length > 0 && this.physics.overlap(this.skeleton, this.waters);
    if (inWater && !this.skeletonInWater) playSfx(this, 'splash');
    this.skeletonInWater = inWater;
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
    const thin = this.skeleton.isThin ? ' [fino]' : '';
    // o create() da HudScene só roda no frame seguinte ao launch
    if (!this.hud.statusText) return;
    const waiting = this.followSystem.waiting;
    this.hud.setStatus(`Personagem: ${name}${thin}\nChave: ${key}\nParceiro: ${waiting ? 'esperando' : 'seguindo'}`);
    // (setText ignora texto igual, então chamar todo frame é barato)
    if (this.touchControls?.buttons) {
      this.touchControls.setButtonLabel('wait', waiting ? 'SEGUIR' : 'ESPERAR');
    }
  }

  triggerDeath(reason) {
    if (this.isResetting || this.levelComplete) return;
    this.isResetting = true;
    this.lastDeathReason = reason || 'unknown';
    if (reason === 'water') playSfx(this, 'splash');
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
