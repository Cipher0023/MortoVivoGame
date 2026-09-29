import { isValidLevelData, normalizeLevelData } from './LevelSerializer.js';

// Fases oficiais do livro: arquivos .json salvos pelo editor e colocados em
// src/levels/data/ (ex.: fase2.json). Basta o arquivo existir pra fase do
// código correspondente (ver phases.js) ficar jogável — sem mexer em código.
const FILES = import.meta.glob('./data/*.json', { eager: true, import: 'default' });

export function getOfficialLevel(id) {
  const data = FILES[`./data/${id}.json`];
  if (!data) return null;
  if (!isValidLevelData(data)) {
    console.error(`Fase oficial "${id}.json" com formato inválido — abra e salve de novo no editor.`);
    return null;
  }
  return normalizeLevelData(data);
}
