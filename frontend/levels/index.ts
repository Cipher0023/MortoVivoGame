import { level1 } from "./level1";
import { level2 } from "./level2";
import { level3 } from "./level3";
import { level4 } from "./level4";
import type { LevelDefinition } from "./types";

// Registro central de fases. Para adicionar uma nova fase:
// 1. Crie frontend/levels/levelN.ts seguindo o padrão dos outros
// 2. Importe e adicione ao array abaixo
const ALL_LEVELS: LevelDefinition[] = [level1, level2, level3, level4];

export function getLevelByMarker(
  markerPattern: string,
): LevelDefinition | undefined {
  return ALL_LEVELS.find((level) => level.markerPattern === markerPattern);
}

export function getLevelById(id: number): LevelDefinition | undefined {
  return ALL_LEVELS.find((level) => level.id === id);
}

export type {
  LevelDefinition,
  LayerConfig,
  TileLayer,
  ImageLayer,
} from "./types";
