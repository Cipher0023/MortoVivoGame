export const TILES_PATH = `${import.meta.env.BASE_URL}assets/tiles/`;
export const OBJECTS_PATH = `${import.meta.env.BASE_URL}assets/objetos/`;
export const BOY_PATH = `${import.meta.env.BASE_URL}assets/boy/`;
export const BLOCKS_PATH = `${import.meta.env.BASE_URL}assets/blocks/`;
export const SOUNDS_PATH = `${import.meta.env.BASE_URL}assets/sounds/`;

// Sons gravados (ver audio/sfx.js), um id por ação do jogo. Origem e licença
// de cada arquivo: public/assets/sounds/CREDITOS.md (todos CC0).
//   files:  variações — cada toque sorteia uma (passos não soam repetidos)
//   volume: relativo, 0 a 1 (os arquivos já vêm com o mesmo pico)
//   rate:   velocidade/tom (1 = original; 1.25 = mais agudo e rápido)
//   vary:   variação aleatória de tom a cada toque (0.1 = ±10%)
// Id sem arquivo aqui (ou arquivo que falhar ao carregar) volta pro som
// sintetizado de mesmo id.
const variants = (id, count) => Array.from({ length: count }, (_, i) => `${id}-${i + 1}.mp3`);
export const SOUND_MANIFEST = [
  // interface
  { id: 'tick', files: variants('tick', 1), volume: 0.25 },
  { id: 'click', files: variants('click', 1), volume: 0.4 },
  { id: 'confirm', files: variants('confirm', 1), volume: 0.5 },
  { id: 'back', files: variants('back', 1), volume: 0.45 },
  { id: 'select', files: variants('select', 1), volume: 0.4 },
  { id: 'toggle', files: variants('toggle', 1), volume: 0.4 },
  { id: 'nope', files: variants('nope', 1), volume: 0.45 },
  { id: 'error', files: variants('error', 1), volume: 0.5 },
  // leitor de QR
  { id: 'scanOk', files: variants('scanOk', 1), volume: 0.6 },
  { id: 'comingSoon', files: variants('comingSoon', 1), volume: 0.6 },
  // personagens
  { id: 'jump', files: variants('jump', 3), volume: 0.45, vary: 0.1 },
  { id: 'land', files: variants('land', 5), volume: 0.5, vary: 0.1 },
  { id: 'step', files: variants('step', 10), volume: 0.3, vary: 0.08 },
  { id: 'stepBone', files: variants('stepBone', 5), volume: 0.3, rate: 1.25, vary: 0.1 },
  { id: 'climb', files: variants('climb', 5), volume: 0.35, vary: 0.1 },
  { id: 'switch', files: variants('switch', 1), volume: 0.45 },
  { id: 'wait', files: variants('wait', 1), volume: 0.45 },
  { id: 'follow', files: variants('follow', 1), volume: 0.45 },
  { id: 'thin', files: variants('thin', 1), volume: 0.45 },
  { id: 'unthin', files: variants('unthin', 1), volume: 0.45 },
  // mecanismos da fase
  { id: 'lever', files: variants('lever', 1), volume: 0.7 },
  { id: 'pressButton', files: variants('pressButton', 1), volume: 0.6 },
  { id: 'gateOpen', files: variants('gateOpen', 1), volume: 0.7 },
  { id: 'bridge', files: variants('bridge', 3), volume: 0.6 },
  { id: 'ladderDrop', files: variants('ladderDrop', 2), volume: 0.7 },
  { id: 'reveal', files: variants('reveal', 1), volume: 0.6 },
  { id: 'key', files: variants('key', 1), volume: 0.6 },
  { id: 'unlock', files: variants('unlock', 2), volume: 0.6 },
  { id: 'door', files: variants('door', 1), volume: 0.6 },
  { id: 'push', files: variants('push', 5), volume: 0.35, rate: 0.8, vary: 0.1 },
  // botão de segurar soltando / portão fechando de novo (sons reaproveitados)
  { id: 'releaseButton', files: variants('pressButton', 1), volume: 0.5, rate: 0.75 },
  { id: 'gateClose', files: variants('gateOpen', 1), volume: 0.6, rate: 0.85 },
  // bola
  { id: 'kick', files: variants('stomp', 3), volume: 0.6, rate: 1.3, vary: 0.08 },
  { id: 'ballBounce', files: variants('armLand', 3), volume: 0.4, rate: 0.8, vary: 0.12 },
  // ataques
  { id: 'stomp', files: variants('stomp', 3), volume: 0.7, vary: 0.08 },
  { id: 'enemyStun', files: variants('enemyStun', 1), volume: 0.55 },
  { id: 'enemyRecover', files: variants('enemyRecover', 1), volume: 0.5 },
  // perseguidor viu o Vivo / mergulhador mergulhando
  { id: 'enemyAlert', files: variants('aim', 1), volume: 0.45, rate: 1.3 },
  { id: 'dive', files: variants('throw', 2), volume: 0.6, rate: 0.75 },
  { id: 'aim', files: variants('aim', 1), volume: 0.5 },
  { id: 'throw', files: variants('throw', 2), volume: 0.6, vary: 0.08 },
  { id: 'armHit', files: variants('armHit', 3), volume: 0.7, vary: 0.08 },
  { id: 'armLand', files: variants('armLand', 3), volume: 0.5, vary: 0.1 },
  { id: 'armPickup', files: variants('armPickup', 1), volume: 0.6 },
  // cabeça da Esqueleto (tirar/pôr usa 'thin'/'unthin') e desmontar
  { id: 'headGrab', files: variants('armPickup', 1), volume: 0.6, rate: 1.15 },
  { id: 'headDrop', files: variants('armLand', 3), volume: 0.5, rate: 0.85, vary: 0.1 },
  { id: 'collapse', files: variants('collapse', 2), volume: 0.7 },
  { id: 'reassemble', files: variants('reassemble', 1), volume: 0.6 },
  // resgate: puxar o parceiro pra cima e afogamento do Vivo
  { id: 'pullUp', files: variants('pullUp', 2), volume: 0.7 },
  { id: 'bubbles', files: variants('bubbles', 3), volume: 0.5, vary: 0.1 },
  // morte / vitória
  { id: 'splash', files: variants('splash', 3), volume: 0.7, vary: 0.05 },
  { id: 'hit', files: variants('hit', 3), volume: 0.7 },
  { id: 'death', files: variants('death', 1), volume: 0.6 },
  { id: 'fall', files: variants('fall', 1), volume: 0.6 },
  { id: 'win', files: variants('win', 1), volume: 0.7 },
  // editor
  { id: 'place', files: variants('place', 5), volume: 0.4, vary: 0.1 },
  { id: 'erase', files: variants('erase', 3), volume: 0.4 },
  { id: 'pickup', files: variants('pickup', 1), volume: 0.45 },
  { id: 'flip', files: variants('flip', 1), volume: 0.5 },
  { id: 'undo', files: variants('undo', 1), volume: 0.45 },
  { id: 'redo', files: variants('redo', 1), volume: 0.45 },
  { id: 'save', files: variants('save', 1), volume: 0.55 },
  { id: 'load', files: variants('load', 1), volume: 0.5 },
];

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
// `ground`: é chão (fica na linha "Chão" da paleta e pode ser atravessado
// pulando por baixo, se a peça pedir — ver piecePassThrough).
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
  { key: 'ground-strip-3', file: 'ground-strip-3.png', px: [383, 129], size: [3, 1], collision: true, ground: true },
  { key: 'dirt-grid-4x2', file: 'dirt-grid-4x2.png', px: [512, 256], size: [4, 2], collision: true, ground: true },
  // Rampas (textura provisória: triângulo subindo pra direita — é só trocar
  // o arquivo). slope: a colisão é a superfície inclinada (levels/slopes.js).
  { key: 'rampa-suave', file: 'rampa-suave.png', px: [256, 128], size: [2, 1], collision: true, ground: true, slope: true },
  { key: 'rampa-45', file: 'rampa-45.png', px: [128, 128], size: [1, 1], collision: true, ground: true, slope: true },
  { key: 'rampa-ingreme', file: 'rampa-ingreme.png', px: [128, 256], size: [1, 2], collision: true, ground: true, slope: true },
];
