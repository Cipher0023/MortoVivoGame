import Phaser from 'phaser';

// Orientação e encaixe da tela no celular.
//
// Aviso de girar (#rotate-hint, index.html): só a partir do JOGAR. O menu
// principal funciona em pé ou deitado; ao sair dele (MainMenuScene) o jogo
// passa a pedir a horizontal. Com o aviso na tela, o jogo pausa, pra ninguém
// morrer enquanto gira o aparelho. Com o leitor de QR aberto não há aviso
// (a câmera funciona em pé).
//
// Encaixe: ao girar, o navegador avisa antes de a tela ter o tamanho novo, e
// o Phaser encaixava o canvas com as medidas velhas (jogo fora de proporção
// até recarregar). Por isso o encaixe é refeito algumas vezes nos instantes
// seguintes, até as medidas assentarem — inclusive com o jogo pausado.

const portrait = window.matchMedia('(orientation: portrait)');
// ms depois da mudança em que o encaixe é refeito
const REFIT_DELAYS = [0, 50, 150, 300, 600, 1000];

let game = null;
let landscapeRequired = false;
let refitTimers = [];

export function setLandscapeRequired(required) {
  landscapeRequired = required;
  document.body.classList.toggle('landscape-required', required);
  syncPause();
}

function isHintVisible() {
  return landscapeRequired && portrait.matches && !document.body.classList.contains('qr-scanning');
}

function syncPause() {
  if (!game) return;
  const shouldPause = isHintVisible();
  if (shouldPause && !game.isPaused) game.pause();
  else if (!shouldPause && game.isPaused) game.resume();
}

function refit() {
  const scale = game.scale;
  scale.getParentBounds();
  scale.refresh();
}

function refitSoon() {
  for (const timer of refitTimers) clearTimeout(timer);
  refitTimers = REFIT_DELAYS.map((ms) => setTimeout(refit, ms));
  syncPause();
}

export function initOrientation(phaserGame) {
  game = phaserGame;
  portrait.addEventListener('change', refitSoon);
  window.addEventListener('resize', refitSoon);
  window.addEventListener('orientationchange', refitSoon);
  window.screen.orientation?.addEventListener?.('change', refitSoon);
  // barra de endereços aparecendo/sumindo muda a área visível sem girar
  window.visualViewport?.addEventListener('resize', refitSoon);
  document.addEventListener('fullscreenchange', refitSoon);
  // o leitor de QR abre/fecha e as cenas trocam sem evento de tela: confere
  // a cada quadro (barato; pausado não roda, mas aí quem destrava é o giro)
  game.events.on(Phaser.Core.Events.PRE_STEP, syncPause);
  game.events.once(Phaser.Core.Events.READY, refitSoon);
}
