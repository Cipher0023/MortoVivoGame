// Tipos personalizados para inimigos e power-ups futuros
export interface Enemy {
  id: string;
  type: "zombie" | "skeleton" | "ghost" | "boss";
  health: number;
  speed: number;
  damage: number;
  sprite: string;
}

export interface PowerUp {
  id: string;
  type: "health" | "speed" | "jump" | "shield";
  duration?: number; // em milissegundos
  effect: string;
  sprite: string;
}

// Configuração de inimigos por tipo
export const ENEMY_TYPES: Record<string, Omit<Enemy, "id">> = {
  zombie: {
    type: "zombie",
    health: 100,
    speed: 50,
    damage: 10,
    sprite: "zombie",
  },
  skeleton: {
    type: "skeleton",
    health: 80,
    speed: 80,
    damage: 15,
    sprite: "skeleton",
  },
  ghost: {
    type: "ghost",
    health: 60,
    speed: 120,
    damage: 20,
    sprite: "ghost",
  },
  boss: {
    type: "boss",
    health: 500,
    speed: 40,
    damage: 30,
    sprite: "boss",
  },
};

// Configuração de power-ups
export const POWERUP_TYPES: Record<string, Omit<PowerUp, "id">> = {
  health: {
    type: "health",
    effect: "+50 HP",
    sprite: "heart",
  },
  speed: {
    type: "speed",
    duration: 10000,
    effect: "Velocidade x2",
    sprite: "speedBoost",
  },
  jump: {
    type: "jump",
    duration: 15000,
    effect: "Pulo extra alto",
    sprite: "jumpBoost",
  },
  shield: {
    type: "shield",
    duration: 8000,
    effect: "Invencibilidade temporária",
    sprite: "shield",
  },
};

// Função para criar inimigo com ID único
export function createEnemy(type: keyof typeof ENEMY_TYPES): Enemy {
  const enemyData = ENEMY_TYPES[type];
  return {
    ...enemyData,
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}

// Função para criar power-up com ID único
export function createPowerUp(type: keyof typeof POWERUP_TYPES): PowerUp {
  const powerUpData = POWERUP_TYPES[type];
  return {
    ...powerUpData,
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}
