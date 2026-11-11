import { findPhaseBySymbols } from '../config/phases.js';
import { SYMBOLS, SYMBOL_IDS, symbolSvg } from '../config/symbols.js';
import { speak, canSpeak } from '../ui/speech.js';
import './ar.css';

// Código de desenhos: a entrada de quem não consegue usar a câmera. Cada
// página tem 3 desenhos impressos num canto; a criança toca nos mesmos 3, na
// ordem, e a fase da página abre. Botões grandes, sem precisar ler, com o
// nome de cada desenho falado ao tocar.

const SAY_HOW = 'Procure os três desenhos no canto da página. Toque nos mesmos desenhos, na mesma ordem.';
const CODE_LENGTH = 3;

const LISTEN_ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

export default class SymbolCodeOverlay {
  // onPhase(fase): os desenhos batem com uma página.
  // onBack(): voltar para a câmera.
  // onSound(id): som de interface (ver audio/sfx.js).
  constructor({ onPhase, onBack, onSound }) {
    this.onPhase = onPhase;
    this.onBack = onBack;
    this.onSound = onSound;
    this.picked = [];
    this.locked = false;
    this.buildDom();
  }

  buildDom() {
    this.root = document.createElement('div');
    this.root.className = 'sym-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Código de desenhos');
    this.root.innerHTML = `
      <div class="ar-top">
        <button type="button" class="ar-round" data-action="back" aria-label="Voltar para a câmera">✕</button>
        <p class="ar-status sym-title" role="status" aria-live="polite">Toque nos 3 desenhos do canto da página</p>
        <button type="button" class="ar-round" data-action="listen" aria-label="Ouvir de novo">${LISTEN_ICON}</button>
      </div>
      <div class="sym-slots" aria-label="Desenhos escolhidos">
        ${'<span class="sym-slot"></span>'.repeat(CODE_LENGTH)}
      </div>
      <div class="sym-grid">
        ${SYMBOL_IDS.map(
          (id) =>
            `<button type="button" class="sym-key" data-symbol="${id}" aria-label="${SYMBOLS[id].name}">` +
            `${symbolSvg(id)}<span>${SYMBOLS[id].name}</span></button>`
        ).join('')}
      </div>
      <div class="sym-actions">
        <button type="button" data-action="erase">⌫ Apagar</button>
      </div>
    `;
    this.slots = [...this.root.querySelectorAll('.sym-slot')];
    this.status = this.root.querySelector('.sym-title');

    const listen = this.root.querySelector('[data-action="listen"]');
    if (!canSpeak()) listen.hidden = true;
    listen.addEventListener('click', () => speak(SAY_HOW));
    this.root.querySelector('[data-action="back"]').addEventListener('click', () => this.onBack());
    this.root.querySelector('[data-action="erase"]').addEventListener('click', () => this.erase());
    for (const key of this.root.querySelectorAll('.sym-key')) {
      key.addEventListener('click', () => this.pick(key.dataset.symbol));
    }
    this.root.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
  }

  open() {
    document.body.appendChild(this.root);
    speak(SAY_HOW);
    this.root.querySelector('.sym-key')?.focus();
  }

  pick(id) {
    if (this.locked || this.picked.length >= CODE_LENGTH) return;
    this.onSound?.('click');
    this.picked.push(id);
    this.render();
    if (this.picked.length < CODE_LENGTH) {
      speak(SYMBOLS[id].name);
      return;
    }

    const phase = findPhaseBySymbols(this.picked);
    if (phase) {
      this.locked = true;
      this.root.classList.add('is-right');
      speak(`${SYMBOLS[id].name}. Você achou a ${phase.title}!`);
      this.status.textContent = `Você achou a ${phase.title}!`;
      setTimeout(() => this.onPhase(phase), 700);
      return;
    }

    this.locked = true;
    this.onSound?.('error');
    this.root.classList.add('is-wrong');
    speak('Esses desenhos não são de uma página do livro. Tente de novo.');
    this.status.textContent = 'Não é esse. Tente de novo!';
    setTimeout(() => {
      this.root.classList.remove('is-wrong');
      this.picked = [];
      this.locked = false;
      this.render();
    }, 1200);
  }

  erase() {
    if (this.locked || this.picked.length === 0) return;
    this.onSound?.('back');
    this.picked.pop();
    this.render();
  }

  render() {
    this.slots.forEach((slot, i) => {
      const id = this.picked[i];
      slot.innerHTML = id ? symbolSvg(id) : '';
      slot.classList.toggle('is-filled', Boolean(id));
    });
  }

  close() {
    this.root.remove();
  }
}
