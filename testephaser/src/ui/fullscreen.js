import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { createSmallButton } from './Button.js';
import { playSfx } from '../audio/sfx.js';

function isInstalledApp() {
  return (
    window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// Botão "Tela cheia" (menu e HUD). Retorna o botão, ou null quando o jogo
// foi aberto pela tela de início (PWA) — aí já roda sem barra.
// (display-mode também casa com a tela cheia ligada pelo próprio botão, e as
// cenas são recriadas — por isso o isFullscreen.)
export function addFullscreenButton(scene, rightX, y, fontSize) {
  if (isInstalledApp() && !scene.scale.isFullscreen) return null;

  const label = () => (scene.scale.isFullscreen ? 'Sair tela cheia' : 'Tela cheia');
  const button = createSmallButton(scene, rightX, y, label(), fontSize, () => toggleFullscreen(scene));
  const refresh = () => button.setText(label());
  scene.scale.on('enterfullscreen', refresh);
  scene.scale.on('leavefullscreen', refresh);
  scene.events.once('shutdown', () => {
    scene.scale.off('enterfullscreen', refresh);
    scene.scale.off('leavefullscreen', refresh);
    // a cena pode reiniciar (ex.: HUD a cada morte): não guardar objeto destruído
    scene.installHint = null;
  });
  return button;
}

function toggleFullscreen(scene) {
  // Safari do iPhone não tem API de fullscreen: ensina o caminho que existe.
  if (!scene.sys.game.device.fullscreen.available) {
    toggleInstallHint(scene);
    return;
  }
  if (scene.scale.isFullscreen) {
    scene.scale.stopFullscreen();
    return;
  }
  // Tem que ser chamado dentro de um evento de toque/clique (pointerup),
  // senão o navegador bloqueia.
  scene.scale.startFullscreen();
  // Trava em paisagem onde o navegador deixa (Android/Chrome); ignora o resto.
  window.screen.orientation?.lock?.('landscape').catch(() => {});
}

function toggleInstallHint(scene) {
  if (scene.installHint) {
    scene.installHint.destroy();
    scene.installHint = null;
    return;
  }
  scene.installHint = scene.add
    .text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      'Tela cheia no iPhone:\n\n1. Toque em Compartilhar (quadrado com seta)\n2. Escolha "Adicionar à Tela de Início"\n3. Abra o jogo pelo ícone criado\n\n(toque para fechar)',
      {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#000000dd',
        padding: { x: 48, y: 36 },
      }
    )
    .setOrigin(0.5)
    .setDepth(1000)
    .setInteractive()
    .on('pointerup', () => {
      playSfx(scene, 'back');
      toggleInstallHint(scene);
    });
}
