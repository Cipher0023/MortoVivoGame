"use client";

import { useEffect, useRef } from "react";
import { Boy } from "../game/Boy";

export default function Game() {
  const gameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameRef.current) return;

    let game: Phaser.Game | null = null;

    const initPhaser = async () => {
      const Phaser = await import("phaser");

      // Cena principal do jogo. Toda a lógica de fase, jogador e controles fica aqui.
      const MainScene = class extends Phaser.Scene {
        // Referência ao jogador (sprite físico controlável)
        private player!: Phaser.Physics.Arcade.Sprite;

        // Teclas direcionais (setas do teclado)
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

        // Joystick virtual (base + "botão" que se move)
        private joystick!: {
          base: Phaser.GameObjects.Arc;
          thumb: Phaser.GameObjects.Arc;
        };

        // Indica se o joystick virtual está sendo usado no momento
        private joystickActive = false;

        // Direção normalizada do joystick (-1 a 1 em x e y)
        private joystickDirection = { x: 0, y: 0 };

        constructor() {
          super("MainScene");
        }

        preload() {
          // Fundo de grama
          this.load.image("yellowgrass", "/yellowGrass.png");
          // Assets do personagem principal
          Boy.preload(this);
        }

        create() {
          const { width, height } = this.scale;

          // Background de grama (somente visual, sem colisão)
          const grassHeight = 180; // altura visível da grama
          const grassY = height - grassHeight / 2;

          this.add.tileSprite(
            width / 2,
            grassY,
            width,
            grassHeight,
            "yellowgrass"
          );

          // Chão de colisão (retângulo vermelho acima da grama)
          const groundThickness = 80;
          const groundY = height - groundThickness / 2;
          const ground = this.add.rectangle(
            width / 2,
            groundY,
            width,
            groundThickness
          );
          this.physics.add.existing(ground, true);

          const groundBody = ground.body as Phaser.Physics.Arcade.StaticBody;
          groundBody.setSize(width, groundThickness);
          groundBody.setOffset(-width / 2, -groundThickness / 2);
          groundBody.updateFromGameObject();

          // Criar player usando a classe Boy (substitui o cubo azul)
          const boy = new Boy(this);
          this.player = boy.create(width / 2, height - 500);

          // Configurar física do player
          this.player.setBounce(0.2);
          this.player.setCollideWorldBounds(true);
          this.physics.add.collider(this.player, ground);

          // Criar thumbstick virtual
          this.createJoystick();

          // Teclado como alternativa
          this.cursors = this.input.keyboard!.createCursorKeys();
        }

        createJoystick() {
          const baseX = 100;
          const baseY = this.scale.height - 100;

          // Base do joystick
          const base = this.add.circle(baseX, baseY, 50, 0x1f2937, 0.5);
          base.setScrollFactor(0);
          base.setDepth(1000);

          // Thumb do joystick
          const thumb = this.add.circle(baseX, baseY, 25, 0x3b82f6, 0.8);
          thumb.setScrollFactor(0);
          thumb.setDepth(1001);

          this.joystick = { base, thumb };

          // Eventos de toque/mouse
          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const distance = Phaser.Math.Distance.Between(
              pointer.x,
              pointer.y,
              base.x,
              base.y
            );
            if (distance < 80) {
              this.joystickActive = true;
            }
          });

          this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.joystickActive) {
              const angle = Phaser.Math.Angle.Between(
                base.x,
                base.y,
                pointer.x,
                pointer.y
              );
              const distance = Math.min(
                Phaser.Math.Distance.Between(
                  base.x,
                  base.y,
                  pointer.x,
                  pointer.y
                ),
                50
              );

              thumb.x = base.x + Math.cos(angle) * distance;
              thumb.y = base.y + Math.sin(angle) * distance;

              this.joystickDirection.x = (thumb.x - base.x) / 50;
              this.joystickDirection.y = (thumb.y - base.y) / 50;
            }
          });

          this.input.on("pointerup", () => {
            this.joystickActive = false;
            thumb.x = base.x;
            thumb.y = base.y;
            this.joystickDirection.x = 0;
            this.joystickDirection.y = 0;
          });
        }

        update() {
          const speed = 200;
          const jumpVelocity = -400;

          // Controle via teclado
          if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
          } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
          } else if (!this.joystickActive) {
            this.player.setVelocityX(0);
          }

          if (this.cursors.up.isDown && this.player.body!.touching.down) {
            this.player.setVelocityY(jumpVelocity);
          }

          // Controle via joystick
          if (this.joystickActive) {
            this.player.setVelocityX(this.joystickDirection.x * speed);

            // Pular se empurrar o joystick para cima
            if (
              this.joystickDirection.y < -0.5 &&
              this.player.body!.touching.down
            ) {
              this.player.setVelocityY(jumpVelocity);
            }
          }
        }
      };

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: gameRef.current!,
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

      game = new Phaser.Game(config);

      // Redimensionar quando a janela mudar
      const handleResize = () => {
        if (game) {
          game.scale.resize(window.innerWidth, window.innerHeight);
        }
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    initPhaser();

    return () => {
      if (game) {
        game.destroy(true);
      }
    };
  }, []);

  return <div ref={gameRef} className="w-full h-full" />;
}
