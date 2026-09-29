import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, EDITOR_GRID, COLORS } from '../config/constants.js';
import { TILE_MANIFEST, OBJECT_MANIFEST } from '../config/assetManifest.js';
import { instantiateSprite } from '../levels/LevelLoader.js';
import { isSlopeKey } from '../levels/slopes.js';
import { playSfx } from '../audio/sfx.js';
import {
  buildLevelData,
  downloadLevelJSON,
  parseLevelFile,
  findLevelProblems,
  isValidLevelData,
  normalizeLevelData,
} from '../levels/LevelSerializer.js';
import {
  ENTITY_TYPES,
  ENTITY_ORDER,
  ENEMY_ORDER,
  CHANNELS,
  CHANNEL_COLORS,
  createEntityPreview,
  entityLayer,
  ENTITY_LAYERS,
} from '../levels/entityCatalog.js';
import {
  resolveAssetSettings,
  inheritedAssetSettings,
  settingsFor,
  variantOf,
  variantId,
  parseVariantId,
  variantLabel,
  pieceCollision,
  spriteArea,
  MAX_ASSET_TILES,
  MAX_ASSET_OFFSET,
  MIN_ASSET_SCALE,
  MAX_ASSET_SCALE,
} from '../levels/assetSettings.js';
import { getOfficialLevel } from '../levels/officialLevels.js';

// Editor de fases (Fase 5 do livro; uso no computador, com mouse e teclado).
// Monta fases jogáveis: chão e objetos (na grade, com tamanho, posição fina
// e colisão ajustáveis por asset) e as peças de mecânica (personagens, água,
// alavancas, portões...). "Testar" joga a fase na PlayScene e volta pra cá;
// "Salvar" baixa o .json — colocado em src/levels/data/faseN.json, vira a
// fase N do livro.

const PALETTE_HEIGHT = 276;
// Faixa do rodapé com a barra de rolagem. Paleta + grade (12 × 64 = 768) +
// rodapé = 1080: a grade cabe inteira na altura, só rola na horizontal.
const SCROLLBAR_AREA = 36;
const SCROLL_TRACK = { x: 16, y: GAME_HEIGHT - 26, w: GAME_WIDTH - 32 - 240, h: 16 };
const SWATCH_SIZE = 40;
const SWATCH_GAP = 46;
const PANEL_X = 1130; // painel de ajustes do asset, à direita da paleta
const PAN_SPEED = 500;
const MAX_HISTORY = 50;
const AUTOSAVE_KEY = 'mortovivo_level_autosave';
const AUTOSAVE_INTERVAL_MS = 15000;
const ENTITY_DEPTH = 10;
const OVERLAY_DEPTH = 20;
// duplo clique numa peça (sem pincel) = pegar ela pra levar pra outro lugar
const DOUBLE_CLICK_MS = 350;
// peça no pincel e peça sendo carregada aparecem translúcidas
const PREVIEW_ALPHA = 0.5;
const HINT =
  'Clique: colocar/selecionar · Botão direito: apagar · Roda do mouse (ou setas, sem seleção): rolar · Home/End: início/fim · P: testar · Ctrl+Z/Y';

function entityKey(col, row, type) {
  return `${col},${row},${entityLayer(type)}`;
}

// peça de chão/objeto tem `key`; peça de mecânica tem `type`
function isSprite(piece) {
  return 'key' in piece;
}

function areasOverlap(a, b) {
  return a.c0 <= b.c1 && b.c0 <= a.c1 && a.r0 <= b.r1 && b.r0 <= a.r1;
}

export default class LevelEditorScene extends Phaser.Scene {
  constructor() {
    super('LevelEditor');
  }

