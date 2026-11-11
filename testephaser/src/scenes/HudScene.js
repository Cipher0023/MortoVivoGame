import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { isTouchEnabled } from './TouchControlsScene.js';
import { createButton, createSmallButton } from '../ui/Button.js';
import { addFullscreenButton } from '../ui/fullscreen.js';
import { addSoundButton } from '../ui/soundButton.js';
import { onPadMenu } from '../input/gamepad.js';
import { playSfx } from '../audio/sfx.js';
import { isGameMode, scanSceneKey } from '../config/mode.js';
import { speak } from '../ui/speech.js';
import { PALETTE, CSS, titleStyle, textStyle, drawPaperPanel } from '../ui/theme.js';

const KEYBOARD_HINT =
  'Setas/WASD: mover | Espaço: pular | Q: trocar | F: parceiro esperar/seguir | E: interagir/empurrar/puxar | C: cabeça | R (segurar/soltar): braço/chute | W/S: escada | M: som | Esc: sair';
// botões no layout Xbox (no PlayStation: A = ✕, B = ○, X = □, Y = △)
const GAMEPAD_HINT =
  'Controle — analógico/direcional: mover e escada | A: pular | X: ação | B ou RT (segurar/soltar): braço/chute | Y: trocar | LB: esperar/seguir | RB: cabeça | Select: sair';

// HUD fixo de tela, em cena própria por cima da fase: assim o zoom/scroll da
// câmera do jogo não desloca nem amplia os textos (setScrollFactor(0) não
// protege contra zoom). A fase só chama setKey()/showLevelComplete().
export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    const touch = isTouchEnabled(this.game);
    // no celular a tela de 1920px é reduzida ~3x: textos precisam ser maiores
    const fontSize = touch ? 30 : 18;

    // ícone da chave (canto de cima, à esquerda): só aparece com a chave
    this.keyBadge = this.createKeyBadge(touch ? 1 : 0.7);
    this.hasKey = false;

    const play = this.scene.get('Play');
    // fase aberta pelo "Testar" do editor: sair volta pro editor
    this.isEditorTest = Boolean(play.returnTo);
    const exitLabel = this.isEditorTest ? 'Voltar ao editor' : isGameMode() ? 'Menu' : 'Livro';
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
        ...textStyle(17),
        backgroundColor: `${CSS.papel}dd`,
        padding: { x: 10, y: 4 },
      });
      const gamepad = this.input.gamepad;
      if (gamepad?.total > 0) hint.setText(GAMEPAD_HINT);
      gamepad?.on('connected', () => hint.setText(GAMEPAD_HINT));
      gamepad?.on('disconnected', () => hint.setText(gamepad.total > 0 ? GAMEPAD_HINT : KEYBOARD_HINT));
    }
  }

  // Selo de papel redondo com uma chave dourada desenhada.
  createKeyBadge(scale) {
    const r = 56;
    const g = this.add.graphics();
    g.fillStyle(PALETTE.espresso, 1).fillCircle(0, 6, r);
    g.fillStyle(PALETTE.papel, 1).fillCircle(0, 0, r);
    g.lineStyle(5, PALETTE.espresso, 1).strokeCircle(0, 0, r);
    // chave deitada: argola à esquerda, haste e dois dentes
    const gold = 0xe2b33c;
    g.fillStyle(PALETTE.espresso, 1);
    g.fillCircle(-20, 0, 20);
    g.fillRect(-6, -8, 46, 16);
    g.fillRect(22, 0, 9, 22);
    g.fillRect(34, 0, 8, 17);
    g.fillStyle(gold, 1);
    g.fillCircle(-20, 0, 15);
    g.fillRect(-4, -4, 42, 8);
    g.fillRect(25, 0, 4, 18);
    g.fillRect(36, 0, 4, 13);
    g.fillStyle(PALETTE.papel, 1).fillCircle(-20, 0, 6);
    const badge = this.add.container(28 + r * scale, 28 + r * scale, [g]).setScale(scale);
    badge.baseScale = scale;
    badge.setVisible(false);
    return badge;
  }

  // Mostra/esconde a chave; ao pegar, o selo "pula" na tela.
  setKey(hasKey) {
    if (hasKey === this.hasKey) return;
    this.hasKey = hasKey;
    const badge = this.keyBadge;
    this.tweens.killTweensOf(badge);
    badge.setVisible(hasKey);
    if (!hasKey) return;
    badge.setScale(badge.baseScale * 1.6);
    this.tweens.add({ targets: badge, scale: badge.baseScale, duration: 350, ease: 'Back.Out' });
  }

  showLevelComplete() {
    // cartão de papel no meio da tela, com o título e o botão
    const panelWidth = 980;
    const panelHeight = 440;
    const panel = this.add.graphics();
    drawPaperPanel(panel, (GAME_WIDTH - panelWidth) / 2, GAME_HEIGHT / 2 - 230, panelWidth, panelHeight, 36, {
      shadow: 12,
      lineWidth: 6,
    });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 110, 'FASE CONCLUÍDA!', titleStyle(96, CSS.folha))
      .setOrigin(0.5);
    const play = this.scene.get('Play');
    // direto pra câmera (o tutorial já foi visto): escanear a próxima fase do
    // livro; no teste do editor, volta pro editor
    const [label, next, width] = this.isEditorTest
      ? ['VOLTAR AO EDITOR', () => play.exitLevel(), 620]
      : isGameMode()
        ? ['PRÓXIMA FASE', () => play.leaveTo('Scan'), 460]
        : ['ESCANEAR OUTRA PÁGINA', () => play.leaveTo(scanSceneKey()), 820];
    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, label, next, { width });
    if (!this.isEditorTest && !isGameMode()) {
      const number = play.phase?.number;
      speak(
        number
          ? `Fase concluída! Muito bem! Agora procure a Fase ${number + 1} no livro.`
          : 'Fase concluída! Muito bem! Escaneie outra página do livro.'
      );
    }
    // controle: A confirma o botão
    onPadMenu(this, {
      onConfirm: () => {
        playSfx(this, 'confirm');
        next();
      },
    });
  }
}
