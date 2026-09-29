// Efeitos sonoros do jogo. Toda ação chama playSfx(scene, 'id').
//
// O som de cada id vem dos arquivos gravados em SOUND_MANIFEST
// (assetManifest.js). Pra trocar um som: substitua o .mp3 em
// public/assets/sounds/ ou mude a lista do id no manifesto.
//
// SFX abaixo é a reserva sintetizada (Web Audio): toca só se o id não tem
// arquivo ou se o arquivo não carregou — o jogo nunca fica mudo por isso.

import { SOUND_MANIFEST } from '../config/assetManifest.js';

const MASTER_VOLUME = 0.6;
// intervalo mínimo entre dois toques do mesmo som: várias células de porta
// abrindo juntas (ou pintar arrastando no editor) não empilham o volume
const DEFAULT_COOLDOWN_MS = 40;
const MUTE_STORAGE_KEY = 'mortovivo:mute';

// Camada de som: tom (wave + freq, com from/to pra deslizar) ou ruído
// (noise + filtro). at = atraso em segundos, dur = duração, vol = volume.
const tone = (wave, from, to, dur, vol, at = 0) => ({ wave, from, to, dur, vol, at });
const noise = (filterType, freq, dur, vol, at = 0, freqTo = freq) => ({ noise: true, filterType, freq, freqTo, dur, vol, at });
const notes = (wave, freqs, step, dur, vol) => freqs.map((f, i) => tone(wave, f, f, dur, vol, i * step));

