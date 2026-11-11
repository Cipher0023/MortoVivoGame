// Gera o banco de instrumentos da música (amostras gravadas, como no SNES).
//
//   npm run banco                 baixa, processa e grava o banco
//   npm run banco -- --analisar   só mede a afinação e mostra o relatório
//
// Fontes (domínio público, CC0 — uso livre, inclusive comercial):
//   VSCO 2 Community Edition  https://github.com/sgossner/VSCO-2-CE
//   VCSL                      https://github.com/sgossner/VCSL
//
// Para cada instrumento, baixa poucas notas (zonas), mede a afinação real de
// cada uma (o nome do arquivo segue convenções diferentes em cada biblioteca),
// converte para mono numa taxa baixa (como o SNES), corta o silêncio e o
// final, e nos instrumentos sustentados cria um ponto de repetição (loop)
// sem estalo. Grava em public/assets/music/instrumentos/ e o índice em
// src/audio/music/instrumentBank.json.
//
// Os arquivos originais ficam num cache temporário (BANCO_CACHE ou
// /tmp/mortovivo-banco) e são apagados depois de processados.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public/assets/music/instrumentos');
const MANIFEST = path.join(ROOT, 'src/audio/music/instrumentBank.json');
const CACHE = process.env.BANCO_CACHE ?? path.join(os.tmpdir(), 'mortovivo-banco');
const ANALYZE_ONLY = process.argv.includes('--analisar');

const SOURCES = {
  vsco: { name: 'VSCO 2 Community Edition', repo: 'sgossner/VSCO-2-CE' },
  vcsl: { name: 'VCSL', repo: 'sgossner/VCSL' },
};

// type: 'loop' (sustenta enquanto a nota estiver ligada) ou 'one' (toca e
// some, como percussão e cordas dedilhadas). rate: taxa de amostragem final.
// max: duração máxima em segundos (one) ou início do loop + loop (loop).
// pitched: false = percussão sem nota (zona única em C-4).
// defaults: valores iniciais do instrumento no editor.
const SUSTAIN = { attack: 0.01, decay: 0.3, sustain: 0.85, release: 0.25 };
const PLUCK = { attack: 0.001, decay: 0.8, sustain: 1, release: 0.15 };
const HIT = { attack: 0.001, decay: 0.5, sustain: 1, release: 0.08 };
const VIB = { vibDepth: 12, vibRate: 5.5, vibDelay: 0.35 };

