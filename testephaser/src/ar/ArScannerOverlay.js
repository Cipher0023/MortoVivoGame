import { PHASES } from '../config/phases.js';
import { symbolSvg } from '../config/symbols.js';
import { speak, canSpeak } from '../ui/speech.js';
import { targetsUrl, targets, scenes, animations } from './arContent.js';
import './ar.css';

// Câmera de realidade aumentada (MindAR + three.js): camada HTML por cima do
// jogo, como o leitor de QR. Reconhece a página do livro, mostra os
// personagens animados sobre ela e oferece o botão de jogar a fase daquela
// página. O MindAR (src/vendor/mind-ar, MIT), o three.js e os personagens
// (actors.js) só são baixados quando a câmera abre, para não pesar no início.
//
// Sempre oferece a saída "Não consegue? Use os desenhos" (SymbolCodeOverlay):
// sem câmera, sem permissão, aparelho fraco, pouca luz ou dificuldade motora.
//
// ?debug=1 desenha a borda da página reconhecida (pra ver se o encaixe treme).

const DEBUG = new URLSearchParams(window.location.search).has('debug');
// sem achar página nesse tempo, dá dicas e destaca a alternativa
const HINT_AFTER_MS = 20000;

const SAY_POINT = 'Aponte a câmera para uma página do livro.';

const LISTEN_ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

export default class ArScannerOverlay {
  // onPlay(fase): a criança tocou em "Jogar" (quem chamou fecha a câmera).
  // onHelp(): tocou em "Não consegue?" (abre o código de desenhos).
  // onBack(): tocou em "Voltar".
  // onSound(id): som de interface (ver audio/sfx.js).
  constructor({ onPlay, onHelp, onBack, onSound }) {
    this.onPlay = onPlay;
    this.onHelp = onHelp;
    this.onBack = onBack;
    this.onSound = onSound;
    this.mindar = null;
    this.closed = false;
    this.hintTimer = null;
    this.lastSpoken = SAY_POINT;
    this.buildDom();
  }

  buildDom() {
    // só enfeite do botão: três desenhos que não são o código de nenhuma página
    const helpIcons = ['flor', 'gota', 'estrela'].map((id) => symbolSvg(id, 28)).join('');
    this.root = document.createElement('div');
    this.root.className = 'ar-overlay';
    this.root.innerHTML = `
      <div class="ar-view"></div>
      <div class="ar-top">
        <button type="button" class="ar-round" data-action="back" aria-label="Voltar">✕</button>
        <p class="ar-status" role="status" aria-live="polite">Preparando a câmera…</p>
        <button type="button" class="ar-round" data-action="listen" aria-label="Ouvir de novo">${LISTEN_ICON}</button>
      </div>
      <div class="ar-bottom">
        <button type="button" class="ar-play" data-action="play" hidden></button>
        <button type="button" class="ar-help" data-action="help">
          <span class="ar-help-icons" aria-hidden="true">${helpIcons}</span>
          <span>Não consegue? Use os desenhos</span>
        </button>
      </div>
    `;
    this.view = this.root.querySelector('.ar-view');
    this.status = this.root.querySelector('.ar-status');
    this.playButton = this.root.querySelector('.ar-play');
    this.helpButton = this.root.querySelector('.ar-help');

    const listen = this.root.querySelector('[data-action="listen"]');
    if (!canSpeak()) listen.hidden = true;
    listen.addEventListener('click', () => speak(this.lastSpoken));
    this.root.querySelector('[data-action="back"]').addEventListener('click', () => this.onBack());
    this.helpButton.addEventListener('click', () => {
      this.onSound?.('click');
      this.onHelp();
    });
    this.playButton.addEventListener('click', () => {
      if (this.foundPhase) this.onPlay(this.foundPhase);
    });
    // o body tem touch-action: none (pro jogo); os botões precisam de toque normal
    this.root.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
  }

  say(text, { status = text } = {}) {
    this.status.textContent = status;
    this.lastSpoken = text;
    speak(text);
  }

  async open() {
    document.body.appendChild(this.root);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail('A câmera só funciona com o site em HTTPS.');
      return;
    }

