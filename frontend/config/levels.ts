// Configuração de fases vinculadas às páginas do livro
export interface LevelConfig {
  id: number;
  name: string;
  chapter: string;
  markerPattern: string; // Nome do arquivo de padrão do marcador
  description: string;
  difficulty: "easy" | "medium" | "hard";
  enemyCount?: number;
  backgroundColor?: string;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Início da Jornada",
    chapter: "Capítulo 1",
    markerPattern: "marker1", // Pode ser um QR code ou marcador personalizado
    description: "O despertar do herói. Aprenda os controles básicos.",
    difficulty: "easy",
    enemyCount: 0,
    backgroundColor: "#87CEEB",
  },
  {
    id: 2,
    name: "Primeiro Encontro",
    chapter: "Capítulo 2",
    markerPattern: "marker2",
    description: "Os primeiros inimigos aparecem. Sobreviva!",
    difficulty: "easy",
    enemyCount: 3,
    backgroundColor: "#9370DB",
  },
  {
    id: 3,
    name: "Noite das Sombras",
    chapter: "Capítulo 3",
    markerPattern: "marker3",
    description: "A escuridão traz novos desafios.",
    difficulty: "medium",
    enemyCount: 5,
    backgroundColor: "#2F4F4F",
  },
  {
    id: 4,
    name: "O Confronto Final",
    chapter: "Capítulo 4",
    markerPattern: "marker4",
    description: "Enfrente o chefe final e salve o mundo.",
    difficulty: "hard",
    enemyCount: 8,
    backgroundColor: "#8B0000",
  },
];

// Função para obter configuração de fase pelo marcador detectado
export function getLevelByMarker(
  markerPattern: string
): LevelConfig | undefined {
  return LEVELS.find((level) => level.markerPattern === markerPattern);
}

// Função para obter configuração de fase pelo ID
export function getLevelById(id: number): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}
