import { settingsFor, pieceCollision, spriteArea } from './assetSettings.js';

// Único lugar que sabe transformar uma peça de chão/objeto (key + célula +
// ajustes do asset) em objetos Phaser. Usado pelo editor (só a imagem) e pela
// PlayScene (imagem + colisão), pra nunca duplicar essa lógica.

// Imagem da peça: cabe inteira na área (cols x rows tiles) sem distorcer —
// ou esticada pra preencher, se o asset pedir —, apoiada na base e
// centralizada; depois o tamanho em %, o deslocamento fino e o espelho.
export function instantiateSprite(scene, sprite, settings, tileSize) {
  const areaWidth = settings.cols * tileSize;
  const areaHeight = settings.rows * tileSize;
  const left = sprite.col * tileSize;
  const bottom = (sprite.row + 1) * tileSize;
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
// na grade (não da imagem), só pras peças com colisão ligada.
export function buildLevelFromData(scene, levelData) {
  const tileSize = levelData.tileSize;
  const tileGroup = scene.physics.add.staticGroup();
  const solidAreas = [];

  for (const sprite of levelData.tiles) {
    const settings = settingsFor(levelData.assets, sprite);
    instantiateSprite(scene, sprite, settings, tileSize);
    if (!pieceCollision(sprite)) continue;

    const area = spriteArea(sprite, settings);
    const width = (area.c1 - area.c0 + 1) * tileSize;
    const height = (area.r1 - area.r0 + 1) * tileSize;
    const zone = scene.add.zone(area.c0 * tileSize + width / 2, area.r0 * tileSize + height / 2, width, height);
    scene.physics.add.existing(zone, true);
    tileGroup.add(zone);
    solidAreas.push({ ...area, body: zone.body });
  }
  disableInternalFaces(solidAreas);

  return { tileGroup };
}
