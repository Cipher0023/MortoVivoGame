import type { MutableRefObject } from "react";
import type { LevelDefinition, TileLayer, ImageLayer } from "../levels/types";
import { Boy } from "./Boy";

export interface MainSceneOptions {
  level: LevelDefinition;
  joystickDirection: MutableRefObject<{ x: number; y: number }>;
  onLevelComplete: () => void;
}

export function createMainScene(
  Phaser: typeof import("phaser"),
  options: MainSceneOptions,
) {
  const { level, joystickDirection, onLevelComplete } = options;

  return class MainScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private boyController!: Boy;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private worldWidth = 0;
    private hasCompletedLevel = false;

    constructor() {
      super("MainScene");
    }

    preload() {
      // Carrega os assets declarados na definição da fase
      for (const asset of level.assets) {
        this.load.image(asset.key, asset.path);
      }
      Boy.preload(this);
    }

    create() {
      const { width, height } = this.scale;

      this.cameras.main.setBackgroundColor(level.backgroundColor);
      this.cameras.main.setZoom(level.cameraZoom);

      const worldWidth = width * level.worldWidthMultiplier;
      const worldHeight = height * level.worldHeightMultiplier;
      this.worldWidth = worldWidth;

      // Renderiza as camadas visuais declaradas na fase
      for (const layer of level.layers) {
        this.renderLayer(layer, worldWidth, worldHeight);
      }

      // Chão físico invisível
      const { thickness } = level.ground;
      const groundY = worldHeight - thickness / 2;
      const ground = this.add.rectangle(
        worldWidth / 2,
        groundY,
        worldWidth,
        thickness,
      );
      this.physics.add.existing(ground, true);

      const groundBody = ground.body as Phaser.Physics.Arcade.StaticBody;
      groundBody.setSize(worldWidth, thickness);
      groundBody.setOffset(-worldWidth / 2, -thickness / 2);
      groundBody.updateFromGameObject();

      // Terreno procédural — gera visual + corpos de física sobre o chão plano
      const staticBodies: Phaser.GameObjects.GameObject[] = [ground];
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

      // Spawn do jogador usando proporções definidas na fase
      const playerX = worldWidth * level.player.xProportion;
      const playerY = worldHeight - level.player.yFromBottom;
      this.boyController = new Boy(this);
      this.player = this.boyController.create(playerX, playerY);

      this.player.setBounce(0.5);
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, staticBodies);

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

      this.cursors = this.input.keyboard!.createCursorKeys();

      // Atalho de teclado para teste de conclusão de fase
      this.input.keyboard!.on("keydown-ENTER", () => {
        if (!this.hasCompletedLevel) {
          this.hasCompletedLevel = true;
          onLevelComplete();
        }
      });
    }

    private renderLayer(
      layer: TileLayer | ImageLayer,
      worldWidth: number,
      worldHeight: number,
    ) {
      if (layer.type === "tile") {
        if (layer.fillMode === "world") {
          // Tile que cobre o mundo inteiro (ex: fundo do cenário)
          const tile = this.add
            .tileSprite(
              worldWidth / 2,
              worldHeight / 2,
              worldWidth * 2,
              worldHeight * 2,
              layer.texture,
            )
            .setOrigin(0.5, 0.5)
            .setScrollFactor(layer.scrollFactor);
          tile.setDepth(layer.depth);
        } else {
          // Tile de altura fixa ancorado no fundo (ex: grama)
          const h = layer.fixedHeight ?? 220;
          const y = worldHeight - h / 2;
          const tile = this.add
            .tileSprite(worldWidth / 2, y, worldWidth * 2, h, layer.texture)
            .setScrollFactor(layer.scrollFactor);
          tile.setDepth(layer.depth);
        }
      } else {
        // Imagem de cenário com parallax (ex: casa, árvore)
        const x = worldWidth / 2 + layer.xFromCenter;
        const y = worldHeight - layer.yFromBottom;
        const img = this.add.image(x, y, layer.texture);
        img.setOrigin(0.5, 1);
        img.setScale(layer.scale);
        img.setScrollFactor(layer.scrollFactor);
        img.setDepth(layer.depth);
      }
    }

    update() {
      const speed = Boy.TUNING.movement.runSpeed;
      const jumpVelocity = Boy.TUNING.movement.jumpVelocity;

      const joyDir = joystickDirection.current;
      const hasJoystickInput =
        Math.abs(joyDir.x) > 0.1 || Math.abs(joyDir.y) > 0.1;

      let isWalking = false;

      // Controle via teclado
      if (this.cursors.left.isDown) {
        this.player.setVelocityX(-speed);
        this.player.setFlipX(true);
        isWalking = true;
      } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(speed);
        this.player.setFlipX(false);
        isWalking = true;
      } else if (!hasJoystickInput) {
        this.player.setVelocityX(0);
      }

      if (this.cursors.up.isDown && this.player.body!.touching.down) {
        this.player.setVelocityY(jumpVelocity);
      }

      // Controle via joystick HTML externo
      if (hasJoystickInput) {
        this.player.setVelocityX(joyDir.x * speed);
        isWalking = Math.abs(joyDir.x) > 0.1;

        if (joyDir.x < -0.1) {
          this.player.setFlipX(true);
        } else if (joyDir.x > 0.1) {
          this.player.setFlipX(false);
        }

        if (joyDir.y < -0.5 && this.player.body!.touching.down) {
          this.player.setVelocityY(jumpVelocity);
        }
      }

      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const isOnGround = body.blocked.down || body.touching.down;
      this.boyController.updateAnimation({
        isMovingHorizontally: isWalking,
        isOnGround,
      });

      // Conclusão de fase: jogador chegou ao fim do mundo
      if (!this.hasCompletedLevel && this.player.x >= this.worldWidth - 50) {
        this.hasCompletedLevel = true;
        onLevelComplete();
      }
    }
  };
}