const INSTRUMENTS = [
  // ---- cordas
  { id: 'cordas', name: 'Cordas', category: 'Cordas', src: 'vsco', dir: 'Strings/Violin Section/susVib', type: 'loop', rate: 22050,
    files: ['VlnEns_susVib_A2_v1.wav', 'VlnEns_susVib_C4_v1.wav', 'VlnEns_susVib_D5_v1.wav'],
    defaults: { ...SUSTAIN, attack: 0.12, release: 0.45, volume: 0.7, reverb: 0.45, chorus: 0.3 } },
  { id: 'violoncelos', name: 'Violoncelos', category: 'Cordas', src: 'vsco', dir: 'Strings/Cello Section/susvib', type: 'loop', rate: 22050,
    files: ['susvib_C1_v1_1.wav', 'susvib_D2_v1_1.wav', 'susvib_C3_v1_1.wav'],
    defaults: { ...SUSTAIN, attack: 0.1, release: 0.4, volume: 0.75, reverb: 0.4 } },
  { id: 'pizzicato', name: 'Pizzicato', category: 'Cordas', src: 'vsco', dir: 'Strings/Violin Section/Pizz', type: 'one', rate: 22050, max: 1.2,
    files: ['VlnEns_Pizz_A2_v2_rr1.wav', 'VlnEns_Pizz_A3_v2_rr1.wav', 'VlnEns_Pizz_B4_v1_rr1.wav'],
    defaults: { ...PLUCK, volume: 0.8, reverb: 0.35 } },
  { id: 'contrabaixo', name: 'Contrabaixo (pizz.)', category: 'Cordas', src: 'vsco', dir: 'Strings/Solo Contrabass/Pizz', type: 'one', rate: 22050, max: 1.6,
    files: ['BKCtbss_Pizz_A#0_v3_rr1.wav', 'BKCtbss_Pizz_A1_v1_rr1.wav', 'BKCtbss_Pizz_C#2_v1_rr1.wav'],
    defaults: { ...PLUCK, volume: 1, reverb: 0.15 } },
  { id: 'harpa', name: 'Harpa', category: 'Cordas', src: 'vsco', dir: 'Strings/Harp', type: 'one', rate: 22050, max: 2.4,
    files: ['KSHarp_B1_mf.wav', 'KSHarp_C3_mf.wav', 'KSHarp_A4_mf.wav', 'KSHarp_D6_mf.wav'],
    defaults: { ...PLUCK, volume: 0.8, reverb: 0.5, echo: 0.2 } },
  // ---- sopros
  { id: 'flauta', name: 'Flauta', category: 'Sopros', src: 'vsco', dir: 'Woodwinds/Flute/susvib', type: 'loop', rate: 22050,
    files: ['LDFlute_susvib_C3_v1_1.wav', 'LDFlute_susvib_C4_v1_1.wav', 'LDFlute_susvib_C5_v1_1.wav'],
    defaults: { ...SUSTAIN, attack: 0.04, volume: 0.75, reverb: 0.4, echo: 0.25 } },
  { id: 'clarinete', name: 'Clarinete', category: 'Sopros', src: 'vsco', dir: 'Woodwinds/Clarinet/susLong', type: 'loop', rate: 22050,
    files: ['DCClar_susLong_D2_v2_rr1_sum.wav', 'DCClar_susLong_D3_v2_rr1_sum.wav', 'DCClar_susLong_A#3_v2_rr1_sum.wav'],
    defaults: { ...SUSTAIN, attack: 0.03, volume: 0.75, reverb: 0.35, ...VIB, vibDepth: 6 } },
  { id: 'oboe', name: 'Oboé', category: 'Sopros', src: 'vsco', dir: 'Woodwinds/Oboe/Vib', type: 'loop', rate: 22050,
    files: ['Oboe_Vib_D3_v1_Main.wav', 'Oboe_Vib_D4_v1_Main.wav', 'Oboe_Vib_D5_v1_Main.wav'],
    defaults: { ...SUSTAIN, attack: 0.03, volume: 0.7, reverb: 0.35 } },
  { id: 'ocarina', name: 'Ocarina', category: 'Sopros', src: 'vcsl', dir: 'Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib', type: 'loop', rate: 22050,
    files: 'auto:2',
    defaults: { ...SUSTAIN, attack: 0.03, volume: 0.75, reverb: 0.45, echo: 0.3 } },
  // ---- metais
  { id: 'trompa', name: 'Trompa', category: 'Metais', src: 'vsco', dir: 'Brass/F Horn/sus', type: 'loop', rate: 22050,
    files: ['MOHorn_sus_A#1_v2_1.wav', 'MOHorn_sus_C3_v2_1.wav'],
    defaults: { ...SUSTAIN, attack: 0.06, volume: 0.75, reverb: 0.45, ...VIB, vibDepth: 5 } },
  { id: 'trompete', name: 'Trompete', category: 'Metais', src: 'vsco', dir: 'Brass/Trumpet/sus', type: 'loop', rate: 22050,
    files: ['Sum_SHTrumpet_sus_A2_v1_rr1.wav', 'Sum_SHTrumpet_sus_A#3_v1_rr1.wav', 'Sum_SHTrumpet_sus_A4_v1_rr1.wav'],
    defaults: { ...SUSTAIN, attack: 0.02, volume: 0.7, reverb: 0.35, ...VIB, vibDepth: 8 } },
  { id: 'trombone', name: 'Trombone', category: 'Metais', src: 'vsco', dir: 'Brass/Tenor Trombone/sus', type: 'loop', rate: 22050,
    files: ['tenortbn_sus_A#1_v2_1.wav', 'tenortbn_sus_C3_v2_1.wav'],
    defaults: { ...SUSTAIN, attack: 0.04, volume: 0.75, reverb: 0.35 } },
  { id: 'tuba', name: 'Tuba', category: 'Metais', src: 'vsco', dir: 'Brass/Tuba/sus', type: 'loop', rate: 22050,
    files: ['Tuba3_sus_A#0_v2_rr1_Mid.wav', 'Tuba3_sus_D2_v2_rr1_Mid.wav'],
    defaults: { ...SUSTAIN, attack: 0.04, volume: 0.9, reverb: 0.2 } },
  // ---- teclas e percussão com nota
  { id: 'marimba', name: 'Marimba', category: 'Teclas e percussão', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Marimba', type: 'one', rate: 22050, max: 1.6,
    files: ['Marimba_hit_Outrigger_C2_med_01.wav', 'Marimba_hit_Outrigger_C4_med_01.wav', 'Marimba_hit_Outrigger_C6_med_01.wav'],
    defaults: { ...HIT, volume: 0.85, reverb: 0.35, echo: 0.2 } },
  { id: 'xilofone', name: 'Xilofone', category: 'Teclas e percussão', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Xylophone/Medium Mallets', type: 'one', rate: 22050, max: 1.0,
    files: 'auto:3',
    defaults: { ...HIT, volume: 0.75, reverb: 0.3 } },
  { id: 'vibrafone', name: 'Vibrafone', category: 'Teclas e percussão', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Vibraphone/Soft Mallets', type: 'one', rate: 22050, max: 2.4,
    files: 'auto:3',
    defaults: { ...HIT, volume: 0.8, reverb: 0.5, chorus: 0.2 } },
  { id: 'glockenspiel', name: 'Glockenspiel', category: 'Teclas e percussão', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Glockenspiel', type: 'one', rate: 32000, max: 1.8,
    files: ['glock_medium_G4_01.wav', 'glock_medium_C6_01.wav'],
    defaults: { ...HIT, volume: 0.6, reverb: 0.5, echo: 0.3 } },
  { id: 'kalimba', name: 'Kalimba', category: 'Teclas e percussão', src: 'vcsl', dir: 'Idiophones/Plucked Idiophones/Kalimba, Tanzania', type: 'one', rate: 22050, max: 1.5,
    files: ['MBira3_pluck_Main_C#2_k10_50_100_rr2.wav', 'MBira3_pluck_Main_D#3_k7_50_100_rr2.wav', 'MBira3_pluck_Main_D#4_k20_50_100_rr2.wav'],
    defaults: { ...HIT, volume: 0.85, reverb: 0.4, echo: 0.25 } },
  { id: 'balafon', name: 'Balafon', category: 'Teclas e percussão', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet', type: 'one', rate: 22050, max: 1.0,
    files: 'auto:2',
    defaults: { ...HIT, volume: 0.85, reverb: 0.3 } },
  { id: 'piano-fm', name: 'Piano elétrico (FM)', category: 'Teclas e percussão', src: 'vcsl', dir: 'Electrophones/TX81Z/FM Piano', type: 'one', rate: 22050, max: 2.2,
    files: ['FMPiano_C2_vl2.wav', 'FMPiano_C3_vl2.wav', 'FMPiano_C4_vl2.wav', 'FMPiano_C5_vl2.wav'],
    defaults: { ...PLUCK, volume: 0.75, reverb: 0.4, chorus: 0.35 } },
  { id: 'timpano', name: 'Tímpano', category: 'Teclas e percussão', src: 'vsco', dir: 'Percussion/Timpani', type: 'one', rate: 22050, max: 2.0,
    files: ['Timpani1_Hit_v3_rr1_Sum.wav', 'Timpani3_Hit_v3_rr1_Sum.wav'],
    defaults: { ...HIT, volume: 0.9, reverb: 0.45 } },
  // ---- bateria e percussão sem nota
  { id: 'bumbo', name: 'Bumbo', category: 'Bateria', src: 'vcsl', dir: 'Membranophones/Struck Membranophones/Bass Drum 1', type: 'one', rate: 22050, max: 0.9, pitched: false,
    files: ['BDrumNew_hit_v5_rr1_Sum.wav'], defaults: { ...HIT, volume: 1, reverb: 0.15 } },
  { id: 'cajon', name: 'Cajón', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Cajon', type: 'one', rate: 22050, max: 0.6, pitched: false,
    files: ['Cajon_hit1_f_rr1.wav'], defaults: { ...HIT, volume: 1, reverb: 0.15 } },
  { id: 'caixa-bateria', name: 'Caixa', category: 'Bateria', src: 'vcsl', dir: 'Membranophones/Struck Membranophones/Snare Drum, Modern 1', type: 'one', rate: 32000, max: 0.6, pitched: false,
    files: ['Snare2_HitSN_v5_rr1_Mid.wav'], defaults: { ...HIT, volume: 0.8, reverb: 0.3 } },
  { id: 'chimbal-fechado', name: 'Chimbal fechado', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Hi-Hat Cymbal', type: 'one', rate: 32000, max: 0.35, pitched: false,
    files: ['HiHat_HitC_v3_rr1_Mid.wav'], defaults: { ...HIT, volume: 0.55, reverb: 0.15 } },
  { id: 'chimbal-aberto', name: 'Chimbal aberto', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Hi-Hat Cymbal', type: 'one', rate: 32000, max: 1.0, pitched: false,
    files: ['HiHat_HitO_rr1_Mid.wav'], defaults: { ...HIT, volume: 0.5, reverb: 0.2 } },
  { id: 'prato', name: 'Prato', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Suspended Cymbal 1', type: 'one', rate: 32000, max: 2.5, pitched: false,
    files: ['susCymb1_hit_f1.wav'], defaults: { ...HIT, volume: 0.55, reverb: 0.35 } },
  { id: 'conga', name: 'Conga', category: 'Bateria', src: 'vcsl', dir: 'Membranophones/Struck Membranophones/Conga', type: 'one', rate: 22050, max: 0.7, pitched: false,
    files: ['Conga_HitN_v2_rr1_Sum.wav'], defaults: { ...HIT, volume: 0.9, reverb: 0.3 } },
  { id: 'bongo', name: 'Bongô', category: 'Bateria', src: 'vcsl', dir: 'Membranophones/Struck Membranophones/Bongos', type: 'one', rate: 22050, max: 0.6, pitched: false,
    files: ['BongoH_Hit1_v2_rr1_Mid.wav'], defaults: { ...HIT, volume: 0.85, reverb: 0.3 } },
  { id: 'chocalho', name: 'Chocalho', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Shaker, Small', type: 'one', rate: 32000, max: 0.4, pitched: false,
    files: ['Mid_ShakerDouble_Down_rr1.wav'], defaults: { ...HIT, volume: 0.6, reverb: 0.2 } },
  { id: 'pandeirola', name: 'Pandeirola', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Tambourine 1', type: 'one', rate: 32000, max: 0.8, pitched: false,
    files: ['Tamb1_Hit_v2_rr1_Mid.wav'], defaults: { ...HIT, volume: 0.6, reverb: 0.25 } },
  { id: 'palmas', name: 'Palmas', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Claps', type: 'one', rate: 32000, max: 0.6, pitched: false,
    files: ['Clap_rr1.wav'], defaults: { ...HIT, volume: 0.7, reverb: 0.35 } },
  { id: 'bloco', name: 'Bloco de madeira', category: 'Bateria', src: 'vcsl', dir: 'Idiophones/Struck Idiophones/Woodblock', type: 'one', rate: 22050, max: 0.4, pitched: false,
    files: ['wood_click_f_rr1.wav'], defaults: { ...HIT, volume: 0.7, reverb: 0.3 } },
];

