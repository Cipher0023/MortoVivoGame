import { GAME_WIDTH, GAME_HEIGHT, SCENERY_LAYERS } from '../config/constants.js';

// Cenário pintado da fase (ver SCENERY_LAYERS): uma TileSprite por camada,
// presa à tela (scrollFactor 0) e rolando a textura por dentro — assim a
// imagem se repete pela fase inteira sem precisar ser tão larga quanto ela.
//
// Com scrollFactor 0 a câmera ainda aplica o zoom em torno do centro da
// tela: a tela inteira corresponde a GAME_WIDTH/zoom x GAME_HEIGHT/zoom de
// mundo centrado em (GAME_WIDTH/2, GAME_HEIGHT/2), e tileScale 1/zoom deixa
// cada pixel da arte = 1 pixel de tela.
export function createScenery(scene) {
  const camera = scene.cameras.main;
  const zoom = camera.zoom;
  const screenBottom = GAME_HEIGHT / 2 + GAME_HEIGHT / (2 * zoom);

  const layers = SCENERY_LAYERS.filter(({ key }) => scene.textures.exists(key)).map((layer) => {
    const frame = scene.textures.getFrame(layer.key);
    const sprite = scene.add
      .tileSprite(GAME_WIDTH / 2, screenBottom, GAME_WIDTH / zoom, frame.height / zoom, layer.key)
      .setOrigin(0.5, 1)
      .setTileScale(1 / zoom)
      .setScrollFactor(0)
      .setDepth(layer.depth);
    return { ...layer, sprite, raisePx: Math.round(frame.height * (layer.raise ?? 0)) };
  });

  // Rolagem em pixels de tela (= pixels da arte). Arredondada: deslocamento
  // fracionário borra a textura.
  const sync = () => {
    const maxScrollY = Math.max(0, camera.getBounds().height - camera.height / zoom);
    for (const { sprite, factor, factorY, raisePx } of layers) {
      sprite.tilePositionX = Math.round(camera.scrollX * zoom * factor);
      const drop = Math.round((maxScrollY - camera.scrollY) * zoom * factorY);
      sprite.y = screenBottom + (drop - raisePx) / zoom;
    }
  };
  sync();
  // 'followupdate' sai depois de a câmera calcular a rolagem do quadro e antes
  // de desenhar — no update() da cena o fundo ficaria um quadro atrasado.
  camera.on('followupdate', sync);
  scene.events.once('shutdown', () => camera.off('followupdate', sync));
}
