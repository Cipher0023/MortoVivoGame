import { COLORS } from '../config/constants.js';

// Peças de mecânica que o editor coloca e a PlayScene monta. Cada peça ocupa
// uma célula da grade. Puro dado + desenho de prévia (paleta e editor); a
// física e o comportamento ficam na PlayScene.
//
// paint:   arrastar o mouse pinta várias células (água, portões, escadas...)
// unique:  só pode existir uma na fase (colocar de novo move a existente)
// channel: 'required' = precisa de cor (alavanca, botões: são os gatilhos)
//          'optional' = com cor, a peça reage ao gatilho da mesma cor
//                       (portão/grade abrem, ponte/escada/chave aparecem);
//                       sem cor, funciona sempre do jeito normal
//          O botão de segurar é o único gatilho que "desliga": sem peso em
//          cima, portão/grade fecham, ponte/escada somem (a chave, uma vez
//          à mostra, fica). Outro gatilho da mesma cor já acionado mantém
//          tudo ligado.

export const ENTITY_TYPES = {
  living: { label: 'Vivo', unique: true },
  skeleton: { label: 'Esqueleto', unique: true },
  exit: { label: 'Saída' },
  enemy: { label: 'Inimigo (vai e volta)' },
  enemyTall: { label: 'Inimigo alto (vai e volta)' },
  chaserTall: { label: 'Inimigo alto que persegue' },
  chaser: { label: 'Inimigo baixo que persegue' },
  flyer: { label: 'Voador (linha reta)' },
  diver: { label: 'Mergulhador' },
  water: { label: 'Água', paint: true },
  box: { label: 'Caixa' },
  ball: { label: 'Bola (o Vivo chuta)' },
  key: { label: 'Chave', channel: 'optional' },
  door: { label: 'Porta', paint: true },
  lever: { label: 'Alavanca', channel: 'required' },
  button: { label: 'Botão', channel: 'required' },
  holdButton: { label: 'Botão de segurar (só com peso em cima)', channel: 'required' },
  wallButton: { label: 'Botão de parede (bola ou braço)', channel: 'required' },
  gate: { label: 'Portão', paint: true, channel: 'optional' },
  grate: { label: 'Grade', paint: true, channel: 'optional' },
  bridge: { label: 'Ponte', paint: true, channel: 'optional' },
  ladder: { label: 'Escada', paint: true, channel: 'optional' },
};

// Inimigos têm um grupo próprio na paleta do editor (ver LevelEditorScene).
export const ENEMY_ORDER = ['enemy', 'enemyTall', 'chaserTall', 'chaser', 'flyer', 'diver'];
export const ENTITY_ORDER = Object.keys(ENTITY_TYPES).filter((type) => !ENEMY_ORDER.includes(type));

// Cores de conexão: gatilho e alvos da mesma cor ficam ligados.
export const CHANNEL_COLORS = {
  1: 0xffd23f, // amarelo
  2: 0x3fa7ff, // azul
  3: 0xff5fa2, // rosa
  4: 0x9dff5f, // verde
};
export const CHANNELS = [1, 2, 3, 4];

// Tamanho de cada peça dentro da célula (em px de mundo, célula = 64) e
// alinhamento vertical: 'bottom' apoia no chão da célula, 'top' fica no teto,
// 'center'/'fill' ocupam o meio/a célula toda. Os inimigos altos passam da
// célula pra cima: coloque-os na célula dos pés.
export const ENTITY_SHAPES = {
  exit: { w: 50, h: 14, align: 'bottom', color: COLORS.EXIT_BUTTON },
  enemy: { w: 36, h: 36, align: 'bottom', color: COLORS.PATROL_ENEMY },
  enemyTall: { w: 36, h: 96, align: 'bottom', color: COLORS.TALL_PATROL_ENEMY },
  chaserTall: { w: 36, h: 96, align: 'bottom', color: COLORS.TALL_CHASER },
  chaser: { w: 30, h: 30, align: 'bottom', color: COLORS.CHASER },
  flyer: { w: 44, h: 24, align: 'center', color: COLORS.FLYER },
  diver: { w: 40, h: 28, align: 'center', color: COLORS.DIVER },
  water: { w: 64, h: 64, align: 'fill', color: COLORS.WATER },
  box: { w: 60, h: 60, align: 'bottom', texture: 'caixa2' },
  ball: { w: 32, h: 32, align: 'bottom', texture: 'ball' },
  key: { w: 18, h: 18, align: 'center', color: COLORS.KEY },
  door: { w: 44, h: 64, align: 'fill', color: COLORS.DOOR },
  lever: { w: 16, h: 40, align: 'bottom', color: COLORS.LEVER_OFF },
  button: { w: 44, h: 12, align: 'bottom', color: COLORS.BUTTON_UP },
  holdButton: { w: 44, h: 12, align: 'bottom', color: COLORS.HOLD_BUTTON_UP },
  // no jogo gruda na parede ao lado (ver PlayScene); no editor fica no meio
  wallButton: { w: 12, h: 44, align: 'center', color: COLORS.WALL_BUTTON_UP },
  gate: { w: 40, h: 64, align: 'fill', color: COLORS.WALL },
  grate: { w: 20, h: 64, align: 'fill', color: COLORS.GRATE },
  bridge: { w: 64, h: 16, align: 'top', color: COLORS.PLATFORM },
  ladder: { w: 24, h: 64, align: 'fill', color: COLORS.LADDER },
};