// ---------------------------------------------------------------------
// WAV
// ---------------------------------------------------------------------
function readWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('não é WAV');
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = {
        code: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        rate: buffer.readUInt32LE(body + 4),
        bits: buffer.readUInt16LE(body + 14),
      };
      if (format.code === 0xfffe) format.code = buffer.readUInt16LE(body + 24); // WAVE_FORMAT_EXTENSIBLE
    } else if (id === 'data') {
      data = buffer.subarray(body, Math.min(body + size, buffer.length));
    }
    offset = body + size + (size % 2);
  }
  if (!format || !data) throw new Error('WAV sem fmt/data');
  const { code, channels, bits, rate } = format;
  const bytes = bits / 8;
  const frames = Math.floor(data.length / (bytes * channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = (i * channels + c) * bytes;
      let v;
      if (code === 3 && bits === 32) v = data.readFloatLE(at);
      else if (bits === 16) v = data.readInt16LE(at) / 32768;
      else if (bits === 24) v = data.readIntLE(at, 3) / 8388608;
      else if (bits === 32) v = data.readInt32LE(at) / 2147483648;
      else if (bits === 8) v = (data[at] - 128) / 128;
      else throw new Error(`WAV de ${bits} bits não suportado`);
      sum += v;
    }
    mono[i] = sum / channels;
  }
  return { rate, data: mono };
}

