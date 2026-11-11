import { TILE_MANIFEST, OBJECT_MANIFEST } from '../config/assetManifest.js';
import { settingsFor, spriteArea } from './assetSettings.js';
import { isSlopeKey, slopeFromArea, surfaceY } from './slopes.js';

// Terreno montado sozinho a partir da arte original, com o desenho batendo
// exatamente com a colisão (a grade). Em vez de cada peça do editor desenhar
// o próprio quadrado (e precisar de escala/deslocamento à mão pra encaixar),
// todas as células de chão da fase viram uma forma só, pintada assim:
//   miolo        dirt-1/2/3 alternados por célula, corte seco (os desenhos
//                foram feitos pra encaixar; só a coluna transparente da borda
//                é aparada)
//   faixa de cima ground-1/2/3 lado a lado em toda superfície exposta; nas
//                rampas, a mesma faixa inclinada por colunas (cada fatia de
//                1px desce até a superfície): a grama fica em pé, as gotas
//                penduram pra baixo e o desenho continua o da faixa plana
//   laterais     dirt-edge-1/2 de verdade, com o contorno (x≈70 no desenho)
//                cravado na borda da célula; só a emenda de dentro, onde é
//                terra lisa, é esfumada
//   pontas       ground-edge, com o beiral de grama passando da borda
//   embaixo      dirt-edge girado (plataformas soltas, tetos)
//
// Qualquer peça de chão do editor (tiles, faixas, rampas) vira terreno; a
// arte e os ajustes antigos ficam só para os fundos em paralaxe. Para
// comparar com o desenho antigo: ?chao=sprites.

const TERRAIN_KEYS = new Set([
  ...TILE_MANIFEST.map((tile) => tile.key),
  ...OBJECT_MANIFEST.filter((object) => object.ground).map((object) => object.key),
]);

export const TERRAIN_DEPTH = -1; // atrás das peças/objetos, na frente dos fundos

const ART = 128; // os desenhos têm 128px por célula
const DIRT_TEXTURE = 'terrain-dirt';
const TOP_TEXTURE = 'terrain-top';
const SIDE_TEXTURES = ['terrain-side-1', 'terrain-side-2'];
const CAP_EDGE_TEXTURE = 'terrain-cap-edge';

// Medidas tiradas dos desenhos (px do desenho, 0..128):
const SIDE = { line: 70, inner: 14, feather: 12 }; // dirt-edge: contorno e começo do desenho
const CAP = { line: 60, inner: 3 }; // ground-edge: borda da terra embaixo e começo do desenho
// variação do miolo: [desenho, espelhado] numa grade 4x4 fixa
const DIRT_GRID = 4;
const DIRT_CROP = 3;
const DIRT_VARIANTS = ['dirt-1', 'dirt-2', 'dirt-3'];
// faixa de cima: ground-1 tem as folhas grandes, então aparece menos
const TOP_SEQUENCE = ['ground-1', 'ground-2', 'ground-3', 'ground-2', 'ground-3', 'ground-2'];
// a grama tem tufos acima da linha do chão: as máscaras deixam esse espaço
const TOP_BUMPS = 8;
// altura da grama (com o contorno de baixo) na faixa de cima, em px de mundo
const GRASS_DEPTH = 20;
// contorno desenhado (só onde não há arte: base de rampa de teto)
const OUTLINE = 0x724728;

export function isTerrainKey(key) {
  return TERRAIN_KEYS.has(key);
}

export function terrainEnabled() {
  return new URLSearchParams(window.location.search).get('chao') !== 'sprites';
}