export const SFX = {
  // interface
  tick: { layers: [tone('sine', 1200, 1200, 0.03, 0.06)] },
  click: { layers: [tone('square', 900, 1200, 0.05, 0.1)] },
  confirm: { layers: notes('square', [523, 784], 0.07, 0.1, 0.1) },
  back: { layers: [tone('square', 700, 400, 0.08, 0.1)] },
  select: { layers: [tone('sine', 1000, 1000, 0.05, 0.12)] },
  toggle: { layers: [tone('square', 700, 700, 0.04, 0.08), tone('square', 900, 900, 0.04, 0.08, 0.04)] },
  nope: { layers: [tone('triangle', 200, 150, 0.08, 0.15)] },
  error: { layers: [tone('square', 220, 180, 0.12, 0.1), tone('square', 180, 140, 0.15, 0.1, 0.1)], cooldown: 1500 },

  // leitor de QR
  scanOk: { layers: notes('sine', [880, 1320], 0.09, 0.12, 0.18) },
  comingSoon: { layers: notes('triangle', [523, 440, 392], 0.12, 0.16, 0.14) },

  // personagens
  jump: { layers: [tone('square', 300, 700, 0.12, 0.08)] },
  land: { layers: [noise('lowpass', 400, 0.08, 0.3)] },
  step: { layers: [noise('lowpass', 900, 0.04, 0.12)], cooldown: 0 },
  stepBone: { layers: [tone('square', 1400, 1100, 0.025, 0.04), noise('highpass', 3000, 0.02, 0.05)], cooldown: 0 },
  climb: { layers: [noise('bandpass', 1200, 0.05, 0.14)], cooldown: 0 },
  switch: { layers: [tone('sine', 440, 880, 0.1, 0.14), tone('sine', 880, 660, 0.08, 0.1, 0.08)] },
  wait: { layers: notes('triangle', [523, 392], 0.08, 0.1, 0.16) },
  follow: { layers: notes('triangle', [392, 523], 0.08, 0.1, 0.16) },
  thin: { layers: [tone('sine', 600, 1200, 0.15, 0.14)] },
  unthin: { layers: [tone('sine', 1200, 600, 0.15, 0.14)] },

  // mecanismos da fase
  lever: { layers: [noise('lowpass', 1500, 0.05, 0.2), tone('square', 180, 120, 0.1, 0.1, 0.03)] },
  pressButton: { layers: [tone('square', 400, 200, 0.08, 0.1), noise('lowpass', 800, 0.05, 0.15)] },
  gateOpen: { layers: [tone('sawtooth', 120, 60, 0.4, 0.08), noise('lowpass', 600, 0.4, 0.2)] },
  bridge: { layers: [tone('sawtooth', 150, 250, 0.3, 0.07), noise('lowpass', 700, 0.25, 0.12)] },
  ladderDrop: { layers: [noise('lowpass', 800, 0.25, 0.22), tone('triangle', 300, 120, 0.25, 0.12)] },
  reveal: { layers: notes('sine', [784, 988, 1175], 0.06, 0.12, 0.14) },
  key: { layers: [tone('square', 988, 988, 0.08, 0.1), tone('square', 1319, 1319, 0.25, 0.1, 0.08)] },
  unlock: { layers: [noise('highpass', 2500, 0.04, 0.15), tone('square', 1200, 900, 0.05, 0.06, 0.06)] },
  door: { layers: [tone('sawtooth', 90, 140, 0.35, 0.08), noise('lowpass', 500, 0.3, 0.2)] },
  push: { layers: [noise('lowpass', 300, 0.14, 0.2)], cooldown: 0 },

  // ataques
  stomp: { layers: [noise('lowpass', 500, 0.12, 0.35), tone('triangle', 220, 90, 0.12, 0.12)] },
  enemyStun: { layers: notes('triangle', [659, 587], 0.08, 0.12, 0.14) },
  enemyRecover: { layers: notes('triangle', [659, 698], 0.08, 0.12, 0.12) },
  enemyAlert: { layers: [tone('square', 880, 1320, 0.08, 0.08)] },
  dive: { layers: [noise('bandpass', 2000, 0.3, 0.2, 0, 500)] },
  pullUp: { layers: [noise('bandpass', 700, 0.25, 0.2, 0, 1400)] },
  bubbles: { layers: notes('sine', [600, 900, 750], 0.07, 0.05, 0.08), cooldown: 0 },
  aim: { layers: [noise('highpass', 3000, 0.08, 0.08)] },
  throw: { layers: [noise('bandpass', 1500, 0.18, 0.2, 0, 400)] },
  armHit: { layers: [noise('lowpass', 900, 0.08, 0.3), tone('triangle', 300, 150, 0.08, 0.1)] },
  armLand: { layers: [noise('bandpass', 1200, 0.05, 0.18)] },
  armPickup: { layers: [tone('sine', 500, 800, 0.08, 0.12)] },
  headGrab: { layers: [tone('sine', 450, 750, 0.08, 0.12)] },
  headDrop: { layers: [noise('bandpass', 900, 0.06, 0.2)] },
  collapse: { layers: [noise('bandpass', 1500, 0.3, 0.25), tone('triangle', 400, 120, 0.3, 0.1)] },
  reassemble: { layers: [tone('triangle', 200, 500, 0.25, 0.12)] },

  // morte / vitória
  splash: { layers: [noise('lowpass', 2500, 0.4, 0.35, 0, 300)] },
  hit: { layers: [tone('square', 200, 60, 0.2, 0.14), noise('lowpass', 1000, 0.12, 0.25)] },
  death: { layers: [tone('triangle', 440, 110, 0.35, 0.16)] },
  fall: { layers: [tone('sine', 800, 150, 0.4, 0.14)] },
  win: {
    layers: [...notes('square', [523, 659, 784], 0.1, 0.12, 0.09), tone('square', 1047, 1047, 0.4, 0.09, 0.3)],
  },

  // editor
  place: { layers: [tone('triangle', 500, 350, 0.05, 0.14)] },
  erase: { layers: [noise('bandpass', 2000, 0.06, 0.15), tone('square', 300, 150, 0.06, 0.06)] },
  pickup: { layers: [tone('sine', 500, 900, 0.08, 0.14)] },
  flip: { layers: [tone('triangle', 600, 900, 0.05, 0.12), tone('triangle', 900, 600, 0.05, 0.12, 0.05)] },
  undo: { layers: [tone('triangle', 700, 450, 0.08, 0.14)] },
  redo: { layers: [tone('triangle', 450, 700, 0.08, 0.14)] },
  save: { layers: notes('sine', [659, 988], 0.08, 0.12, 0.16) },
  load: { layers: notes('sine', [988, 659], 0.08, 0.12, 0.16) },
};

const RECORDED = new Map(SOUND_MANIFEST.map((sound) => [sound.id, sound]));

// chave do arquivo no cache de áudio do Phaser (a PreloadScene carrega)
export function sfxKey(id, variant) {
  return `sfx-${id}-${variant}`;
}

