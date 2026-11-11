import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/constants.js';
import { playSfx, isMuted, toggleMute } from '../audio/sfx.js';
import { releaseMusicForEditor } from '../audio/music.js';
import { getSong, listSongIds, registerSong } from '../audio/songLibrary.js';
import {
  CHANNEL_COUNT,
  MAX_INSTRUMENTS,
  MAX_PATTERNS,
  MAX_ORDER,
  MAX_VOLUME,
  MIN_PATTERN_ROWS,
  MAX_PATTERN_ROWS,
  MIN_NOTE,
  MAX_NOTE,
  MIN_BPM,
  MAX_BPM,
  NOTE_OFF,
  WAVES,
  EFFECTS,
  REVERB_TYPES,
  createSong,
  createPattern,
  createInstrument,
  getCell,
  setCell,
  cloneSong,
  formatCell,
  hex2,
  isValidSong,
  normalizeSong,
  serializeSong,
} from '../audio/music/song.js';
import { BANK_INSTRUMENTS, bankWave, bankEntry } from '../audio/music/sampleBank.js';

// Editor de música (modo editor, no computador, com teclado). É um tracker
// como os usados nos jogos de SNES: 8 canais, padrões de linhas e uma ordem
// que diz em que sequência os padrões tocam. Teclas no estilo FastTracker:
// a fileira Z–M é uma oitava do piano e Q–P a de cima.
//
// "Salvar no jogo" (só com npm run dev) grava em src/audio/songs/<nome>.json;
// em config/phases.js cada fase diz qual música toca (`music: 'fase1'`).
// "Baixar .json" baixa o arquivo para colocar nessa pasta à mão.

const ROW_H = 22;
const VISIBLE_ROWS = 32;
const GRID_X = 250;
const GRID_Y = 210;
const ROWNUM_W = 40;
const CH_W = 146;
const GRID_W = ROWNUM_W + CH_W * CHANNEL_COUNT;
const GRID_FONT = { fontFamily: 'monospace', fontSize: '17px', color: '#e6e6f0' };
const LEFT_X = 16;
const RIGHT_X = GRID_X + GRID_W + 24;
const ORDER_VISIBLE = 18;
const INSTRUMENT_VISIBLE = 8;
const LIST_ROW_H = 24;
const MAX_HISTORY = 100;
const AUTOSAVE_KEY = 'mortovivo_music_autosave';
const AUTOSAVE_INTERVAL_MS = 15000;
const SAVE_URL = '/__mortovivo/musica';

// Colunas do cursor dentro de um canal: nota, instrumento (2 dígitos),
// volume (2), efeito, parâmetro (2). Posição/largura em caracteres no texto
// "C-4 01 40 4A3".
const FIELDS = [
  { char: 0, width: 3, name: 'nota' },
  { char: 4, width: 1, name: 'instrumento' },
  { char: 5, width: 1, name: 'instrumento' },
  { char: 7, width: 1, name: 'volume' },
  { char: 8, width: 1, name: 'volume' },
  { char: 10, width: 1, name: 'efeito' },
  { char: 11, width: 1, name: 'parâmetro' },
  { char: 12, width: 1, name: 'parâmetro' },
];

// Piano no teclado (posição física da tecla — vale para teclado ABNT e US)
const NOTE_KEYS = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  Comma: 12, KeyL: 13, Period: 14, Semicolon: 15,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
  Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
};
const NOTE_OFF_KEYS = new Set(['Digit1', 'Backquote', 'IntlBackslash']);

function hexDigitOf(code) {
  let match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (match) return Number(match[1]);
  match = /^Key([A-F])$/.exec(code);
  return match ? match[1].charCodeAt(0) - 55 : null;
}

const HELP = [
  'Notas: Z S X D C V G B H N J M (oitava de baixo) · Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P (de cima) · 1 = soltar a nota (===)',
  'Setas: mover · Tab: canal seguinte · PgUp/PgDn: 16 linhas · Del: apagar · Insert: inserir linha · Backspace: apagar a linha de cima',
  'Espaço: tocar/parar a música · Shift+Espaço: tocar daqui · Enter: repetir o padrão · −/+ (teclado numérico): oitava · Ctrl+Z/Y · Ctrl+C/V: copiar/colar canal (Shift: padrão)',
  'Números em hexadecimal, como nos trackers (10 = 16, 40 = 64). Instrumento e volume: digite 2 dígitos. Volume: 00 a 40.',
  'Efeitos: 0xy arpejo · 1xx sobe · 2xx desce · 3xx desliza · 4xy vibrato · 8xx pan · Axy volume · Bxx pular · Dxx fim do padrão · Fxx BPM',
];

// Todos os timbres: os sintetizados (chip) e os gravados do banco.
const TIMBRES = [
  ...WAVES.map((wave) => ({ id: wave.id, label: wave.label, category: 'Sintetizados (chip)' })),
  ...BANK_INSTRUMENTS.map((entry) => ({ id: bankWave(entry.id), label: entry.name, category: entry.category })),
];
const TIMBRE_LABELS = new Set(TIMBRES.map((timbre) => timbre.label));
// ajustes do instrumento que um timbre do banco traz prontos
const DEFAULT_FIELDS = ['attack', 'decay', 'sustain', 'release', 'volume', 'echo', 'reverb', 'chorus', 'vibDepth', 'vibRate', 'vibDelay'];

// O que estava aberto, para voltar do editor de fases sem perder nada.
let session = null;

export default class MusicEditorScene extends Phaser.Scene {
  constructor() {
    super('MusicEditor');
  }

  init(data) {
    this.returnTo = data?.returnTo ?? null;
  }

  create() {
    this.player = releaseMusicForEditor(this.game);
    this.player?.stop();

    const restored = session;
    this.song = restored?.song ?? createSong();
    this.songId = restored?.songId ?? null;
    this.isDirty = restored?.isDirty ?? false;
    this.orderIndex = restored?.orderIndex ?? 0;
    this.cursor = restored?.cursor ?? { row: 0, ch: 0, col: 0 };
    this.instrument = restored?.instrument ?? 1;
    this.octave = restored?.octave ?? 4;
    this.step = restored?.step ?? 1;
    this.follow = restored?.follow ?? true;
    this.undoStack = restored?.undoStack ?? [];
    this.redoStack = restored?.redoStack ?? [];
    this.clipboard = restored?.clipboard ?? null;
    this.mutes = new Array(CHANNEL_COUNT).fill(false);
    this.solo = null;
    this.playhead = null;
    this.message = '';
    this.orderScroll = 0;
    this.instrumentScroll = 0;
    this.steppers = [];

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.EDITOR_BG).setOrigin(0, 0);
    this.measureFont();
    this.buildToolbar();
    this.buildSongSettings();
    this.buildGrid();
    this.buildOrderPanel();
    this.buildInstrumentPanel();
    this.buildHelp();
    this.buildFileInput();

    this.player?.load(this.song);
    this.player?.prepare(this.song);
    this.applyMutes();
    this.clampCursor();
    this.redraw();

    this.keyHandler = (event) => this.handleKey(event);
    window.addEventListener('keydown', this.keyHandler);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('wheel', (pointer, over, deltaX, deltaY) => this.handleWheel(pointer, deltaY));

