import jsQR from 'jsqr';
import './qr-scanner.css';

// Leitor de QR code pela câmera: camada HTML por cima do jogo (vídeo da
// câmera + moldura + botões), decodificando os quadros com jsQR. Fica fora
// do Phaser porque um <video> no DOM é bem mais simples e leve do que
// jogar a câmera dentro do canvas.
//
// Sempre oferece "Digitar código" — pra câmera negada, sem câmera ou fora de
// HTTPS (navegador só libera câmera em HTTPS ou localhost).

// Decodifica numa cópia reduzida do quadro: QR impresso lê bem assim e o
// celular não esquenta processando vídeo em resolução cheia.
const DECODE_MAX_WIDTH = 640;
const DECODE_INTERVAL_MS = 120;

export default class QrScannerOverlay {
  // onScan(texto) deve retornar true se aceitou o código (fecha o leitor) ou
  // uma mensagem de erro (string) pra mostrar e continuar lendo.
  // onSound(id): toca o som de um botão do próprio leitor (ver audio/sfx.js).
  constructor({ onScan, onCancel, onSound }) {
    this.onScan = onScan;
    this.onCancel = onCancel;
    this.onSound = onSound;
    this.stream = null;
    this.frameRequest = null;
    this.lastDecode = 0;
    this.buildDom();
  }

  buildDom() {
    this.root = document.createElement('div');
    this.root.className = 'qr-overlay';
    this.root.innerHTML = `
      <video class="qr-video" playsinline muted></video>
      <div class="qr-frame"><span></span><span></span><span></span><span></span></div>
      <div class="qr-top">
        <p class="qr-title">Aponte a câmera para o QR code da fase</p>
        <p class="qr-message" role="status"></p>
      </div>
      <form class="qr-manual" hidden>
        <input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
               placeholder="Ex.: MORTOVIVO-FASE1-XXXX" aria-label="Código da fase" />
        <button type="submit">Entrar</button>
      </form>
      <div class="qr-actions">
        <button type="button" data-action="cancel">Voltar</button>
        <button type="button" data-action="manual">Digitar código</button>
      </div>
    `;
    this.video = this.root.querySelector('.qr-video');
    this.message = this.root.querySelector('.qr-message');
    this.manualForm = this.root.querySelector('.qr-manual');
    this.manualInput = this.manualForm.querySelector('input');
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });

    this.root.querySelector('[data-action="cancel"]').addEventListener('click', () => this.onCancel());
    this.root.querySelector('[data-action="manual"]').addEventListener('click', () => {
      this.onSound?.('click');
      this.showManualEntry();
    });
    this.manualForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleText(this.manualInput.value);
    });
    // o body tem touch-action: none (pro jogo); o formulário precisa de toque normal
    this.root.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
  }

  async open() {
    document.body.appendChild(this.root);
    // Escanear com o celular em pé é natural: libera a vertical enquanto o
    // leitor está aberto (ver .qr-scanning no qr-scanner.css).
    document.body.classList.add('qr-scanning');

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.showError('A câmera só funciona com o site em HTTPS. Digite o código que aparece abaixo do QR code.');
      this.showManualEntry();
      return;
    }

    try {
      // câmera traseira quando existir (a da frente não foca no livro)
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (error) {
      const denied = error.name === 'NotAllowedError' || error.name === 'SecurityError';
      this.showError(
        denied
          ? 'Sem permissão para usar a câmera. Libere o acesso nas configurações do navegador ou digite o código.'
          : 'Não encontramos uma câmera neste aparelho. Digite o código que aparece abaixo do QR code.'
      );
      this.showManualEntry();
      return;
    }

    // fechado enquanto o navegador pedia permissão
    if (!this.root.isConnected) {
      this.stopCamera();
      return;
    }
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    this.scanLoop();
  }

  scanLoop = (now = 0) => {
    this.frameRequest = requestAnimationFrame(this.scanLoop);
    if (now - this.lastDecode < DECODE_INTERVAL_MS) return;
    if (this.video.readyState < this.video.HAVE_ENOUGH_DATA) return;
    this.lastDecode = now;

    const scale = Math.min(1, DECODE_MAX_WIDTH / this.video.videoWidth);
    const width = Math.round(this.video.videoWidth * scale);
    const height = Math.round(this.video.videoHeight * scale);
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.drawImage(this.video, 0, 0, width, height);
    const image = this.context.getImageData(0, 0, width, height);
    const result = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
    if (result?.data) this.handleText(result.data);
  };

  handleText(text) {
    const outcome = this.onScan(text);
    if (outcome === true) return;
    this.showError(outcome);
  }

  showManualEntry() {
    this.manualForm.hidden = false;
    this.manualInput.focus();
  }

  showError(text) {
    this.message.textContent = text;
    this.message.classList.add('is-error');
  }

  stopCamera() {
    cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  close() {
    this.stopCamera();
    this.root.remove();
    document.body.classList.remove('qr-scanning');
  }
}
