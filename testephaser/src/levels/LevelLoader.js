import { settingsFor, pieceCollision, piecePassThrough, spriteArea } from './assetSettings.js';
import { isSlopeKey, slopeFromArea } from './slopes.js';
import { BACKGROUND_LAYERS } from '../config/constants.js';
import { layerGrid } from './layerGrid.js';

// espessura das paredes finas da rampa (lado alto e fundo)
const RAMP_EDGE = 4;
// a parede do lado alto começa um pouco abaixo do topo: quem chega de cima,
// no nível do topo, entra na rampa pra descer sem esbarrar nela
const RAMP_SIDE_INSET = 8;

// Único lugar que sabe transformar uma peça de chão/objeto (key + célula +
// ajustes do asset) em objetos Phaser. Usado pelo editor (só a imagem) e pela
// PlayScene (imagem + colisão), pra nunca duplicar essa lógica.

// Imagem da peça: cabe inteira na área (cols x rows tiles) sem distorcer —
// ou esticada pra preencher, se o asset pedir —, apoiada na base e
// centralizada; depois o tamanho em %, o deslocamento fino e o espelho.
// originY: onde começa a grade (fundos em paralaxe têm a grade deslocada —
// ver layerGrid).
export function instantiateSprite(scene, sprite, settings, tileSize, originY = 0) {
  const areaWidth = settings.cols * tileSize;
  const areaHeight = settings.rows * tileSize;
  const left = sprite.col * tileSize;
  const bottom = originY + (sprite.row + 1) * tileSize;
  const factor = settings.scale / 100;

  const image = scene.add.image(left + areaWidth / 2 + settings.offsetX, bottom + settings.offsetY, sprite.key);
  image.setOrigin(0.5, 1);
  if (settings.stretch) {
    image.setDisplaySize(areaWidth * factor, areaHeight * factor);
  } else {
    image.setScale(Math.min(areaWidth / image.width, areaHeight / image.height) * factor);
  }
  // o espelho gira o desenho no próprio lugar (em torno do centro da textura)
  image.setFlip(Boolean(sprite.flipX), Boolean(sprite.flipY));
  return image;
}

// Desliga a colisão nas faces "internas" (as que encostam em outra área
// sólida do mesmo conjunto). Sem isso, cada bloco é um corpo separado e o
// Arcade às vezes resolve a emenda entre dois blocos de um muro como se fosse
// um teto: pular encostado no muro "bate a cabeça" e o pulo morre.
// `areas`: [{ c0, c1, r0, r1, body }] em células. `horizontal: false` só junta
// em cima e embaixo — pra peças mais finas que a célula (portão, grade,
// porta), que deixam um vão de verdade entre vizinhas laterais.
export function disableInternalFaces(areas, { horizontal = true } = {}) {
  const solid = new Set();
  for (const { c0, c1, r0, r1 } of areas) {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) solid.add(`${c},${r}`);
  }
  const rowCovered = (r, c0, c1) => {
    for (let c = c0; c <= c1; c++) if (!solid.has(`${c},${r}`)) return false;
    return true;
  };
  const colCovered = (c, r0, r1) => {
    for (let r = r0; r <= r1; r++) if (!solid.has(`${c},${r}`)) return false;
    return true;
  };

  for (const { c0, c1, r0, r1, body } of areas) {
    body.checkCollision.up = !rowCovered(r0 - 1, c0, c1);
    body.checkCollision.down = !rowCovered(r1 + 1, c0, c1);
    if (!horizontal) continue;
    body.checkCollision.left = !colCovered(c0 - 1, r0, r1);
    body.checkCollision.right = !colCovered(c1 + 1, r0, r1);
  }
}

