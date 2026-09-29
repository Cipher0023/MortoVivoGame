import Phaser from 'phaser';

const DEFAULT_TEXTURE = 'bloco-solido';

// Base pros elementos estáticos/interativos da fase (paredes, alavancas,
// portas, blocos etc.): uma Image com física, em vez de um
// Phaser.GameObjects.Rectangle. Sem uma textura própria (ex.: um objeto do
// editor como 'caixa2'), usa 'bloco-solido' (branca) tingida com setTint()
// pra reproduzir a cor — assim toda a Fase 1 passa pelo mesmo pipeline de
// textura dos tiles/objetos pintados no editor.
export default class TexturedBlock extends Phaser.GameObjects.Image {
  constructor(scene, x, y, width, height, options = {}) {
    super(scene, x, y, options.texture || DEFAULT_TEXTURE);
    this.scene = scene;

    this.setDisplaySize(width, height);
    if (options.color !== undefined) this.setTint(options.color);
    if (options.alpha !== undefined) this.setAlpha(options.alpha);

    scene.add.existing(this);
    scene.physics.add.existing(this, options.staticBody !== false);
  }

  setColor(color) {
    this.setTint(color);
    return this;
  }
}
