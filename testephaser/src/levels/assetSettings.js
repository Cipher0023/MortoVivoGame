import { TILE_MANIFEST, OBJECT_MANIFEST } from '../config/assetManifest.js';

// Ajustes do desenho de chão/objeto, por VARIANTE: cada asset tem a versão
// normal e as espelhadas (↔, ↕, ↔↕). Todas as cópias da mesma variante
// dividem os ajustes; uma variante espelhada herda os da normal até ganhar
// ajustes próprios.
//   cols, rows          quantos tiles ocupa (a imagem se ajusta dentro dessa
//                       área sem distorcer, apoiada na base)
//   offsetX, offsetY    deslocamento fino da imagem dentro da área (px de
//                       mundo) — pra corrigir sprite desalinhado
//   scale               tamanho do desenho em % (100 = cabe exato na área)
//   stretch             esticar o desenho pra preencher a área (distorce)
// O arquivo da fase (campo `assets`) guarda só o que difere do herdado,
// com a chave "asset" (normal) ou "asset|x", "asset|y", "asset|xy".
//
// Espelho e colisão NÃO são ajustes da variante: são de cada peça colocada
// (flipX/flipY/collision no arquivo). Sem `collision` na peça, vale o padrão
// do asset (chão sólido; objetos conforme o manifesto).

export const MAX_ASSET_TILES = 8;
export const MAX_ASSET_OFFSET = 64;
export const MIN_ASSET_SCALE = 25;
export const MAX_ASSET_SCALE = 400;
export const VARIANTS = ['', 'x', 'y', 'xy'];
const SETTING_FIELDS = ['cols', 'rows', 'offsetX', 'offsetY', 'scale', 'stretch'];

const TILE_KEYS = new Set(TILE_MANIFEST.map((t) => t.key));
const OBJECTS = new Map(OBJECT_MANIFEST.map((o) => [o.key, o]));

export function isSpriteKey(key) {
  return TILE_KEYS.has(key) || OBJECTS.has(key);
}

// ---------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------
export function variantOf(sprite) {
  return `${sprite.flipX ? 'x' : ''}${sprite.flipY ? 'y' : ''}`;
}

export function variantId(key, variant) {
  return variant ? `${key}|${variant}` : key;
}

export function parseVariantId(id) {
  const [key, variant = ''] = id.split('|');
  return { key, variant };
}

export function variantLabel(variant) {
  return { '': 'normal', x: 'espelhado ↔', y: 'espelhado ↕', xy: 'espelhado ↔↕' }[variant];
}

// ---------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------
function manifestDefaults(key) {
  const object = OBJECTS.get(key);
  return {
    cols: object ? object.size[0] : 1,
    rows: object ? object.size[1] : 1,
    offsetX: 0,
    offsetY: 0,
    scale: 100,
    stretch: false,
  };
}

// De onde a variante herda: normal ← padrão do manifesto; espelhadas ← normal.
export function inheritedAssetSettings(assets, key, variant) {
  const normal = { ...manifestDefaults(key), ...(assets?.[key] ?? {}) };
  return variant ? normal : manifestDefaults(key);
}

export function resolveAssetSettings(assets, key, variant = '') {
  return { ...inheritedAssetSettings(assets, key, variant), ...(assets?.[variantId(key, variant)] ?? {}) };
}

// Ajustes da variante de uma peça colocada.
export function settingsFor(assets, sprite) {
  return resolveAssetSettings(assets, sprite.key, variantOf(sprite));
}

// Tira campos iguais ao herdado e variantes sem nada próprio.
export function compactAssetSettings(assets) {
  const compact = {};
  for (const [id, overrides] of Object.entries(assets)) {
    const { key, variant } = parseVariantId(id);
    const inherited = inheritedAssetSettings(assets, key, variant);
    const own = Object.fromEntries(Object.entries(overrides).filter(([field, value]) => inherited[field] !== value));
    if (Object.keys(own).length > 0) compact[id] = own;
  }
  return compact;
}

export function isValidAssetSettings(id, settings) {
  const { key, variant } = parseVariantId(id);
  if (!isSpriteKey(key) || !VARIANTS.includes(variant) || !settings || typeof settings !== 'object') return false;
  const intIn = (value, min, max) => value === undefined || (Number.isInteger(value) && value >= min && value <= max);
  return (
    intIn(settings.cols, 1, MAX_ASSET_TILES) &&
    intIn(settings.rows, 1, MAX_ASSET_TILES) &&
    intIn(settings.offsetX, -MAX_ASSET_OFFSET, MAX_ASSET_OFFSET) &&
    intIn(settings.offsetY, -MAX_ASSET_OFFSET, MAX_ASSET_OFFSET) &&
    intIn(settings.scale, MIN_ASSET_SCALE, MAX_ASSET_SCALE) &&
    (settings.stretch === undefined || typeof settings.stretch === 'boolean') &&
    // `collision` aqui é de uma versão anterior do formato (ver migrateAssetCollision)
    (settings.collision === undefined || typeof settings.collision === 'boolean') &&
    Object.keys(settings).every((field) => SETTING_FIELDS.includes(field) || field === 'collision')
  );
}

// ---------------------------------------------------------------------
// Colisão (de cada peça)
// ---------------------------------------------------------------------
export function defaultCollision(key) {
  const object = OBJECTS.get(key);
  return object ? object.collision : true;
}

export function pieceCollision(sprite) {
  return sprite.collision ?? defaultCollision(sprite.key);
}

// Formato anterior guardava colisão por asset: passa pra cada peça daquele
// asset (as que não tinham valor próprio) e tira dos ajustes.
export function migrateAssetCollision(tiles, assets) {
  const cleanAssets = {};
  const collisionByKey = {};
  for (const [id, settings] of Object.entries(assets)) {
    const { collision, ...rest } = settings;
    if (collision !== undefined) collisionByKey[parseVariantId(id).key] = collision;
    cleanAssets[id] = rest;
  }
  const migratedTiles = tiles.map((tile) =>
    tile.collision === undefined && collisionByKey[tile.key] !== undefined
      ? { ...tile, collision: collisionByKey[tile.key] }
      : tile
  );
  return { tiles: migratedTiles, assets: cleanAssets };
}

// ---------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------
// Área (em células) de uma peça colocada: (col, row) é a célula de baixo à
// esquerda; a peça cresce pra direita e pra cima.
export function spriteArea(sprite, settings) {
  return {
    c0: sprite.col,
    c1: sprite.col + settings.cols - 1,
    r0: sprite.row - settings.rows + 1,
    r1: sprite.row,
  };
}

// Enfeite de arquivo antigo (posição livre em px) → célula de baixo à
// esquerda mais próxima, com o tamanho padrão do objeto.
export function decorationToSprite(decoration, tileSize) {
  const object = OBJECTS.get(decoration.key);
  const [width, height] = object.px;
  return {
    key: decoration.key,
    col: Math.max(0, Math.round((decoration.x - width / 2) / tileSize)),
    row: Math.max(0, Math.round((decoration.y + height / 2) / tileSize) - 1),
  };
}
