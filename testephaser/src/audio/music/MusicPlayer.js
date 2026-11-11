// Tocador das músicas (formato em song.js), em Web Audio.
//
// Funciona como o "driver" de som dos jogos de SNES: lê a música linha a
// linha e dispara as notas de cada canal. As linhas são agendadas um pouco
// à frente (LOOKAHEAD) no relógio do áudio, então o ritmo não depende da
// taxa de quadros do jogo.
//
// Caminho do som:
//   voz → canal (volume/mudo) → pan do canal ───────┐
//   voz → envio de eco → eco (atraso + retorno) ────┼→ volume da música
//   voz → envio de ambiente → reverberação ─────────┘
//   → fade → limitador suave (só arredonda picos) → volume do jogo → saída do Phaser
//
// Instrumentos gravados (banco) precisam ser baixados antes: chame
// prepare(song) e espere antes de play().

import { CHANNEL_COUNT, NOTE_OFF, MAX_VOLUME, getCell } from './song.js';
import { createVoice } from './instruments.js';
import { loadSongSamples, loadBankInstrument, bankIdOf } from './sampleBank.js';

// Ambientes: duração da cauda (s), pré-atraso (s), quanto os agudos somem
// ao longo da cauda (0..1) e reflexões iniciais (paredes perto).
const ROOMS = {
  sala: { seconds: 0.9, predelay: 0.008, damp: 0.55, early: 0.5 },
  floresta: { seconds: 1.6, predelay: 0.02, damp: 0.75, early: 0.15 },
  salao: { seconds: 2.4, predelay: 0.025, damp: 0.5, early: 0.35 },
  caverna: { seconds: 3.6, predelay: 0.04, damp: 0.7, early: 0.6 },
};

