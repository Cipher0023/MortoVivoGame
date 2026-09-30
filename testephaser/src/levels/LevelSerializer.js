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
//   backgrounds? { near?, far? }  fundos em paralaxe: [{ col, row, key,
//             flipX?, flipY? }] como tiles, sem colisão (BACKGROUND_LAYERS)
//   backgroundAssets? { near?, far? }  ajustes de desenho de cada fundo (como
//             `assets`, mas só daquela camada). Sempre vai junto com
//             `backgrounds`; arquivo com fundos e sem ele é de antes dos
//             ajustes por camada: os fundos herdam os ajustes da fase.
//   assets    { [key ou key|variante]: ajustes }  só o que difere do herdado
//             (ver assetSettings)
// Versões 1 e 2 continuam abrindo: `decorations` (enfeites em posição livre)
// viram peças da grade, e `entities` ausente vira [].

import { ENTITY_TYPES, CHANNELS } from './entityCatalog.js';
import { layerGrid } from './layerGrid.js';
import {
  isSpriteKey,
  isValidAssetSettings,
  compactAssetSettings,
  decorationToSprite,
  defaultCollision,
  isGroundKey,
  migrateAssetCollision,
} from './assetSettings.js';

const BACKGROUND_KEYS = ['near', 'far'];

function backgroundTile({ col, row, key, flipX, flipY }) {
  return { col, row, key, ...(flipX ? { flipX: true } : {}), ...(flipY ? { flipY: true } : {}) };
}

// backgrounds: { near: [...], far: [...] } — só entra no arquivo se tiver
// algo; backgroundAssets: { near: {...}, far: {...} } — ajustes de cada fundo
export function buildLevelData(
  sprites,
  gridConfig,
  entitiesList = [],
  assetSettings = {},
  backgrounds = {},
  backgroundAssets = {}
) {
  const usedLayers = BACKGROUND_KEYS.filter((layer) => backgrounds[layer]?.length);
  const usedBackgrounds = Object.fromEntries(usedLayers.map((layer) => [layer, backgrounds[layer].map(backgroundTile)]));
  const compactBackgroundAssets = Object.fromEntries(
    BACKGROUND_KEYS.map((layer) => [layer, compactAssetSettings(backgroundAssets[layer] ?? {})])
  );
  // (vai também sem fundos pintados, se algum fundo já tem ajuste próprio)
  const hasBackgroundAssets =
    usedLayers.length > 0 || Object.values(compactBackgroundAssets).some((map) => Object.keys(map).length > 0);
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
    ...(usedLayers.length ? { backgrounds: usedBackgrounds } : {}),
    ...(hasBackgroundAssets ? { backgroundAssets: compactBackgroundAssets } : {}),
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
  const backgroundsOk =
    data.backgrounds === undefined ||
    (typeof data.backgrounds === 'object' &&
      data.backgrounds !== null &&
      Object.entries(data.backgrounds).every(
        ([layer, list]) =>
          BACKGROUND_KEYS.includes(layer) &&
          Array.isArray(list) &&
          list.every((t) => {
            // o fundo tem grade própria, com mais células (ver layerGrid)
            const grid = layerGrid(layer, data.tileSize, cols, rows);
            return t && isSpriteKey(t.key) && inGrid(t.col, t.row, grid.cols, grid.rows) && optionalBool(t.flipX) && optionalBool(t.flipY);
          })
      ));

  const backgroundAssetsOk =
    data.backgroundAssets === undefined ||
    (typeof data.backgroundAssets === 'object' &&
      data.backgroundAssets !== null &&
      Object.entries(data.backgroundAssets).every(
        ([layer, map]) =>
          BACKGROUND_KEYS.includes(layer) &&
          typeof map === 'object' &&
          map !== null &&
          Object.entries(map).every(([key, settings]) => isValidAssetSettings(key, settings))
      ));

  return tilesOk && decorationsOk && entitiesOk && assetsOk && backgroundsOk && backgroundAssetsOk;
}

// Normaliza qualquer versão (1, 2, 3) pra versão 3, depois de validar
// (backgrounds e backgroundAssets sempre presentes, com as duas camadas).
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
    backgrounds: {
      near: (data.backgrounds?.near ?? []).map(backgroundTile),
      far: (data.backgrounds?.far ?? []).map(backgroundTile),
    },
    // arquivo sem backgroundAssets (de antes): fundos herdam os da fase
    backgroundAssets: Object.fromEntries(
      BACKGROUND_KEYS.map((layer) => [
        layer,
        compactAssetSettings(data.backgroundAssets ? (data.backgroundAssets[layer] ?? {}) : assets),
      ])
    ),
  };
}

// O que falta pra fase ser jogável (lista vazia = pronta pra jogar).
export function findLevelProblems(data) {
  const count = (type) => data.entities.filter((e) => e.type === type).length;
  const problems = [];
  // pode ter só um dos dois (fase sem o parceiro)
  if (count('living') + count('skeleton') === 0) problems.push('coloque o Vivo, o Esqueleto ou os dois');
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