function writeWav(samples, rate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    // dither leve antes de arredondar para 16 bits
    const v = samples[i] * 32767 + (Math.random() - Math.random()) * 0.5;
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), 44 + i * 2);
  }
  return buffer;
}

// ---------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------
// Reamostragem com sinc janelado (Blackman), com corte abaixo da nova Nyquist.
function resample(input, from, to) {
  if (from === to) return input;
  const ratio = to / from;
  const cutoff = Math.min(1, ratio) * 0.95;
  const taps = 24;
  const out = new Float32Array(Math.floor(input.length * ratio));
  const step = 1 / ratio;
  for (let i = 0; i < out.length; i++) {
    const center = i * step;
    const first = Math.ceil(center - taps / cutoff);
    const last = Math.floor(center + taps / cutoff);
    let sum = 0;
    for (let j = Math.max(0, first); j <= Math.min(input.length - 1, last); j++) {
      const x = (j - center) * cutoff;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.42 + 0.5 * Math.cos((Math.PI * x) / taps) + 0.08 * Math.cos((2 * Math.PI * x) / taps);
      sum += input[j] * sinc * w * cutoff;
    }
    out[i] = sum;
  }
  return out;
}

function rms(data, start, length) {
  let sum = 0;
  const end = Math.min(data.length, start + length);
  for (let i = start; i < end; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

function peak(data) {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  return max;
}

// YIN simplificado: frequência fundamental de uma janela, ou null.
function yin(data, rate, start, size = 4096) {
  if (start + size * 2 > data.length) return null;
  const maxTau = Math.min(size, Math.floor(rate / 25));
  const minTau = Math.floor(rate / 4500);
  const diff = new Float32Array(maxTau);
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const d = data[start + i] - data[start + i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }
  let running = 0;
  const cmnd = new Float32Array(maxTau);
  cmnd[0] = 1;
  for (let tau = 1; tau < maxTau; tau++) {
    running += diff[tau];
    cmnd[tau] = running ? (diff[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = Math.max(2, minTau); t < maxTau - 1; t++) {
    if (cmnd[t] < 0.12) {
      while (t + 1 < maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // interpolação parabólica
  const a = cmnd[tau - 1];
  const b = cmnd[tau];
  const c = cmnd[tau + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c)) || 0;
  return rate / (tau + shift);
}

function median(values) {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
}

// Afinação medida em várias janelas depois do ataque (nota MIDI fracionária).
function measurePitch(data, rate) {
  const results = [];
  const window = rate < 30000 ? 2048 : 4096;
  for (let t = 0.08; t < 1.2; t += 0.06) {
    const f = yin(data, rate, Math.floor(t * rate), window);
    if (f) results.push(69 + 12 * Math.log2(f / 440));
  }
  if (results.length < 3) return null;
  const mid = median(results);
  const close = results.filter((n) => Math.abs(n - mid) < 0.35);
  return close.length >= 3 ? close.reduce((s, n) => s + n, 0) / close.length : null;
}

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// nota do nome do arquivo (ex.: A#2) — na convenção C4 = 60
function noteFromName(file) {
  const match = /(?:^|[_ ])([A-G])(#?)(-?\d)(?=[_.])/.exec(file);
  if (!match) return null;
  return (Number(match[3]) + 1) * 12 + NOTE_INDEX[match[1]] + (match[2] ? 1 : 0);
}

// Escolhe a nota base: a medida, ajustada à nota do nome (que pode estar
// uma oitava deslocada conforme a convenção da biblioteca).
function rootNote(measured, named) {
  if (measured == null || named == null) return { root: measured ?? null, offset: null, how: 'medida' };
  const candidates = [named - 12, named, named + 12];
  const best = candidates.reduce((a, b) => (Math.abs(b - measured) < Math.abs(a - measured) ? b : a));
  if (Math.abs(best - measured) <= 0.6) return { root: measured, offset: best - named, how: best === named ? 'medida' : `medida (nome ${best > named ? '+' : '−'}8va)` };
  // a medida pegou um harmônico ou ruído: decide depois, pela oitava das outras notas
  return { root: null, offset: null, how: '' };
}

function trimStart(data, rate) {
  const threshold = peak(data) * 0.01;
  let i = 0;
  while (i < data.length && Math.abs(data[i]) < threshold) i++;
  return data.subarray(Math.max(0, i - Math.floor(rate * 0.002)));
}

// Corta o final quando o som some (ou em `max` segundos) e suaviza a saída.
function trimEnd(data, rate, max) {
  const top = peak(data);
  let end = Math.min(data.length, Math.floor(max * rate));
  const block = Math.floor(rate * 0.02);
  for (let i = Math.floor(rate * 0.05); i + block < end; i += block) {
    if (rms(data, i, block) < top * 0.002) {
      end = i + block;
      break;
    }
  }
  const out = data.slice(0, end);
  const fade = Math.min(out.length, Math.floor(rate * 0.04));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

// Loop sem estalo: escolhe um trecho estável depois do ataque, com duração
// de um número inteiro de períodos da nota, e funde o fim do trecho com o
// que vem antes do início (crossfade de potência constante).
function makeLoop(data, rate, frequency) {
  const block = Math.floor(rate * 0.02);
  const peakRms = Math.max(...Array.from({ length: Math.floor(Math.min(data.length, rate * 1.5) / block) }, (_, i) => rms(data, i * block, block)));
  let attackEnd = 0;
  while (attackEnd + block < data.length && rms(data, attackEnd, block) < peakRms * 0.8) attackEnd += block;
  const start = Math.max(Math.floor(rate * 0.3), attackEnd + Math.floor(rate * 0.1));
  const period = frequency ? rate / frequency : rate / 200;
  const length = Math.max(period, Math.round((rate * 0.55) / period) * period);
  const end = Math.round(start + length);
  if (end >= data.length) throw new Error('amostra curta demais para o loop');
  const loopStart = Math.round(start);
  const fade = Math.min(Math.floor(rate * 0.12), loopStart, Math.floor((end - loopStart) / 2));
  const out = data.slice(0, end);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[end - fade + i] = data[end - fade + i] * Math.cos((t * Math.PI) / 2) + data[loopStart - fade + i] * Math.sin((t * Math.PI) / 2);
  }
  return { data: out, loopStart, loopEnd: end };
}

// ---------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------
const treeCache = new Map();
async function listDir(src, dir) {
  if (!treeCache.has(src)) {
    const url = `https://api.github.com/repos/${SOURCES[src].repo}/git/trees/HEAD?recursive=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'mortovivo-banco' } });
    if (!response.ok) throw new Error(`GitHub ${response.status} ao listar ${SOURCES[src].repo}`);
    treeCache.set(src, (await response.json()).tree);
  }
  return treeCache
    .get(src)
    .filter((t) => t.type === 'blob' && t.path.startsWith(`${dir}/`) && !t.path.slice(dir.length + 1).includes('/') && /\.wav$/i.test(t.path))
    .map((t) => t.path.slice(dir.length + 1));
}

// "auto:N": N notas espalhadas pela extensão do instrumento (1 por nota)
async function resolveFiles(inst) {
  if (Array.isArray(inst.files)) return inst.files;
  const count = Number(inst.files.split(':')[1]);
  const all = await listDir(inst.src, inst.dir);
  const byNote = new Map();
  for (const file of all.sort()) {
    const note = noteFromName(file);
    if (note != null && !byNote.has(note)) byNote.set(note, file);
  }
  const notes = [...byNote.keys()].sort((a, b) => a - b);
  if (notes.length === 0) throw new Error(`nenhuma nota em ${inst.dir}`);
  const picks = Array.from({ length: count }, (_, i) => notes[Math.round((i * (notes.length - 1)) / Math.max(1, count - 1))]);
  return [...new Set(picks)].map((note) => byNote.get(note));
}

async function download(src, dir, file) {
  const target = path.join(CACHE, src, dir, file);
  try {
    return await fs.readFile(target);
  } catch {
    // não está no cache
  }
  const encoded = `${dir}/${file}`.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${SOURCES[src].repo}/HEAD/${encoded}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download ${response.status}: ${dir}/${file}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return buffer;
}

// ---------------------------------------------------------------------
async function processInstrument(inst) {
  const files = await resolveFiles(inst);
  const zones = [];
  const report = [];
  // 1ª passada: baixa e mede cada nota
  const takes = [];
  for (const file of files) {
    const wav = readWav(await download(inst.src, inst.dir, file));
    const data = trimStart(wav.data, wav.rate);
    const named = noteFromName(file);
    const measured = inst.pitched === false ? null : measurePitch(data, wav.rate);
    takes.push({ file, rate: wav.rate, data, named, measured, ...(inst.pitched === false ? {} : rootNote(measured, named)) });
  }
  // a oitava da convenção do nome, tirada das notas que a medida confirmou;
  // vale para as notas em que a medida falhou
  const offsets = takes.filter((t) => t.offset != null).map((t) => t.offset);
  const offset = offsets.length ? median(offsets) : 0;
  for (const take of takes) {
    if (inst.pitched === false) {
      take.root = 60;
      take.how = 'percussão';
    } else if (take.root == null) {
      if (take.named == null) throw new Error(`sem afinação: ${take.file}`);
      take.root = take.named + offset;
      take.how = `nome ${offset ? `${offset > 0 ? '+' : '−'}8va ` : ''}(medida ${take.measured?.toFixed(2) ?? '—'} descartada)`;
    }
    report.push(`${take.file} → ${take.root.toFixed(2)} (${take.how})`);
  }

  for (const take of takes) {
    if (ANALYZE_ONLY) break;
    const { root } = take;
    let data = resample(take.data, take.rate, inst.rate);
    let zone;
    if (inst.type === 'loop') {
      const looped = makeLoop(data, inst.rate, 440 * 2 ** ((root - 69) / 12));
      data = looped.data;
      zone = { loopStart: looped.loopStart / inst.rate, loopEnd: looped.loopEnd / inst.rate };
    } else {
      data = trimEnd(data, inst.rate, inst.max);
      zone = {};
    }
    // volume: zonas do mesmo instrumento com a mesma "força" (RMS do corpo),
    // pico no máximo em -1 dB
    const body = rms(data, Math.floor(inst.rate * 0.02), Math.floor(inst.rate * 0.5));
    zones.push({ data, root, body, ...zone });
  }
  if (ANALYZE_ONLY) {
    if (!process.env.BANCO_CACHE) for (const file of files) await fs.rm(path.join(CACHE, inst.src, inst.dir, file), { force: true });
  }
  if (ANALYZE_ONLY) return { report };

  const targetBody = median(zones.map((z) => z.body));
  let gain = Infinity;
  for (const zone of zones) gain = Math.min(gain, 0.89 / (peak(zone.data) * (targetBody / zone.body)));
  const manifestZones = [];
  for (const zone of zones) {
    const scale = gain * (targetBody / zone.body);
    for (let i = 0; i < zone.data.length; i++) zone.data[i] *= scale;
    const name = `${inst.id}-${Math.round(zone.root)}.wav`;
    await fs.writeFile(path.join(OUT_DIR, name), writeWav(zone.data, inst.rate));
    manifestZones.push({
      file: name,
      root: Number(zone.root.toFixed(3)),
      ...(zone.loopStart != null && { loopStart: Number(zone.loopStart.toFixed(5)), loopEnd: Number(zone.loopEnd.toFixed(5)) }),
      bytes: 44 + zone.data.length * 2,
    });
  }
  for (const file of files) if (!process.env.BANCO_CACHE) await fs.rm(path.join(CACHE, inst.src, inst.dir, file), { force: true });
  manifestZones.sort((a, b) => a.root - b.root);
  return {
    report,
    entry: {
      id: inst.id,
      name: inst.name,
      category: inst.category,
      source: SOURCES[inst.src].name,
      origin: { repo: SOURCES[inst.src].repo, dir: inst.dir, files },
      loop: inst.type === 'loop',
      pitched: inst.pitched !== false,
      zones: manifestZones.map(({ bytes, ...z }) => z),
      defaults: inst.defaults,
      bytes: manifestZones.reduce((s, z) => s + z.bytes, 0),
    },
  };
}

function credits(instruments) {
  const lines = [
    '# Créditos dos instrumentos da música',
    '',
    'Todas as amostras desta pasta vêm de bibliotecas **CC0 (domínio público)**: podem',
    'ser usadas no jogo, inclusive comercialmente, sem obrigação de dar crédito. O',
    'crédito abaixo é cortesia e registro de origem.',
    '',
    '- **VSCO 2 Community Edition**, Versilian Studios — https://github.com/sgossner/VSCO-2-CE (CC0 1.0)',
    '- **VCSL (Versilian Community Sample Library)**, Versilian Studios — https://github.com/sgossner/VCSL (CC0 1.0)',
    '',
    'As notas foram convertidas para mono, com taxa de amostragem reduzida (22 ou 32 kHz,',
    'como no SNES), silêncio cortado, volume igualado e, nos instrumentos sustentados, um',
    'trecho de repetição (loop) criado com crossfade. Arquivos gerados por',
    '`scripts/gerar-banco-instrumentos.mjs` (`npm run banco`).',
    '',
    '| Instrumento | Biblioteca | Arquivos originais |',
    '|---|---|---|',
  ];
  for (const inst of instruments) {
    const origin = inst.origin;
    lines.push(`| ${inst.name} | ${inst.source} | ${origin.dir}/: ${origin.files.join(', ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const only = process.argv.filter((a) => !a.startsWith('--')).slice(2);
  const list = only.length ? INSTRUMENTS.filter((i) => only.includes(i.id)) : INSTRUMENTS;
  if (!ANALYZE_ONLY) await fs.mkdir(OUT_DIR, { recursive: true });
  let manifest = { instruments: [] };
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch {
    // primeiro banco
  }
  for (const inst of list) {
    try {
      const { report, entry } = await processInstrument(inst);
      console.log(`\n${inst.name}${entry ? ` — ${(entry.bytes / 1024).toFixed(0)} KB` : ''}`);
      for (const line of report) console.log(`  ${line}`);
      if (entry) {
        manifest.instruments = manifest.instruments.filter((i) => i.id !== entry.id);
        manifest.instruments.push(entry);
      }
    } catch (err) {
      console.error(`\n${inst.name}: ERRO ${err.message}`);
      process.exitCode = 1;
    }
  }
  if (ANALYZE_ONLY) return;
  const order = INSTRUMENTS.map((i) => i.id);
  manifest.instruments.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const total = manifest.instruments.reduce((s, i) => s + (i.bytes ?? i.kb * 1024), 0);
  manifest.instruments = manifest.instruments.map(({ bytes, kb, ...rest }) => ({ ...rest, kb: Math.round((bytes ?? kb * 1024) / 1024) }));
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'CREDITOS.md'), credits(manifest.instruments));
  console.log(`\n${manifest.instruments.length} instrumentos, ${(total / 1024 / 1024).toFixed(2)} MB em ${path.relative(ROOT, OUT_DIR)}`);
}

await main();
