import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { PALETTE, CSS, FONT_TITLE, FONT_TEXT } from '../ui/theme.js';

// Controles touch, no jeito dos jogos de aventura em quadrinhos (Valiant
// Hearts): poucos botões, cada um com uma função clara, e o resto aparece só
// quando dá para usar.
//
//   esquerda   analógico flutuante: nasce onde o dedo toca (pra cima e
//              pra baixo sobe/desce escada)
//   direita    PULAR (sempre) e um botão de AÇÃO só, que mostra o que vai
//              fazer agora (ALAVANCA, PUXAR, PEGAR, EMPURRAR, CHUTAR, BRAÇO…)
//              e some quando não há nada para fazer
//   topo       rosto do parceiro (toque = trocar) e ESPERAR/SEGUIR
//
// Mirar: segure a AÇÃO quando ela for CHUTAR ou BRAÇO e arraste o dedo — para
// cima/baixo muda o ângulo, para os lados vira o personagem — e solte para
// lançar. A fase lê `state` (e `state.drag`) e consome os apertos com
// consumePress(); quem decide o rótulo e o que aparece é a fase
// (setButtonLabel / setButtonVisible / setButtonImage).
//
// Roda como cena própria, por cima da fase, pra nunca ser afetada pelo
// scroll/zoom da câmera do jogo.

const H = GAME_HEIGHT;
const W = GAME_WIDTH;

const BUTTONS = [
  { id: 'jump', label: 'PULAR', x: W - 190, y: H - 270, radius: 118, color: PALETTE.folha, ink: CSS.papel },
  // rótulo e visibilidade vêm da fase, conforme o que dá para fazer agora
  { id: 'action', label: 'AÇÃO', x: W - 440, y: H - 140, radius: 108, color: PALETTE.crema, ink: CSS.espresso, hidden: true },
  // Esqueleto tira/põe a cabeça (habilidade dela, fica à parte)
  { id: 'head', label: 'CABEÇA', x: W - 190, y: H - 520, radius: 74, color: PALETTE.cafeComLeite, ink: CSS.papel, hidden: true },

  // rosto do parceiro: tocar troca de personagem
  { id: 'switch', caption: 'TROCAR', x: W / 2 - 95, y: 92, radius: 66, color: PALETTE.papel, ink: CSS.espresso, hidden: true },
  { id: 'wait', label: 'ESPERAR', x: W / 2 + 95, y: 92, radius: 66, color: PALETTE.morto, ink: CSS.papel, hidden: true },
];

// Margem extra de toque além do círculo desenhado (dedo não é preciso).
const HIT_SLOP = 1.25;
// Analógico: posição de descanso, raio da base e do pino.
const JOYSTICK_HOME = { x: 260, y: H - 260 };
const JOYSTICK_RADIUS = 150;
const THUMB_RADIUS = 70;
// Zona morta (fração do raio): abaixo disso o eixo vale 0, pra o personagem
// não andar sozinho com o dedo só apoiado. Acima, o valor é reescalado pra
// ir de 0 a 1 — a velocidade começa suave logo após a zona morta.
const DEADZONE = 0.15;
// Analógico flutuante: só nasce onde o dedo toca se for dentro desta área.
const JOYSTICK_ZONE = { maxX: W * 0.45, minY: 160 };

function applyDeadzone(value) {
  const magnitude = Math.abs(value);
  if (magnitude < DEADZONE) return 0;
  return (Math.sign(value) * (magnitude - DEADZONE)) / (1 - DEADZONE);
}

const IDLE_ALPHA = 0.85;
const PRESSED_ALPHA = 1;

// Liga no celular/tablet; `?touch=1` força no desktop (testar com o mouse),
// `?touch=0` desliga.
export function isTouchEnabled(game) {
  const param = new URLSearchParams(window.location.search).get('touch');
  if (param === '1') return true;
  if (param === '0') return false;
  return game.device.input.touch;
}

