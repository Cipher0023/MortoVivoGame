// Vozes dos instrumentos (Web Audio). Uma voz = uma nota tocando num canal:
// fonte (oscilador, ruído ou bateria) → filtro opcional → envelope ADSR →
// volume → pan → saída do canal (+ envio para o eco).

import { noteFrequency } from './song.js';
import { bankIdOf, zoneFor } from './sampleBank.js';

const waveCache = new WeakMap(); // AudioContext -> Map(id -> PeriodicWave)
const noiseCache = new WeakMap(); // AudioContext -> AudioBuffer
const HARMONICS = 48;
// Gravações acústicas têm picos altos e corpo mais baixo que as ondas do chip:
// este ganho deixa os dois no mesmo volume percebido na mistura.
const SAMPLE_GAIN = 2.2;

// Ondas que o oscilador não tem pronto, montadas pela série de Fourier.
function buildWave(ctx, id) {
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  if (id === 'pulse25' || id === 'pulse12') {
    // pulso de largura d: coeficientes 2·sen(π·n·d)/(π·n)
    const duty = id === 'pulse25' ? 0.25 : 0.125;
    for (let n = 1; n < HARMONICS; n++) real[n] = (2 * Math.sin(Math.PI * n * duty)) / (Math.PI * n);
  } else if (id === 'organ') {
    // "registros" de órgão: fundamental, oitava, quinta, duas oitavas...
    [0, 1, 0.6, 0.35, 0.25, 0, 0.15, 0, 0.12].forEach((amp, n) => {
      imag[n] = amp;
    });
  } else {
    // cordas: dente de serra com os agudos amaciados
    for (let n = 1; n < HARMONICS; n++) imag[n] = (1 / n) * Math.exp(-n / 10);
  }
  return ctx.createPeriodicWave(real, imag);
}

function periodicWave(ctx, id) {
  let waves = waveCache.get(ctx);
  if (!waves) waveCache.set(ctx, (waves = new Map()));
  if (!waves.has(id)) waves.set(id, buildWave(ctx, id));
  return waves.get(id);
}

export function noiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

const NATIVE_WAVES = { square: 'square', triangle: 'triangle', sine: 'sine', saw: 'sawtooth' };
const DRUMS = new Set(['kick', 'snare', 'hihat']);

export function isDrum(wave) {
  return DRUMS.has(wave);
}

function oscillator(ctx, wave, frequency) {
  const osc = ctx.createOscillator();
  if (NATIVE_WAVES[wave]) osc.type = NATIVE_WAVES[wave];
  else osc.setPeriodicWave(periodicWave(ctx, wave));
  osc.frequency.value = frequency;
  return osc;
}

function noiseSource(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  return source;
}

function filter(ctx, type, frequency, q = 0.7) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = Math.min(frequency, ctx.sampleRate / 2 - 100);
  node.Q.value = q;
  return node;
}

// Volume do envelope `dt` segundos depois do início da nota (mesma curva que
// é agendada em startEnvelope) — usado para soltar a nota sem estalo.
function envelopeAt(inst, dt) {
  if (dt <= 0) return 0;
  if (dt < inst.attack) return dt / inst.attack;
  return inst.sustain + (1 - inst.sustain) * Math.exp(-(dt - inst.attack) / (inst.decay / 3));
}

function startEnvelope(param, inst, time) {
  param.setValueAtTime(0, time);
  param.linearRampToValueAtTime(1, time + inst.attack);
  param.setTargetAtTime(inst.sustain, time + inst.attack, inst.decay / 3);
}

// Voz muda: instrumento do banco que ainda não carregou (ou falhou).
function silentVoice(time) {
  return {
    silent: true,
    startTime: time,
    volume: { setValueAtTime() {}, linearRampToValueAtTime() {} },
    detunes: [],
    onended: null,
    setPitch() {},
    rampPitch() {},
    release() {},
  };
}