const lastPlayed = new Map();
let noiseBuffer = null;
// Estado próprio do mudo: o `mute` do Phaser lê o ganho do nó de áudio, que
// só atualiza depois que a thread de áudio processa (e nunca, com o áudio
// ainda bloqueado pelo navegador) — ler logo após escrever dá o valor antigo.
let muted = false;

export function playSfx(scene, id) {
  const def = SFX[id];
  const manager = scene.sys.game.sound;
  if (!def || muted) return;

  const now = performance.now();
  if (now - (lastPlayed.get(id) ?? -Infinity) < (def.cooldown ?? DEFAULT_COOLDOWN_MS)) return;
  lastPlayed.set(id, now);

  const play = () => {
    if (!playRecorded(scene, id)) synthesize(manager, def.layers);
  };

  const context = manager.context;
  if (!context) {
    // sem Web Audio (áudio HTML5): só toca o que tiver arquivo
    playRecorded(scene, id);
  } else if (context.state === 'running') {
    play();
  } else if (context.state === 'suspended') {
    // 1º toque da página: o navegador só libera o áudio dentro do gesto.
    // Se demorar pra liberar, descarta — senão o som sairia atrasado.
    context.resume().then(() => {
      if (performance.now() - now < 150) play();
    }, () => {});
  }
}

// Toca uma das variações gravadas do id (sorteada), com um leve desvio de
// tom. Retorna false se não há arquivo carregado pra ele.
function playRecorded(scene, id) {
  const sound = RECORDED.get(id);
  if (!sound) return false;
  const cache = scene.sys.game.cache.audio;
  const loaded = sound.files.map((_, i) => sfxKey(id, i)).filter((key) => cache.exists(key));
  if (loaded.length === 0) return false;

  const key = loaded[Math.floor(Math.random() * loaded.length)];
  const vary = sound.vary ?? 0;
  scene.sys.game.sound.play(key, {
    volume: (sound.volume ?? 1) * MASTER_VOLUME,
    rate: (sound.rate ?? 1) * (1 + (Math.random() * 2 - 1) * vary),
  });
  return true;
}

function synthesize(manager, layers) {
  const context = manager.context;
  if (!context) return;
  const start = context.currentTime;
  for (const layer of layers) {
    const t0 = start + layer.at;
    const t1 = t0 + layer.dur;

    // envelope: ataque rápido e decaimento exponencial (sem estalo no fim)
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(layer.vol * MASTER_VOLUME, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    // manager.destination respeita o mute/volume do Phaser
    gain.connect(manager.destination);

    let source;
    if (layer.noise) {
      source = context.createBufferSource();
      source.buffer = getNoiseBuffer(context);
      const filter = context.createBiquadFilter();
      filter.type = layer.filterType;
      filter.frequency.setValueAtTime(layer.freq, t0);
      if (layer.freqTo !== layer.freq) filter.frequency.exponentialRampToValueAtTime(layer.freqTo, t1);
      source.connect(filter).connect(gain);
    } else {
      source = context.createOscillator();
      source.type = layer.wave;
      source.frequency.setValueAtTime(layer.from, t0);
      if (layer.to !== layer.from) source.frequency.exponentialRampToValueAtTime(layer.to, t1);
      source.connect(gain);
    }
    source.start(t0);
    source.stop(t1 + 0.02);
    source.onended = () => gain.disconnect();
  }
}

// 1s de ruído branco, reaproveitado por todos os sons de ruído
function getNoiseBuffer(context) {
  if (noiseBuffer?.sampleRate === context.sampleRate) return noiseBuffer;
  noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// ---------------------------------------------------------------------
// Som ligado/desligado — lembrado entre visitas (localStorage é só
// conveniência: sem ele, o jogo começa com som)
// ---------------------------------------------------------------------
export function isMuted() {
  return muted;
}

export function restoreMute(game) {
  try {
    muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch (err) {
    // localStorage indisponível: fica com som
  }
  game.sound.mute = muted;
}

export function toggleMute(scene) {
  muted = !muted;
  scene.sys.game.sound.mute = muted;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch (err) {
    // ignore
  }
  playSfx(scene, 'toggle'); // só se ouve ao religar
}