const LOOKAHEAD = 0.15; // segundos agendados à frente
const TICK_MS = 25;
const MAX_LAG = 0.3; // atrasou mais que isso (aba parada etc.): recomeça do agora
const ARP_STEP = 1 / 30; // troca de nota do arpejo
const VOICE_LEVEL = 0.42; // volume de uma voz cheia; o limitador só pega picos
const SMOOTH = 0.015;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default class MusicPlayer {
  constructor(ctx, destination) {
    this.ctx = ctx;

    this.output = ctx.createGain(); // volume do jogo para a música
    // limitador suave: abaixo de 70% do volume máximo não mexe em nada;
    // acima, arredonda o pico em vez de estourar. Sem compressor: o
    // DynamicsCompressor do navegador bombeia e aplica ganho automático,
    // o que deixava o som "espremido".
    this.limiter = ctx.createWaveShaper();
    this.limiter.curve = softClipCurve();
    this.limiter.oversample = '2x';
    this.fade = ctx.createGain(); // entradas e saídas suaves
    this.songVolume = ctx.createGain(); // volume gravado na música
    this.songVolume.connect(this.fade).connect(this.limiter).connect(this.output).connect(destination);

    // prévia das notas no editor: não passa pelo fade (toca mesmo parado)
    this.previewBus = ctx.createGain();
    this.previewBus.connect(this.limiter);

    // eco: atraso com retorno abafado, como o eco do SNES
    this.echoIn = ctx.createGain();
    this.echoDelay = ctx.createDelay(1);
    this.echoDamp = ctx.createBiquadFilter();
    this.echoDamp.type = 'lowpass';
    this.echoDamp.frequency.value = 3200;
    this.echoFeedback = ctx.createGain();
    this.echoOut = ctx.createGain();
    this.echoIn.connect(this.echoDelay).connect(this.echoDamp);
    this.echoDamp.connect(this.echoFeedback).connect(this.echoDelay);
    this.echoDamp.connect(this.echoOut).connect(this.songVolume);

    // ambiente: convolução com uma "resposta de sala" gerada (ver buildRoom)
    this.reverbIn = ctx.createGain();
    this.reverb = ctx.createConvolver();
    this.reverbOut = ctx.createGain();
    this.reverbIn.connect(this.reverb).connect(this.reverbOut).connect(this.songVolume);
    this.roomType = null;

    this.channels = Array.from({ length: CHANNEL_COUNT }, () => {
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      const echoGain = ctx.createGain();
      const reverbGain = ctx.createGain();
      gain.connect(panner).connect(this.songVolume);
      echoGain.connect(this.echoIn);
      reverbGain.connect(this.reverbIn);
      return { gain, panner, echoGain, reverbGain, muted: false };
    });
    this.resetChannelState();

    this.song = null;
    this.playing = false;
    this.timer = null;
    this.voices = new Set();
    this.positions = []; // { time, order, row, pattern } das linhas agendadas
    this.onEnd = null;
  }

  // ---------------------------------------------------------------------
  // Controle
  // ---------------------------------------------------------------------
  load(song) {
    this.song = song;
    this.applySongSettings();
  }

  // Baixa os instrumentos gravados que a música usa (Promise).
  prepare(song = this.song) {
    return loadSongSamples(this.ctx, song);
  }

  // Relê volume, pan e eco da música (o editor chama depois de mudar).
  applySongSettings() {
    const song = this.song;
    if (!song) return;
    const now = this.ctx.currentTime;
    this.songVolume.gain.setTargetAtTime(song.volume, now, SMOOTH);
    this.echoDelay.delayTime.setTargetAtTime(song.echo.delay, now, 0.05);
    this.echoFeedback.gain.setTargetAtTime(song.echo.feedback, now, SMOOTH);
    this.echoOut.gain.setTargetAtTime(song.echo.volume, now, SMOOTH);
    const room = song.reverb?.type ?? 'nenhum';
    if (room !== this.roomType) {
      this.roomType = room;
      if (ROOMS[room]) this.reverb.buffer = buildRoom(this.ctx, ROOMS[room]);
    }
    this.reverbOut.gain.setTargetAtTime(ROOMS[room] ? song.reverb.volume : 0, now, SMOOTH);
    this.channels.forEach((channel, i) => {
      const settings = song.channels[i];
      const level = channel.muted ? 0 : settings.volume;
      channel.gain.gain.setTargetAtTime(level, now, SMOOTH);
      channel.echoGain.gain.setTargetAtTime(level, now, SMOOTH);
      channel.reverbGain.gain.setTargetAtTime(level, now, SMOOTH);
      channel.panner.pan?.setTargetAtTime(settings.pan, now, SMOOTH);
    });
  }

  // Liga/desliga um canal (mudo/solo do editor ou camadas da música no jogo:
  // ex. a bateria só entra quando um inimigo aparece).
  setChannelMuted(index, muted, fade = SMOOTH) {
    const channel = this.channels[index];
    if (!channel || !this.song) return;
    channel.muted = muted;
    const level = muted ? 0 : this.song.channels[index].volume;
    const now = this.ctx.currentTime;
    channel.gain.gain.setTargetAtTime(level, now, fade / 3);
    channel.echoGain.gain.setTargetAtTime(level, now, fade / 3);
    channel.reverbGain.gain.setTargetAtTime(level, now, fade / 3);
  }

  setVolume(volume) {
    this.output.gain.setTargetAtTime(volume, this.ctx.currentTime, SMOOTH);
  }

  // order/row: de onde começar. loopPattern: repete só o padrão da posição
  // (editor). delay: espera (ex.: a música anterior sumir). fadeIn: segundos.
  play({ order = 0, row = 0, loopPattern = false, delay = 0, fadeIn = 0 } = {}) {
    if (!this.song) return;
    if (this.playing) this.stop();
    this.resetChannelState();
    this.applySongSettings();
    this.bpm = this.song.bpm;
    this.order = clamp(order, 0, this.song.order.length - 1);
    const pattern = this.song.patterns[this.song.order[this.order]];
    this.row = clamp(row, 0, (pattern?.rows ?? 1) - 1);
    this.loopPattern = loopPattern;
    this.positions = [];

    const start = this.ctx.currentTime + 0.03 + delay;
    const fadeGain = this.fade.gain;
    fadeGain.cancelScheduledValues(start);
    fadeGain.setValueAtTime(fadeIn > 0 ? 0 : 1, start);
    if (fadeIn > 0) fadeGain.linearRampToValueAtTime(1, start + fadeIn);

    this.nextTime = start;
    this.playing = true;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  // fade = 0 corta na hora; > 0 abaixa o volume nesse tempo e para.
  stop(fade = 0) {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    const fadeGain = this.fade.gain;
    fadeGain.cancelScheduledValues(now);
    if (fade > 0) {
      fadeGain.setValueAtTime(fadeGain.value, now);
      fadeGain.linearRampToValueAtTime(0, now + fade);
    } else {
      fadeGain.setValueAtTime(1, now);
    }
    this.releaseAll(now + fade, true);
    this.positions = [];
  }

  get isPlaying() {
    return this.playing;
  }

  // Linha que está tocando agora (para a barra do editor), ou null.
  position() {
    const now = this.ctx.currentTime;
    let current = null;
    for (const entry of this.positions) {
      if (entry.time > now) break;
      current = entry;
    }
    return current;
  }

  // Toca uma nota solta (editor: ouvir enquanto digita).
  // Instrumento gravado ainda não baixado: baixa e toca em seguida.
  previewNote(instrument, note, duration = 0.35) {
    if (!instrument || note == null || note === NOTE_OFF) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const play = () => {
      const time = this.ctx.currentTime + 0.01;
      const voice = createVoice(this.ctx, instrument, {
        time,
        note,
        level: instrument.volume * VOICE_LEVEL,
        out: this.previewBus,
        echoOut: this.echoIn,
        reverbOut: this.reverbIn,
      });
      voice.release(time + duration);
    };
    if (bankIdOf(instrument.wave)) loadBankInstrument(this.ctx, instrument.wave).then(play);
    else play();
  }

  dispose() {
    this.stop();
    this.output.disconnect();
  }

  // ---------------------------------------------------------------------
  // Agendamento
  // ---------------------------------------------------------------------
  resetChannelState() {
    for (const channel of this.channels) {
      Object.assign(channel, {
        voice: null,
        inst: null,
        vol: MAX_VOLUME,
        semi: 60,
        target: null, // nota alvo do deslizar (3xx)
        slideMem: 0,
        portaMem: 0,
        vibSpeed: 6,
        vibDepth: 4,
      });
    }
  }

  tick() {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - MAX_LAG) this.nextTime = now + 0.02;
    while (this.playing && this.nextTime < now + LOOKAHEAD) this.scheduleRow();
    while (this.positions.length > 1 && this.positions[1].time < now - 1) this.positions.shift();
  }

  scheduleRow() {
    const song = this.song;
    const patternIndex = song.order[this.order];
    const pattern = song.patterns[patternIndex];
    if (!pattern) {
      this.end(this.nextTime);
      return;
    }
    const time = this.nextTime;
    const row = this.row;

    // andamento (Fxx) vale já para a própria linha
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const cell = getCell(pattern, row, ch);
      if (cell?.[3] === 'F' && cell[4] >= 32) this.bpm = cell[4];
    }
    const rowDuration = 60 / (this.bpm * song.rowsPerBeat);

    let jump = null;
    let rowBreak = null;
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const flow = this.playCell(ch, getCell(pattern, row, ch), time, rowDuration);
      if (flow.jump != null) jump = flow.jump;
      if (flow.rowBreak != null) rowBreak = flow.rowBreak;
    }
    this.positions.push({ time, order: this.order, row, pattern: patternIndex });
    this.nextTime += rowDuration;

    // próxima linha
    if (this.loopPattern) {
      this.row = row + 1 >= pattern.rows ? 0 : row + 1;
      return;
    }
    if (jump != null || rowBreak != null) {
      this.order = jump ?? this.order + 1;
      this.row = rowBreak ?? 0;
    } else if (++this.row >= pattern.rows) {
      this.row = 0;
      this.order++;
    }
    if (this.order >= song.order.length) {
      if (song.loopTo >= 0 && song.loopTo < song.order.length) {
        this.order = song.loopTo;
      } else {
        this.end(this.nextTime);
        return;
      }
    }
    const next = song.patterns[song.order[this.order]];
    if (next && this.row >= next.rows) this.row = 0;
  }

  // Toca uma célula no canal `ch`. Devolve { jump, rowBreak } (Bxx/Dxx).
  playCell(ch, cell, time, duration) {
    const channel = this.channels[ch];
    const [note, instNumber, volume, effect, param = 0] = cell ?? [];
    const flow = {};

    if (instNumber != null) {
      const inst = this.song.instruments[instNumber - 1];
      if (inst) {
        channel.inst = inst;
        if (volume == null) channel.vol = MAX_VOLUME;
      }
    }
    if (volume != null) channel.vol = volume;

    let started = false;
    if (note === NOTE_OFF) {
      channel.voice?.release(time);
      channel.voice = null;
    } else if (note != null && channel.inst) {
      if (effect === '3' && channel.voice) {
        channel.target = note;
      } else {
        channel.voice?.release(time, true);
        channel.semi = note;
        channel.target = null;
        channel.voice = this.startVoice(ch, channel.inst, note, time);
        started = true;
      }
    }

    const voice = channel.voice;
    if (voice && !started && (volume != null || instNumber != null)) {
      voice.volume.setValueAtTime(this.levelOf(channel), time);
    }

    const x = param >> 4;
    const y = param & 15;
    switch (effect) {
      case '0': // arpejo
        if (voice && param) {
          const steps = [0, x, y];
          for (let t = time, i = 0; t < time + duration - 0.001; t += ARP_STEP, i++) {
            voice.setPitch(t, channel.semi + steps[i % 3]);
          }
          voice.setPitch(time + duration, channel.semi);
        }
        break;
      case '1': // subir
      case '2': // descer
        if (voice) {
          channel.slideMem = param || channel.slideMem;
          const delta = (channel.slideMem / 16) * (effect === '1' ? 1 : -1);
          const to = clamp(channel.semi + delta, 0, 127);
          voice.setPitch(time, channel.semi);
          voice.rampPitch(time + duration, to);
          channel.semi = to;
        }
        break;
      case '3': // deslizar até a nota
        if (voice && channel.target != null) {
          channel.portaMem = param || channel.portaMem || 16;
          const speed = channel.portaMem / 16;
          const diff = channel.target - channel.semi;
          const to = Math.abs(diff) <= speed ? channel.target : channel.semi + Math.sign(diff) * speed;
          voice.setPitch(time, channel.semi);
          voice.rampPitch(time + duration, to);
          channel.semi = to;
          if (to === channel.target) channel.target = null;
        }
        break;
      case '4': // vibrato
        if (voice && voice.detunes.length) {
          channel.vibSpeed = x || channel.vibSpeed;
          channel.vibDepth = y || channel.vibDepth;
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = channel.vibSpeed;
          const depth = this.ctx.createGain();
          depth.gain.value = channel.vibDepth * 8; // cents
          lfo.connect(depth);
          for (const detune of voice.detunes) depth.connect(detune);
          lfo.start(time);
          lfo.stop(time + duration);
          lfo.onended = () => depth.disconnect();
        }
        break;
      case '8': // pan
        channel.panner.pan?.setValueAtTime(clamp((param - 128) / 128, -1, 1), time);
        break;
      case 'A': // volume desliza
        if (voice) {
          voice.volume.setValueAtTime(this.levelOf(channel), time);
          channel.vol = clamp(channel.vol + (x ? x * 2 : -y * 2), 0, MAX_VOLUME);
          voice.volume.linearRampToValueAtTime(this.levelOf(channel), time + duration);
        }
        break;
      case 'B':
        flow.jump = param;
        break;
      case 'D':
        flow.rowBreak = param;
        break;
      default:
        break;
    }
    return flow;
  }

  levelOf(channel) {
    return (channel.inst?.volume ?? 1) * (channel.vol / MAX_VOLUME) * VOICE_LEVEL;
  }

  startVoice(ch, inst, note, time) {
    const channel = this.channels[ch];
    const voice = createVoice(this.ctx, inst, {
      time,
      note,
      level: this.levelOf(channel),
      out: channel.gain,
      echoOut: channel.echoGain,
      reverbOut: channel.reverbGain,
    });
    if (voice.silent) return null; // instrumento gravado que não carregou
    this.voices.add(voice);
    voice.onended = () => {
      this.voices.delete(voice);
      if (channel.voice === voice) channel.voice = null;
    };
    return voice;
  }

  releaseAll(time, fast = false) {
    for (const voice of this.voices) voice.release(time, fast);
    for (const channel of this.channels) channel.voice = null;
  }

  // fim da música sem repetição
  end(time) {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this.releaseAll(time);
    const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => this.onEnd?.(), delay);
  }
}