// Centro da peça (x, y) dentro da célula (col, row).
export function entityCenter(type, col, row, cellSize) {
  const shape = ENTITY_SHAPES[type];
  const x = col * cellSize + cellSize / 2;
  const top = row * cellSize;
  if (!shape) return { x, y: top + cellSize / 2 };
  if (shape.align === 'bottom') return { x, y: top + cellSize - shape.h / 2 };
  if (shape.align === 'top') return { x, y: top + shape.h / 2 };
  return { x, y: top + cellSize / 2 };
}

// Prévia visual de uma peça (paleta e editor): Container centrado na célula.
// `size` = lado da célula na tela (64 no editor, menor na paleta).
export function createEntityPreview(scene, type, channel, size = 64) {
  const scale = size / 64;
  const parts = [];

  if (type === 'living') {
    const boy = scene.add.image(0, 0, 'boy-walk-01');
    boy.setScale((60 * scale) / boy.height);
    parts.push(boy);
  } else if (type === 'skeleton') {
    parts.push(scene.add.rectangle(0, 6 * scale, 30 * scale, 50 * scale, COLORS.SKELETON));
  } else {
    const shape = ENTITY_SHAPES[type];
    // na paleta (size < 64), peça maior que a célula (inimigo alto) é
    // encolhida e centrada pra caber no quadradinho; na grade, tamanho real
    const fit = size < 64 ? Math.min(1, 64 / Math.max(shape.w, shape.h)) : 1;
    const offsetY = fit < 1 ? 0 : entityCenter(type, 0, 0, 64).y - 32;
    const piece = shape.texture
      ? scene.add.image(0, offsetY * scale, shape.texture)
      : scene.add.image(0, offsetY * scale, 'bloco-solido').setTint(shape.color);
    piece.setDisplaySize(shape.w * scale * fit, shape.h * scale * fit);
    // "escondida até acionar" fica meio transparente no editor
    if (channel && isHiddenUntilTriggered(type)) piece.setAlpha(0.5);
    if (type === 'water') piece.setAlpha(0.6);
    parts.push(piece);

    if (type === 'ladder') {
      const rungs = scene.add.graphics();
      rungs.lineStyle(3 * scale, 0x7a5a2a, 1);
      for (let i = -24; i <= 24; i += 16) rungs.lineBetween(-12 * scale, i * scale, 12 * scale, i * scale);
      parts.push(rungs);
    }
  }

  if (channel) parts.push(createChannelMarker(scene, 20 * scale, -20 * scale, channel, scale));
  return scene.add.container(0, 0, parts);
}

// Bolinha da cor de conexão (editor e jogo).
export function createChannelMarker(scene, x, y, channel, scale = 1) {
  const marker = scene.add.graphics({ x, y });
  marker.fillStyle(0x000000, 0.6);
  marker.fillCircle(0, 0, 10 * scale);
  marker.fillStyle(CHANNEL_COLORS[channel], 1);
  marker.fillCircle(0, 0, 7 * scale);
  return marker;
}

// Camada da peça: água e ponte têm camadas próprias pra dividir a célula com
// outras peças (alavanca submersa, escada atravessando a ponte, ponte sobre a
// água). Cada célula aceita uma peça por camada.
export const ENTITY_LAYERS = ['main', 'platform', 'water']; // de cima pra baixo

export function entityLayer(type) {
  if (type === 'water') return 'water';
  if (type === 'bridge') return 'platform';
  return 'main';
}

// Peças que, com cor, começam invisíveis e surgem ao acionar o gatilho.
export function isHiddenUntilTriggered(type) {
  return type === 'bridge' || type === 'ladder' || type === 'key';
}
