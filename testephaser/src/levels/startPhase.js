import { getOfficialLevel } from './officialLevels.js';

// Abre a fase do livro a partir de `scene`. Retorna false se ela ainda não
// existe (sem arquivo em src/levels/data) — quem chamou mostra "em construção".
export function startPhase(scene, phase) {
  if (phase.sceneKey) {
    scene.scene.start(phase.sceneKey);
    return true;
  }
  const levelData = getOfficialLevel(phase.level);
  if (!levelData) return false;
  scene.scene.start('Play', { levelData, phase });
  return true;
}
