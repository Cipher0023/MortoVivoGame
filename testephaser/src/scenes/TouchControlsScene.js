import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';

// Overlay de controles touch: joystick virtual (esquerda) + botões Pular e
// Ação (direita) + botão Trocar personagem (topo). Roda como cena própria,
// por cima da fase, pra nunca ser afetado pelo scroll/zoom da câmera do jogo.
// A fase só lê `state` e consome os "apertos" com consumePress().

const JOYSTICK_HOME = { x: 260, y: GAME_HEIGHT - 260 };
const JOYSTICK_RADIUS = 150;
const THUMB_RADIUS = 70;
// Zona morta (fração do raio): abaixo disso o eixo vale 0, pra o personagem
// não andar sozinho com o dedo só apoiado. Acima, o valor é reescalado pra
// ir de 0 a 1 — assim a velocidade começa suave logo após a zona morta.
const DEADZONE = 0.15;

function applyDeadzone(value) {
  const magnitude = Math.abs(value);
  if (magnitude < DEADZONE) return 0;
  return (Math.sign(value) * (magnitude - DEADZONE)) / (1 - DEADZONE);
}
// Joystick flutuante: só nasce onde o dedo toca se for dentro desta área.
const JOYSTICK_ZONE = { maxX: GAME_WIDTH * 0.45, minY: 160 };

const BUTTONS = [
  { id: 'jump', label: 'PULAR', x: GAME_WIDTH - 200, y: GAME_HEIGHT - 300, radius: 115, color: 0x33aa66 },
  { id: 'action', label: 'AÇÃO', x: GAME_WIDTH - 440, y: GAME_HEIGHT - 170, radius: 105, color: 0xcc8833 },
  // segurar mira, soltar arremessa (braço da Esqueleto)
  { id: 'attack', label: 'BRAÇO', x: GAME_WIDTH - 440, y: GAME_HEIGHT - 430, radius: 95, color: 0xaa3355 },
  // Esqueleto tira/põe a cabeça (acima do PULAR)
  { id: 'head', label: 'CABEÇA', x: GAME_WIDTH - 200, y: GAME_HEIGHT - 540, radius: 75, color: 0x777766 },
  { id: 'switch', label: 'TROCAR', x: GAME_WIDTH / 2 - 90, y: 80, radius: 70, color: 0x5555aa },
  // rótulo alterna ESPERAR/SEGUIR (a fase chama setButtonLabel)
  { id: 'wait', label: 'ESPERAR', x: GAME_WIDTH / 2 + 90, y: 80, radius: 70, color: 0x996633 },

];
// Margem extra de toque além do círculo desenhado (dedo não é preciso).
const HIT_SLOP = 1.2;

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
    // x/y: eixos analógicos do joystick, de -1 a 1 (y negativo = pra cima)
    this.state = { x: 0, y: 0 };
    this.pressed = {};
    for (const def of BUTTONS) {
      this.state[def.id] = false;
      this.pressed[def.id] = false;
    }
    this.joystickPointerId = null;

    this.createJoystick();
    this.buttons = BUTTONS.map((def) => this.createButton(def));

    this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
    this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
  }

  // Retorna true uma única vez por toque (equivalente ao JustDown do teclado).
  consumePress(id) {
    const wasPressed = this.pressed[id];
    this.pressed[id] = false;
    return wasPressed;
  }

  // ---------------------------------------------------------------------
  // Joystick
  // ---------------------------------------------------------------------
  createJoystick() {
    this.joyBase = this.add
      .circle(JOYSTICK_HOME.x, JOYSTICK_HOME.y, JOYSTICK_RADIUS, 0xffffff, 0.12)
      .setStrokeStyle(4, 0xffffff, 0.35);
    this.joyThumb = this.add.circle(JOYSTICK_HOME.x, JOYSTICK_HOME.y, THUMB_RADIUS, 0xffffff, 0.4);
  }

  onPointerDown(pointer) {
    if (this.joystickPointerId !== null) return;
    if (pointer.x > JOYSTICK_ZONE.maxX || pointer.y < JOYSTICK_ZONE.minY) return;
    if (this.buttonAt(pointer)) return;

    this.joystickPointerId = pointer.id;
    this.joyBase.setPosition(pointer.x, pointer.y);
    this.joyThumb.setPosition(pointer.x, pointer.y);
    this.updateJoystick(pointer);
  }

  onPointerMove(pointer) {
    if (pointer.id === this.joystickPointerId) this.updateJoystick(pointer);
  }

  onPointerUp(pointer) {
    if (pointer.id !== this.joystickPointerId) return;
    this.joystickPointerId = null;
    this.joyBase.setPosition(JOYSTICK_HOME.x, JOYSTICK_HOME.y);
    this.joyThumb.setPosition(JOYSTICK_HOME.x, JOYSTICK_HOME.y);
    this.setDirections(0, 0);
  }

  updateJoystick(pointer) {
    const dx = pointer.x - this.joyBase.x;
    const dy = pointer.y - this.joyBase.y;
    const dist = Math.min(Math.hypot(dx, dy), JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * dist) / JOYSTICK_RADIUS;
    const ny = (Math.sin(angle) * dist) / JOYSTICK_RADIUS;

    this.joyThumb.setPosition(this.joyBase.x + nx * JOYSTICK_RADIUS, this.joyBase.y + ny * JOYSTICK_RADIUS);
    this.setDirections(nx, ny);
  }

  setDirections(nx, ny) {
    this.state.x = applyDeadzone(nx);
    this.state.y = applyDeadzone(ny);
  }

  // ---------------------------------------------------------------------
  // Botões — estado calculado a cada frame a partir de todos os dedos na
  // tela (em vez de eventos por botão), assim deslizar o dedo pra fora ou
  // segurar dois botões ao mesmo tempo nunca deixa um botão "preso".
  // ---------------------------------------------------------------------
  createButton(def) {
    const circle = this.add.circle(def.x, def.y, def.radius, def.color, 0.35).setStrokeStyle(4, 0xffffff, 0.5);
    const text = this.add
      .text(def.x, def.y, def.label, {
        fontFamily: 'monospace',
        fontSize: def.radius > 80 ? '34px' : '24px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    return { def, circle, text };
  }

  setButtonLabel(id, label) {
    this.buttons.find(({ def }) => def.id === id)?.text.setText(label);
  }

  buttonAt(pointer) {
    return this.buttons.find(
      ({ def }) => Phaser.Math.Distance.Between(pointer.x, pointer.y, def.x, def.y) <= def.radius * HIT_SLOP
    );
  }

  update() {
    const held = new Set();
    for (const pointer of this.input.manager.pointers) {
      if (!pointer.isDown || pointer.id === this.joystickPointerId) continue;
      const button = this.buttonAt(pointer);
      if (button) held.add(button.def.id);
    }

    for (const { def, circle } of this.buttons) {
      const isDown = held.has(def.id);
      if (isDown && !this.state[def.id]) this.pressed[def.id] = true;
      this.state[def.id] = isDown;
      circle.setFillStyle(def.color, isDown ? 0.75 : 0.35);
    }
  }
}