export default class TouchControlsScene extends Phaser.Scene {
  constructor() {
    super('TouchControls');
  }

  create() {
    // x/y: eixos do analógico, de -1 a 1 (y negativo = pra cima). drag: quanto o dedo
    // da AÇÃO andou desde que apertou (para mirar), ou null.
    this.state = { x: 0, y: 0, drag: null };
    this.pressed = {};
    for (const def of BUTTONS) {
      this.state[def.id] = false;
      this.pressed[def.id] = false;
    }
    this.actionPointer = null; // { id, startX, startY }
    this.joystickPointerId = null;
    this.createJoystick();
    this.buttons = BUTTONS.map((def) => this.createButton(def));
    this.input.on('pointerdown', (pointer) => this.onJoystickDown(pointer));
    this.input.on('pointermove', (pointer) => {
      if (pointer.id === this.joystickPointerId) this.updateJoystick(pointer);
    });
    this.input.on('pointerup', (pointer) => this.onJoystickUp(pointer));
    this.input.on('pointerupoutside', (pointer) => this.onJoystickUp(pointer));
    // Toque rápido (dedo sobe antes do próximo quadro) também conta: o aperto
    // é marcado já no evento, e o update() não marca de novo.
    this.input.on('pointerdown', (pointer) => {
      const button = this.buttonAt(pointer);
      if (!button) return;
      const { id } = button.def;
      if (!this.state[id]) this.pressed[id] = true;
      this.state[id] = true;
      if (id === 'action' && !this.actionPointer) {
        this.actionPointer = { id: pointer.id, startX: pointer.x, startY: pointer.y };
      }
    });
    this.events.once('shutdown', () => {
      this.actionPointer = null;
      this.joystickPointerId = null;
    });
  }

  // Retorna true uma única vez por toque (equivalente ao JustDown do teclado).
  consumePress(id) {
    const wasPressed = this.pressed[id];
    this.pressed[id] = false;
    return Boolean(wasPressed);
  }

  // ---------------------------------------------------------------------
  // Analógico
  // ---------------------------------------------------------------------
  createJoystick() {
    // base: disco de papel translúcido com aro café; pino: bolinha creme com
    // sombra dura, como os botões da página
    this.joyBase = this.add.graphics({ x: JOYSTICK_HOME.x, y: JOYSTICK_HOME.y });
    this.joyBase.fillStyle(PALETTE.papel, 0.3);
    this.joyBase.fillCircle(0, 0, JOYSTICK_RADIUS);
    this.joyBase.lineStyle(6, PALETTE.espresso, 0.6);
    this.joyBase.strokeCircle(0, 0, JOYSTICK_RADIUS);
    // setinhas de direção, só de guia
    this.joyBase.fillStyle(PALETTE.espresso, 0.5);
    const tip = JOYSTICK_RADIUS - 20;
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      this.joyBase.fillTriangle(
        c * tip, sn * tip,
        c * (tip - 26) - sn * 18, sn * (tip - 26) + c * 18,
        c * (tip - 26) + sn * 18, sn * (tip - 26) - c * 18
      );
    }

