import { isMuted } from '../audio/sfx.js';

// Narração das instruções em voz alta (voz do próprio aparelho, em pt-BR).
// Ajuda quem ainda não lê e quem tem baixa visão. Segue o botão de som: com o
// som desligado, não fala. Os navegadores só deixam falar depois do primeiro
// toque na página, por isso a 1ª fala vem depois do "Começar".

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voice = null;

function pickVoice() {
  const voices = synth?.getVoices() ?? [];
  voice = voices.find((v) => v.lang === 'pt-BR') ?? voices.find((v) => v.lang?.startsWith('pt')) ?? null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export function canSpeak() {
  return Boolean(synth);
}

// Fala `text`, interrompendo a fala anterior.
export function speak(text) {
  if (!synth || isMuted() || !text) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  synth.speak(utterance);
}

export function stopSpeaking() {
  synth?.cancel();
}