    this.beforeUnloadHandler = (event) => {
      if (!this.isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.time.addEvent({ delay: AUTOSAVE_INTERVAL_MS, loop: true, callback: () => this.autosaveTick() });

    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.keyHandler);
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.fileInput.remove();
      this.player?.stop();
      // o tocador é o mesmo da música do jogo: sai com todos os canais ligados
      for (let ch = 0; ch < CHANNEL_COUNT; ch++) this.player?.setChannelMuted(ch, false, 0.01);
    });

    if (!restored) this.maybeOfferAutosaveRestore();
    if (!this.player) this.setMessage('Este navegador não tem Web Audio: dá para editar, mas não para ouvir.');
  }

  // ---------------------------------------------------------------------
  // Peças de interface
  // ---------------------------------------------------------------------
  measureFont() {
    const probe = this.add.text(0, 0, '0000000000', GRID_FONT);
    this.charW = probe.width / 10;
    const metrics = probe.getTextMetrics();
    this.lineSpacing = ROW_H - metrics.fontSize;
    probe.destroy();
  }

  uiText(x, y, text, style = {}) {
    return this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '14px', color: '#cccccc', ...style })
      .setDepth(10);
  }

  uiButton(x, y, label, onClick, style = {}) {
    const button = this.uiText(x, y, label, {
      color: '#ffffff',
      backgroundColor: '#333355',
      padding: { x: 8, y: 6 },
      ...style,
    }).setInteractive({ useHandCursor: true });
    button.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      playSfx(this, 'click');
      onClick(pointer);
    });
    return button;
  }

  // "Rótulo  [−] valor [+]". Shift+clique anda 10 passos. `values` (lista)
  // troca o passo fixo por uma escada de valores.
  uiStepper(x, y, label, { get, set, min, max, step = 1, values, format = String, labelWidth = 110, valueWidth = 64 }) {
    this.uiText(x, y + 5, label);
    const valueText = this.uiText(x + labelWidth + 32, y + 5, '', { color: '#ffffff' });
    const change = (dir, pointer) => {
      const current = get();
      if (current == null) return;
      let next;
      if (values) {
        let index = values.findIndex((v) => v >= current - 1e-9);
        if (index < 0) index = values.length - 1;
        if (values[index] > current + 1e-9 && dir > 0) index -= 1;
        next = values[Phaser.Math.Clamp(index + dir, 0, values.length - 1)];
      } else {
        const amount = pointer?.event?.shiftKey ? step * 10 : step;
        next = Phaser.Math.Clamp(Math.round((current + dir * amount) / step) * step, min, max);
      }
      if (next !== current) set(next);
    };
    this.uiButton(x + labelWidth, y, '−', (pointer) => change(-1, pointer), { padding: { x: 7, y: 4 } });
    this.uiButton(x + labelWidth + 32 + valueWidth, y, '+', (pointer) => change(1, pointer), { padding: { x: 7, y: 4 } });
    const stepper = {
      refresh: () => {
        const value = get();
        valueText.setText(value == null ? '—' : format(value));
      },
    };
    this.steppers.push(stepper);
    return stepper;
  }

  buildToolbar() {
    let x = 16;
    const y = 12;
    const gap = 8;
    const buttons = [
      ['Novo', () => this.newSong()],
      ['Abrir', () => this.handleOpenClick()],
      ['Modelos', () => this.openTemplate()],
      ...(import.meta.env.DEV ? [['Salvar no jogo', () => this.saveToGame()]] : []),
      ['Baixar .json', () => this.downloadSong()],
      ['Desfazer', () => this.undo()],
      ['Refazer', () => this.redo()],
    ];
    for (const [label, onClick] of buttons) x += this.uiButton(x, y, label, onClick).width + gap;
    x += 24;
    for (const [label, onClick] of [
      ['▶ Música (Espaço)', () => this.togglePlay({ loopPattern: false })],
      ['▶ Padrão (Enter)', () => this.togglePlay({ loopPattern: true, fromCursor: true })],
      ['■ Parar', () => this.stopPlayback()],
    ]) {
      x += this.uiButton(x, y, label, onClick, { backgroundColor: '#2d5a3d' }).width + gap;
    }
    this.followButton = this.uiButton(x, y, '', () => {
      this.follow = !this.follow;
      this.redraw();
    });
    x += 150;
    this.muteButton = this.uiButton(x, y, '', () => {
      toggleMute(this);
      this.redraw();
    });
    this.uiButton(GAME_WIDTH - 16, y, 'Voltar ao editor de fases', () => this.goBack()).setOrigin(1, 0);
  }

  buildSongSettings() {
    const y = 58;
    this.titleText = this.uiText(16, y + 5, '', { color: '#ffffff', fontSize: '16px' }).setInteractive({
      useHandCursor: true,
    });
    this.titleText.on('pointerdown', () => this.renameSong());

    const song = () => this.song;
    const row = (x, label, options) => this.uiStepper(x, y, label, options);
    row(430, 'BPM', {
      labelWidth: 50,
      get: () => song().bpm,
      set: (v) => this.mutate(() => (song().bpm = v)),
      min: MIN_BPM,
      max: MAX_BPM,
    });
    row(640, 'Linhas/batida', {
      labelWidth: 125,
      get: () => song().rowsPerBeat,
      set: (v) => this.mutate(() => (song().rowsPerBeat = v)),
      min: 1,
      max: 16,
    });
    row(920, 'Volume geral', {
      labelWidth: 115,
      get: () => Math.round(song().volume * 100),
      set: (v) => this.mutate(() => (song().volume = v / 100), true),
      min: 0,
      max: 100,
      step: 5,
      format: (v) => `${v}%`,
    });
    const y2 = 98;
    this.uiText(430, y2 + 5, 'Eco do SNES:', { color: '#9fb4ff' });
    this.uiStepper(540, y2, 'atraso', {
      labelWidth: 60,
      get: () => Math.round(song().echo.delay * 1000),
      set: (v) => this.mutate(() => (song().echo.delay = v / 1000), true),
      min: 20,
      max: 900,
      step: 10,
      format: (v) => `${v} ms`,
    });
    this.uiStepper(760, y2, 'retorno', {
      labelWidth: 70,
      get: () => Math.round(song().echo.feedback * 100),
      set: (v) => this.mutate(() => (song().echo.feedback = v / 100), true),
      min: 0,
      max: 90,
      step: 5,
      format: (v) => `${v}%`,
    });
    this.uiStepper(990, y2, 'volume', {
      labelWidth: 70,
      get: () => Math.round(song().echo.volume * 100),
      set: (v) => this.mutate(() => (song().echo.volume = v / 100), true),
      min: 0,
      max: 100,
      step: 5,
      format: (v) => `${v}%`,
    });
    this.uiText(1230, y2 + 5, 'Edição:', { color: '#9fb4ff' });
    this.uiStepper(1300, y2, 'oitava', {
      labelWidth: 60,
      get: () => this.octave,
      set: (v) => {
        this.octave = v;
        this.redraw();
      },
      min: 0,
      max: 8,
    });
    this.uiStepper(1500, y2, 'passo', {
      labelWidth: 50,
      get: () => this.step,
      set: (v) => {
        this.step = v;
        this.redraw();
      },
      min: 0,
      max: 16,
    });
    this.uiStepper(1190, y, 'Linhas do padrão', {
      labelWidth: 150,
      get: () => this.currentPattern()?.rows,
      set: (v) => this.setPatternRows(v),
      min: MIN_PATTERN_ROWS,
      max: MAX_PATTERN_ROWS,
      step: 8,
    });
    this.uiStepper(1480, y, 'Ambiente', {
      labelWidth: 80,
      valueWidth: 84,
      get: () => Math.max(0, REVERB_TYPES.findIndex((t) => t.id === song().reverb.type)),
      set: (v) => this.mutate(() => (song().reverb.type = REVERB_TYPES[v].id), true),
      min: 0,
      max: REVERB_TYPES.length - 1,
      format: (v) => REVERB_TYPES[v].label,
    });
    this.uiStepper(1712, y, 'vol.', {
      labelWidth: 42,
      valueWidth: 46,
      get: () => Math.round(song().reverb.volume * 100),
      set: (v) => this.mutate(() => (song().reverb.volume = v / 100), true),
      min: 0,
      max: 100,
      step: 5,
      format: (v) => `${v}%`,
    });
    this.statusText = this.uiText(16, 140, '', { color: '#ffd966' });
  }

  buildGrid() {
    this.gridBg = this.add.graphics();
    this.gridOverlay = this.add.graphics().setDepth(5);
    this.rowNumText = this.add
      .text(GRID_X + 4, GRID_Y, '', { ...GRID_FONT, color: '#7f7fa8' })
      .setLineSpacing(this.lineSpacing)
      .setDepth(6);
    this.channelTexts = [];
    this.channelHeaders = [];
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const x = this.channelX(ch);
      this.channelTexts.push(this.add.text(x + 6, GRID_Y, '', GRID_FONT).setLineSpacing(this.lineSpacing).setDepth(6));
      const name = this.uiText(x + 6, GRID_Y - 46, '', { color: '#ffffff' }).setInteractive({ useHandCursor: true });
      name.on('pointerdown', (pointer, lx, ly, event) => {
        event?.stopPropagation?.();
        this.renameChannel(ch);
      });
      const mute = this.uiButton(x + 6, GRID_Y - 26, 'M', () => this.toggleMuteChannel(ch), { padding: { x: 6, y: 1 } });
      const solo = this.uiButton(x + 34, GRID_Y - 26, 'S', () => this.toggleSolo(ch), { padding: { x: 6, y: 1 } });
      this.channelHeaders.push({ name, mute, solo });
    }
  }

  buildOrderPanel() {
    const x = LEFT_X;
    this.uiText(x, GRID_Y - 46, 'Ordem (posição · padrão)', { color: '#9fb4ff' });
    this.orderTexts = [];
    for (let i = 0; i < ORDER_VISIBLE; i++) {
      const text = this.uiText(x, GRID_Y + i * LIST_ROW_H, '', { fontSize: '15px', padding: { x: 4, y: 2 } })
        .setInteractive({ useHandCursor: true });
      text.on('pointerdown', (pointer, lx, ly, event) => {
        event?.stopPropagation?.();
        this.selectOrder(this.orderScroll + i);
      });
      this.orderTexts.push(text);
    }
    const y0 = GRID_Y + ORDER_VISIBLE * LIST_ROW_H + 12;
    const small = { padding: { x: 6, y: 4 }, fontSize: '13px' };
    const grid = [
      [['+ Posição', () => this.addOrder()], ['− Posição', () => this.removeOrder()]],
      [['Padrão −', () => this.changeOrderPattern(-1)], ['Padrão +', () => this.changeOrderPattern(1)]],
      [['Novo padrão', () => this.newPattern()], ['Duplicar', () => this.duplicatePattern()]],
      [['Repetir daqui', () => this.setLoop()], ['Limpar', () => this.clearPattern()]],
      [['Copiar canal', () => this.copy(false)], ['Colar', () => this.paste()]],
      [['Copiar padrão', () => this.copy(true)]],
    ];
    grid.forEach((line, row) => {
      line.forEach(([label, onClick], col) => {
        this.uiButton(x + col * 118, y0 + row * 32, label, onClick, small);
      });
    });
  }

  buildInstrumentPanel() {
    const x = RIGHT_X;
    this.uiText(x, GRID_Y - 46, 'Instrumentos', { color: '#9fb4ff' });
    this.instrumentTexts = [];
    for (let i = 0; i < INSTRUMENT_VISIBLE; i++) {
      const text = this.uiText(x, GRID_Y + i * LIST_ROW_H, '', { fontSize: '15px', padding: { x: 4, y: 2 } })
        .setInteractive({ useHandCursor: true });
      text.on('pointerdown', (pointer, lx, ly, event) => {
        event?.stopPropagation?.();
        this.selectInstrument(this.instrumentScroll + i + 1);
      });
      this.instrumentTexts.push(text);
    }
    let y = GRID_Y + INSTRUMENT_VISIBLE * LIST_ROW_H + 8;
    const small = { padding: { x: 6, y: 4 }, fontSize: '13px' };
    let bx = x;
    for (const [label, onClick] of [
      ['Novo', () => this.addInstrument(false)],
      ['Duplicar', () => this.addInstrument(true)],
      ['Apagar', () => this.deleteInstrument()],
      ['Ouvir', () => this.previewCurrent()],
      ['Timbres…', () => this.openTimbrePicker()],
    ]) {
      bx += this.uiButton(bx, y, label, onClick, small).width + 6;
    }

    y += 40;
    this.instrumentTitle = this.uiText(x, y, '', { color: '#ffffff', fontSize: '15px' }).setInteractive({
      useHandCursor: true,
    });
    this.instrumentTitle.on('pointerdown', (pointer, lx, ly, event) => {
      event?.stopPropagation?.();
      this.renameInstrument();
    });
    y += 28;

    const inst = () => this.song.instruments[this.instrument - 1];
    const field = (key, scale = 1) => ({
      get: () => (inst() ? Math.round(inst()[key] * scale) : null),
      set: (v) => this.mutate(() => (inst()[key] = v / scale), true),
    });
    const ms = (v) => `${v} ms`;
    const pct = (v) => `${v}%`;
    const timeSteps = [1, 2, 5, 10, 20, 30, 50, 80, 120, 160, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000];
    const lines = [
      ['Timbre', {
        get: () => (inst() ? Math.max(0, TIMBRES.findIndex((t) => t.id === inst().wave)) : null),
        set: (v) => this.chooseTimbre(TIMBRES[v].id),
        min: 0,
        max: TIMBRES.length - 1,
        format: (v) => (TIMBRES[v].label.length > 17 ? `${TIMBRES[v].label.slice(0, 16)}…` : TIMBRES[v].label),
      }],
      ['Volume', { ...field('volume', 100), min: 0, max: 100, step: 5, format: pct }],
      ['Pan', { ...field('pan', 100), min: -100, max: 100, step: 10, format: (v) => (v === 0 ? 'centro' : v < 0 ? `esq ${-v}` : `dir ${v}`) }],
      ['Ataque', { ...field('attack', 1000), values: timeSteps, format: ms }],
      ['Decaimento', { ...field('decay', 1000), values: timeSteps, format: ms }],
      ['Sustentação', { ...field('sustain', 100), min: 0, max: 100, step: 5, format: pct }],
      ['Soltura', { ...field('release', 1000), values: timeSteps.filter((v) => v >= 5), format: ms }],
      ['Afinação', { ...field('detune'), min: -100, max: 100, step: 5, format: (v) => `${v} cents` }],
      ['Eco', { ...field('echo', 100), min: 0, max: 100, step: 5, format: pct }],
      ['Ambiente', { ...field('reverb', 100), min: 0, max: 100, step: 5, format: pct }],
      ['Coro', { ...field('chorus', 100), min: 0, max: 100, step: 10, format: pct }],
      ['Vibrato', { ...field('vibDepth'), min: 0, max: 100, step: 2, format: (v) => (v === 0 ? 'sem' : `${v} cents`) }],
      ['  velocidade', { ...field('vibRate', 10), min: 5, max: 150, step: 5, format: (v) => `${(v / 10).toFixed(1)} Hz` }],
      ['  atraso', { ...field('vibDelay', 1000), values: [0, 50, 100, 200, 300, 400, 600, 800, 1000, 1500, 2000], format: ms }],
      ['Filtro', {
        ...field('cutoff'),
        values: [0, 200, 300, 500, 800, 1200, 2000, 3000, 5000, 8000, 12000],
        format: (v) => (v === 0 ? 'aberto' : `${v} Hz`),
      }],
    ];
    for (const [label, options] of lines) {
      this.uiStepper(x, y, label, { labelWidth: 105, valueWidth: 150, ...options });
      y += 27;
    }

    y += 8;
    this.channelTitle = this.uiText(x, y, '', { color: '#9fb4ff' });
    y += 24;
    const channel = () => this.song.channels[this.cursor.ch];
    this.uiStepper(x, y, 'Volume', {
      labelWidth: 105,
      valueWidth: 150,
      get: () => Math.round(channel().volume * 100),
      set: (v) => this.mutate(() => (channel().volume = v / 100), true),
      min: 0,
      max: 100,
      step: 5,
      format: pct,
    });
    this.uiStepper(x, y + 27, 'Pan', {
      labelWidth: 105,
      valueWidth: 150,
      get: () => Math.round(channel().pan * 100),
      set: (v) => this.mutate(() => (channel().pan = v / 100), true),
      min: -100,
      max: 100,
      step: 10,
      format: (v) => (v === 0 ? 'centro' : v < 0 ? `esq ${-v}` : `dir ${v}`),
    });
  }

  buildHelp() {
    const y = GRID_Y + VISIBLE_ROWS * ROW_H + 14;
    this.uiText(GRID_X, y, HELP.join('\n'), {
      fontSize: '13px',
      color: '#8888aa',
      lineSpacing: 3,
      wordWrap: { width: GRID_W },
    });
  }

  buildFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      input.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!isValidSong(data)) throw new Error('não é um arquivo de música do jogo');
        this.loadSong(normalizeSong(data), file.name.replace(/\.json$/i, ''));
        playSfx(this, 'load');
      } catch (err) {
        playSfx(this, 'error');
        window.alert('Erro ao abrir a música: ' + err.message);
      }
    });
    document.body.appendChild(input);
    this.fileInput = input;
  }

  // ---------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------
  currentPattern() {
    return this.song.patterns[this.song.order[this.orderIndex]];
  }

  channelX(ch) {
    return GRID_X + ROWNUM_W + ch * CH_W;
  }

  setMessage(text) {
    this.message = text;
    this.statusText?.setText(text);
  }

  // Toda mudança na música passa por aqui (desfazer + "não salvo").
  // `settings` = mudou volume/pan/eco: o tocador relê na hora.
  mutate(fn, settings = false) {
    this.undoStack.push(JSON.stringify(this.song));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    fn();
    this.isDirty = true;
    if (settings) this.player?.applySongSettings();
    this.clampCursor();
    this.redraw();
  }

  replaceSong(json) {
    // o tocador guarda a referência: troca o conteúdo, não o objeto
    const next = JSON.parse(json);
    for (const key of Object.keys(this.song)) delete this.song[key];
    Object.assign(this.song, next);
    this.player?.applySongSettings();
    this.isDirty = true;
    this.clampCursor();
    this.redraw();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    playSfx(this, 'undo');
    this.redoStack.push(JSON.stringify(this.song));
    this.replaceSong(this.undoStack.pop());
  }

  redo() {
    if (this.redoStack.length === 0) return;
    playSfx(this, 'redo');
    this.undoStack.push(JSON.stringify(this.song));
    this.replaceSong(this.redoStack.pop());
  }

  loadSong(song, id = null) {
    this.stopPlayback();
    this.song = song;
    this.songId = id;
    this.orderIndex = 0;
    this.cursor = { row: 0, ch: 0, col: 0 };
    this.instrument = 1;
    this.undoStack = [];
    this.redoStack = [];
    this.isDirty = false;
    this.player?.load(this.song);
    this.player?.prepare(this.song);
    this.applyMutes();
    this.setMessage(id ? `Aberta: ${id}` : 'Música nova.');
    this.clampCursor();
    this.redraw();
  }

  clampCursor() {
    const song = this.song;
    this.orderIndex = Phaser.Math.Clamp(this.orderIndex, 0, song.order.length - 1);
    const pattern = this.currentPattern();
    this.cursor.row = Phaser.Math.Clamp(this.cursor.row, 0, pattern.rows - 1);
    this.cursor.ch = Phaser.Math.Clamp(this.cursor.ch, 0, CHANNEL_COUNT - 1);
    this.cursor.col = Phaser.Math.Clamp(this.cursor.col, 0, FIELDS.length - 1);
    this.instrument = Phaser.Math.Clamp(this.instrument, 1, Math.max(1, song.instruments.length));
  }

  // ---------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------
  viewTop() {
    const rows = this.currentPattern().rows;
    const top = this.cursor.row - Math.floor(VISIBLE_ROWS / 2);
    return Phaser.Math.Clamp(top, 0, Math.max(0, rows - VISIBLE_ROWS));
  }

  redraw() {
    this.redrawGrid();
    this.refreshPanels();
  }

  redrawGrid() {
    const song = this.song;
    const pattern = this.currentPattern();
    const top = this.viewTop();
    const beat = song.rowsPerBeat;

    const numbers = [];
    const columns = Array.from({ length: CHANNEL_COUNT }, () => []);
    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const row = top + i;
      if (row >= pattern.rows) break;
      numbers.push(hex2(row));
      for (let ch = 0; ch < CHANNEL_COUNT; ch++) columns[ch].push(formatCell(getCell(pattern, row, ch)));
    }
    this.rowNumText.setText(numbers.join('\n'));
    this.channelTexts.forEach((text, ch) => {
      text.setText(columns[ch].join('\n'));
      text.setAlpha(this.isChannelMuted(ch) ? 0.3 : 1);
    });

    const g = this.gridBg.clear();
    g.fillStyle(0x10101e, 1).fillRect(GRID_X, GRID_Y, GRID_W, VISIBLE_ROWS * ROW_H);
    for (let i = 0; i < numbers.length; i++) {
      const row = top + i;
      if (row % (beat * 4) === 0) g.fillStyle(0x3a3a66, 0.55);
      else if (row % beat === 0) g.fillStyle(0x2a2a4a, 0.55);
      else continue;
      g.fillRect(GRID_X, GRID_Y + i * ROW_H, GRID_W, ROW_H);
    }
    g.lineStyle(1, 0x44446a, 1);
    for (let ch = 0; ch <= CHANNEL_COUNT; ch++) {
      const x = this.channelX(ch);
      g.lineBetween(x, GRID_Y - 50, x, GRID_Y + VISIBLE_ROWS * ROW_H);
    }

    const o = this.gridOverlay.clear();
    // linha que está tocando
    const playing = this.playhead;
    if (playing && playing.pattern === song.order[this.orderIndex]) {
      const i = playing.row - top;
      if (i >= 0 && i < VISIBLE_ROWS) {
        o.fillStyle(0x3d8a4f, 0.45).fillRect(GRID_X, GRID_Y + i * ROW_H, GRID_W, ROW_H);
      }
    }
    // linha e campo do cursor
    const ci = this.cursor.row - top;
    o.lineStyle(1, 0x8888ff, 0.6).strokeRect(GRID_X, GRID_Y + ci * ROW_H, GRID_W, ROW_H);
    const field = FIELDS[this.cursor.col];
    const fx = this.channelX(this.cursor.ch) + 6 + field.char * this.charW;
    o.fillStyle(0xffffff, 0.22).fillRect(fx - 1, GRID_Y + ci * ROW_H, field.width * this.charW + 2, ROW_H);
    o.lineStyle(2, 0xffd966, 1).strokeRect(fx - 1, GRID_Y + ci * ROW_H, field.width * this.charW + 2, ROW_H);
  }

  refreshPanels() {
    const song = this.song;
    const title = song.title.length > 26 ? `${song.title.slice(0, 25)}…` : song.title;
    this.titleText.setText(`♪ ${title}${this.songId ? ` (${this.songId})` : ''}${this.isDirty ? ' •' : ''}`);

    // ordem: rola para o item selecionado ficar à vista
    const orderAt = this.playhead && this.follow ? this.playhead.order : this.orderIndex;
    this.orderScroll = this.scrollToShow(this.orderScroll, orderAt, ORDER_VISIBLE, song.order.length);
    this.orderTexts.forEach((text, i) => {
      const index = this.orderScroll + i;
      if (index >= song.order.length) {
        text.setText('').setBackgroundColor('');
        return;
      }
      const loop = song.loopTo === index ? ' ↻' : '';
      const playing = this.playhead?.order === index ? ' ▶' : '';
      text.setText(`${hex2(index)} · P${hex2(song.order[index])}${loop}${playing}`);
      text.setBackgroundColor(index === this.orderIndex ? '#5555aa' : '');
      text.setColor(index === this.orderIndex ? '#ffffff' : '#bbbbdd');
    });

    this.instrumentScroll = this.scrollToShow(
      this.instrumentScroll,
      this.instrument - 1,
      INSTRUMENT_VISIBLE,
      song.instruments.length
    );
    this.instrumentTexts.forEach((text, i) => {
      const index = this.instrumentScroll + i;
      const inst = song.instruments[index];
      if (!inst) {
        text.setText('').setBackgroundColor('');
        return;
      }
      text.setText(`${hex2(index + 1)} ${inst.name}`);
      text.setBackgroundColor(index + 1 === this.instrument ? '#5555aa' : '');
      text.setColor(index + 1 === this.instrument ? '#ffffff' : '#bbbbdd');
    });
    const inst = song.instruments[this.instrument - 1];
    this.instrumentTitle.setText(inst ? `Instrumento ${hex2(this.instrument)}: ${inst.name} ✎` : 'Sem instrumentos');
    this.channelTitle.setText(`Canal ${this.cursor.ch + 1}: ${song.channels[this.cursor.ch].name}`);

    this.channelHeaders.forEach(({ name, mute, solo }, ch) => {
      name.setText(`${ch + 1} ${song.channels[ch].name}`);
      name.setColor(ch === this.cursor.ch ? '#ffd966' : '#ffffff');
      mute.setBackgroundColor(this.mutes[ch] ? '#aa3333' : '#333355');
      solo.setBackgroundColor(this.solo === ch ? '#c9a227' : '#333355');
    });

    this.followButton.setText(`Seguir: ${this.follow ? 'sim' : 'não'}`);
    this.muteButton.setText(isMuted() ? 'Som: DESLIGADO' : 'Som: ligado');
    this.muteButton.setBackgroundColor(isMuted() ? '#aa3333' : '#333355');
    for (const stepper of this.steppers) stepper.refresh();
    this.refreshPicker();

    if (!this.message) this.statusText.setText(this.cursorHint());
  }

  cursorHint() {
    const cell = getCell(this.currentPattern(), this.cursor.row, this.cursor.ch);
    const field = FIELDS[this.cursor.col];
    let hint = `Canal ${this.cursor.ch + 1} · linha ${hex2(this.cursor.row)} · ${field.name}`;
    if (field.name === 'efeito' || field.name === 'parâmetro') {
      hint += cell?.[3] ? ` — ${EFFECTS[cell[3]].help}` : ' — digite 0–9 ou A–F para escolher o efeito';
    } else if (field.name === 'nota') {
      hint += ` — oitava ${this.octave}, instrumento ${hex2(this.instrument)}, passo ${this.step}`;
    }
    return hint;
  }

  scrollToShow(scroll, index, visible, length) {
    let next = scroll;
    if (index < next) next = index;
    if (index >= next + visible) next = index - visible + 1;
    return Phaser.Math.Clamp(next, 0, Math.max(0, length - visible));
  }

  // ---------------------------------------------------------------------
  // Teclado e mouse
  // ---------------------------------------------------------------------
  handleKey(event) {
    if (!this.scene.isActive() || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const code = event.code;
    if (this.picker) {
      // com o seletor de timbres aberto: Esc fecha, o piano só toca (não escreve)
      if (code === 'Escape' || code === 'Enter') this.closeTimbrePicker();
      else if (code in NOTE_KEYS) {
        this.player?.previewNote(this.song.instruments[this.instrument - 1], (this.octave + 1) * 12 + NOTE_KEYS[code], 0.6);
      }
      event.preventDefault();
      return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    let handled = true;

    if (ctrl) {
      if (code === 'KeyZ') event.shiftKey ? this.redo() : this.undo();
      else if (code === 'KeyY') this.redo();
      else if (code === 'KeyC') this.copy(event.shiftKey);
      else if (code === 'KeyV') this.paste();
      else if (code === 'KeyS') import.meta.env.DEV ? this.saveToGame() : this.downloadSong();
      else handled = false;
      if (handled) event.preventDefault();
      return;
    }

    this.message = '';
    switch (code) {
      case 'ArrowUp': this.moveRow(-1); break;
      case 'ArrowDown': this.moveRow(1); break;
      case 'ArrowLeft': this.moveCol(-1); break;
      case 'ArrowRight': this.moveCol(1); break;
      case 'PageUp': this.moveRow(-16); break;
      case 'PageDown': this.moveRow(16); break;
      case 'Home': this.setRow(0); break;
      case 'End': this.setRow(this.currentPattern().rows - 1); break;
      case 'Tab':
        this.cursor.ch = (this.cursor.ch + (event.shiftKey ? CHANNEL_COUNT - 1 : 1)) % CHANNEL_COUNT;
        this.cursor.col = 0;
        this.redraw();
        break;
      case 'Space':
        this.togglePlay({ loopPattern: false, fromCursor: event.shiftKey });
        break;
      case 'Enter':
      case 'NumpadEnter':
        this.togglePlay({ loopPattern: true, fromCursor: true });
        break;
      case 'Delete': this.clearField(); break;
      case 'Backspace': this.deleteRowAbove(); break;
      case 'Insert': this.insertRow(); break;
      case 'NumpadAdd': this.octave = Math.min(8, this.octave + 1); this.redraw(); break;
      case 'NumpadSubtract': this.octave = Math.max(0, this.octave - 1); this.redraw(); break;
      case 'Escape': this.stopPlayback(); break;
      default:
        handled = this.typeValue(code);
    }
    if (handled) event.preventDefault();
  }

  // Tecla de valor no campo do cursor. Devolve se usou a tecla.
  typeValue(code) {
    const col = this.cursor.col;
    if (col === 0) {
      if (NOTE_OFF_KEYS.has(code)) {
        this.writeCell((cell) => [NOTE_OFF, null, null, cell[3], cell[4]]);
        this.moveRow(this.step);
        return true;
      }
      if (code in NOTE_KEYS) {
        const note = (this.octave + 1) * 12 + NOTE_KEYS[code];
        if (note < MIN_NOTE || note > MAX_NOTE) return true;
        const instrument = this.song.instruments.length ? this.instrument : null;
        this.writeCell((cell) => [note, instrument, cell[2], cell[3], cell[4]]);
        this.player?.previewNote(this.song.instruments[this.instrument - 1], note);
        this.moveRow(this.step);
        return true;
      }
      return false;
    }

    const digit = hexDigitOf(code);
    if (digit == null) return false;
    if (col === 5) {
      const fx = digit.toString(16).toUpperCase();
      if (!EFFECTS[fx]) {
        this.setMessage(`O efeito ${fx} não existe. ${HELP[4]}`);
        return true;
      }
      this.writeCell((cell) => [cell[0], cell[1], cell[2], fx, cell[4] ?? 0]);
      this.moveCol(1);
      return true;
    }

    const high = col === 1 || col === 3 || col === 6;
    const index = col <= 2 ? 1 : col <= 4 ? 2 : 4;
    const current = getCell(this.currentPattern(), this.cursor.row, this.cursor.ch);
    if (index === 4 && !current?.[3]) {
      this.setMessage('Escolha o efeito antes do parâmetro (coluna da esquerda).');
      return true;
    }
    const old = current?.[index] ?? 0;
    let value = high ? (digit << 4) | (old & 15) : (old & 0xf0) | digit;
    if (index === 1) value = value > MAX_INSTRUMENTS ? MAX_INSTRUMENTS : value || null;
    if (index === 2) value = Math.min(value, MAX_VOLUME);
    this.writeCell((cell) => {
      const next = [...cell];
      next[index] = value;
      return next;
    });
    if (index === 1 && value) this.instrument = Math.min(value, this.song.instruments.length || 1);
    if (high) {
      this.moveCol(1);
    } else {
      // segundo dígito: volta para o primeiro e desce
      this.cursor.col -= col === 7 ? 2 : 1;
      this.moveRow(this.step);
    }
    return true;
  }

  writeCell(build) {
    const { row, ch } = this.cursor;
    this.mutate(() => {
      const pattern = this.currentPattern();
      const cell = getCell(pattern, row, ch) ?? [null, null, null, null, null];
      setCell(pattern, row, ch, build(cell));
    });
  }

  clearField() {
    const col = this.cursor.col;
    this.writeCell((cell) => {
      if (col === 0) return null;
      const next = [...cell];
      if (col <= 2) next[1] = null;
      else if (col <= 4) next[2] = null;
      else {
        next[3] = null;
        next[4] = null;
      }
      return next;
    });
    this.moveRow(this.step);
  }

  // Insert: empurra o canal para baixo a partir do cursor (a última linha some)
  insertRow() {
    const { row, ch } = this.cursor;
    this.mutate(() => {
      const pattern = this.currentPattern();
      for (let r = pattern.rows - 1; r > row; r--) setCell(pattern, r, ch, getCell(pattern, r - 1, ch));
      setCell(pattern, row, ch, null);
    });
  }

  // Backspace: apaga a linha de cima e puxa o canal para cima
  deleteRowAbove() {
    const { row, ch } = this.cursor;
    if (row === 0) return;
    this.mutate(() => {
      const pattern = this.currentPattern();
      for (let r = row - 1; r < pattern.rows - 1; r++) setCell(pattern, r, ch, getCell(pattern, r + 1, ch));
      setCell(pattern, pattern.rows - 1, ch, null);
    });
    this.moveRow(-1);
  }

  moveRow(delta) {
    const rows = this.currentPattern().rows;
    // passa do fim do padrão para o próximo da ordem (e volta)
    let row = this.cursor.row + delta;
    if (Math.abs(delta) === 1 || delta === this.step) {
      if (row >= rows && this.orderIndex < this.song.order.length - 1 && !this.player?.isPlaying) {
        this.orderIndex += 1;
        row = 0;
      } else if (row < 0 && this.orderIndex > 0 && !this.player?.isPlaying) {
        this.orderIndex -= 1;
        row = this.currentPattern().rows - 1;
      }
    }
    this.setRow(row);
  }

  setRow(row) {
    this.cursor.row = Phaser.Math.Clamp(row, 0, this.currentPattern().rows - 1);
    this.redraw();
  }

  moveCol(delta) {
    let { ch, col } = this.cursor;
    col += delta;
    if (col >= FIELDS.length) {
      col = 0;
      ch = (ch + 1) % CHANNEL_COUNT;
    } else if (col < 0) {
      col = FIELDS.length - 1;
      ch = (ch + CHANNEL_COUNT - 1) % CHANNEL_COUNT;
    }
    this.cursor.ch = ch;
    this.cursor.col = col;
    this.redraw();
  }

  handlePointerDown(pointer) {
    if (this.picker) return;
    const x = pointer.x - GRID_X - ROWNUM_W;
    const y = pointer.y - GRID_Y;
    if (x < 0 || x >= CH_W * CHANNEL_COUNT || y < 0 || y >= VISIBLE_ROWS * ROW_H) return;
    const row = this.viewTop() + Math.floor(y / ROW_H);
    if (row >= this.currentPattern().rows) return;
    const ch = Math.floor(x / CH_W);
    const char = (x - ch * CH_W - 6) / this.charW;
    let col = 0;
    FIELDS.forEach((field, i) => {
      if (char >= field.char - 0.5) col = i;
    });
    this.message = '';
    this.cursor = { row, ch, col };
    this.redraw();
  }

  handleWheel(pointer, deltaY) {
    if (pointer.x < GRID_X || pointer.x > GRID_X + GRID_W) return;
    this.setRow(this.cursor.row + Math.sign(deltaY) * 4);
  }

  // ---------------------------------------------------------------------
  // Tocar
  // ---------------------------------------------------------------------
  togglePlay({ loopPattern, fromCursor = false }) {
    if (!this.player) return;
    if (this.player.isPlaying) {
      this.stopPlayback();
      return;
    }
    if (isMuted()) this.setMessage('O som do jogo está desligado: ligue no botão "Som" para ouvir.');
    this.player.onEnd = () => {
      this.playhead = null;
      this.redraw();
    };
    const options = { order: this.orderIndex, row: fromCursor ? this.cursor.row : 0, loopPattern };
    // instrumentos gravados que ainda não baixaram: espera e toca
    if (this.loadingPlay) return;
    this.loadingPlay = true;
    const slow = this.time.delayedCall(250, () => this.setMessage('Carregando instrumentos…'));
    this.player.prepare(this.song).then(() => {
      this.loadingPlay = false;
      slow.remove();
      if (this.message === 'Carregando instrumentos…') this.setMessage('');
      if (this.scene.isActive()) this.player.play(options);
    });
  }

  stopPlayback() {
    this.player?.stop(0.05);
    this.playhead = null;
    this.redraw();
  }

  isChannelMuted(ch) {
    return this.solo != null ? this.solo !== ch : this.mutes[ch];
  }

  applyMutes() {
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) this.player?.setChannelMuted(ch, this.isChannelMuted(ch));
  }

  toggleMuteChannel(ch) {
    this.mutes[ch] = !this.mutes[ch];
    this.applyMutes();
    this.redraw();
  }

  toggleSolo(ch) {
    this.solo = this.solo === ch ? null : ch;
    this.applyMutes();
    this.redraw();
  }

  previewCurrent() {
    this.player?.previewNote(this.song.instruments[this.instrument - 1], (this.octave + 1) * 12, 0.6);
  }

  update() {
    if (!this.player) return;
    const position = this.player.isPlaying ? this.player.position() : null;
    const before = this.playhead;
    if (position?.time === before?.time && !!position === !!before) return;
    this.playhead = position;
    if (position && this.follow) {
      this.orderIndex = position.order;
      this.cursor.row = Math.min(position.row, this.currentPattern().rows - 1);
    }
    this.redraw();
  }

  // ---------------------------------------------------------------------
  // Ordem e padrões
  // ---------------------------------------------------------------------
  selectOrder(index) {
    if (index >= this.song.order.length) return;
    this.orderIndex = index;
    this.message = '';
    this.clampCursor();
    this.redraw();
  }

  addOrder() {
    if (this.song.order.length >= MAX_ORDER) return;
    this.mutate(() => {
      this.song.order.splice(this.orderIndex + 1, 0, this.song.order[this.orderIndex]);
      this.orderIndex += 1;
    });
  }

  removeOrder() {
    if (this.song.order.length <= 1) return;
    this.mutate(() => {
      const song = this.song;
      song.order.splice(this.orderIndex, 1);
      if (song.loopTo > this.orderIndex) song.loopTo -= 1;
      song.loopTo = Math.min(song.loopTo, song.order.length - 1);
    });
  }

  // muda qual padrão toca nesta posição; passar do último cria um novo
  changeOrderPattern(delta) {
    const song = this.song;
    const next = song.order[this.orderIndex] + delta;
    if (next < 0) return;
    this.mutate(() => {
      if (next >= song.patterns.length) {
        if (song.patterns.length >= MAX_PATTERNS) return;
        song.patterns.push(createPattern(this.currentPattern().rows));
      }
      song.order[this.orderIndex] = Math.min(next, song.patterns.length - 1);
    });
  }

  insertPattern(pattern) {
    const song = this.song;
    if (song.patterns.length >= MAX_PATTERNS || song.order.length >= MAX_ORDER) {
      this.setMessage('Limite de padrões atingido.');
      return;
    }
    this.mutate(() => {
      song.patterns.push(pattern);
      song.order.splice(this.orderIndex + 1, 0, song.patterns.length - 1);
      this.orderIndex += 1;
    });
  }

  newPattern() {
    this.insertPattern(createPattern(this.currentPattern().rows));
  }

  duplicatePattern() {
    this.insertPattern(JSON.parse(JSON.stringify(this.currentPattern())));
  }

  setLoop() {
    this.mutate(() => {
      this.song.loopTo = this.song.loopTo === this.orderIndex ? -1 : this.orderIndex;
    });
    this.setMessage(
      this.song.loopTo < 0
        ? 'A música agora toca uma vez só e para.'
        : `No fim, a música volta para a posição ${hex2(this.song.loopTo)}.`
    );
  }

  clearPattern() {
    if (!window.confirm('Apagar todas as notas deste padrão?')) return;
    this.mutate(() => {
      this.currentPattern().cells = {};
    });
  }

  setPatternRows(rows) {
    this.mutate(() => {
      const pattern = this.currentPattern();
      pattern.rows = rows;
      for (const key of Object.keys(pattern.cells)) {
        if (Number(key.split(',')[0]) >= rows) delete pattern.cells[key];
      }
    });
  }

  copy(wholePattern) {
    const pattern = this.currentPattern();
    if (wholePattern) {
      this.clipboard = { type: 'pattern', pattern: JSON.parse(JSON.stringify(pattern)) };
      this.setMessage('Padrão copiado. "Colar" (Ctrl+V) substitui o padrão aberto.');
    } else {
      const ch = this.cursor.ch;
      const cells = [];
      for (let r = this.cursor.row; r < pattern.rows; r++) cells.push(getCell(pattern, r, ch));
      this.clipboard = { type: 'channel', cells };
      this.setMessage(`Canal ${ch + 1} copiado da linha ${hex2(this.cursor.row)} até o fim. Cole com Ctrl+V.`);
    }
  }

  paste() {
    const clip = this.clipboard;
    if (!clip) {
      this.setMessage('Nada copiado ainda.');
      return;
    }
    this.mutate(() => {
      if (clip.type === 'pattern') {
        const pattern = this.currentPattern();
        pattern.rows = clip.pattern.rows;
        pattern.cells = JSON.parse(JSON.stringify(clip.pattern.cells));
      } else {
        const pattern = this.currentPattern();
        clip.cells.forEach((cell, i) => {
          const row = this.cursor.row + i;
          if (row < pattern.rows) setCell(pattern, row, this.cursor.ch, cell && [...cell]);
        });
      }
    });
  }

  // ---------------------------------------------------------------------
  // Instrumentos e nomes
  // ---------------------------------------------------------------------
  selectInstrument(number) {
    if (number > this.song.instruments.length) return;
    this.instrument = number;
    this.redraw();
    this.previewCurrent();
  }

  addInstrument(duplicate) {
    const song = this.song;
    if (song.instruments.length >= MAX_INSTRUMENTS) {
      this.setMessage(`No máximo ${MAX_INSTRUMENTS} instrumentos.`);
      return;
    }
    const base = duplicate ? song.instruments[this.instrument - 1] : null;
    this.mutate(() => {
      song.instruments.push(base ? { ...base, name: `${base.name} 2` } : createInstrument());
      this.instrument = song.instruments.length;
    });
  }

  // Apaga o instrumento; as notas dele ficam sem instrumento e os números
  // dos seguintes descem um.
  deleteInstrument() {
    const song = this.song;
    const number = this.instrument;
    const inst = song.instruments[number - 1];
    if (!inst || !window.confirm(`Apagar o instrumento ${hex2(number)} (${inst.name})?`)) return;
    this.mutate(() => {
      song.instruments.splice(number - 1, 1);
      for (const pattern of song.patterns) {
        for (const cell of Object.values(pattern.cells)) {
          if (cell[1] === number) cell[1] = null;
          else if (cell[1] > number) cell[1] -= 1;
        }
      }
    });
  }

  // Troca o timbre do instrumento aberto. Um timbre gravado traz os ajustes
  // pensados para ele (envelope, ambiente, vibrato...); um nome genérico
  // vira o nome do timbre.
  chooseTimbre(waveId) {
    const inst = this.song.instruments[this.instrument - 1];
    if (!inst || inst.wave === waveId) {
      this.previewCurrent();
      return;
    }
    const timbre = TIMBRES.find((t) => t.id === waveId);
    const entry = bankEntry(waveId);
    this.mutate(() => {
      const oldGeneric = /^Instrumento/.test(inst.name) || TIMBRE_LABELS.has(inst.name);
      inst.wave = waveId;
      if (entry) {
        // parte dos ajustes neutros: nada do timbre anterior (ex.: o vibrato
        // da flauta) fica no novo
        const neutral = createInstrument();
        for (const key of DEFAULT_FIELDS) inst[key] = entry.defaults?.[key] ?? neutral[key];
      }
      if (oldGeneric && timbre) inst.name = timbre.label;
    }, true);
    this.previewCurrent();
  }

  openTimbrePicker() {
    if (this.picker || !this.song.instruments[this.instrument - 1]) return;
    const objects = [];
    const depth = 50;
    const shade = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0b18, 0.94)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setInteractive();
    objects.push(shade);
    const text = (x, y, label, style = {}) => {
      const t = this.uiText(x, y, label, style).setDepth(depth + 1);
      objects.push(t);
      return t;
    };
    text(60, 40, `Timbre do instrumento ${hex2(this.instrument)}`, { fontSize: '26px', color: '#ffffff' });
    text(60, 80, 'Clique para escolher e ouvir · o piano do teclado (Z–M, Q–P) toca o timbre escolhido · Esc ou Enter fecha', {
      color: '#9fb4ff',
    });
    text(60, 104, 'Gravados: bibliotecas VSCO 2 CE e VCSL, de domínio público (CC0). Eles baixam na primeira vez em que são usados.', {
      color: '#8888aa',
      fontSize: '13px',
    });
    const categories = [...new Set(TIMBRES.map((t) => t.category))];
    const colWidth = (GAME_WIDTH - 120) / categories.length;
    this.pickerItems = [];
    categories.forEach((category, c) => {
      const x = 60 + c * colWidth;
      text(x, 150, category, { color: '#ffd966', fontSize: '15px' });
      TIMBRES.filter((t) => t.category === category).forEach((timbre, i) => {
        const button = this.uiButton(x, 182 + i * 38, timbre.label, () => this.chooseTimbre(timbre.id), {
          fontSize: '15px',
          padding: { x: 10, y: 6 },
        }).setDepth(depth + 1);
        objects.push(button);
        this.pickerItems.push({ button, id: timbre.id });
      });
    });
    const close = this.uiButton(GAME_WIDTH - 60, 40, 'Fechar (Esc)', () => this.closeTimbrePicker(), {
      fontSize: '16px',
    })
      .setOrigin(1, 0)
      .setDepth(depth + 1);
    objects.push(close);
    this.picker = objects;
    this.refreshPicker();
  }

  refreshPicker() {
    if (!this.picker) return;
    const current = this.song.instruments[this.instrument - 1]?.wave;
    for (const { button, id } of this.pickerItems) {
      button.setBackgroundColor(id === current ? '#5555aa' : bankEntry(id) ? '#2d4a5a' : '#333355');
    }
  }

  closeTimbrePicker() {
    if (!this.picker) return;
    for (const object of this.picker) object.destroy();
    this.picker = null;
    this.pickerItems = [];
    playSfx(this, 'back');
  }

  renameInstrument() {
    const inst = this.song.instruments[this.instrument - 1];
    if (!inst) return;
    const name = window.prompt('Nome do instrumento:', inst.name);
    if (name) this.mutate(() => (inst.name = name.slice(0, 24)));
  }

  renameChannel(ch) {
    const name = window.prompt(`Nome do canal ${ch + 1}:`, this.song.channels[ch].name);
    if (name) this.mutate(() => (this.song.channels[ch].name = name.slice(0, 14)));
    this.cursor.ch = ch;
    this.redraw();
  }

  renameSong() {
    const title = window.prompt('Nome da música:', this.song.title);
    if (title) this.mutate(() => (this.song.title = title.slice(0, 60)));
  }

  // ---------------------------------------------------------------------
  // Arquivos
  // ---------------------------------------------------------------------
  confirmDiscard() {
    return !this.isDirty || window.confirm('A música aberta tem mudanças não salvas. Continuar mesmo assim?');
  }

  newSong() {
    if (!this.confirmDiscard()) return;
    this.loadSong(createSong());
  }

  handleOpenClick() {
    if (!this.confirmDiscard()) return;
    this.fileInput.click();
  }

  openTemplate() {
    const ids = listSongIds();
    if (ids.length === 0) {
      this.setMessage('Ainda não há músicas em src/audio/songs/.');
      return;
    }
    const id = window.prompt(`Abrir qual música do jogo?\n${ids.join(', ')}`, ids[0]);
    if (!id) return;
    const song = getSong(id.trim());
    if (!song) {
      playSfx(this, 'error');
      this.setMessage(`Não existe a música "${id}".`);
      return;
    }
    if (!this.confirmDiscard()) return;
    this.loadSong(cloneSong(song), id.trim());
    playSfx(this, 'load');
  }

  askSongId() {
    const id = window.prompt(
      'Nome do arquivo da música (ex.: fase1). Em config/phases.js, `music: \'fase1\'` liga a música à fase.',
      this.songId ?? 'fase1'
    );
    if (!id) return null;
    const clean = id.trim().replace(/\.json$/i, '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(clean)) {
      window.alert('Use só letras minúsculas sem acento, números, - e _ (ex.: fase1, chefe-2).');
      return null;
    }
    return clean;
  }

  async saveToGame() {
    const id = this.askSongId();
    if (!id) return;
    if (id !== this.songId && getSong(id) && !window.confirm(`Já existe a música "${id}". Substituir?`)) return;
    try {
      const response = await fetch(`${SAVE_URL}?id=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializeSong(this.song),
      });
      if (!response.ok) throw new Error((await response.text()) || `erro ${response.status}`);
      registerSong(id, this.song);
      this.songId = id;
      this.isDirty = false;
      this.clearAutosave();
      playSfx(this, 'save');
      this.setMessage(`Salva em src/audio/songs/${id}.json. Ligue à fase em config/phases.js com music: '${id}'.`);
      this.redraw();
    } catch (err) {
      playSfx(this, 'error');
      window.alert(`Não deu para salvar no jogo (${err.message}). Use "Baixar .json" e coloque o arquivo em src/audio/songs/.`);
    }
  }

  downloadSong() {
    const id = this.askSongId();
    if (!id) return;
    const blob = new Blob([serializeSong(this.song)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.songId = id;
    this.isDirty = false;
    this.clearAutosave();
    playSfx(this, 'save');
    this.setMessage(`Baixada como ${id}.json: coloque em src/audio/songs/ para o jogo usar.`);
    this.redraw();
  }

  autosaveTick() {
    if (!this.isDirty) return;
    try {
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ savedAt: Date.now(), songId: this.songId, song: this.song })
      );
    } catch {
      // localStorage indisponível ou cheio: o rascunho automático é só uma rede de segurança
    }
  }

  clearAutosave() {
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      // ignore
    }
  }

  maybeOfferAutosaveRestore() {
    let saved;
    try {
      saved = JSON.parse(window.localStorage.getItem(AUTOSAVE_KEY));
    } catch {
      this.clearAutosave();
      return;
    }
    if (!saved || !isValidSong(saved.song)) return;
    const when = new Date(saved.savedAt).toLocaleTimeString('pt-BR');
    if (window.confirm(`Encontramos um rascunho de música salvo automaticamente às ${when}. Restaurar?`)) {
      this.loadSong(normalizeSong(saved.song), saved.songId ?? null);
      this.isDirty = true;
      this.redraw();
    } else {
      this.clearAutosave();
    }
  }

  // ---------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------
  goBack() {
    this.autosaveTick();
    session = {
      song: this.song,
      songId: this.songId,
      isDirty: this.isDirty,
      orderIndex: this.orderIndex,
      cursor: this.cursor,
      instrument: this.instrument,
      octave: this.octave,
      step: this.step,
      follow: this.follow,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
      clipboard: this.clipboard,
    };
    playSfx(this, 'back');
    if (this.returnTo && this.scene.isSleeping(this.returnTo)) {
      this.scene.wake(this.returnTo);
      this.scene.stop();
    } else {
      this.scene.start('LevelEditor');
    }
  }
}