  create() {
    const worldWidth = EDITOR_GRID.COLS * TILE_SIZE;
    const worldHeight = EDITOR_GRID.ROWS * TILE_SIZE;

    // A paleta ocupa o topo da tela e a barra de rolagem o rodapé: os limites
    // da câmera incluem essas faixas, então a grade inteira aparece entre as
    // duas (e não escondida atrás delas). A altura bate com a tela: só rola
    // na horizontal.
    this.worldWidth = worldWidth;
    this.cameras.main.setBounds(0, -PALETTE_HEIGHT, worldWidth, worldHeight + PALETTE_HEIGHT + SCROLLBAR_AREA);
    this.cameras.main.setScroll(0, -PALETTE_HEIGHT);

    this.sprites = []; // chão e objetos, em ordem de desenho: { key, col, row, image }
    this.assetSettings = {}; // ajustes por asset que diferem do padrão (ver assetSettings)
    this.entities = new Map(); // "col,row,camada" -> { type, col, row, channel, view }
    this.selectedBrush = null; // { type: 'sprite'|'entity', key }
    this.selectedChannel = null; // cor de conexão pras peças que usam
    this.selection = new Set(); // peças selecionadas (sem pincel)
    this.selectGesture = null; // clique/arraste de seleção em andamento
    this.lastClick = null; // { piece, time } pra detectar duplo clique
    this.carry = null; // peças "grudadas" no mouse depois do duplo clique
    this.brushPreview = null; // prévia translúcida da peça do pincel
    this.isPainting = false;
    this.showCollision = false;

    this.isDirty = false;
    this.undoStack = [];
    this.redoStack = [];

    this.drawGridOverlay(worldWidth, worldHeight);
    this.collisionOverlay = this.add.graphics().setDepth(OVERLAY_DEPTH);
    this.ghost = this.add.graphics().setDepth(OVERLAY_DEPTH + 1);
    this.selectionGfx = this.add.graphics().setDepth(OVERLAY_DEPTH + 2);
    this.buildToolbar();
    this.buildPalette();
    this.buildAssetPanel();
    this.buildScrollbar();
    this.buildFileInput();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-HOME', () => {
      playSfx(this, 'tick');
      this.cameras.main.setScroll(0, this.cameras.main.scrollY);
    });
    this.input.keyboard.on('keydown-END', () => {
      playSfx(this, 'tick');
      this.scrollToContentEnd();
    });
    this.input.keyboard.on('keydown-P', () => this.startTest());
    // seleção: H/V espelham, C liga/desliga colisão, Del apaga, setas movem
    this.input.keyboard.on('keydown-H', () => this.flipSelection('x'));
    this.input.keyboard.on('keydown-V', () => this.flipSelection('y'));
    this.input.keyboard.on('keydown-C', () => this.toggleSelectionCollision());
    this.input.keyboard.on('keydown-DELETE', () => this.deleteSelection());
    this.input.keyboard.on('keydown-BACKSPACE', () => this.deleteSelection());
    this.input.keyboard.on('keydown-LEFT', (event) => this.handleArrow(event, -1, 0));
    this.input.keyboard.on('keydown-RIGHT', (event) => this.handleArrow(event, 1, 0));
    this.input.keyboard.on('keydown-UP', (event) => this.handleArrow(event, 0, -1));
    this.input.keyboard.on('keydown-DOWN', (event) => this.handleArrow(event, 0, 1));
    // Esc: larga o pincel (volta a selecionar) e limpa a seleção
    // (carregando uma peça, Esc devolve ela pro lugar)
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.carry) {
        this.cancelCarry();
        return;
      }
      playSfx(this, 'back');
      this.selectBrush(null);
    });
    this.input.keyboard.on('keydown-Z', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    });
    this.input.keyboard.on('keydown-Y', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      this.redo();
    });

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', (pointer) => {
      this.isPainting = false;
      this.finishSelectGesture(pointer);
    });
    // roda do mouse rola a fase pros lados (a fase é comprida, não alta)
    this.input.on('wheel', (pointer, over, deltaX, deltaY) => {
      this.cameras.main.scrollX += deltaX + deltaY;
    });

    this.beforeUnloadHandler = (event) => {
      if (!this.isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    this.autosaveTimer = this.time.addEvent({
      delay: AUTOSAVE_INTERVAL_MS,
      loop: true,
      callback: () => this.autosaveTick(),
    });

    this.events.once('shutdown', () => {
      this.fileInput.remove();
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    });

    this.maybeOfferAutosaveRestore();
  }

  // ---------------------------------------------------------------------
  // UI: grid, toolbar, paleta
  // ---------------------------------------------------------------------
  drawGridOverlay(worldWidth, worldHeight) {
    const g = this.add.graphics();
    g.lineStyle(1, COLORS.EDITOR_GRID_LINE, 0.15);
    for (let x = 0; x <= worldWidth; x += TILE_SIZE) {
      g.lineBetween(x, 0, x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += TILE_SIZE) {
      g.lineBetween(0, y, worldWidth, y);
    }
    // borda do fundo do mundo: abaixo dela é "buraco" (cair = morrer)
    g.lineStyle(3, 0xff6666, 0.6);
    g.lineBetween(0, worldHeight, worldWidth, worldHeight);
  }

  uiText(x, y, text, style = {}) {
    return this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '12px', color: '#8888aa', ...style })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  uiButton(x, y, label, onClick, style = {}) {
    const button = this.uiText(x, y, label, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#333355',
      padding: { x: 8, y: 6 },
      ...style,
    }).setInteractive({ useHandCursor: true });
    button.on('pointerdown', (pointer) => {
      playSfx(this, 'click');
      onClick(pointer);
    });
    return button;
  }

  buildToolbar() {
    // fundo da área de UI: esconde o mundo que passa por baixo
    this.add
      .rectangle(0, 0, GAME_WIDTH, PALETTE_HEIGHT, COLORS.EDITOR_BG)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999);

    let x = 16;
    const gap = 10;
    for (const [label, onClick] of [
      ['Salvar', () => this.saveLevel()],
      ['Abrir', () => this.handleLoadClick()],
      ['Modelo: Fase 1', () => this.loadOfficialTemplate('fase1')],
      ['Limpar', () => this.clearLevel(true)],
      ['Desfazer', () => this.undo()],
      ['Refazer', () => this.redo()],
      ['Selecionar (Esc)', () => this.selectBrush(null)],
      ['Testar (P)', () => this.startTest()],
      ['Menu', () => this.goToMenu()],
    ]) {
      x += this.uiButton(x, 14, label, onClick).width + gap;
    }
    this.collisionButton = this.uiButton(x, 14, '', () => this.toggleCollisionView());
    this.refreshCollisionButton();

    this.brushLabel = this.uiText(16, 48, 'Pincel: nenhum', { color: '#cccccc' });
    this.uiText(420, 48, HINT);
  }

  buildPalette() {
    this.paletteHighlight = this.add
      .rectangle(0, 0, SWATCH_SIZE + 6, SWATCH_SIZE + 6)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(1001)
      .setVisible(false);

    this.uiText(16, 72, 'Chão');
    TILE_MANIFEST.forEach((tile, i) => {
      this.addImageSwatch(16 + i * SWATCH_GAP, 90, tile.key);
    });

    // inimigos na mesma linha do chão (a de peças não tem mais espaço)
    const enemiesX = 16 + TILE_MANIFEST.length * SWATCH_GAP + 40;
    this.uiText(enemiesX, 72, 'Inimigos');
    ENEMY_ORDER.forEach((type, i) => {
      this.addEntitySwatch(enemiesX + i * SWATCH_GAP, 90, type);
    });

    this.uiText(16, 140, 'Objetos');
    OBJECT_MANIFEST.forEach((obj, i) => {
      this.addImageSwatch(16 + i * SWATCH_GAP, 158, obj.key);
    });

    this.uiText(16, 208, 'Peças');
    ENTITY_ORDER.forEach((type, i) => {
      this.addEntitySwatch(16 + i * SWATCH_GAP, 226, type);
    });

    this.buildChannelPicker(16 + ENTITY_ORDER.length * SWATCH_GAP + 40, 226);
  }

  addImageSwatch(x, y, key) {
    const swatch = this.add.image(x + SWATCH_SIZE / 2, y + SWATCH_SIZE / 2, key).setScrollFactor(0).setDepth(1000);
    // cabe no quadradinho sem distorcer
    swatch.setScale(Math.min(SWATCH_SIZE / swatch.width, SWATCH_SIZE / swatch.height));
    this.add
      .rectangle(x, y, SWATCH_SIZE, SWATCH_SIZE, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        playSfx(this, 'select');
        this.selectBrush({ type: 'sprite', key }, x, y);
      });
  }

  addEntitySwatch(x, y, type) {
    const bg = this.add
      .rectangle(x, y, SWATCH_SIZE, SWATCH_SIZE, 0x262645)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      playSfx(this, 'select');
      this.selectBrush({ type: 'entity', key: type }, x, y);
    });
    createEntityPreview(this, type, null, SWATCH_SIZE)
      .setPosition(x + SWATCH_SIZE / 2, y + SWATCH_SIZE / 2)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  // Cor de conexão: alavanca/botão de uma cor aciona portões, grades, pontes,
  // escadas e chaves da mesma cor.
  buildChannelPicker(x, y) {
    this.uiText(x, y - 18, 'Cor de conexão (alavanca/botão aciona a mesma cor)');
    this.channelRing = this.add.graphics().setScrollFactor(0).setDepth(1001);
    this.channelOptions = [];

    const options = [null, ...CHANNELS];
    options.forEach((channel, i) => {
      const cx = x + 20 + i * 50;
      const cy = y + 20;
      const dot = channel
        ? this.add.circle(cx, cy, 16, CHANNEL_COLORS[channel])
        : this.add.circle(cx, cy, 16, 0x262645).setStrokeStyle(2, 0x8888aa);
      dot.setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
      dot.on('pointerdown', () => {
        playSfx(this, 'select');
        this.selectChannel(channel);
      });
      if (!channel) this.uiText(cx, cy, 'sem', { fontSize: '10px', color: '#cccccc' }).setOrigin(0.5);
      this.channelOptions.push({ channel, cx, cy });
    });
    this.selectChannel(null);
  }

  selectChannel(channel) {
    this.selectedChannel = channel;
    if (this.selectedBrush?.type === 'entity') this.rebuildBrushPreview(); // bolinha de cor da prévia
    const option = this.channelOptions.find((o) => o.channel === channel);
    this.channelRing.clear().lineStyle(3, 0xffffff, 1).strokeCircle(option.cx, option.cy, 21);
    this.refreshBrushLabel();
  }

  // ---------------------------------------------------------------------
  // Painel à direita da paleta. Em cima: ajustes do asset (chão/objeto do
  // pincel, ou das peças selecionadas se forem todas do mesmo asset) — valem
  // pra todas as cópias. Embaixo: ações da seleção (espelhar, apagar), que
  // valem só pras peças selecionadas.
  // ---------------------------------------------------------------------
  buildAssetPanel() {
    const x = PANEL_X;
    this.panelTitle = this.uiText(x, 68, '', { color: '#cccccc' });
    this.assetWidgets = [];
    this.panelValues = {};
    this.panelToggles = {};

    const label = (lx, y, text) => {
      const widget = this.uiText(lx, y + 6, text, { fontSize: '13px', color: '#cccccc' });
      this.assetWidgets.push(widget);
    };
    // [-] valor [+]; `step` = passo normal, Shift + clique = passo grande
    const stepper = (sx, y, text, field, min, max, step, bigStep) => {
      label(sx, y, text);
      const minus = this.uiButton(sx + 120, y, '−', (pointer) =>
        this.stepAssetSetting(field, -(pointer.event.shiftKey ? bigStep : step), min, max)
      );
      const value = this.uiText(sx + 162, y + 6, '', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0);
      const plus = this.uiButton(sx + 182, y, '+', (pointer) =>
        this.stepAssetSetting(field, pointer.event.shiftKey ? bigStep : step, min, max)
      );
      this.panelValues[field] = value;
      this.assetWidgets.push(minus, value, plus);
    };
    const toggle = (tx, y, text, name, onClick) => {
      label(tx, y, text);
      const button = this.uiButton(tx + 120, y, '', onClick);
      this.panelToggles[name] = button;
      this.assetWidgets.push(button);
    };

    // ajustes do asset (todas as cópias)
    stepper(x, 88, 'Largura (tiles)', 'cols', 1, MAX_ASSET_TILES, 1, 1);
    stepper(x + 270, 88, 'Altura (tiles)', 'rows', 1, MAX_ASSET_TILES, 1, 1);
    stepper(x, 118, 'Mover sprite X', 'offsetX', -MAX_ASSET_OFFSET, MAX_ASSET_OFFSET, 1, 8);
    stepper(x + 270, 118, 'Mover sprite Y', 'offsetY', -MAX_ASSET_OFFSET, MAX_ASSET_OFFSET, 1, 8);
    stepper(x, 148, 'Tamanho (%)', 'scale', MIN_ASSET_SCALE, MAX_ASSET_SCALE, 5, 25);
    toggle(x + 270, 148, 'Esticar', 'stretch', () => this.toggleAssetFlag('stretch'));
    this.assetWidgets.push(this.uiButton(x, 178, 'Restaurar padrão', () => this.resetAssetSettings()));

    // ações da seleção (só as peças selecionadas)
    this.selectionLabel = this.uiText(x, 218, '', { fontSize: '13px', color: '#9fe0ff' });
    this.selectionCollisionButton = this.uiButton(x + 428, 212, '', () => this.toggleSelectionCollision());
    this.selectionWidgets = [
      this.selectionLabel,
      this.uiButton(x + 140, 212, 'Espelhar ↔ · H', () => this.flipSelection('x')),
      this.uiButton(x + 284, 212, 'Espelhar ↕ · V', () => this.flipSelection('y')),
      this.selectionCollisionButton,
      this.uiButton(x + 610, 212, 'Apagar · Del', () => this.deleteSelection()),
    ];

    this.panelTip = this.uiText(x, 250, '');
    this.refreshAssetPanel();
  }

  selectedSpriteKey() {
    return this.selectedBrush?.type === 'sprite' ? this.selectedBrush.key : null;
  }

  // Variante que o painel ajusta ("asset" ou "asset|x"...): a normal do
  // pincel, ou a das peças selecionadas (se forem todas chão/objeto do mesmo
  // asset e espelhadas do mesmo jeito).
  panelVariantId() {
    const brushKey = this.selectedSpriteKey();
    if (brushKey) return variantId(brushKey, '');
    const pieces = [...this.selection];
    if (pieces.length === 0 || !pieces.every(isSprite)) return null;
    const ids = new Set(pieces.map((piece) => variantId(piece.key, variantOf(piece))));
    return ids.size === 1 ? [...ids][0] : null;
  }

  panelSettings(id) {
    const { key, variant } = parseVariantId(id);
    return resolveAssetSettings(this.assetSettings, key, variant);
  }

  refreshAssetPanel() {
    const id = this.panelVariantId();
    for (const widget of this.assetWidgets) widget.setVisible(Boolean(id));
    for (const widget of this.selectionWidgets) widget.setVisible(this.selection.size > 0);

    if (this.selection.size > 0) {
      const count = this.selection.size;
      this.selectionLabel.setText(`Seleção: ${count} ${count === 1 ? 'peça' : 'peças'}`);
      const sprites = [...this.selection].filter(isSprite);
      const solid = sprites.filter(pieceCollision).length;
      const state = sprites.length === 0 ? '—' : solid === sprites.length ? 'Sim' : solid === 0 ? 'Não' : 'misto';
      this.selectionCollisionButton
        .setText(`Colisão: ${state} · C`)
        .setBackgroundColor(state === 'Sim' ? '#2f7a4a' : state === 'Não' ? '#553333' : '#333355');
    }
    this.panelTip.setText(
      this.selectedBrush
        ? 'Shift + clique: passos maiores · a colisão ocupa a área na grade; "Mover sprite" só ajusta o desenho\nEsc: largar o pincel e voltar a selecionar'
        : 'Sem pincel: clique seleciona · Shift+clique soma/tira · arraste num espaço pra selecionar uma área\nSetas movem · H/V espelham · C colisão · Del apaga (só as peças selecionadas) · Esc limpa'
    );

    if (!id) {
      this.panelTitle.setText(
        this.selection.size > 0
          ? 'Os ajustes do desenho aparecem quando a seleção é de um só asset, espelhado do mesmo jeito.'
          : 'Escolha um chão ou objeto na paleta, ou selecione peças na fase, pra ajustar.'
      );
      return;
    }
    const { key, variant } = parseVariantId(id);
    const settings = this.panelSettings(id);
    const inherits = variant && !this.assetSettings[id] ? ' (herdando do normal)' : '';
    this.panelTitle.setText(`Ajustes de "${key}" ${variantLabel(variant)}${inherits} — valem pra todas as cópias assim`);
    for (const [field, text] of Object.entries(this.panelValues)) text.setText(String(settings[field]));
    const onOff = (button, on) => button.setText(on ? 'Sim' : 'Não').setBackgroundColor(on ? '#2f7a4a' : '#553333');
    onOff(this.panelToggles.stretch, settings.stretch);
  }

  stepAssetSetting(field, delta, min, max) {
    const id = this.panelVariantId();
    if (!id) return;
    const current = this.panelSettings(id)[field];
    const next = Phaser.Math.Clamp(current + delta, min, max);
    if (next !== current) this.setAssetSettings(id, { [field]: next });
    else playSfx(this, 'nope'); // já no limite
  }

  toggleAssetFlag(field) {
    const id = this.panelVariantId();
    if (!id) return;
    this.setAssetSettings(id, { [field]: !this.panelSettings(id)[field] });
  }

  // Restaurar: a normal volta ao padrão; a espelhada volta a herdar da normal.
  resetAssetSettings() {
    const id = this.panelVariantId();
    if (!id || !this.assetSettings[id]) {
      playSfx(this, 'nope');
      return;
    }
    this.beforeMutate();
    delete this.assetSettings[id];
    this.afterAssetChange();
  }

  // Guarda só o que difere do herdado (se voltar a ficar igual, some).
  setAssetSettings(id, changes) {
    this.beforeMutate();
    const { key, variant } = parseVariantId(id);
    const inherited = inheritedAssetSettings(this.assetSettings, key, variant);
    const merged = { ...(this.assetSettings[id] ?? {}), ...changes };
    const own = Object.fromEntries(Object.entries(merged).filter(([field, value]) => inherited[field] !== value));
    if (Object.keys(own).length > 0) this.assetSettings[id] = own;
    else delete this.assetSettings[id];
    this.afterAssetChange();
  }

  // Todas as cópias mudam juntas: redesenha as imagens (na mesma ordem).
  afterAssetChange() {
    this.rerenderSprites();
    this.rebuildBrushPreview(); // o tamanho da peça pode ter mudado
    this.refreshAssetPanel();
    this.drawSelection();
  }

  // ---------------------------------------------------------------------
  // Seleção (sem pincel): clique numa peça, Shift+clique soma/tira, arrastar
  // num espaço seleciona uma área. Com peças selecionadas: setas movem,
  // H/V espelham (cada peça individualmente), Del apaga.
  // Peça = registro de chão/objeto (tem `key`) ou de peça de mecânica (`type`).
  // ---------------------------------------------------------------------
  pieceArea(piece) {
    return isSprite(piece) ? this.areaOf(piece) : { c0: piece.col, c1: piece.col, r0: piece.row, r1: piece.row };
  }

  // Peça por cima numa célula: mecânica (camadas de cima pra baixo) > chão/objeto.
  pieceAt(cell) {
    for (const layer of ENTITY_LAYERS) {
      const entity = this.entities.get(`${cell.col},${cell.row},${layer}`);
      if (entity) return entity;
    }
    const point = { c0: cell.col, c1: cell.col, r0: cell.row, r1: cell.row };
    return this.sprites.findLast((sprite) => areasOverlap(this.areaOf(sprite), point)) ?? null;
  }

  piecesInArea(area) {
    const entities = [...this.entities.values()].filter((entity) => areasOverlap(this.pieceArea(entity), area));
    const sprites = this.sprites.filter((sprite) => areasOverlap(this.areaOf(sprite), area));
    return [...entities, ...sprites];
  }

  setSelection(pieces, additive = false) {
    if (!additive) this.selection.clear();
    for (const piece of pieces) {
      // Shift+clique numa peça já selecionada tira ela da seleção
      if (additive && pieces.length === 1 && this.selection.has(piece)) this.selection.delete(piece);
      else this.selection.add(piece);
    }
    this.selectionChanged();
  }

  clearSelection() {
    if (this.selection.size === 0) return;
    this.selection.clear();
    this.selectionChanged();
  }

  selectionChanged() {
    this.drawSelection();
    this.refreshAssetPanel();
  }

  drawSelection() {
    const g = this.selectionGfx.clear();
    g.lineStyle(3, 0x33ccff, 1);
    for (const piece of this.selection) {
      const { c0, c1, r0, r1 } = this.pieceArea(piece);
      g.strokeRect(c0 * TILE_SIZE, r0 * TILE_SIZE, (c1 - c0 + 1) * TILE_SIZE, (r1 - r0 + 1) * TILE_SIZE);
    }
  }

  // Clique sem pincel: começa uma seleção (vira clique ou retângulo ao soltar).
  startSelectGesture(pointer) {
    this.selectGesture = { x: pointer.worldX, y: pointer.worldY, additive: pointer.event.shiftKey, dragging: false };
  }

  updateSelectGesture(pointer) {
    const gesture = this.selectGesture;
    if (!gesture) return;
    if (!gesture.dragging && Phaser.Math.Distance.Between(gesture.x, gesture.y, pointer.worldX, pointer.worldY) > 8) {
      gesture.dragging = true;
    }
    if (!gesture.dragging) return;
    const x = Math.min(gesture.x, pointer.worldX);
    const y = Math.min(gesture.y, pointer.worldY);
    this.ghost.clear().fillStyle(0x33ccff, 0.15).lineStyle(2, 0x33ccff, 0.9);
    this.ghost.fillRect(x, y, Math.abs(pointer.worldX - gesture.x), Math.abs(pointer.worldY - gesture.y));
    this.ghost.strokeRect(x, y, Math.abs(pointer.worldX - gesture.x), Math.abs(pointer.worldY - gesture.y));
  }

  finishSelectGesture(pointer) {
    const gesture = this.selectGesture;
    this.selectGesture = null;
    if (!gesture) return;
    this.ghost.clear();

    if (gesture.dragging) {
      const toCell = (value) => Math.floor(value / TILE_SIZE);
      const area = {
        c0: toCell(Math.min(gesture.x, pointer.worldX)),
        c1: toCell(Math.max(gesture.x, pointer.worldX)),
        r0: toCell(Math.min(gesture.y, pointer.worldY)),
        r1: toCell(Math.max(gesture.y, pointer.worldY)),
      };
      const pieces = this.piecesInArea(area);
      playSfx(this, pieces.length > 0 ? 'select' : 'tick');
      this.setSelection(pieces, gesture.additive);
      return;
    }

    const cell = this.cellOf(gesture.x, gesture.y);
    const piece = cell && this.pieceAt(cell);
    const now = Date.now();
    const isDoubleClick = piece && this.lastClick?.piece === piece && now - this.lastClick.time < DOUBLE_CLICK_MS;
    this.lastClick = piece ? { piece, time: now } : null;
    if (isDoubleClick && !gesture.additive) {
      this.lastClick = null;
      this.startCarry(piece, cell);
      return;
    }
    // (o 2º clique de um duplo clique numa peça de uma seleção maior não
    // deve desfazer a seleção — então clique simples numa peça já
    // selecionada, sem Shift, mantém a seleção como está)
    if (piece && !gesture.additive && this.selection.has(piece) && this.selection.size > 1) return;
    playSfx(this, piece ? 'select' : 'tick');
    if (piece) this.setSelection([piece], gesture.additive);
    else if (!gesture.additive) this.clearSelection();
  }

  // Espelha cada chão/objeto selecionado no próprio lugar. Espelhar troca a
  // variante da peça, que tem os próprios ajustes: a imagem é recriada.
  flipSelection(axis) {
    if (this.carry) return; // com peça no ar: primeiro solte ou devolva
    const sprites = [...this.selection].filter(isSprite);
    if (sprites.length === 0) return;
    this.beforeMutate();
    const field = axis === 'x' ? 'flipX' : 'flipY';
    for (const sprite of sprites) {
      sprite[field] = !sprite[field];
      this.redrawSprite(sprite);
    }
    playSfx(this, 'flip');
    this.selectionChanged();
  }

  // Liga/desliga a colisão das peças selecionadas (se todas estão ligadas,
  // desliga; senão, liga todas).
  toggleSelectionCollision() {
    if (this.carry) return; // com peça no ar: primeiro solte ou devolva
    const sprites = [...this.selection].filter(isSprite);
    if (sprites.length === 0) return;
    this.beforeMutate();
    const turnOn = !sprites.every(pieceCollision);
    for (const sprite of sprites) sprite.collision = turnOn;
    playSfx(this, 'toggle');
    this.selectionChanged();
  }

  deleteSelection() {
    if (this.carry) return; // com peça no ar: primeiro solte ou devolva
    if (this.selection.size === 0) return;
    this.beforeMutate();
    for (const piece of [...this.selection]) {
      if (isSprite(piece)) this.removeSprite(piece);
      else this.removeEntity(entityKey(piece.col, piece.row, piece.type));
    }
    playSfx(this, 'erase');
    this.clearSelection();
  }

  // Move a seleção uma célula. Não move se alguma peça sair da grade ou se
  // uma peça de mecânica cair numa célula já ocupada (na mesma camada).
  moveSelection(dc, dr) {
    if (this.carry) return; // com peça no ar: primeiro solte ou devolva
    const pieces = [...this.selection];
    const movedKeys = new Set(pieces.filter((p) => !isSprite(p)).map((p) => entityKey(p.col, p.row, p.type)));
    for (const piece of pieces) {
      const area = this.pieceArea(piece);
      const blocked = () => playSfx(this, 'nope');
      if (!this.areaFits({ c0: area.c0 + dc, c1: area.c1 + dc, r0: area.r0 + dr, r1: area.r1 + dr })) return blocked();
      if (!isSprite(piece)) {
        const target = entityKey(piece.col + dc, piece.row + dr, piece.type);
        if (this.entities.has(target) && !movedKeys.has(target)) return blocked();
      }
    }

    this.beforeMutate();
    for (const piece of pieces.filter((p) => !isSprite(p))) this.entities.delete(entityKey(piece.col, piece.row, piece.type));
    for (const piece of pieces) {
      piece.col += dc;
      piece.row += dr;
      if (isSprite(piece)) {
        this.redrawSprite(piece);
      } else {
        piece.view.setPosition(piece.col * TILE_SIZE + TILE_SIZE / 2, piece.row * TILE_SIZE + TILE_SIZE / 2);
        this.entities.set(entityKey(piece.col, piece.row, piece.type), piece);
      }
    }
    playSfx(this, 'tick');
    this.drawSelection();
  }

  // Setas: com seleção movem as peças; sem seleção rolam a tela (no update).
  handleArrow(event, dc, dr) {
    if (this.selection.size === 0 || this.carry) return;
    event.preventDefault();
    this.moveSelection(dc, dr);
  }

  // ---------------------------------------------------------------------
  // Carregar (duplo clique numa peça): a peça — ou a seleção inteira, se ela
  // faz parte de uma — gruda no mouse, translúcida e encaixando na grade.
  // Clique solta no lugar novo; Esc ou botão direito devolvem pro lugar.
  // ---------------------------------------------------------------------
  displayOf(piece) {
    return isSprite(piece) ? piece.image : piece.view;
  }

  startCarry(piece, cell) {
    const pieces = this.selection.has(piece) && this.selection.size > 1 ? [...this.selection] : [piece];
    // foto da fase antes de mexer, pra entrar no desfazer quando soltar
    const snapshot = this.currentLevelData();
    // peças de mecânica saem do mapa enquanto voam (não bloqueiam a si mesmas)
    for (const p of pieces.filter((p) => !isSprite(p))) this.entities.delete(entityKey(p.col, p.row, p.type));
    this.carry = {
      snapshot,
      anchor: cell,
      dc: 0,
      dr: 0,
      valid: true,
      pieces: pieces.map((p) => ({ piece: p, x: this.displayOf(p).x, y: this.displayOf(p).y })),
    };
    for (const { piece: p } of this.carry.pieces) this.displayOf(p).setAlpha(PREVIEW_ALPHA);
    playSfx(this, 'pickup');
    this.setSelection(pieces);
    this.brushLabel.setText('Carregando: clique pra soltar · Esc ou botão direito devolve');
  }

  updateCarry(pointer) {
    const carry = this.carry;
    const cell = this.cellOf(pointer.worldX, pointer.worldY);
    if (!cell) return;
    carry.dc = cell.col - carry.anchor.col;
    carry.dr = cell.row - carry.anchor.row;

    const g = this.ghost.clear();
    carry.valid = true;
    for (const { piece, x, y } of carry.pieces) {
      this.displayOf(piece).setPosition(x + carry.dc * TILE_SIZE, y + carry.dr * TILE_SIZE);
      const area = this.pieceArea(piece);
      const moved = { c0: area.c0 + carry.dc, c1: area.c1 + carry.dc, r0: area.r0 + carry.dr, r1: area.r1 + carry.dr };
      const blocked =
        !this.areaFits(moved) ||
        (!isSprite(piece) && this.entities.has(entityKey(piece.col + carry.dc, piece.row + carry.dr, piece.type)));
      if (blocked) carry.valid = false;
      g.lineStyle(2, blocked ? 0xff4444 : 0xffffff, 0.9);
      g.strokeRect(moved.c0 * TILE_SIZE, moved.r0 * TILE_SIZE, (moved.c1 - moved.c0 + 1) * TILE_SIZE, (moved.r1 - moved.r0 + 1) * TILE_SIZE);
    }
    this.selectionGfx.clear(); // o contorno da seleção ficaria no lugar antigo
  }

  dropCarry() {
    const carry = this.carry;
    if (!carry.valid) {
      playSfx(this, 'nope');
      return;
    }
    this.carry = null;
    playSfx(this, 'place');
    this.ghost.clear();
    for (const { piece } of carry.pieces) {
      piece.col += carry.dc;
      piece.row += carry.dr;
      if (isSprite(piece)) {
        this.redrawSprite(piece); // recria no lugar novo, opaca
      } else {
        piece.view.setAlpha(1);
        this.entities.set(entityKey(piece.col, piece.row, piece.type), piece);
      }
    }
    if (carry.dc !== 0 || carry.dr !== 0) {
      this.undoStack.push(carry.snapshot);
      if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
      this.redoStack = [];
      this.isDirty = true;
      this.extentDirty = true;
    }
    this.refreshBrushLabel();
    this.drawSelection();
  }

  cancelCarry() {
    const carry = this.carry;
    if (!carry) return;
    this.carry = null;
    playSfx(this, 'back');
    this.ghost.clear();
    for (const { piece, x, y } of carry.pieces) {
      this.displayOf(piece).setPosition(x, y).setAlpha(1);
      if (!isSprite(piece)) this.entities.set(entityKey(piece.col, piece.row, piece.type), piece);
    }
    this.refreshBrushLabel();
    this.drawSelection();
  }

  // ---------------------------------------------------------------------
  // Prévia do pincel: a peça escolhida acompanha o mouse, translúcida, no
  // lugar exato onde vai ser colocada.
  // ---------------------------------------------------------------------
  rebuildBrushPreview() {
    this.brushPreview?.destroy();
    this.brushPreview = null;
    const brush = this.selectedBrush;
    if (!brush) return;
    if (brush.type === 'sprite') {
      // criada na célula (0, 0); a posição real é essa + o deslocamento da célula
      const image = instantiateSprite(this, { key: brush.key, col: 0, row: 0 }, resolveAssetSettings(this.assetSettings, brush.key), TILE_SIZE);
      image.baseX = image.x;
      image.baseY = image.y;
      this.brushPreview = image;
    } else {
      this.brushPreview = createEntityPreview(this, brush.key, this.channelFor(brush.key), TILE_SIZE);
      this.brushPreview.baseX = TILE_SIZE / 2;
      this.brushPreview.baseY = TILE_SIZE / 2;
    }
    this.brushPreview.setAlpha(PREVIEW_ALPHA).setDepth(OVERLAY_DEPTH).setVisible(false);
  }

  positionBrushPreview(cell) {
    const preview = this.brushPreview;
    if (!preview) return;
    preview.setVisible(Boolean(cell));
    if (cell) preview.setPosition(preview.baseX + cell.col * TILE_SIZE, preview.baseY + cell.row * TILE_SIZE);
  }

  // ---------------------------------------------------------------------
  // Barra de rolagem horizontal no rodapé: arrastar o pegador, ou clicar no
  // trilho pra pular até ali. A faixa mais clara no trilho mostra até onde a
  // fase já tem conteúdo.
  // ---------------------------------------------------------------------
  buildScrollbar() {
    const t = SCROLL_TRACK;
    const viewFraction = this.cameras.main.width / this.worldWidth;
    this.scrollThumbWidth = Math.max(40, t.w * viewFraction);

    this.add
      .rectangle(0, GAME_HEIGHT - SCROLLBAR_AREA, GAME_WIDTH, SCROLLBAR_AREA, COLORS.EDITOR_BG)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999);

    const track = this.add
      .rectangle(t.x, t.y, t.w, t.h, 0x262645)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    track.on('pointerdown', (pointer) => this.scrollToThumbX(pointer.x - this.scrollThumbWidth / 2));

    this.scrollContent = this.add
      .rectangle(t.x, t.y, 0, t.h, 0x5555aa, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.scrollThumb = this.add
      .rectangle(t.x, t.y, this.scrollThumbWidth, t.h, 0xccccee)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.scrollThumb.on('drag', (pointer, dragX) => this.scrollToThumbX(dragX));

    this.scrollLabel = this.uiText(t.x + t.w + 16, t.y, '', { fontSize: '13px', color: '#cccccc' });
    this.extentDirty = true;
  }

  // Posiciona a câmera a partir da posição (x na tela) do pegador da barra.
  scrollToThumbX(thumbX) {
    const t = SCROLL_TRACK;
    const fraction = Phaser.Math.Clamp((thumbX - t.x) / (t.w - this.scrollThumbWidth), 0, 1);
    this.cameras.main.scrollX = fraction * (this.worldWidth - this.cameras.main.width);
  }

  scrollToContentEnd() {
    // fim do conteúdo a 3/4 da tela, deixando espaço pra continuar construindo
    this.cameras.main.scrollX = this.contentEndX() - this.cameras.main.width * 0.75;
  }

  // x (no mundo) onde termina o conteúdo da fase.
  contentEndX() {
    let end = 0;
    for (const sprite of this.sprites) end = Math.max(end, (this.areaOf(sprite).c1 + 1) * TILE_SIZE);
    for (const entity of this.entities.values()) end = Math.max(end, (entity.col + 1) * TILE_SIZE);
    return end;
  }

  // Barra acompanha a câmera (que também rola por teclado e roda do mouse).
  syncScrollbar() {
    const t = SCROLL_TRACK;
    const camera = this.cameras.main;
    const maxScroll = this.worldWidth - camera.width;
    this.scrollThumb.x = t.x + (camera.scrollX / maxScroll) * (t.w - this.scrollThumbWidth);

    if (this.extentDirty) {
      this.extentDirty = false;
      this.scrollContent.setSize(Math.min(1, this.contentEndX() / this.worldWidth) * t.w, t.h);
      this.drawCollisionOverlay();
    }

    const firstCol = Math.floor(camera.scrollX / TILE_SIZE) + 1;
    const lastCol = Math.min(EDITOR_GRID.COLS, Math.floor((camera.scrollX + camera.width - 1) / TILE_SIZE) + 1);
    this.scrollLabel.setText(`Colunas ${firstCol}–${lastCol} de ${EDITOR_GRID.COLS}`);
  }

  // ---------------------------------------------------------------------
  // Ver colisão: pinta de vermelho as áreas sólidas de chão/objetos
  // ---------------------------------------------------------------------
  toggleCollisionView() {
    this.showCollision = !this.showCollision;
    this.refreshCollisionButton();
    this.drawCollisionOverlay();
  }

  refreshCollisionButton() {
    this.collisionButton.setText(this.showCollision ? 'Colisão: visível' : 'Colisão: oculta');
  }

  drawCollisionOverlay() {
    const g = this.collisionOverlay.clear();
    if (!this.showCollision) return;
    g.fillStyle(0xff3355, 0.35);
    g.lineStyle(2, 0xff3355, 0.9);
    for (const sprite of this.sprites) {
      if (!pieceCollision(sprite)) continue;
      const { c0, c1, r0, r1 } = this.areaOf(sprite);
      const x = c0 * TILE_SIZE;
      const y = r0 * TILE_SIZE;
      const w = (c1 - c0 + 1) * TILE_SIZE;
      const h = (r1 - r0 + 1) * TILE_SIZE;
      if (isSlopeKey(sprite.key)) {
        // rampa: a colisão é a superfície inclinada (sobe pra direita; ↔ pra esquerda)
        const highX = sprite.flipX ? x : x + w;
        const lowX = sprite.flipX ? x + w : x;
        g.fillTriangle(lowX, y + h, highX, y + h, highX, y);
        g.strokeTriangle(lowX, y + h, highX, y + h, highX, y);
        continue;
      }
      g.fillRect(x, y, w, h);
      g.strokeRect(x, y, w, h);
    }
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
        const data = await parseLevelFile(file);
        this.loadLevelData(data);
      } catch (err) {
        playSfx(this, 'error');
        window.alert('Erro ao carregar fase: ' + err.message);
      }
    });
    document.body.appendChild(input);
    this.fileInput = input;
  }

  selectBrush(brush, swatchX, swatchY) {
    this.cancelCarry();
    this.selectedBrush = brush;
    this.selection.clear();
    this.drawSelection();
    this.rebuildBrushPreview();
    if (brush) {
      this.paletteHighlight
        .setPosition(swatchX + SWATCH_SIZE / 2, swatchY + SWATCH_SIZE / 2)
        .setVisible(true);
    } else {
      this.paletteHighlight.setVisible(false);
      this.ghost.clear();
    }
    this.refreshBrushLabel();
    this.refreshAssetPanel();
  }

  refreshBrushLabel() {
    const brush = this.selectedBrush;
    if (!brush) {
      this.brushLabel.setText('Pincel: nenhum');
      return;
    }
    if (brush.type === 'sprite') {
      this.brushLabel.setText(`Pincel: ${brush.key}`);
      return;
    }
    const info = ENTITY_TYPES[brush.key];
    const channel = this.channelFor(brush.key);
    const colorText = info.channel ? (channel ? ` · cor ${channel}` : ' · sem cor') : '';
    this.brushLabel.setText(`Pincel: ${info.label}${colorText}`);
  }

  // Cor que a peça recebe ao ser colocada: gatilhos sempre têm cor (padrão 1).
  channelFor(type) {
    const mode = ENTITY_TYPES[type].channel;
    if (mode === 'required') return this.selectedChannel ?? 1;
    if (mode === 'optional') return this.selectedChannel;
    return null;
  }

  // ---------------------------------------------------------------------
  // Pintura / posicionamento
  // ---------------------------------------------------------------------
  // Ponteiro em cima da paleta ou da barra de rolagem: não pinta a fase.
  isOverUi(pointer) {
    return pointer.y < PALETTE_HEIGHT || pointer.y >= GAME_HEIGHT - SCROLLBAR_AREA;
  }

  handlePointerDown(pointer) {
    if (this.isOverUi(pointer)) return;

    if (this.carry) {
      if (pointer.rightButtonDown()) this.cancelCarry();
      else this.dropCarry();
      return;
    }

    if (pointer.rightButtonDown()) {
      this.eraseAt(pointer.worldX, pointer.worldY);
      return;
    }

    if (!this.selectedBrush) {
      this.startSelectGesture(pointer);
      return;
    }

    const { type, key } = this.selectedBrush;
    if (type === 'sprite') {
      // arrastar pintando só faz sentido pra peças de 1 tile
      const settings = resolveAssetSettings(this.assetSettings, key);
      this.isPainting = settings.cols === 1 && settings.rows === 1;
      this.placeSpriteAt(pointer.worldX, pointer.worldY);
    } else {
      this.isPainting = Boolean(ENTITY_TYPES[key].paint);
      this.placeEntityAt(pointer.worldX, pointer.worldY);
    }
  }

  handlePointerMove(pointer) {
    if (this.carry) {
      this.updateCarry(pointer);
      return;
    }
    if (this.selectGesture) {
      this.updateSelectGesture(pointer);
      return;
    }
    this.drawGhost(pointer);
    if (!this.isPainting || this.isOverUi(pointer)) return;
    if (this.selectedBrush?.type === 'entity') this.placeEntityAt(pointer.worldX, pointer.worldY);
    else this.placeSpriteAt(pointer.worldX, pointer.worldY);
  }

  // Prévia do pincel embaixo do mouse: a área que a peça vai ocupar.
  drawGhost(pointer) {
    const g = this.ghost.clear();
    const cell = !this.isOverUi(pointer) && this.selectedBrush && this.cellOf(pointer.worldX, pointer.worldY);
    this.positionBrushPreview(cell || null);
    if (!cell) return;
    let area = { c0: cell.col, c1: cell.col, r0: cell.row, r1: cell.row };
    if (this.selectedBrush.type === 'sprite') {
      area = spriteArea(cell, resolveAssetSettings(this.assetSettings, this.selectedBrush.key));
    }
    const fits = this.areaFits(area);
    g.lineStyle(2, fits ? 0xffffff : 0xff4444, 0.9);
    g.strokeRect(area.c0 * TILE_SIZE, area.r0 * TILE_SIZE, (area.c1 - area.c0 + 1) * TILE_SIZE, (area.r1 - area.r0 + 1) * TILE_SIZE);
  }

  cellOf(worldX, worldY) {
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    const inside = col >= 0 && col < EDITOR_GRID.COLS && row >= 0 && row < EDITOR_GRID.ROWS;
    return inside ? { col, row } : null;
  }

  areaFits(area) {
    return area.c0 >= 0 && area.c1 < EDITOR_GRID.COLS && area.r0 >= 0 && area.r1 < EDITOR_GRID.ROWS;
  }

  areaOf(sprite) {
    return spriteArea(sprite, settingsFor(this.assetSettings, sprite));
  }

  // Coloca chão/objeto com a célula clicada como canto de baixo à esquerda.
  // O que estiver embaixo da área nova é substituído.
  placeSpriteAt(worldX, worldY) {
    const cell = this.cellOf(worldX, worldY);
    if (!cell) return;
    const key = this.selectedBrush.key;
    const area = spriteArea(cell, resolveAssetSettings(this.assetSettings, key));
    if (!this.areaFits(area)) return;

    const overlapping = this.sprites.filter((sprite) => areasOverlap(this.areaOf(sprite), area));
    const [only] = overlapping;
    const same = overlapping.length === 1 && only.key === key && only.col === cell.col && only.row === cell.row;
    if (same) return;

    this.beforeMutate();
    for (const sprite of overlapping) this.removeSprite(sprite);
    this.addSprite({ key, col: cell.col, row: cell.row });
    playSfx(this, 'place');
  }

  // collision ausente = padrão do asset (ver pieceCollision)
  addSprite({ key, col, row, flipX = false, flipY = false, collision }) {
    const sprite = { key, col, row, flipX, flipY, collision, image: null };
    sprite.image = instantiateSprite(this, sprite, settingsFor(this.assetSettings, sprite), TILE_SIZE);
    this.sprites.push(sprite);
  }

  removeSprite(sprite) {
    sprite.image.destroy();
    this.sprites.splice(this.sprites.indexOf(sprite), 1);
    this.selection.delete(sprite);
  }

  // Recria a imagem de uma peça no lugar dela na ordem de desenho.
  redrawSprite(sprite) {
    const depthIndex = this.children.getIndex(sprite.image);
    sprite.image.destroy();
    sprite.image = instantiateSprite(this, sprite, settingsFor(this.assetSettings, sprite), TILE_SIZE);
    this.children.moveTo(sprite.image, depthIndex);
    this.extentDirty = true;
  }

  // Recria todas as imagens na mesma ordem (depois de mudar ajustes de um asset).
  rerenderSprites() {
    for (const sprite of this.sprites) {
      sprite.image.destroy();
      sprite.image = instantiateSprite(this, sprite, settingsFor(this.assetSettings, sprite), TILE_SIZE);
    }
    this.extentDirty = true;
  }

  placeEntityAt(worldX, worldY) {
    const cell = this.cellOf(worldX, worldY);
    if (!cell) return;
    const type = this.selectedBrush.key;
    const channel = this.channelFor(type);
    const cellKey = entityKey(cell.col, cell.row, type);
    const existing = this.entities.get(cellKey);
    if (existing && existing.type === type && existing.channel === channel) return;

    this.beforeMutate();
    if (existing) this.removeEntity(cellKey);
    // Vivo/Esqueleto: só um de cada — colocar de novo muda de lugar
    if (ENTITY_TYPES[type].unique) {
      for (const [key, entity] of this.entities) {
        if (entity.type === type) this.removeEntity(key);
      }
    }
    this.addEntity({ type, col: cell.col, row: cell.row, channel });
    playSfx(this, 'place');
  }

  addEntity({ type, col, row, channel }) {
    const view = createEntityPreview(this, type, channel ?? null, TILE_SIZE)
      .setPosition(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2)
      // camadas de baixo (água, ponte) desenhadas por baixo das de cima
      .setDepth(ENTITY_DEPTH - ENTITY_LAYERS.indexOf(entityLayer(type)));
    this.entities.set(entityKey(col, row, type), { type, col, row, channel: channel ?? null, view });
  }

  removeEntity(cellKey) {
    const entity = this.entities.get(cellKey);
    entity?.view.destroy();
    this.entities.delete(cellKey);
    if (entity) this.selection.delete(entity);
  }

  // Apaga o que estiver por cima: peça > ponte > água > chão/objeto.
  eraseAt(worldX, worldY) {
    const cell = this.cellOf(worldX, worldY);
    if (!cell) return;
    const cellKey = `${cell.col},${cell.row}`;

    const entityHit = ENTITY_LAYERS.map((layer) => `${cellKey},${layer}`).find((key) => this.entities.has(key));
    if (entityHit) {
      this.beforeMutate();
      this.removeEntity(entityHit);
      playSfx(this, 'erase');
      return;
    }

    const point = { c0: cell.col, c1: cell.col, r0: cell.row, r1: cell.row };
    const spriteHit = this.sprites.findLast((sprite) => areasOverlap(this.areaOf(sprite), point));
    if (spriteHit) {
      this.beforeMutate();
      this.removeSprite(spriteHit);
      playSfx(this, 'erase');
    } else {
      playSfx(this, 'nope');
    }
  }

  // ---------------------------------------------------------------------
  // Salvar / carregar / limpar
  // ---------------------------------------------------------------------
  currentLevelData() {
    return buildLevelData(
      this.sprites,
      { tileSize: TILE_SIZE, cols: EDITOR_GRID.COLS, rows: EDITOR_GRID.ROWS },
      Array.from(this.entities.values()),
      this.assetSettings
    );
  }

  saveLevel() {
    const data = this.currentLevelData();
    const problems = findLevelProblems(data);
    if (problems.length > 0 && !window.confirm(`Essa fase ainda não é jogável (${problems.join(', ')}). Salvar mesmo assim?`)) {
      return;
    }
    const filename = window.prompt('Nome do arquivo (pra virar uma fase do livro: fase2.json, fase3.json...):', 'fase2.json');
    if (!filename) return;
    downloadLevelJSON(data, filename.endsWith('.json') ? filename : `${filename}.json`);
    playSfx(this, 'save');
    this.isDirty = false;
    this.clearAutosave();
  }

  handleLoadClick() {
    if (this.isDirty && !window.confirm('Você tem alterações não salvas. Abrir outro arquivo mesmo assim?')) {
      return;
    }
    this.fileInput.click();
  }

  loadOfficialTemplate(id) {
    if (this.isDirty && !window.confirm('Você tem alterações não salvas. Abrir o modelo mesmo assim?')) {
      return;
    }
    const data = getOfficialLevel(id);
    if (!data) {
      playSfx(this, 'error');
      window.alert(`Não encontrei a fase oficial "${id}".`);
      return;
    }
    this.loadLevelData(data);
  }

  clearLevel(confirmFirst = false) {
    if (confirmFirst) {
      if (!window.confirm('Limpar toda a fase?')) return;
      this.beforeMutate();
      playSfx(this, 'erase');
    }
    this.removeEverything();
    this.assetSettings = {};
    this.refreshAssetPanel();
  }

  removeEverything() {
    for (const sprite of this.sprites) sprite.image.destroy();
    this.sprites = [];
    this.selection.clear();
    this.drawSelection();
    for (const key of Array.from(this.entities.keys())) {
      this.removeEntity(key);
    }
    this.extentDirty = true;
  }

  // Monta a fase a partir de dados (arquivo, modelo, rascunho ou desfazer).
  applyLevelData(data) {
    this.removeEverything();
    this.assetSettings = structuredClone(data.assets ?? {});
    for (const sprite of data.tiles) this.addSprite(sprite);
    for (const entity of data.entities ?? []) this.addEntity(entity);
    this.refreshAssetPanel();
    this.extentDirty = true;
  }

  loadLevelData(data) {
    playSfx(this, 'load');
    this.applyLevelData(data);
    this.undoStack = [];
    this.redoStack = [];
    this.isDirty = false;
    this.cameras.main.setScroll(0, -PALETTE_HEIGHT);
  }

  // ---------------------------------------------------------------------
  // Testar: joga a fase de verdade na PlayScene. O editor "dorme" (fica
  // intacto, sem rodar) e a PlayScene acorda ele ao sair (ver exitLevel).
  // ---------------------------------------------------------------------
  startTest() {
    this.cancelCarry();
    const data = this.currentLevelData();
    const problems = findLevelProblems(data);
    if (problems.length > 0) {
      playSfx(this, 'error');
      window.alert(`Pra testar, falta: ${problems.join(', ')}.`);
      return;
    }
    playSfx(this, 'confirm');
    this.isPainting = false;
    this.ghost.clear();
    this.positionBrushPreview(null);
    this.scene.sleep();
    this.scene.launch('Play', { levelData: data, returnTo: 'LevelEditor' });
  }

  // ---------------------------------------------------------------------
  // Undo / redo — snapshot do nível inteiro (grid pequeno o bastante pra
  // clonar ser mais simples e confiável do que inverter cada operação).
  // ---------------------------------------------------------------------
  beforeMutate() {
    this.extentDirty = true;
    this.undoStack.push(this.currentLevelData());
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.isDirty = true;
  }

  undo() {
    this.cancelCarry();
    if (this.undoStack.length === 0) {
      playSfx(this, 'nope');
      return;
    }
    playSfx(this, 'undo');
    this.redoStack.push(this.currentLevelData());
    this.applyLevelData(this.undoStack.pop());
    this.isDirty = true;
  }

  redo() {
    this.cancelCarry();
    if (this.redoStack.length === 0) {
      playSfx(this, 'nope');
      return;
    }
    playSfx(this, 'redo');
    this.undoStack.push(this.currentLevelData());
    this.applyLevelData(this.redoStack.pop());
    this.isDirty = true;
  }

  // ---------------------------------------------------------------------
  // Autosave (localStorage) — rede de segurança contra fechar/recarregar a
  // aba sem querer; não substitui o "Salvar" (que baixa o .json).
  // ---------------------------------------------------------------------
  autosaveTick() {
    if (!this.isDirty) return;
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: Date.now(), data: this.currentLevelData() }));
    } catch (err) {
      // localStorage indisponível (modo privado, quota cheia) — autosave é best-effort
    }
  }

  clearAutosave() {
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch (err) {
      // ignore
    }
  }

  maybeOfferAutosaveRestore() {
    let parsed;
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      parsed = JSON.parse(raw);
    } catch (err) {
      this.clearAutosave();
      return;
    }
    if (!isValidLevelData(parsed?.data)) {
      this.clearAutosave();
      return;
    }

    const when = new Date(parsed.savedAt).toLocaleTimeString('pt-BR');
    if (window.confirm(`Encontramos um rascunho salvo automaticamente às ${when}. Restaurar?`)) {
      this.loadLevelData(normalizeLevelData(parsed.data));
      this.isDirty = true;
    }
  }

  // ---------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------
  goToMenu() {
    if (this.isDirty && !window.confirm('Você tem alterações não salvas no editor. Sair mesmo assim?')) {
      return;
    }
    playSfx(this, 'back');
    this.scene.start('MainMenu');
  }

  update(time, delta) {
    // setas: sem seleção rolam a tela; com seleção movem as peças (handleArrow)
    const panDelta = (PAN_SPEED * delta) / 1000;
    if (this.selection.size === 0 && this.cursors.left.isDown) this.cameras.main.scrollX -= panDelta;
    if (this.selection.size === 0 && this.cursors.right.isDown) this.cameras.main.scrollX += panDelta;
    this.syncScrollbar();
  }
}