// Resposta de sala estéreo: ruído com queda exponencial (RT60 = seconds),
// agudos sumindo ao longo da cauda e algumas reflexões iniciais. Gerada uma
// vez por ambiente — nenhum arquivo extra para baixar.
function buildRoom(ctx, { seconds, predelay, damp, early }) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * (seconds + predelay));
  const buffer = ctx.createBuffer(2, length, rate);
  const start = Math.floor(rate * predelay);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let low = 0;
    for (let i = start; i < length; i++) {
      const t = (i - start) / rate;
      const decay = Math.exp((-6.9 * t) / seconds);
      // filtro passa-baixa que fecha com o tempo: a cauda fica escura
      const k = 1 - damp * Math.min(1, t / seconds) * 0.95;
      low += k * (Math.random() * 2 - 1 - low);
      data[i] = low * decay;
    }
    // reflexões iniciais (diferentes em cada lado: dá largura)
    for (let r = 0; r < 6; r++) {
      const at = start + Math.floor(rate * (0.007 + Math.random() * 0.05));
      if (at < length) data[at] += (Math.random() < 0.5 ? -1 : 1) * early * (1 - r / 7);
    }
  }
  return buffer;
}

// Curva do limitador: linear até KNEE, depois tende suavemente a 1.
function softClipCurve() {
  const KNEE = 0.7;
  const size = 4096;
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= KNEE ? a : KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