    this.joyThumb = this.add.graphics({ x: JOYSTICK_HOME.x, y: JOYSTICK_HOME.y });
    this.joyThumb.fillStyle(PALETTE.espresso, 0.9);
    this.joyThumb.fillCircle(0, 9, THUMB_RADIUS);
    this.joyThumb.fillStyle(PALETTE.crema, 1);
    this.joyThumb.fillCircle(0, 0, THUMB_RADIUS);
    this.joyThumb.lineStyle(6, PALETTE.espresso, 1);
    this.joyThumb.strokeCircle(0, 0, THUMB_RADIUS);
    this.setJoystickActive(false);
  }

  setJoystickActive(active) {
    this.joyBase.setAlpha(active ? 1 : 0.75);
    this.joyThumb.setAlpha(active ? 1 : 0.8);
  }

  onJoystickDown(pointer) {
    if (this.joystickPointerId !== null) return;
    if (pointer.x > JOYSTICK_ZONE.maxX || pointer.y < JOYSTICK_ZONE.minY) return;
    if (this.buttonAt(pointer)) return;
    this.joystickPointerId = pointer.id;
    this.joyBase.setPosition(pointer.x, pointer.y);
    this.joyThumb.setPosition(pointer.x, pointer.y);
    this.setJoystickActive(true);
    this.updateJoystick(pointer);
  }

  onJoystickUp(pointer) {
    if (pointer.id !== this.joystickPointerId) return;
    this.joystickPointerId = null;
    this.joyBase.setPosition(JOYSTICK_HOME.x, JOYSTICK_HOME.y);
    this.joyThumb.setPosition(JOYSTICK_HOME.x, JOYSTICK_HOME.y);
    this.setJoystickActive(false);
    this.state.x = 0;
    this.state.y = 0;
  }

  updateJoystick(pointer) {
    const dx = pointer.x - this.joyBase.x;
    const dy = pointer.y - this.joyBase.y;
    const dist = Math.min(Math.hypot(dx, dy), JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * dist) / JOYSTICK_RADIUS;
    const ny = (Math.sin(angle) * dist) / JOYSTICK_RADIUS;
    this.joyThumb.setPosition(this.joyBase.x + nx * JOYSTICK_RADIUS, this.joyBase.y + ny * JOYSTICK_RADIUS);
    this.state.x = applyDeadzone(nx);
    this.state.y = applyDeadzone(ny);
  }

  // ---------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------
  createButton(def) {
    const shadow = Math.round(def.radius / 9);
    const graphics = this.add.graphics({ x: def.x, y: def.y });
    const text = this.add
      .text(def.x, def.y, def.label ?? '', {
        fontFamily: FONT_TITLE,
        fontSize: `${def.radius > 90 ? 42 : 28}px`,
        color: def.ink,
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5);
    const button = { def, graphics, text, shadow, visible: !def.hidden, isDown: false, image: null, caption: null };
    if (def.caption) {
      button.caption = this.add
        .text(def.x, def.y + def.radius + 22, def.caption, {
          fontFamily: FONT_TEXT,
          fontSize: '24px',
          fontStyle: 'bold',
          color: CSS.espresso,
          backgroundColor: `${CSS.papel}dd`,
          padding: { x: 10, y: 0 },
        })
        .setOrigin(0.5);
    }
    this.fitLabel(button);
    this.drawButton(button);
    this.applyVisible(button);
    return button;
  }

  // Rótulo cabe dentro do círculo: diminui a fonte se for comprido.
  fitLabel(button) {
    const { def, text } = button;
    const base = def.radius > 90 ? 42 : 28;
    text.setFontSize(base);
    const max = def.radius * 1.6;
    if (text.width > max) text.setFontSize(Math.floor((base * max) / text.width));
  }

  // Círculo colorido com contorno café e sombra dura; apertado, ele desce
  // até a sombra e fica opaco.
  drawButton(button) {
    const { def, graphics, text, shadow, isDown, image } = button;
    const offset = isDown ? shadow - 2 : 0;
    const r = def.radius;
    graphics.clear();
    graphics.fillStyle(PALETTE.espresso, 1);
    graphics.fillCircle(0, shadow, r);
    graphics.fillStyle(def.color, 1);
    graphics.fillCircle(0, offset, r);
    graphics.lineStyle(Math.max(5, r / 16), PALETTE.espresso, 1);
    graphics.strokeCircle(0, offset, r);
    graphics.setAlpha(isDown ? PRESSED_ALPHA : IDLE_ALPHA);
    text.setY(def.y + offset + 2);
    text.setAlpha(isDown ? PRESSED_ALPHA : 1);
    image?.setY(def.y + offset + def.radius * 1.2);
  }

  setButtonLabel(id, label) {
    const button = this.find(id);
    if (!button || button.text.text === label) return;
    button.text.setText(label);
    this.fitLabel(button);
  }

  // Figura dentro do botão (rosto do parceiro no TROCAR).
  setButtonImage(id, textureKey) {
    const button = this.find(id);
    if (!button || button.imageKey === textureKey) return;
    button.imageKey = textureKey;
    button.image?.destroy();
    button.image = null;
    if (!textureKey || !this.textures.exists(textureKey)) return;
    const { def } = button;
    // retrato: pés apoiados abaixo do círculo, grande, da cintura pra cima
    const image = this.add.image(def.x, def.y, textureKey).setOrigin(0.5, 1);
    const size = def.radius * 2.3;
    image.setScale(size / image.height);
    // recorta no círculo do botão
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff, 1).fillCircle(def.x, def.y, def.radius - 5);
    image.setMask(maskShape.createGeometryMask());
    button.image = image;
    this.drawButton(button);
    this.applyVisible(button);
  }

  // Botão escondido: some da tela e não responde ao toque.
  setButtonVisible(id, visible) {
    const button = this.find(id);
    if (!button || button.visible === visible) return;
    button.visible = visible;
    this.applyVisible(button);
    if (!visible) {
      this.pressed[id] = false;
      this.state[id] = false;
      button.isDown = false;
      this.drawButton(button);
    }
  }

  applyVisible(button) {
    const { visible } = button;
    button.graphics.setVisible(visible);
    button.text.setVisible(visible);
    button.image?.setVisible(visible);
    button.caption?.setVisible(visible);
  }

  find(id) {
    return this.buttons?.find(({ def }) => def.id === id);
  }

  // O botão mais perto do dedo, dentro da margem de toque.
  buttonAt(pointer) {
    let best = null;
    let bestDist = Infinity;
    for (const button of this.buttons) {
      if (!button.visible) continue;
      const { def } = button;
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, def.x, def.y);
      if (dist <= def.radius * HIT_SLOP && dist / def.radius < bestDist) {
        best = button;
        bestDist = dist / def.radius;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------
  // Estado — calculado a cada quadro a partir de todos os dedos na tela
  // (em vez de eventos por botão): deslizar de ◀ para ▶, ou segurar dois
  // botões ao mesmo tempo, nunca deixa um botão "preso".
  // ---------------------------------------------------------------------
  update() {
    const held = new Set();
    let actionPointerStillDown = false;
    for (const pointer of this.input.manager.pointers) {
      if (!pointer.isDown || pointer.id === this.joystickPointerId) continue;
      // o dedo que apertou a AÇÃO continua sendo dela enquanto mira, mesmo
      // arrastado para fora do botão
      if (this.actionPointer && pointer.id === this.actionPointer.id) {
        actionPointerStillDown = true;
        held.add('action');
        continue;
      }
      const button = this.buttonAt(pointer);
      if (button) {
        held.add(button.def.id);
        if (button.def.id === 'action' && !this.actionPointer) {
          this.actionPointer = { id: pointer.id, startX: pointer.x, startY: pointer.y };
          actionPointerStillDown = true;
        }
      }
    }

    if (!actionPointerStillDown) this.actionPointer = null;
    const ap = this.actionPointer;
    const pointer = ap && this.input.manager.pointers.find((p) => p.id === ap.id);
    this.state.drag = pointer ? { dx: pointer.x - ap.startX, dy: pointer.y - ap.startY } : null;

    for (const button of this.buttons) {
      const { def } = button;
      const isDown = held.has(def.id);
      if (isDown && !this.state[def.id]) this.pressed[def.id] = true;
      this.state[def.id] = isDown;
      if (button.isDown !== isDown) {
        button.isDown = isDown;
        this.drawButton(button);
      }
    }
  }
}
