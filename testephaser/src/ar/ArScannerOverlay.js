import { PHASES } from '../config/phases.js';
import { symbolSvg } from '../config/symbols.js';
import { speak, canSpeak } from '../ui/speech.js';
import { targetsUrl, targets, scenes, animations } from './arContent.js';
import { isUnlocked, markFound } from '../config/progress.js';
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
    this.pages = null;
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
    // Tocar na tela (fora dos botões) dispensa os personagens e volta a
    // procurar página. Eles não somem sozinhos quando a página sai da tela.
    this.root.addEventListener('click', (event) => {
      if (!event.target.closest('button')) this.dismiss();
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
      this.pages = targets.map((target, index) => this.buildTarget(target, index, frames));

      // O MindAR engole o erro da câmera (rejeita sem dizer o motivo): guarda
      // o erro de verdade para mostrar a mensagem certa.
      const media = navigator.mediaDevices;
      const getUserMedia = media.getUserMedia;
      media.getUserMedia = (...args) =>
        getUserMedia.apply(media, args).catch((cameraError) => {
          this.cameraError = cameraError;
          throw cameraError;
        });
      try {
        await this.mindar.start();
      } finally {
        media.getUserMedia = getUserMedia;
      }
      if (this.closed) {
        this.stopAr();
        return;
      }

      const { renderer, scene, camera } = this.mindar;
      const { updateHolder } = this.actorsModule;
      let last = performance.now();
      renderer.setAnimationLoop((now) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        for (const page of this.pages) {
          updateHolder(page.holder, page.anchor, dt);
          for (const actor of page.actors) actor.update(dt);
        }
        renderer.render(scene, camera);
      });
    } catch (error) {
      const cause = this.cameraError ?? error;
      console.error(cause);
      if (this.closed) return;
      this.stopAr();
      const permission = await navigator.permissions?.query({ name: 'camera' }).catch(() => null);
      this.fail(cameraErrorMessage(cause, permission?.state));
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

    const { buildActor, createHolder, pageBorder } = this.actorsModule;
    const holder = createHolder(this.mindar.scene);
    if (DEBUG) holder.group.add(pageBorder(target.height ?? 1));

    anchor.onTargetFound = () => {
      clearTimeout(this.hintTimer);
      this.root.classList.remove('needs-help');
      // outra página na câmera: os personagens da anterior saem
      for (const page of this.pages) if (page.holder !== holder) page.holder.shown = false;
      // só "salta" do papel na 1ª vez; reencontrar a página não reinicia
      if (!holder.shown) appear.at = performance.now();
      holder.shown = true;
      if (!phase) return;
      markFound(phase.number);
      const unlocked = isUnlocked(phase);
      if (this.foundPhase !== phase) {
        this.onSound?.('scanOk');
        if (unlocked) {
          this.say(`Você achou a ${phase.title}! Toque em Jogar.`, { status: `Você achou a ${phase.title}!` });
        } else {
          // fase de mais adiante: fica "encontrada", mas só abre depois da anterior
          this.say(
            `Você achou uma fase escondida! Termine a Fase ${phase.number - 1} para jogar.`,
            { status: `Fase escondida! Termine a Fase ${phase.number - 1} para jogar.` }
          );
        }
      }
      this.foundPhase = phase;
      this.playButton.textContent = `▶ Jogar a ${phase.title}`;
      this.playButton.hidden = !unlocked;
    };
    // a página saiu da tela: personagens e botão de jogar ficam (tremer a
    // mão não pode tirar a fase da criança); só somem com toque na tela ou X

    const configs = scenes[`fase${target.phase}`] ?? [];
    const actors = configs
      .filter((config) => frames[config.animacao])
      .map((config) => buildActor(config, frames[config.animacao], holder, this.mindar.camera, appear));
    return { anchor, holder, actors };
  }

  // Toque na tela: tira os personagens e o botão de jogar, volta a procurar.
  dismiss() {
    if (!this.foundPhase || !this.pages) return;
    for (const page of this.pages) page.holder.shown = false;
    this.foundPhase = null;
    this.playButton.hidden = true;
    this.onSound?.('back');
    this.say(SAY_POINT);
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

// Mensagem curta para cada motivo de a câmera não abrir. O código do erro vai
// entre parênteses: ajuda quem for dar suporte a entender o que houve.
function cameraErrorMessage(error, permissionState) {
  const name = error?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || permissionState === 'denied') {
    return 'O navegador não deixou usar a câmera. Libere a câmera nas configurações do navegador.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'A câmera está sendo usada por outro app ou outra aba. Feche e tente de novo.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Não encontramos uma câmera neste aparelho.';
  }
  return `Não deu para abrir a câmera neste aparelho (${name || error?.message || 'erro desconhecido'}).`;
}