    // Tudo que pode falhar (baixar o MindAR, os quadros, abrir a câmera) cai
    // no mesmo aviso, que oferece os desenhos — nunca uma tela parada.
    try {
      const [{ MindARThree }, actorsModule] = await Promise.all([
        import('../vendor/mind-ar/mindar-image-three.prod.js'),
        import('./actors.js'),
      ]);
      this.actorsModule = actorsModule;
      const frames = await actorsModule.loadAnimations(scenes, animations);
      if (this.closed) return;

      this.mindar = new MindARThree({
        container: this.view,
        imageTargetSrc: targetsUrl,
        maxTrack: 1,
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no',
        // filtro mais forte: menos tremor, um pouco mais de atraso
        filterMinCF: 0.0001,
        filterBeta: 0.001,
      });
      const actors = targets.flatMap((target, index) => this.buildTarget(target, index, frames));

      await this.mindar.start();
      if (this.closed) {
        this.stopAr();
        return;
      }

      const { renderer, scene, camera } = this.mindar;
      let last = performance.now();
      renderer.setAnimationLoop((now) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        for (const actor of actors) actor.update(dt);
        renderer.render(scene, camera);
      });
    } catch (error) {
      console.error(error);
      if (this.closed) return;
      this.stopAr();
      // o MindAR engole o erro da câmera (rejeita sem motivo): pergunta ao
      // navegador se a permissão foi negada
      const permission = await navigator.permissions?.query({ name: 'camera' }).catch(() => null);
      const denied =
        error?.name === 'NotAllowedError' || error?.name === 'SecurityError' || permission?.state === 'denied';
      const missing = error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError';
      this.fail(
        denied
          ? 'O navegador não deixou usar a câmera.'
          : missing
            ? 'Não encontramos uma câmera neste aparelho.'
            : 'Não deu para abrir a câmera neste aparelho.'
      );
      return;
    }

    this.say(SAY_POINT);
    this.hintTimer = setTimeout(() => this.showHint(), HINT_AFTER_MS);
  }

  // Liga a página `index` do targets.mind à sua fase e às animações dela.
  buildTarget(target, index, frames) {
    const phase = PHASES.find((p) => p.number === target.phase && p.level);
    const anchor = this.mindar.addAnchor(index);
    const appear = { at: 0 };

    const { buildActor, pageBorder } = this.actorsModule;
    if (DEBUG) anchor.group.add(pageBorder(target.height ?? 1));

    anchor.onTargetFound = () => {
      appear.at = performance.now();
      clearTimeout(this.hintTimer);
      this.root.classList.remove('needs-help');
      if (!phase) return;
      if (this.foundPhase !== phase) {
        this.onSound?.('scanOk');
        this.say(`Você achou a ${phase.title}! Toque em Jogar.`, { status: `Você achou a ${phase.title}!` });
      }
      this.foundPhase = phase;
      this.playButton.textContent = `▶ Jogar a ${phase.title}`;
      this.playButton.hidden = false;
    };
    // o botão de jogar fica: tremer a mão não pode tirar a fase da criança
    anchor.onTargetLost = () => {
      if (!this.foundPhase) this.status.textContent = SAY_POINT;
    };

    const configs = scenes[`fase${target.phase}`] ?? [];
    return configs
      .filter((config) => frames[config.animacao])
      .map((config) => buildActor(config, frames[config.animacao], anchor, this.mindar.camera, appear));
  }

  showHint() {
    if (this.closed || this.foundPhase) return;
    this.root.classList.add('needs-help');
    this.say(
      'Dica: acenda a luz, deixe o livro bem aberto e afaste um pouco o celular, para a página inteira aparecer. Se não conseguir, toque nos desenhos.',
      { status: 'Dica: mais luz e a página inteira na tela' }
    );
  }

  fail(message) {
    this.root.classList.add('is-error', 'needs-help');
    this.say(`${message} Toque no botão dos desenhos para jogar.`, { status: message });
  }

  stopAr() {
    const mindar = this.mindar;
    this.mindar = null;
    if (!mindar) return;
    try {
      mindar.renderer.setAnimationLoop(null);
      mindar.stop();
    } catch {
      // ainda não tinha começado
    }
    // solta a GPU: abrir e fechar a câmera várias vezes não pode acumular
    // contextos WebGL (o navegador tem limite)
    mindar.renderer.dispose();
    mindar.renderer.forceContextLoss();
    this.view.replaceChildren();
  }

  close() {
    this.closed = true;
    clearTimeout(this.hintTimer);
    this.stopAr();
    this.root.remove();
  }
}