// Monta chão e objetos da fase. Colisão = zona invisível do tamanho da área
// na grade (não da imagem), só pras peças com colisão ligada. Rampas não
// viram caixa: vão pra `slopes` (a PlayScene apoia quem está em cima) e
// ganham só duas paredes finas — o lado alto (ninguém entra por ali) e o
// fundo (ninguém atravessa pulando por baixo). Pra inimigos e caixas, que não
// sobem rampa, a rampa inteira é um bloco (`rampBlockers`).
// Chão "atravessar por baixo" (passThrough): só a face de cima segura — pula
// por baixo e pelos lados passa, e quem cai por cima pousa. Na rampa assim,
// nem as paredes finas existem: só a superfície (o apoio da PlayScene já
// ignora quem está subindo ou vem de muito abaixo dela).
export function buildLevelFromData(scene, levelData) {
  const tileSize = levelData.tileSize;
  const tileGroup = scene.physics.add.staticGroup();
  const rampBlockers = scene.physics.add.staticGroup();
  const slopes = [];
  const solidAreas = [];
  const passThroughAreas = [];

  const addZone = (group, x, y, width, height) => {
    const zone = scene.add.zone(x + width / 2, y + height / 2, width, height);
    scene.physics.add.existing(zone, true);
    group.add(zone);
    return zone;
  };

  // fundos em paralaxe: só desenho, rolando mais devagar (ver BACKGROUND_LAYERS),
  // com os ajustes de desenho da própria camada
  for (const [layer, { factor, depth }] of Object.entries(BACKGROUND_LAYERS)) {
    const assets = levelData.backgroundAssets?.[layer] ?? {};
    // grade menor e um pouco mais alta que a da fase (ver layerGrid)
    const grid = layerGrid(layer, tileSize, levelData.grid.cols, levelData.grid.rows);
    for (const sprite of levelData.backgrounds?.[layer] ?? []) {
      instantiateSprite(scene, sprite, settingsFor(assets, sprite), grid.cell, grid.originY)
        .setScrollFactor(factor, 1)
        .setDepth(depth);
    }
  }

  for (const sprite of levelData.tiles) {
    const settings = settingsFor(levelData.assets, sprite);
    instantiateSprite(scene, sprite, settings, tileSize);
    if (!pieceCollision(sprite)) continue;

    const area = spriteArea(sprite, settings);
    if (isSlopeKey(sprite.key)) {
      const slope = slopeFromArea(area, tileSize, sprite.flipX);
      slopes.push(slope);
      const height = slope.yBottom - slope.yTop;
      addZone(rampBlockers, slope.x0, slope.yTop, slope.x1 - slope.x0, height);
      if (piecePassThrough(sprite)) continue;
      const highX = slope.up > 0 ? slope.x1 - RAMP_EDGE : slope.x0;
      const side = addZone(tileGroup, highX, slope.yTop + RAMP_SIDE_INSET, RAMP_EDGE, height - RAMP_SIDE_INSET).body;
      side.checkCollision.up = false;
      side.checkCollision.down = false;
      // só a face de fora do lado alto (quem vem subindo passa por cima)
      side.checkCollision.left = slope.up < 0;
      side.checkCollision.right = slope.up > 0;
      const bottom = addZone(tileGroup, slope.x0, slope.yBottom - RAMP_EDGE, slope.x1 - slope.x0, RAMP_EDGE).body;
      bottom.checkCollision.up = false;
      bottom.checkCollision.left = false;
      bottom.checkCollision.right = false;
      continue;
    }
    const width = (area.c1 - area.c0 + 1) * tileSize;
    const height = (area.r1 - area.r0 + 1) * tileSize;
    const zone = addZone(tileGroup, area.c0 * tileSize, area.r0 * tileSize, width, height);
    (piecePassThrough(sprite) ? passThroughAreas : solidAreas).push({ ...area, body: zone.body });
  }
  // emendas calculadas separadas: um bloco sólido encostado num de
  // atravessar não perde a própria face
  disableInternalFaces(solidAreas);
  disableInternalFaces(passThroughAreas);
  for (const { body } of passThroughAreas) {
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  return { tileGroup, slopes, rampBlockers };
}
