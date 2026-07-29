import type { LevelDefinition } from "./types";

export const level1: LevelDefinition = {
  id: 1,
  name: "Início da Jornada",
  chapter: "Capítulo 1",
  markerPattern: "marker1",
  difficulty: "easy",
  backgroundColor: "#87CEEB",
  cameraZoom: 0.6,
  worldWidthMultiplier: 3,
  worldHeightMultiplier: 2,
  assets: [
    { key: "backgroundTexture", path: "/textura_fundo.png" },
    { key: "yellowgrass", path: "/yellowGrass.png" },
    { key: "casabg", path: "/casabg.png" },
    { key: "arvore", path: "/arvore-removebg-preview.png" },
  ],
  layers: [
    {
      type: "tile",
      texture: "backgroundTexture",
      scrollFactor: 0,
      depth: -2,
      fillMode: "world",
    },
    {
      type: "image",
      texture: "casabg",
      scrollFactor: 0.3,
      depth: -1,
      scale: 2.0,
      xFromCenter: 100,
      yFromBottom: 400,
    },
    {
      type: "image",
      texture: "arvore",
      scrollFactor: 0.3,
      depth: -1,
      scale: 2.0,
      xFromCenter: -2300,
      yFromBottom: 300,
    },
    {
      type: "tile",
      texture: "yellowgrass",
      scrollFactor: 1,
      depth: 0,
      fillMode: "fixedHeight",
      fixedHeight: 220,
    },
  ],
  ground: { thickness: 120 },
  player: { xProportion: 0.5, yFromBottom: 600 },
  terrain: [
    {
      type: "sineHill",
      xFromEnd: 1000, // colina começa 1000px antes do fim do mundo
      width: 1000, // estende-se até o fim do mundo
      amplitude: 220, // pico de 220px acima do chão
      frequency: 1, // uma subida e uma descida
      segments: 150, // 150 segmentos ≈ 6.7px cada → declive suave
      colorBody: 0x8b6914,
      colorGrass: 0x5a8a3c,
    },
  ],
};
