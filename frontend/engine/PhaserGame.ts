import type { MutableRefObject } from "react";
import type { LevelDefinition } from "../levels/types";

export interface PhaserGameOptions {
  container: HTMLDivElement;
  level: LevelDefinition;
  joystickDirection: MutableRefObject<{ x: number; y: number }>;
  onLevelComplete: () => void;
}

// Inicializa o motor Phaser para uma fase e retorna a função de limpeza.
// O Phaser e a MainScene são importados dinamicamente para não afetarem
// o carregamento inicial da página (lazy loading).
export async function startPhaserGame(
  options: PhaserGameOptions,
): Promise<() => void> {
  const Phaser = await import("phaser");
  const { createMainScene } = await import("./MainScene");

  const MainScene = createMainScene(Phaser, {
    level: options.level,
    joystickDirection: options.joystickDirection,
    onLevelComplete: options.onLevelComplete,
  });

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: options.container,
    backgroundColor: "#0a0a0a",
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 800 }, debug: false },
    },
    scene: [MainScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  const game = new Phaser.Game(config);

  const handleResize = () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener("resize", handleResize);

  // Retorna função de limpeza para ser chamada pelo React no unmount
  return () => {
    window.removeEventListener("resize", handleResize);
    game.destroy(true);
  };
}
