// Formato das músicas do jogo (arquivo .json salvo pelo editor de música).
//
// É o formato de um tracker, como os do SNES: a música tem 8 CANAIS (o SNES
// tinha 8 vozes), cada canal toca uma nota por vez. Os PADRÕES são grades de
// linhas × canais; a ORDEM diz em que sequência os padrões tocam (um padrão
// pode repetir na ordem sem ser copiado). Cada linha dura 1/rowsPerBeat de
// batida, no andamento `bpm`.
//
// Cada célula da grade: [nota, instrumento, volume, efeito, parâmetro]
//   nota         número MIDI (60 = C-4), NOTE_OFF (solta a nota) ou null
//   instrumento  1..MAX_INSTRUMENTS (null = continua o do canal)
//   volume       0..64 (null = volume cheio ao trocar de nota)
//   efeito       um caractere de EFFECTS ('0'..'F') ou null
//   parâmetro    0..255 (dois dígitos hexadecimais, "xy")
//
// Puro JS (sem Phaser nem Web Audio): roda também no Node.

export const SONG_VERSION = 1;
export const CHANNEL_COUNT = 8;
export const MIN_PATTERN_ROWS = 8;
export const MAX_PATTERN_ROWS = 128;
export const DEFAULT_PATTERN_ROWS = 64;
export const MAX_PATTERNS = 128;
export const MAX_ORDER = 256;
export const MAX_INSTRUMENTS = 32;
export const MAX_VOLUME = 64;
export const NOTE_OFF = -1;
export const MIN_NOTE = 12; // C-0
export const MAX_NOTE = 119; // B-8
export const MIN_BPM = 32;
export const MAX_BPM = 255;

// Timbres dos instrumentos. Os tonais tocam a nota; os de bateria usam a nota
// só para afinar (mais grave/agudo). O ruído é como o gerador de ruído do SNES.
export const WAVES = [
  { id: 'square', label: 'Quadrada' },
  { id: 'pulse25', label: 'Pulso 25%' },
  { id: 'pulse12', label: 'Pulso 12%' },
  { id: 'triangle', label: 'Triangular' },
  { id: 'sine', label: 'Senoide' },
  { id: 'saw', label: 'Dente de serra' },
  { id: 'organ', label: 'Órgão' },
  { id: 'strings', label: 'Cordas' },
  { id: 'noise', label: 'Ruído' },
  { id: 'kick', label: 'Bumbo' },
  { id: 'snare', label: 'Caixa' },
  { id: 'hihat', label: 'Chimbal' },
];
export const WAVE_IDS = WAVES.map((wave) => wave.id);

// Instrumentos gravados do banco (ver sampleBank.js): timbre "bank:<id>".
export function isBankWave(wave) {
  return typeof wave === 'string' && /^bank:[a-z0-9-]{1,40}$/.test(wave);
}

export function isValidWave(wave) {
  return WAVE_IDS.includes(wave) || isBankWave(wave);
}

// Ambientes (reverberação) da música inteira
export const REVERB_TYPES = [
  { id: 'nenhum', label: 'Nenhum' },
  { id: 'sala', label: 'Sala' },
  { id: 'floresta', label: 'Floresta' },
  { id: 'salao', label: 'Salão' },
  { id: 'caverna', label: 'Caverna' },
];
export const REVERB_IDS = REVERB_TYPES.map((type) => type.id);

// Efeitos (coluna de efeito). Valem só na linha em que aparecem, como nos
// trackers: para um vibrato longo, repita o efeito nas linhas seguintes
// (com parâmetro 00 ele repete o último valor usado no canal).
export const EFFECTS = {
  0: { label: 'Arpejo', help: '0xy alterna a nota com +x e +y semitons (acorde rápido)' },
  1: { label: 'Subir tom', help: '1xx sobe xx/16 semitons durante a linha' },
  2: { label: 'Descer tom', help: '2xx desce xx/16 semitons durante a linha' },
  3: { label: 'Deslizar', help: '3xx desliza da nota anterior até a nova, xx/16 semitons por linha' },
  4: { label: 'Vibrato', help: '4xy vibrato: x = velocidade, y = profundidade' },
  8: { label: 'Pan', help: '8xx posição no estéreo: 00 esquerda, 80 centro, FF direita' },
  A: { label: 'Volume', help: 'Axy volume sobe x ou desce y durante a linha' },
  B: { label: 'Pular', help: 'Bxx depois desta linha, pula para a posição xx da ordem' },
  D: { label: 'Fim do padrão', help: 'Dxx termina o padrão aqui e segue na linha xx do próximo' },
  F: { label: 'Andamento', help: 'Fxx muda o andamento para xx BPM (hexadecimal, 20..FF)' },
};
export const EFFECT_KEYS = Object.keys(EFFECTS);

const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

