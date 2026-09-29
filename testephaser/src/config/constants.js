// 1920x1080 (não 1280x720) pra que a maioria das telas fique em escala 1:1
// ou downscale (nítido) em vez de upscale (borrado) — ver main.js.
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

// Câmera da fase, calibrada por Mario (NES: Super Mario ≈ 14% da altura da
// tela) e Sonic (Mega Drive: ≈ 18%). Com zoom 2 a visão é 960x540 de mundo e
// o Vivo (84px) ocupa ≈ 16% da altura.
export const CAMERA = {
  ZOOM: 2,
  // suavização do follow (1 = gruda no personagem). Vertical mais lenta pra
  // tela não "pular" junto com cada pulo.
  LERP_X: 0.15,
  LERP_Y: 0.08,
  // centro da câmera fica este tanto ACIMA do personagem: ele aparece mais
  // embaixo e o chão fica no quarto inferior da tela, como nesses jogos.
  FOLLOW_OFFSET_Y: 90,
};

// Padrão para fases NOVAS criadas no editor. O LevelLoader sempre confia no
// tileSize/grid gravado no próprio arquivo de fase, nunca nestas constantes
// — mudar isto aqui não invalida fases já salvas.
export const TILE_SIZE = 64;
// 300 tiles de largura de fase; 12 de altura (768px) — cobre a visão da Fase 1
// com zoom (540px), mas não a tela inteira do editor, que não usa zoom (1080px).
export const EDITOR_GRID = { COLS: 300, ROWS: 12 };

export const PHYSICS = {
  GRAVITY_Y: 900,
  MOVE_SPEED: 220,
  // ≈170px de altura = 2,6 blocos do editor (64px): muro de 2 blocos se pula
  // com folga, de 3 blocos não — mas de cima de uma caixa, sim. É a régua
  // pra montar fases.
  JUMP_VELOCITY: -560,
  BLOCK_PUSH_SPEED: 150,
  CLIMB_SPEED: 160,
};

export const COLORS = {
  LIVING: 0xe08030,
  SKELETON: 0xe8e8d8,
  GROUND: 0x3a2a1a,
  GROUND_TOP: 0x2f6b2f,
  PLATFORM: 0x5a4a3a,
  BRIDGE_ACTIVE: 0x8a6a3a,
  WATER: 0x2266cc,
  POOL_BOTTOM: 0x1a2a44,
  LADDER: 0xc9a25c,
  KEY: 0xffdd33,
  LEVER_OFF: 0xaa3333,
  LEVER_ON: 0x33aa33,
  DOOR: 0x6b3f1f,
  WALL: 0x555555,
  BLOCK: 0x996633,
  BUTTON_UP: 0x888888,
  BUTTON_DOWN: 0x444444,
  EXIT_BUTTON: 0x33cc66,
  PATROL_ENEMY: 0x9933cc,
  GRATE: 0x777777,

  EDITOR_BG: 0x1a1a2e,
  EDITOR_GRID_LINE: 0xffffff,
  EDITOR_BUTTON: 0x333355,
  EDITOR_BUTTON_ACTIVE: 0x5555aa,
};
