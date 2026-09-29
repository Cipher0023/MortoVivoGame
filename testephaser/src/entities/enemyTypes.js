import PatrolEnemy from './PatrolEnemy.js';
import ChaserEnemy from './ChaserEnemy.js';
import FlyerEnemy from './FlyerEnemy.js';
import DiverEnemy from './DiverEnemy.js';
import { ENEMY } from '../config/constants.js';
import { ENEMY_ORDER, ENTITY_SHAPES } from '../levels/entityCatalog.js';

// Tipo de peça do editor (ver entityCatalog) -> inimigo na fase. Tamanho e
// cor vêm do ENTITY_SHAPES, igual à prévia do editor.
export function isEnemyType(type) {
  return ENEMY_ORDER.includes(type);
}

export function createEnemy(scene, type, x, y) {
  const { w, h, color } = ENTITY_SHAPES[type];
  switch (type) {
    case 'chaserTall':
      return new ChaserEnemy(scene, x, y, w, h, color, ENEMY.TALL_CHASE_SPEED);
    case 'chaser':
      return new ChaserEnemy(scene, x, y, w, h, color, ENEMY.SHORT_CHASE_SPEED);
    case 'flyer':
      return new FlyerEnemy(scene, x, y, w, h, color);
    case 'diver':
      return new DiverEnemy(scene, x, y, w, h, color);
    default: // 'enemy', 'enemyTall'
      return new PatrolEnemy(scene, x, y, w, h, color);
  }
}
