import Phaser from "phaser";
import type { LevelDefinition } from "../levels/types";
import { Boy } from "./Boy";

export interface EngineOptions {
  parent: string | HTMLElement;
  level: LevelDefinition;
  joystickDirection: React.MutableRefObject<{ x: number; y: number }>;
  onLevelComplete: () => void;
  width?: number;
  height?: number;
}

export class MainEngine {
  private game: Phaser.Game;
  private currentLevel: LevelDefinition;
  private joystickDirection: React.MutableRefObject<{ x: number; y: number }>;
  private onLevelComplete: () => void;
  private hasCompletedLevel: boolean = false;

  constructor(options: EngineOptions) {
    this.currentLevel = options.level;
    this.joystickDirection = options.joystickDirection;
    this.onLevelComplete = options.onLevelComplete;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: options.parent,
      width: options.width ?? 800,
      height: options.height ?? 600,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 1000 }, // Ajuste conforme o TUNING do Boy
          debug: false,
        },
      },
      scene: this.createLevelScene(),
    };

    this.game = new Phaser.Game(config);
  }

  /**
   * Cria a configuração da cena de nível, com acesso ao contexto do Engine.
   */
  private createLevelScene() {
    const engine = this; // Captura o contexto do engine para a cena

    return class LevelScene extends Phaser.Scene {
      private boy!: Boy;
      private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

      constructor() {
        super("LevelScene");
      }

      preload() {
        // 1. Carregamento de Assets
        engine.currentLevel.assets.forEach((asset) => {
          this.load.image(asset.key, asset.path);
        });
        Boy.preload(this);
      }

      create() {
        engine.hasCompletedLevel = false;
        const { width, height } = this.scale;
        
        // 2. Configuração Mundial
        this.cameras.main.setBackgroundColor(engine.currentLevel.backgroundColor);
        this.cameras.main.setZoom(engine.currentLevel.cameraZoom);
        
        const worldWidth = width * engine.currentLevel.worldWidthMultiplier;
        const worldHeight = height * engine.currentLevel.worldHeightMultiplier;

        // 3. Construção da Geometria do Nível (Chão + Terreno)
        const staticBodies = this.buildLevelGeometry(worldWidth, worldHeight);

        // 4. Spawn do Personagem (A lógica de movimento agora é 100% do Boy)
        const playerX = worldWidth * engine.currentLevel.player.xProportion;
        const playerY = worldHeight - engine.currentLevel.player.yFromBottom;
        
        this.boy = new Boy({
          scene: this,
          x: playerX,
          y: playerY,
          staticBodies,
          terrain: engine.currentLevel.terrain,
        });

        // 5. Câmera
        this.cameras.main.startFollow(this.boy.sprite, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // 6. Inputs Globais
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.input.keyboard!.on("keydown-ENTER", () => this.attemptLevelComplete());
      }

      update() {
        if (engine.hasCompletedLevel) return;

        // Coleta o estado bruto do input
        const inputState = {
          left: this.cursors.left.isDown,
          right: this.cursors.right.isDown,
          jump: this.cursors.up.isDown,
          joyX: engine.joystickDirection.current.x,
          joyJump: engine.joystickDirection.current.y < -0.5,
        };

        // Delega TODA a lógica de movimento, física de ladeira e animação para o Boy
        this.boy.update(inputState);

        // Lógica global de vitória
        const worldWidth = this.scale.width * engine.currentLevel.worldWidthMultiplier;
        if (this.boy.sprite.x >= worldWidth - 50) {
          this.attemptLevelComplete();
        }
      }

      private attemptLevelComplete() {
        if (!engine.hasCompletedLevel) {
          engine.hasCompletedLevel = true;
          engine.onLevelComplete();
        }
      }

      private buildLevelGeometry(worldWidth: number, worldHeight: number) {
        const bodies: Phaser.GameObjects.GameObject[] = [];
        const { thickness } = engine.currentLevel.ground;
        
        // Chão base
        const groundY = worldHeight - thickness / 2;
        const ground = this.add.rectangle(worldWidth / 2, groundY, worldWidth, thickness);
        this.physics.add.existing(ground, true);
        bodies.push(ground);

        // Terreno procedural
        if (engine.currentLevel.terrain) {
          for (const feature of engine.currentLevel.terrain) {
            if (feature.type === "sineHill") {
              bodies.push(...this.buildSineHill(feature, worldWidth, worldHeight));
            }
          }
        }

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        return bodies;
      }

      private buildSineHill(feature: any, worldWidth: number, worldHeight: number) {
        // (Mantenha sua lógica atual de buildSineHill aqui, ela retorna os retângulos de física)
        // ...
        return [] as Phaser.GameObjects.GameObject[];
      }
    };
  }

  /**
   * Carrega uma nova fase, reiniciando a cena com os novos dados.
   */
  public loadLevel(newLevel: LevelDefinition) {
    this.currentLevel = newLevel;
    this.game.scene.stop("LevelScene");
    this.game.scene.start("LevelScene");
  }

  /**
   * Limpa a memória e destrói a instância do Phaser (útil para unmount do React).
   */
  public destroy() {
    this.game.destroy(true);
  }
}