// ---------------------------------------------------------------------
// Texturas (uma vez por jogo)
// ---------------------------------------------------------------------
function hash(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeCanvas(textures, key, width, height, draw) {
  if (textures.exists(key)) return;
  const canvas = textures.createCanvas(key, width, height);
  draw(canvas.getContext());
  canvas.refresh();
}

function ensureTextures(scene) {
  const textures = scene.textures;
  const image = (key) => textures.get(key).getSourceImage();

  // miolo: 4x4 células, cada uma um dos desenhos (às vezes espelhado), sem
  // a coluna 0 (transparente no dirt-*)
  makeCanvas(textures, DIRT_TEXTURE, ART * DIRT_GRID, ART * DIRT_GRID, (ctx) => {
    for (let gx = 0; gx < DIRT_GRID; gx++) {
      for (let gy = 0; gy < DIRT_GRID; gy++) {
        const pick = hash(gx, gy);
        const source = image(DIRT_VARIANTS[Math.floor(pick * DIRT_VARIANTS.length)]);
        const flip = hash(gy + 7, gx + 3) < 0.5;
        ctx.save();
        ctx.translate(gx * ART + (flip ? ART : 0), gy * ART);
        ctx.scale(flip ? -1 : 1, 1);
        // bordas do desenho aparadas (são mais claras e deixavam a grade à mostra)
        ctx.drawImage(source, DIRT_CROP, DIRT_CROP, ART - DIRT_CROP * 2, ART - DIRT_CROP * 2, 0, 0, ART, ART);
        ctx.restore();
      }
    }
  });

  // faixa de cima: ground-* lado a lado (sem a 1ª/última coluna, meio
  // transparentes)
  makeCanvas(textures, TOP_TEXTURE, ART * TOP_SEQUENCE.length, ART, (ctx) => {
    TOP_SEQUENCE.forEach((key, i) => ctx.drawImage(image(key), 1, 0, ART - 2, ART, i * ART, 0, ART, ART));
  });

  // laterais: dirt-edge sem a última linha (transparente), com o começo de
  // dentro esfumado pra se misturar com o miolo
  ['dirt-edge-1', 'dirt-edge-2'].forEach((key, i) => {
    makeCanvas(textures, SIDE_TEXTURES[i], ART, ART, (ctx) => {
      ctx.drawImage(image(key), 0, 0, ART, ART - 1, 0, 0, ART, ART);
      const gradient = ctx.createLinearGradient(SIDE.inner, 0, SIDE.inner + SIDE.feather, 0);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, ART, ART);
    });
  });

  // ponta: ground-edge sem a última linha (transparente)
  makeCanvas(textures, CAP_EDGE_TEXTURE, ART, ART, (ctx) => {
    ctx.drawImage(image('ground-edge'), 0, 0, ART, ART - 1, 0, 0, ART, ART);
  });
}

// ---------------------------------------------------------------------
// Forma da fase
// ---------------------------------------------------------------------
function collectShape(sprites, assets, tileSize) {
  const cells = new Set();
  const slopes = [];
  for (const sprite of sprites) {
    if (!isTerrainKey(sprite.key)) continue;
    const area = spriteArea(sprite, settingsFor(assets, sprite));
    if (isSlopeKey(sprite.key)) {
      slopes.push({ ...slopeFromArea(area, tileSize, sprite.flipX), area, flipY: Boolean(sprite.flipY) });
      continue;
    }
    for (let c = area.c0; c <= area.c1; c++) for (let r = area.r0; r <= area.r1; r++) cells.add(`${c},${r}`);
  }
  // célula dentro da área de uma rampa: conta como chão pra efeito de borda
  const slopeCells = new Set();
  for (const { area } of slopes) {
    for (let c = area.c0; c <= area.c1; c++) for (let r = area.r0; r <= area.r1; r++) slopeCells.add(`${c},${r}`);
  }
  return { cells, slopes, slopeCells };
}

function trianglePoints(slope) {
  const { x0, x1, yTop, yBottom, up, flipY } = slope;
  const low = up > 0 ? x0 : x1;
  const high = up > 0 ? x1 : x0;
  if (flipY) return [{ x: low, y: yTop }, { x: high, y: yTop }, { x: high, y: yBottom }];
  return [{ x: low, y: yBottom }, { x: high, y: yBottom }, { x: high, y: yTop }];
}

