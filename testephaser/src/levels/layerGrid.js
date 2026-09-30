import { BACKGROUND_LAYERS } from '../config/constants.js';

// Grade de cada camada de chão/objeto. A fase ('main') usa a grade normal.
// Os fundos em paralaxe têm células menores (BACKGROUND_LAYERS.scale): tudo
// pintado neles sai proporcionalmente menor, como coisa mais distante. A
// grade de fundo tem mais linhas/colunas pra cobrir o mesmo mundo, fica
// apoiada no fundo do mundo (chão alinhado com o da fase) e sobe `raise` px,
// pra dar a impressão de plano de fundo.
// Retorna { cell, cols, rows, originY }: célula (col, row) começa em
// x = col * cell, y = originY + row * cell. Usado pelo editor, pela PlayScene
// (LevelLoader) e pela validação do arquivo.
export function layerGrid(layer, tileSize, cols, rows) {
  const background = BACKGROUND_LAYERS[layer];
  if (!background) return { cell: tileSize, cols, rows, originY: 0 };
  const cell = tileSize * background.scale;
  const gridCols = Math.ceil(cols / background.scale);
  const gridRows = Math.ceil(rows / background.scale);
  return { cell, cols: gridCols, rows: gridRows, originY: rows * tileSize - gridRows * cell - background.raise };
}
