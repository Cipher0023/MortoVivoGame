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
  // A Esqueleto pula 1,5 bloco (96px): sobe 1 bloco com folga, 2 não.
  // Velocidade pra altura h: √(2·g·h).
  SKELETON_JUMP_VELOCITY: -Math.sqrt(2 * 900 * 1.5 * 64),
};

// Esqueleto: sem a cabeça fica fina (passa em grades); pisada pelo Vivo,
// desmonta e fica imóvel por um tempo.
export const SKELETON = {
  WIDTH: 30,
  HEIGHT: 50,
  HEADLESS_WIDTH: 14,
  HEADLESS_HEIGHT: 40,
  // pilha de ossos quando desmontada
  COLLAPSED_HEIGHT: 14,
  COLLAPSE_MS: 5000,
  HEAD_SIZE: 26,
  // distância (px) pra pegar/pôr a cabeça
  HEAD_REACH_X: 44,
  HEAD_REACH_Y: 60,
};

// Ataques. Vivo: pisão (cair na cabeça do inimigo). Esqueleto: arremesso do
// braço — a mira oscila sozinha num arco e o braço voa com a gravidade do
// mundo (movimento uniformemente variado). Alcance máximo (a 45°) ≈
// ARM_SPEED² / GRAVITY_Y ≈ 350px ≈ 5,5 blocos.
export const ATTACK = {
  // quique depois do pisão (segurando o pulo, quica com o pulo inteiro)
  STOMP_BOUNCE: -380,
  // pés até este tanto (px) abaixo do topo do inimigo ainda contam como "em cima"
  STOMP_TOLERANCE: 12,
  ARM_SPEED: 560,
  AIM_MIN_DEG: 10,
  AIM_MAX_DEG: 80,
  // tempo (ms) pra mira ir de uma ponta do arco à outra
  AIM_SWEEP_MS: 900,
  AIM_RADIUS: 60,
  // giro do braço no ar (graus/s)
  ARM_SPIN: 720,
};

// Bola: o Vivo chuta com o botão de ataque (R / B / CHUTAR) quando ela está
// no pé dele. Quica, rola e desce rampa; aciona o botão de parede e pesa no
// botão de segurar. Caiu num buraco: volta pro lugar onde começou.
export const BALL = {
  RADIUS: 16,
  // alcance do chute (centro a centro na horizontal; pés a pés na vertical)
  KICK_REACH_X: 60,
  KICK_REACH_Y: 40,
  KICK_SPEED_X: 520,
  KICK_SPEED_Y: -380,
  BOUNCE: 0.55,
  // no chão: fração da velocidade que sobra a cada segundo (atrito)
  GROUND_KEEP_PER_S: 0.35,
  // abaixo disso (px/s) no chão, para
  STOP_SPEED: 12,
  // aceleração morro abaixo numa rampa (px/s²)
  SLOPE_ACCEL: 500,
  // quique abaixo disso (px/s) não faz barulho
  BOUNCE_SOUND_SPEED: 140,
};

// Água: o Vivo não morre na hora — afunda devagar, anda mais lento e não
// consegue pular. Morre se afundar mais que 1 bloco abaixo da borda (aí o
// parceiro não alcança mais pra puxar) ou depois de DROWN_MS, o que vier
// primeiro. Ao cair, mergulha rápido até meio bloco (senão, andando quase na
// superfície, a física o deixaria "subir" na borda do outro lado) e depois
// afunda devagar: janela de resgate numa piscina funda ≈2,5s.
export const WATER = {
  PLUNGE_DEPTH: 0.5, // blocos abaixo da borda
  PLUNGE_SPEED: 200,
  SINK_SPEED: 20,
  MOVE_FACTOR: 0.5,
  DROWN_MS: 5000,
  BUBBLE_INTERVAL_MS: 700,
};

