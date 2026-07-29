// Tipos de camada visual para composição do cenário da fase

export type TileLayer = {
  type: "tile";
  texture: string;
  scrollFactor: number;
  depth: number;
  // "world" = preenche o mundo inteiro (fundo); "fixedHeight" = altura fixa (grama)
  fillMode: "world" | "fixedHeight";
  fixedHeight?: number;
};

export type ImageLayer = {
  type: "image";
  texture: string;
  scrollFactor: number;
  depth: number;
  scale: number;
  xFromCenter: number; // offset em px a partir do centro do mundo (negativo = esquerda)
  yFromBottom: number; // distância em px a partir do fundo do mundo
};

export type LayerConfig = TileLayer | ImageLayer;

// Colina com perfil senoidal — terreno físico gerado proceduralmente
export interface SineHill {
  type: "sineHill";
  xFromEnd: number; // px a partir do fim do mundo onde a colina começa
  width: number; // largura total da colina em px
  amplitude: number; // altura máxima no pico em px
  frequency: number; // ciclos da senoide (1 = sobe e desce uma vez)
  segments: number; // resolução (mais segmentos = declive mais suave)
  colorBody: number; // cor hex Phaser do corpo de terra (ex: 0x8B6914)
  colorGrass: number; // cor hex Phaser da faixa de grama no topo (ex: 0x5a8a3c)
}

export type TerrainFeature = SineHill;

// Definição completa de uma fase — tudo que o motor precisa para construí-la
export interface LevelDefinition {
  id: number;
  name: string;
  chapter: string;
  markerPattern: string;
  difficulty: "easy" | "medium" | "hard";

  // Visual
  backgroundColor: string;
  cameraZoom: number;

  // Tamanho do mundo como múltiplos do tamanho da tela
  worldWidthMultiplier: number;
  worldHeightMultiplier: number;

  // Assets que devem ser carregados para esta fase (chave + caminho)
  assets: Array<{ key: string; path: string }>;

  // Camadas visuais do cenário, renderizadas na ordem do array (de trás para frente)
  layers: LayerConfig[];

  // Chão físico invisível (apenas colisão)
  ground: {
    thickness: number;
  };

  // Posição de spawn do jogador
  player: {
    xProportion: number; // 0-1 relativo à largura do mundo (0.5 = centro)
    yFromBottom: number; // px a partir do fundo do mundo
  };

  // Terreno procédural (opcional) — gerado sobre o chão plano
  terrain?: TerrainFeature[];
}
