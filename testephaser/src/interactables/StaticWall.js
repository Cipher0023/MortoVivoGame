import TexturedBlock from '../entities/TexturedBlock.js';

// Parede estática que pode sumir/aparecer: portão, grade, ponte.
export default class StaticWall extends TexturedBlock {
  constructor(scene, x, y, width, height, color, options = {}) {
    super(scene, x, y, width, height, { color, alpha: options.alpha ?? 1 });
    this.destroyed = false;
    // bolinha da cor de conexão (opcional): some junto com a parede
    this.marker = null;

    if (options.startSolid === false) {
      this.setSolid(false);
    }
  }

  setMarker(marker) {
    this.marker = marker;
    marker.setVisible(this.visible);
  }

  setSolid(solid) {
    this.body.enable = solid;
    this.setVisible(solid);
    this.marker?.setVisible(solid);
  }

  destroyWall() {
    this.destroyed = true;
    this.setSolid(false);
  }
}