// ---------------------------------------------------------------------
// Montagem. Retorna { objects, destroy() } — o editor refaz quando o chão muda.
// ---------------------------------------------------------------------
export function buildTerrain(scene, sprites, assets, tileSize) {
  ensureTextures(scene);
  const { cells, slopes, slopeCells } = collectShape(sprites, assets, tileSize);
  const S = tileSize;
  const k = S / ART; // escala do desenho
  const objects = [];
  const masks = [];
  const generated = []; // texturas feitas só pra esta montagem (faixas das rampas)
  const keep = (object) => {
    object.setDepth(TERRAIN_DEPTH);
    objects.push(object);
    return object;
  };
  const makeMask = (draw) => {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    draw(g);
    masks.push(g);
    return g.createGeometryMask();
  };
  const result = {
    objects,
    destroy() {
      for (const object of objects) object.destroy();
      for (const g of masks) g.destroy();
      for (const key of generated) scene.textures.remove(key);
      objects.length = 0;
    },
  };
  if (cells.size === 0 && slopes.length === 0) return result;

  const parse = (key) => key.split(',').map(Number);
  let maxX = 0;
  let maxY = 0;
  for (const key of [...cells, ...slopeCells]) {
    const [c, r] = parse(key);
    maxX = Math.max(maxX, (c + 2) * S);
    maxY = Math.max(maxY, (r + 2) * S);
  }
  const solid = (c, r) => cells.has(`${c},${r}`) || slopeCells.has(`${c},${r}`);

  // quanto da célula a arte de borda ocupa por dentro (px de mundo)
  const sideDepth = (SIDE.line - SIDE.inner) * k;
  // o miolo vai até onde a arte da borda já está opaca (fim do esfumado)
  const sideFill = sideDepth - SIDE.feather * k;
  const capDepth = (CAP.line - CAP.inner) * k;

  // classifica cada célula
  const info = [];
  for (const key of cells) {
    const [c, r] = parse(key);
    info.push({
      c,
      r,
      // topo exposto (debaixo de rampa é miolo: a faixa da rampa já desce
      // até o pé dela e continua a do chão)
      cap: !solid(c, r - 1),
      openL: !solid(c - 1, r),
      openR: !solid(c + 1, r),
      openB: !solid(c, r + 1),
    });
  }

  // 1. miolo (não entra nas células de cima, que a faixa cobre inteira, nem
  // na parte que a arte de borda cobre)
  const dirt = keep(scene.add.tileSprite(0, 0, maxX, maxY, DIRT_TEXTURE).setOrigin(0, 0));
  dirt.setTileScale(k);
  dirt.setMask(
    makeMask((g) => {
      for (const cell of info) {
        if (cell.cap) continue;
        const x0 = cell.c * S + (cell.openL ? sideFill : 0);
        const x1 = (cell.c + 1) * S - (cell.openR ? sideFill : 0);
        const y1 = (cell.r + 1) * S - (cell.openB ? sideFill : 0);
        g.fillRect(x0, cell.r * S, x1 - x0, y1 - cell.r * S);
      }
    })
  );

  // 2. laterais e fundos de terra (arte de borda)
  const side = (x, y, flip, c, r, rotate = false) => {
    const texture = SIDE_TEXTURES[Math.floor(hash(c, r) * SIDE_TEXTURES.length)];
    const image = keep(scene.add.image(x, y, texture).setScale(k));
    if (rotate) {
      // girada 90° (sentido horário): o contorno fica embaixo
      image.setOrigin(SIDE.line / ART, 0.5).setRotation(Math.PI / 2);
    } else {
      image.setOrigin((flip ? ART - SIDE.line : SIDE.line) / ART, 0).setFlipX(flip);
    }
    return image;
  };
  for (const cell of info) {
    const { c, r } = cell;
    if (!cell.cap) {
      if (cell.openL) side(c * S, r * S, true, c, r);
      if (cell.openR) side((c + 1) * S, r * S, false, c, r);
    }
    if (cell.openB && !cell.cap) side((c + 0.5) * S, (r + 1) * S, false, c, r, true);
  }

  // 3. faixa de cima nas células com o topo exposto, uma tira por linha
  const capCells = info.filter((cell) => cell.cap);
  for (const [r, rowCells] of groupBy(capCells, (cell) => cell.r)) {
    const y = r * S;
    const strip = keep(scene.add.tileSprite(0, y, maxX, S, TOP_TEXTURE).setOrigin(0, 0));
    strip.setTileScale(k);
    strip.setMask(
      makeMask((g) => {
        for (const cell of rowCells) {
          // ponta solta: a faixa para onde começa a ponta (ground-edge)
          const x0 = cell.c * S + (cell.openL ? capDepth - 1 : 0);
          const x1 = (cell.c + 1) * S - (cell.openR ? capDepth - 1 : 0);
          g.fillRect(x0, y - TOP_BUMPS, x1 - x0, S + TOP_BUMPS);
        }
      })
    );
  }
  // fundo de plataforma de uma célula de altura: borda por cima da faixa
  for (const cell of capCells) {
    if (cell.openB) side((cell.c + 0.5) * S, (cell.r + 1) * S, false, cell.c, cell.r, true);
  }
  // pontas com beiral de grama
  const capEdge = (x, y, flip) => {
    keep(
      scene.add
        .image(x, y, CAP_EDGE_TEXTURE)
        .setScale(k)
        .setOrigin((flip ? ART - CAP.line : CAP.line) / ART, 0)
        .setFlipX(flip)
    );
  };
  for (const cell of capCells) {
    if (cell.openL) capEdge(cell.c * S, cell.r * S, true);
    if (cell.openR) capEdge((cell.c + 1) * S, cell.r * S, false);
  }

  // 4. rampas: a terra delas, as bordas de terra expostas e a faixa de cima
  // inclinada por colunas
  if (slopes.length > 0) {
    const slopeDirt = keep(scene.add.tileSprite(0, 0, maxX, maxY, DIRT_TEXTURE).setOrigin(0, 0));
    slopeDirt.setTileScale(k);
    slopeDirt.setMask(makeMask((g) => slopes.forEach((slope) => g.fillPoints(trianglePoints(slope), true))));
  }
  // traços desenhados por último (por cima das faixas)
  const outline = scene.make.graphics({ add: false });
  for (const slope of slopes) {
    const { area, up, x0, x1, yTop, yBottom, flipY } = slope;
    // lado alto (vertical): arte de borda nas linhas sem chão do lado
    const highCol = up > 0 ? area.c1 + 1 : area.c0 - 1;
    const highX = up > 0 ? x1 : x0;
    const highOpen = [];
    for (let r = area.r0; r <= area.r1; r++) if (!solid(highCol, r)) highOpen.push(r);
    if (!flipY) {
      for (let c = area.c0; c <= area.c1; c++) {
        if (!solid(c, area.r1 + 1)) side((c + 0.5) * S, yBottom, false, c, area.r1, true);
      }
    } else {
      // rampa de teto: a face inclinada fica embaixo (contorno desenhado)
      const [p, , q] = trianglePoints(slope);
      outline.lineStyle(4, OUTLINE, 1).lineBetween(p.x, p.y, q.x, q.y);
      continue;
    }

    keep(shearedBand(scene, slope, k, generated));

    // lado alto solto (rampa subindo pro nada): borda de terra por cima da
    // faixa, mas só abaixo da grama — recortada no triângulo descido — e a
    // ponta da grama fechada com contorno
    if (highOpen.length > 0) {
      const below = makeMask((g) =>
        g.fillPoints(trianglePoints(slope).map((p, i) => (i === 1 ? p : { x: p.x, y: p.y + GRASS_DEPTH })), true)
      );
      for (const r of highOpen) side(highX, r * S, up < 0, highCol, r).setMask(below);
      if (highOpen.includes(area.r0)) {
        const inward = up > 0 ? -1.5 : 1.5;
        outline.lineStyle(3, OUTLINE, 1).lineBetween(highX + inward, yTop + 1, highX + inward, yTop + GRASS_DEPTH + 2);
      }
    }
  }
  scene.add.existing(outline);
  keep(outline);
  return result;
}