// Puxar o parceiro: quem está no chão puxa o outro pra cima SÓ se os pés
// dele estão exatamente 1 bloco abaixo (ex.: um no bloco 1, o outro no 2).
// Acontece apertando a ação (quem está em cima) ou sozinho, quando o de
// baixo pula ao lado do de cima — é também como o Vivo sai da água.
export const PULL_UP = {
  // distância lateral (centro a centro): ~1,75 bloco — quem para na beira da
  // água fica a ~1,5 bloco de quem caiu na primeira coluna
  REACH_X: 112,
  LEVEL_DIFF: 1,
  // folga, em fração de bloco (≈21px), pra quem não está exatamente alinhado
  // à grade (o Vivo boiando fica com os pés 1 bloco abaixo da borda)
  LEVEL_TOLERANCE: 0.33,
  DURATION_MS: 250,
};

// Rampas (ver levels/slopes.js), classificadas pelo ângulo: suave (até
// EASY_MAX_DEG) sobe normal; média (ex.: 45°) sobe mais devagar; íngreme (a
// partir de STEEP_MIN_DEG) perde velocidade conforme sobe e, sem força,
// escorrega de volta — não dá pra pular dela.
export const SLOPE = {
  EASY_MAX_DEG: 35,
  STEEP_MIN_DEG: 55,
  MEDIUM_FACTOR: 0.5,
  // íngreme: começa com esta fração da velocidade e chega a zero ao subir
  // STEEP_STALL_AT da altura da rampa
  STEEP_START_FACTOR: 0.6,
  STEEP_STALL_AT: 0.6,
  STEEP_MIN_FACTOR: 0.05,
  SLIDE_SPEED: 140,
  // quanto (px) o apoio "puxa" pra baixo quem desce andando, pra não quicar
  STICK: 20,
  // afundou mais que isso na superfície num quadro: não é apoio (é o lado
  // de baixo/alto da rampa)
  MAX_STEP: 28,
};

// Inimigos não morrem: o pisão e o braço os paralisam por STUN_MS (piscam
// no fim, antes de voltar a andar). Paralisados, não fazem mal a ninguém.
// Todos só enxergam/machucam o Vivo. Distâncias em blocos (64px).
export const ENEMY = {
  STUN_MS: 4000,
  BLINK_MS: 1000,
  PATROL_SPEED: 80,
  // perseguidores: veem o Vivo até esta distância (e mais ou menos na mesma
  // altura) e vão atrás dele, sem cair de beiradas
  CHASE_RANGE_X: 6,
  CHASE_RANGE_Y: 1.5,
  TALL_CHASE_SPEED: 110,
  SHORT_CHASE_SPEED: 160,
  // voadores: vão e voltam na horizontal até FLY_RANGE blocos da origem
  FLY_SPEED: 110,
  FLY_RANGE: 4,
  // mergulhador: mergulha quando o Vivo passa embaixo (até DIVE_RANGE_Y
  // blocos abaixo), desce até o nível dele e sobe de volta
  DIVE_TRIGGER_X: 0.6,
  DIVE_RANGE_Y: 7,
  DIVE_SPEED: 380,
  RISE_SPEED: 120,
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
  // botão de segurar (só fica apertado com peso em cima)
  HOLD_BUTTON_UP: 0xd08a2a,
  HOLD_BUTTON_DOWN: 0x6a4410,
  // botão de parede (bola chutada ou braço arremessado)
  WALL_BUTTON_UP: 0x3aa0d8,
  WALL_BUTTON_DOWN: 0x1a4a66,
  BALL: 0xf2f2f2,
  BALL_PATCH: 0x222222,
  EXIT_BUTTON: 0x33cc66,
  PATROL_ENEMY: 0x9933cc,
  TALL_PATROL_ENEMY: 0x6a2a9a,
  TALL_CHASER: 0xcc3333,
  CHASER: 0xff6644,
  FLYER: 0x33bbaa,
  DIVER: 0xdd9922,
  GRATE: 0x777777,

  EDITOR_BG: 0x1a1a2e,
  EDITOR_GRID_LINE: 0xffffff,
  EDITOR_BUTTON: 0x333355,
  EDITOR_BUTTON_ACTIVE: 0x5555aa,
};
