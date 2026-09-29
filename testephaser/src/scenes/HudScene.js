import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { isTouchEnabled } from './TouchControlsScene.js';
import { createButton, createSmallButton } from '../ui/Button.js';
import { addFullscreenButton } from '../ui/fullscreen.js';
import { addSoundButton } from '../ui/soundButton.js';
import { onPadMenu } from '../input/gamepad.js';
import { playSfx } from '../audio/sfx.js';

const KEYBOARD_HINT =
  'Setas/WASD: mover | Espaço: pular | Q: trocar | F: parceiro esperar/seguir | E: interagir/empurrar/puxar | C: cabeça | R (segurar/soltar): braço | W/S: escada | M: som | Esc: sair';
// botões no layout Xbox (no PlayStation: A = ✕, B = ○, X = □, Y = △)
const GAMEPAD_HINT =
  'Controle — analógico/direcional: mover e escada | A: pular | X: ação | B ou RT (segurar/soltar): braço | Y: trocar | LB: esperar/seguir | RB: cabeça | Select: sair';

// HUD fixo de tela, em cena própria por cima da fase: assim o zoom/scroll da
// câmera do jogo não desloca nem amplia os textos (setScrollFactor(0) não
// protege contra zoom). A fase só chama setStatus()/showLevelComplete().
export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    const touch = isTouchEnabled(this.game);
    // no celular a tela de 1920px é reduzida ~3x: textos precisam ser maiores
    const fontSize = touch ? 30 : 18;

    this.statusText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 8 },
    });

    const play = this.scene.get('Play');
    // fase aberta pelo "Testar" do editor: sair volta pro editor
    this.isEditorTest = Boolean(play.returnTo);
    const exitLabel = this.isEditorTest ? 'Voltar ao editor' : 'Menu';
    const exitButton = createSmallButton(this, GAME_WIDTH - 16, 16, exitLabel, fontSize, () => play.exitLevel());
    let rightX = GAME_WIDTH - 16 - exitButton.width - 12;
    const fullscreenButton = addFullscreenButton(this, rightX, 16, fontSize);
    if (fullscreenButton) rightX -= fullscreenButton.width + 12;
    const soundButton = addSoundButton(this, rightX, 16, fontSize);
    // M: liga/desliga o som (mesmo efeito do botão)
    this.input.keyboard.on('keydown-M', () => soundButton.emit('pointerup'));

    // no touch, a dica de teclado ficaria embaixo do joystick/botões; com
    // um controle conectado, a dica mostra os botões dele
    if (!touch) {
      const hint = this.add.text(16, GAME_HEIGHT - 44, KEYBOARD_HINT, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
      });
      const gamepad = this.input.gamepad;
      if (gamepad?.total > 0) hint.setText(GAMEPAD_HINT);
      gamepad?.on('connected', () => hint.setText(GAMEPAD_HINT));
      gamepad?.on('disconnected', () => hint.setText(gamepad.total > 0 ? GAMEPAD_HINT : KEYBOARD_HINT));
    }
  }

  setStatus(text) {
    this.statusText.setText(text);
  }

  showLevelComplete() {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'Fase concluída!', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#33ff88',
        backgroundColor: '#00000099',
        padding: { x: 28, y: 18 },
      })
      .setOrigin(0.5);
    const play = this.scene.get('Play');
    // direto pra câmera (o tutorial já foi visto): escanear a próxima fase do
    // livro; no teste do editor, volta pro editor
    const [label, next] = this.isEditorTest
      ? ['VOLTAR AO EDITOR', () => play.exitLevel()]
      : ['PRÓXIMA FASE', () => play.leaveTo('Scan')];
    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, label, next, { width: this.isEditorTest ? 620 : 460 });
    // controle: A confirma o botão
    onPadMenu(this, {
      onConfirm: () => {
        playSfx(this, 'confirm');
        next();
      },
    });
  }
}