// Cria e liga uma nota. `out` = entrada do canal; `echoOut` = envio do eco;
// `reverbOut` = envio do ambiente.
export function createVoice(ctx, inst, { time, note, level, out, echoOut, reverbOut }) {
  const frequency = noteFrequency(note);
  const sources = [];
  const noiseSources = new Set(); // ruído começa num ponto sorteado
  const pitched = []; // { param, ratio }: parâmetros que seguem a nota
  const detunes = []; // parâmetros de cents (vibrato)
  const extras = []; // nós de apoio, desligados no fim da nota

  const env = ctx.createGain();
  env.gain.value = 0;
  const volume = ctx.createGain();
  volume.gain.setValueAtTime(level, time);
  let input = env; // onde as fontes entram (antes do filtro, se houver)

  if (inst.cutoff > 0) {
    const lowpass = filter(ctx, 'lowpass', inst.cutoff);
    lowpass.connect(env);
    input = lowpass;
  }

  // Coro: a fonte é tocada duas vezes, desafinada para cima e para baixo e
  // aberta no estéreo (o "som largo" dos jogos de SNES). `connectLayer`
  // liga cada cópia na entrada com o pan e o volume certos.
  const chorus = inst.chorus > 0;
  const layers = chorus ? [-1, 1] : [0];
  const connectLayer = (node, side) => {
    if (side === 0) {
      node.connect(input);
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = Math.SQRT1_2;
    node.connect(gain);
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = side * inst.chorus * 0.7;
      gain.connect(panner).connect(input);
      extras.push(panner);
    } else {
      gain.connect(input);
    }
    extras.push(gain);
  };
  const chorusCents = (side) => side * (4 + inst.chorus * 12);

  const wave = inst.wave;
  const sample = bankIdOf(wave) ? zoneFor(ctx, wave, note) : null;
  if (bankIdOf(wave) && !sample) return silentVoice(time);

  if (sample) {
    // amostra gravada: afinada pela velocidade de leitura (como o SNES)
    const { zone, buffer, entry } = sample;
    for (const side of layers) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 2 ** ((note - zone.root) / 12);
      if (entry.loop && zone.loopEnd) {
        source.loop = true;
        source.loopStart = zone.loopStart;
        source.loopEnd = zone.loopEnd;
      }
      if (source.detune) {
        source.detune.value = inst.detune + chorusCents(side);
        detunes.push(source.detune);
      }
      connectLayer(source, side);
      sources.push(source);
      pitched.push({ param: source.playbackRate, ratio: 1 / noteFrequency(zone.root) });
    }
  } else if (wave === 'noise') {
    // ruído afinado: a nota escolhe a faixa de frequência (como o clock de
    // ruído do SNES)
    const source = noiseSource(ctx);
    const band = filter(ctx, 'bandpass', Math.min(frequency * 4, 16000), 1.2);
    source.connect(band).connect(input);
    sources.push(source);
    noiseSources.add(source);
    pitched.push({ param: band.frequency, ratio: 4 });
    detunes.push(band.detune);
  } else if (wave === 'kick') {
    const osc = oscillator(ctx, 'sine', frequency * 0.6);
    osc.frequency.setValueAtTime(frequency * 0.6, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.17), time + 0.12);
    osc.connect(input);
    sources.push(osc);
  } else if (wave === 'snare') {
    const source = noiseSource(ctx);
    source.connect(filter(ctx, 'highpass', 1200 * (frequency / 261.6))).connect(input);
    // "corpo" da caixa: um tom grave curtinho por baixo do ruído
    const body = oscillator(ctx, 'triangle', 180 * (frequency / 261.6));
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.7, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    body.connect(bodyGain).connect(input);
    sources.push(source, body);
    noiseSources.add(source);
  } else if (wave === 'hihat') {
    const source = noiseSource(ctx);
    source.connect(filter(ctx, 'highpass', Math.min(7000 * (frequency / 261.6), 15000))).connect(input);
    sources.push(source);
    noiseSources.add(source);
  } else {
    // tonais; as cordas já têm dois osciladores desafinados por natureza
    const spreads = wave === 'strings' ? [-7, 7] : [0];
    for (const side of layers) {
      for (const spread of spreads) {
        const osc = oscillator(ctx, wave, frequency);
        osc.detune.value = inst.detune + spread + chorusCents(side);
        connectLayer(osc, side);
        sources.push(osc);
        pitched.push({ param: osc.frequency, ratio: 1 });
        detunes.push(osc.detune);
      }
    }
  }

  if (sample) {
    const makeup = ctx.createGain();
    makeup.gain.value = SAMPLE_GAIN;
    env.connect(makeup).connect(volume);
    extras.push(makeup);
  } else {
    env.connect(volume);
  }
  let tail = volume;
  if (inst.pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = inst.pan;
    tail.connect(panner);
    tail = panner;
  }
  tail.connect(out);
  const sends = [];
  for (const [amount, target] of [[inst.echo, echoOut], [inst.reverb, reverbOut]]) {
    if (!(amount > 0) || !target) continue;
    const send = ctx.createGain();
    send.gain.value = amount;
    tail.connect(send).connect(target);
    sends.push(send);
  }

  // vibrato automático: entra devagar depois de vibDelay (como nas cordas)
  let lfo = null;
  if (inst.vibDepth > 0 && detunes.length) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = inst.vibRate;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.setValueAtTime(0, time + inst.vibDelay);
    depth.gain.linearRampToValueAtTime(inst.vibDepth, time + inst.vibDelay + 0.4);
    lfo.connect(depth);
    for (const detune of detunes) depth.connect(detune);
    extras.push(depth);
    lfo.start(time);
  }

  startEnvelope(env.gain, inst, time);
  for (const source of sources) source.start(time, noiseSources.has(source) ? Math.random() * 1.5 : 0);

  let endTime = Infinity;
  const voice = {
    startTime: time,
    instrument: inst,
    volume: volume.gain,
    detunes,
    onended: null,

    // muda a nota na hora `t` (semitons, pode ser fracionário)
    setPitch(t, semi) {
      const f = noteFrequency(semi);
      for (const { param, ratio } of pitched) param.setValueAtTime(Math.min(f * ratio, 16000), t);
    },
    // desliza até a nota `semi`, terminando na hora `t`
    rampPitch(t, semi) {
      const f = noteFrequency(semi);
      for (const { param, ratio } of pitched) param.exponentialRampToValueAtTime(Math.min(f * ratio, 16000), t);
    },
    // solta a nota (envelope de soltura do instrumento)
    release(t, fast = false) {
      if (t >= endTime) return;
      if (t <= time) {
        // ainda nem começou (agendada à frente): não chega a tocar
        endTime = time;
        for (const source of sources) source.stop(time);
        lfo?.stop(time);
        return;
      }
      const releaseTime = fast ? 0.012 : inst.release;
      const at = Math.max(t, time);
      env.gain.cancelScheduledValues(at);
      env.gain.setValueAtTime(envelopeAt(inst, at - time), at);
      env.gain.setTargetAtTime(0, at, releaseTime / 4);
      endTime = at + releaseTime + 0.03;
      for (const source of sources) source.stop(endTime);
      lfo?.stop(endTime);
    },
  };

  sources[0].onended = () => {
    env.disconnect();
    volume.disconnect();
    tail.disconnect();
    for (const node of [...sends, ...extras]) node.disconnect();
    voice.onended?.();
  };
  // Some sozinha: bateria sintetizada, sustentação 0, e amostra sem loop
  // (a gravação acaba — depois disso a voz não precisa continuar viva).
  if (isDrum(wave) || inst.sustain === 0) {
    voice.release(time + inst.attack + inst.decay * 1.5);
  } else if (sample && !sample.entry.loop) {
    const rate = 2 ** ((note - sample.zone.root) / 12);
    voice.release(time + sample.buffer.duration / rate);
  }
  return voice;
}