// Faixa de cima de uma rampa, inclinada por colunas: pra cada coluna de 1px
// do desenho, a fatia da faixa plana na mesma posição do mundo (o padrão
// continua o do chão dos lados) descida até a superfície da rampa ali. A
// faixa desce a altura toda (uma célula) — no pé da rampa ela é a própria
// faixa do chão; mais acima, embaixo dela fica o miolo da rampa.
let bandCount = 0;
function shearedBand(scene, slope, k, generated) {
  const band = scene.textures.get(TOP_TEXTURE).getSourceImage();
  const { x0, x1, yTop, yBottom } = slope;
  const top = yTop - TOP_BUMPS;
  const width = Math.round((x1 - x0) / k);
  const height = Math.round((yBottom - top) / k) + ART;
  const key = `terrain-band-${++bandCount}`;
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas.getContext();
  for (let i = 0; i < width; i++) {
    const worldX = x0 + (i + 0.5) * k;
    const y = Math.round((surfaceY(slope, worldX) - top) / k);
    const u = Math.floor(worldX / k) % band.width;
    ctx.drawImage(band, u, 0, 1, ART, i, y, 1, ART);
  }
  canvas.refresh();
  generated.push(key);
  return scene.add.image(x0, top, key).setOrigin(0, 0).setScale(k);
}

function groupBy(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