export function noteName(note) {
  if (note === NOTE_OFF) return '===';
  if (note == null) return '···';
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export function hex2(value) {
  return value == null ? '··' : value.toString(16).toUpperCase().padStart(2, '0');
}

// "C-4 01 40 4A3": nota, instrumento, volume, efeito + parâmetro
export function formatCell(cell) {
  const [note, inst, vol, fx, param] = cell ?? [];
  const effect = fx == null ? '···' : `${fx}${hex2(param ?? 0)}`;
  return `${noteName(note)} ${hex2(inst)} ${hex2(vol)} ${effect}`;
}

export function noteFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

export function createInstrument(changes = {}) {
  return {
    name: 'Instrumento',
    wave: 'square',
    volume: 0.8, // 0..1
    pan: 0, // -1 (esquerda) .. 1 (direita), somado ao pan do canal
    attack: 0.005, // segundos até o volume máximo
    decay: 0.2, // segundos até chegar na sustentação
    sustain: 0.6, // 0..1, volume enquanto a nota fica segurada
    release: 0.12, // segundos para sumir depois de soltar
    detune: 0, // cents (-100..100)
    echo: 0, // 0..1, quanto vai para o eco
    cutoff: 0, // Hz do filtro passa-baixa (0 = sem filtro)
    reverb: 0.25, // 0..1, quanto vai para o ambiente (reverberação)
    chorus: 0, // 0..1, coro: duas cópias levemente desafinadas, abertas no estéreo
    vibDepth: 0, // vibrato automático: profundidade em cents (0 = sem)
    vibRate: 5.5, // vibrato automático: velocidade em Hz
    vibDelay: 0.3, // vibrato automático: começa depois de tantos segundos
    ...changes,
  };
}

export function createPattern(rows = DEFAULT_PATTERN_ROWS) {
  return { rows, cells: {} };
}

export function createChannel(index) {
  return { name: `Canal ${index + 1}`, volume: 1, pan: 0 };
}

export function createSong() {
  return {
    version: SONG_VERSION,
    title: 'Nova música',
    bpm: 120,
    rowsPerBeat: 4,
    volume: 0.8,
    // eco do SNES: atraso em segundos, retorno (quanto repete) e volume
    echo: { delay: 0.25, feedback: 0.35, volume: 0.3 },
    // ambiente (reverberação) da música inteira
    reverb: { type: 'sala', volume: 0.35 },
    channels: Array.from({ length: CHANNEL_COUNT }, (_, i) => createChannel(i)),
    // começa com instrumentos gravados do banco (ver sampleBank.js); os
    // sintetizados (chip) continuam disponíveis no seletor de timbres
    instruments: [
      createInstrument({ name: 'Flauta', wave: 'bank:flauta', volume: 0.75, attack: 0.04, decay: 0.3, sustain: 0.85, release: 0.25, reverb: 0.4, echo: 0.25 }),
      createInstrument({ name: 'Contrabaixo (pizz.)', wave: 'bank:contrabaixo', volume: 1, attack: 0.001, decay: 0.8, sustain: 1, release: 0.15, reverb: 0.15 }),
      createInstrument({ name: 'Cordas', wave: 'bank:cordas', volume: 0.7, attack: 0.12, decay: 0.3, sustain: 0.85, release: 0.45, reverb: 0.45, chorus: 0.3 }),
      createInstrument({ name: 'Bumbo', wave: 'bank:bumbo', volume: 1, attack: 0.001, decay: 0.5, sustain: 1, release: 0.08, reverb: 0.15 }),
      createInstrument({ name: 'Caixa', wave: 'bank:caixa-bateria', volume: 0.8, attack: 0.001, decay: 0.5, sustain: 1, release: 0.08, reverb: 0.3 }),
      createInstrument({ name: 'Chimbal fechado', wave: 'bank:chimbal-fechado', volume: 0.55, attack: 0.001, decay: 0.5, sustain: 1, release: 0.08, reverb: 0.15 }),
      createInstrument({ name: 'Marimba', wave: 'bank:marimba', volume: 0.85, attack: 0.001, decay: 0.5, sustain: 1, release: 0.08, reverb: 0.35, echo: 0.2 }),
    ],
    patterns: [createPattern()],
    order: [0],
    loopTo: 0, // posição da ordem onde a música recomeça (-1 = não repete)
  };
}

function cellKey(row, channel) {
  return `${row},${channel}`;
}

export function getCell(pattern, row, channel) {
  return pattern?.cells[cellKey(row, channel)] ?? null;
}

export function isEmptyCell(cell) {
  return !cell || cell.every((value) => value == null);
}

// Grava a célula (ou apaga, se ficou vazia). Devolve a célula gravada.
export function setCell(pattern, row, channel, cell) {
  const key = cellKey(row, channel);
  if (isEmptyCell(cell)) {
    delete pattern.cells[key];
    return null;
  }
  pattern.cells[key] = cell;
  return cell;
}

export function cloneSong(song) {
  return JSON.parse(JSON.stringify(song));
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clampInt(value, min, max, fallback) {
  return Math.round(clamp(value, min, max, fallback));
}

export function isValidSong(data) {
  return (
    !!data &&
    typeof data === 'object' &&
    Array.isArray(data.patterns) &&
    data.patterns.length > 0 &&
    Array.isArray(data.order) &&
    data.order.length > 0
  );
}

function normalizeCell(raw) {
  if (!Array.isArray(raw)) return null;
  const [note, inst, vol, fx, param] = raw;
  let cleanNote = null;
  if (note === NOTE_OFF) cleanNote = NOTE_OFF;
  else if (Number.isInteger(note) && note >= MIN_NOTE && note <= MAX_NOTE) cleanNote = note;
  const cleanFx = typeof fx === 'string' && EFFECTS[fx.toUpperCase()] ? fx.toUpperCase() : null;
  return [
    cleanNote,
    Number.isInteger(inst) && inst >= 1 && inst <= MAX_INSTRUMENTS ? inst : null,
    Number.isInteger(vol) && vol >= 0 && vol <= MAX_VOLUME ? vol : null,
    cleanFx,
    cleanFx ? clampInt(param, 0, 255, 0) : null,
  ];
}

// Completa o que faltar com o padrão e corrige valores fora da faixa: um
// arquivo velho ou editado à mão nunca derruba o jogo.
export function normalizeSong(data) {
  const base = createSong();
  const song = {
    version: SONG_VERSION,
    title: typeof data.title === 'string' ? data.title.slice(0, 60) : base.title,
    bpm: clampInt(data.bpm, MIN_BPM, MAX_BPM, base.bpm),
    rowsPerBeat: clampInt(data.rowsPerBeat, 1, 16, base.rowsPerBeat),
    volume: clamp(data.volume, 0, 1, base.volume),
    echo: {
      delay: clamp(data.echo?.delay, 0.02, 0.9, base.echo.delay),
      feedback: clamp(data.echo?.feedback, 0, 0.9, base.echo.feedback),
      volume: clamp(data.echo?.volume, 0, 1, base.echo.volume),
    },
    reverb: {
      type: REVERB_IDS.includes(data.reverb?.type) ? data.reverb.type : base.reverb.type,
      volume: clamp(data.reverb?.volume, 0, 1, base.reverb.volume),
    },
    channels: Array.from({ length: CHANNEL_COUNT }, (_, i) => {
      const raw = data.channels?.[i] ?? {};
      return {
        name: typeof raw.name === 'string' ? raw.name.slice(0, 20) : createChannel(i).name,
        volume: clamp(raw.volume, 0, 1, 1),
        pan: clamp(raw.pan, -1, 1, 0),
      };
    }),
    instruments: (Array.isArray(data.instruments) ? data.instruments : base.instruments)
      .slice(0, MAX_INSTRUMENTS)
      .map((raw) => {
        const def = createInstrument();
        return {
          name: typeof raw?.name === 'string' ? raw.name.slice(0, 24) : def.name,
          wave: isValidWave(raw?.wave) ? raw.wave : def.wave,
          volume: clamp(raw?.volume, 0, 1, def.volume),
          pan: clamp(raw?.pan, -1, 1, def.pan),
          attack: clamp(raw?.attack, 0.001, 4, def.attack),
          decay: clamp(raw?.decay, 0.001, 8, def.decay),
          sustain: clamp(raw?.sustain, 0, 1, def.sustain),
          release: clamp(raw?.release, 0.005, 8, def.release),
          detune: clamp(raw?.detune, -100, 100, def.detune),
          echo: clamp(raw?.echo, 0, 1, def.echo),
          cutoff: clamp(raw?.cutoff, 0, 20000, def.cutoff),
          reverb: clamp(raw?.reverb, 0, 1, def.reverb),
          chorus: clamp(raw?.chorus, 0, 1, def.chorus),
          vibDepth: clamp(raw?.vibDepth, 0, 100, def.vibDepth),
          vibRate: clamp(raw?.vibRate, 0.5, 15, def.vibRate),
          vibDelay: clamp(raw?.vibDelay, 0, 4, def.vibDelay),
        };
      }),
    patterns: data.patterns.slice(0, MAX_PATTERNS).map((raw) => {
      const rows = clampInt(raw?.rows, MIN_PATTERN_ROWS, MAX_PATTERN_ROWS, DEFAULT_PATTERN_ROWS);
      const pattern = createPattern(rows);
      for (const [key, value] of Object.entries(raw?.cells ?? {})) {
        const [row, channel] = key.split(',').map(Number);
        if (!(row >= 0 && row < rows && channel >= 0 && channel < CHANNEL_COUNT)) continue;
        setCell(pattern, row, channel, normalizeCell(value));
      }
      return pattern;
    }),
    order: [],
    loopTo: 0,
  };
  song.order = data.order
    .slice(0, MAX_ORDER)
    .map((index) => clampInt(index, 0, song.patterns.length - 1, 0));
  song.loopTo = clampInt(data.loopTo, -1, song.order.length - 1, 0);
  return song;
}

// JSON legível e bom para o git: cada célula numa linha só.
export function serializeSong(song) {
  return `${JSON.stringify(song, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) =>
    `[${inner.split(/,\s+/).join(', ')}]`
  )}\n`;
}
