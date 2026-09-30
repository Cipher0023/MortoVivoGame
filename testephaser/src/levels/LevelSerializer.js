// Puro JS, sem import de Phaser — só conversão de/para o formato de arquivo
// de fase.
//
// Versão 3:
//   tiles     [{ col, row, key, flipX?, flipY?, collision?, passThrough? }]
//             chão e objetos, todos na grade. (col, row) é a célula de baixo
//             à esquerda; o tamanho vem de `assets`; espelho e colisão são só
//             daquela peça (colisão ausente = padrão do asset); passThrough
//             = chão que se atravessa pulando por baixo
//   entities  [{ type, col, row, channel? }]  peças de mecânica (entityCatalog)
//   assets    { [key ou key|variante]: ajustes }  só o que difere do herdado
//             (ver assetSettings)
// Versões 1 e 2 continuam abrindo: `decorations` (enfeites em posição livre)
// viram peças da grade, e `entities` ausente vira [].

import { ENTITY_TYPES, CHANNELS } from './entityCatalog.js';
import {
  isSpriteKey,
  isValidAssetSettings,
  compactAssetSettings,
  decorationToSprite,
  defaultCollision,
  isGroundKey,
  migrateAssetCollision,
} from './assetSettings.js';

export function buildLevelData(sprites, gridConfig, entitiesList = [], assetSettings = {}) {
  return {
    version: 3,
    tileSize: gridConfig.tileSize,
    grid: { cols: gridConfig.cols, rows: gridConfig.rows },
    tiles: sprites.map(({ col, row, key, flipX, flipY, collision, passThrough }) => ({
      col,
      row,
      key,
      ...(flipX ? { flipX: true } : {}),
      ...(flipY ? { flipY: true } : {}),
      ...(collision !== undefined && collision !== defaultCollision(key) ? { collision } : {}),
      ...(passThrough && isGroundKey(key) ? { passThrough: true } : {}),
    })),
    entities: entitiesList.map(({ type, col, row, channel }) => (channel ? { type, col, row, channel } : { type, col, row })),
    assets: compactAssetSettings(assetSettings),
  };
}

export function downloadLevelJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function inGrid(col, row, cols, rows) {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < cols && row >= 0 && row < rows;
}

export function isValidLevelData(data) {
  const shapeOk =
    data &&
    Array.isArray(data.tiles) &&
    (data.decorations === undefined || Array.isArray(data.decorations)) &&
    (data.entities === undefined || Array.isArray(data.entities)) &&
    (data.assets === undefined || (typeof data.assets === 'object' && data.assets !== null)) &&
    data.grid &&
    typeof data.grid.cols === 'number' &&
    typeof data.grid.rows === 'number' &&
    typeof data.tileSize === 'number';
  if (!shapeOk) return false;

  const { cols, rows } = data.grid;
  const optionalBool = (value) => value === undefined || typeof value === 'boolean';
  const tilesOk = data.tiles.every(
    (t) =>
      t &&
      isSpriteKey(t.key) &&
      inGrid(t.col, t.row, cols, rows) &&
      optionalBool(t.flipX) &&
      optionalBool(t.flipY) &&
      optionalBool(t.collision) &&
      optionalBool(t.passThrough)
  );
  const decorationsOk = (data.decorations ?? []).every(
    (d) => d && isSpriteKey(d.key) && Number.isFinite(d.x) && Number.isFinite(d.y)
  );
  const entitiesOk = (data.entities ?? []).every(
    (e) =>
      e &&
      Object.hasOwn(ENTITY_TYPES, e.type) &&
      inGrid(e.col, e.row, cols, rows) &&
      (e.channel === undefined || CHANNELS.includes(e.channel))
  );
  const assetsOk = Object.entries(data.assets ?? {}).every(([key, settings]) => isValidAssetSettings(key, settings));

  return tilesOk && decorationsOk && entitiesOk && assetsOk;
}

// Normaliza qualquer versão (1, 2, 3) pra versão 3, depois de validar.
export function normalizeLevelData(data) {
  const legacySprites = (data.decorations ?? []).map((deco) => decorationToSprite(deco, data.tileSize));
  const { tiles, assets } = migrateAssetCollision([...data.tiles, ...legacySprites], data.assets ?? {});
  return {
    version: 3,
    tileSize: data.tileSize,
    grid: data.grid,
    tiles,
    entities: data.entities ?? [],
    assets: compactAssetSettings(assets),
  };
}

// O que falta pra fase ser jogável (lista vazia = pronta pra jogar).
export function findLevelProblems(data) {
  const count = (type) => data.entities.filter((e) => e.type === type).length;
  const problems = [];
  if (count('living') !== 1) problems.push('coloque o Vivo');
  if (count('skeleton') !== 1) problems.push('coloque o Esqueleto');
  if (count('exit') === 0) problems.push('coloque pelo menos uma Saída');
  return problems;
}

export function parseLevelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        reject(err);
        return;
      }
      if (!isValidLevelData(data)) {
        reject(new Error('Arquivo de fase inválido: formato inesperado.'));
        return;
      }
      resolve(normalizeLevelData(data));
    };
    reader.readAsText(file);
  });
}
