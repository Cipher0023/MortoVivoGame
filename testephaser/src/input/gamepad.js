// Controle (joystick/gamepad) no layout padrão do navegador ("standard
// mapping": Xbox; no PlayStation A = ✕, B = ○, X = □, Y = △). O navegador só
// mostra o controle pro jogo depois do primeiro botão apertado nele.
//
// Fase: A pula, X ação, B/RT ataque (Esqueleto: segurar mira, soltar
// arremessa o braço; Vivo: chuta a bola), Y troca,
// LB esperar/seguir, RB cabeça (Esqueleto), Select sai. Menus: A confirma, B/Select volta.

export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
};

// abaixo disso o analógico vale 0 (controle gasto "anda sozinho")
const DEADZONE = 0.25;

function applyDeadzone(value) {
  const magnitude = Math.abs(value);
  if (magnitude < DEADZONE) return 0;
  return (Math.sign(value) * (magnitude - DEADZONE)) / (1 - DEADZONE);
}

// Lê o primeiro controle conectado uma vez por quadro (update()) e guarda o
// quadro anterior, pra saber o que acabou de ser apertado (pressed()).
export class PadReader {
  constructor(scene) {
    this.scene = scene;
    this.now = new Set();
    this.previous = new Set();
    this.x = 0;
    this.y = 0;
  }

  update() {
    this.previous = this.now;
    this.now = new Set();
    this.x = 0;
    this.y = 0;
    const pad = this.scene.input.gamepad?.gamepads.find((candidate) => candidate?.connected);
    if (!pad) return;

    pad.buttons.forEach((button, index) => {
      if (button.pressed) this.now.add(index);
    });
    // direcional digital tem prioridade sobre o analógico
    const digitalX = (this.now.has(PAD.RIGHT) ? 1 : 0) - (this.now.has(PAD.LEFT) ? 1 : 0);
    const digitalY = (this.now.has(PAD.DOWN) ? 1 : 0) - (this.now.has(PAD.UP) ? 1 : 0);
    this.x = digitalX || applyDeadzone(pad.leftStick.x);
    this.y = digitalY || applyDeadzone(pad.leftStick.y);
  }

  held(...buttons) {
    return buttons.some((button) => this.now.has(button));
  }

  // apertou neste quadro (vale uma vez por aperto)
  pressed(...buttons) {
    return buttons.some((button) => this.now.has(button) && !this.previous.has(button));
  }
}

// Menus: chama onConfirm (A/Start) ou onBack (B/Select) no primeiro aperto
// — só uma vez, pra dois apertos rápidos não trocarem de tela duas vezes.
// Os ouvintes somem sozinhos quando a cena fecha; o retorno remove antes.
export function onPadMenu(scene, { onConfirm, onBack }) {
  const gamepad = scene.input.gamepad;
  if (!gamepad) return () => {};
  const listener = (pad, button) => {
    let handler = null;
    if (button.index === PAD.A || button.index === PAD.START) handler = onConfirm;
    else if (button.index === PAD.B || button.index === PAD.SELECT) handler = onBack;
    if (!handler) return;
    gamepad.off('down', listener);
    handler();
  };
  gamepad.on('down', listener);
  return () => gamepad.off('down', listener);
}
