export const TILES_PATH = `${import.meta.env.BASE_URL}assets/tiles/`;
export const OBJECTS_PATH = `${import.meta.env.BASE_URL}assets/objetos/`;
export const BOY_PATH = `${import.meta.env.BASE_URL}assets/boy/`;
export const BLOCKS_PATH = `${import.meta.env.BASE_URL}assets/blocks/`;

// Textura branca genérica pros blocos/interactables da Fase 1 (paredes,
// alavancas, portas etc.) — tingida via setTint() pra cada cor, em vez de
// desenhados como Phaser.GameObjects.Rectangle. Assim tudo na fase passa
// pelo mesmo pipeline de textura usado pelos tiles/objetos do editor.
export const BLOCK_MANIFEST = [{ key: 'bloco-solido', file: 'bloco-solido.png' }];

// Ciclo de caminhada do "Vivo" (12 frames), reaproveitado do game2.0.
export const BOY_WALK_FRAME_COUNT = 12;
export const BOY_WALK_MANIFEST = Array.from({ length: BOY_WALK_FRAME_COUNT }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { key: `boy-walk-${n}`, file: `walk_${n}.png` };
});

export const TILE_MANIFEST = [
  { key: 'ground-1', file: 'ground-1.png' },
  { key: 'ground-2', file: 'ground-2.png' },
  { key: 'ground-3', file: 'ground-3.png' },
  { key: 'ground-edge', file: 'ground-edge.png' },
  { key: 'dirt-1', file: 'dirt-1.png' },
  { key: 'dirt-2', file: 'dirt-2.png' },
  { key: 'dirt-3', file: 'dirt-3.png' },
  { key: 'dirt-edge-1', file: 'dirt-edge-1.png' },
  { key: 'dirt-edge-2', file: 'dirt-edge-2.png' },
];

// Objetos: padrão de quantos tiles ocupam (`size` = [colunas, linhas]) e se
// têm colisão. A arte foi feita na escala de 128px por tile (ex.: 512x256 =
// 4x2), então o tamanho padrão sai do tamanho original da imagem (`px`). O
// editor deixa mudar tudo isso por fase (ver levels/assetSettings.js).
export const OBJECT_MANIFEST = [
  { key: 'arbusto', file: 'arbusto.png', px: [127, 85], size: [1, 1], collision: false },
  { key: 'banco', file: 'banco.png', px: [231, 175], size: [2, 1], collision: false },
  { key: 'caixa1', file: 'caixa1.png', px: [200, 128], size: [2, 1], collision: false },
  { key: 'caixa2', file: 'caixa2.png', px: [200, 240], size: [2, 2], collision: false },
  { key: 'cerca1', file: 'cerca1.png', px: [260, 155], size: [2, 1], collision: false },
  { key: 'flor1', file: 'flor1.png', px: [115, 116], size: [1, 1], collision: false },
  { key: 'flor2', file: 'flor2.png', px: [88, 89], size: [1, 1], collision: false },
  { key: 'hidrante', file: 'hidrante.png', px: [87, 124], size: [1, 1], collision: false },
  { key: 'pedra1', file: 'pedra1.png', px: [125, 83], size: [1, 1], collision: false },
  { key: 'pedra2', file: 'pedra2.png', px: [133, 99], size: [1, 1], collision: false },
  { key: 'ground-strip-3', file: 'ground-strip-3.png', px: [383, 129], size: [3, 1], collision: true },
  { key: 'dirt-grid-4x2', file: 'dirt-grid-4x2.png', px: [512, 256], size: [4, 2], collision: true },
];
