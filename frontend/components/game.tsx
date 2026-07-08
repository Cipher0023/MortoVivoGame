"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boy } from "../game/Boy";
import { getLevelByMarker, type LevelConfig } from "../config/levels";
import ARCamera from "./ARCamera";
import TouchJoystick from "./TouchJoystick";

const BOY_WALK_ASSETS = Array.from({ length: 12 }, (_, index) => {
  const frame = String(index + 1).padStart(2, "0");
  return `/boy/walk_${frame}.png`;
});

const GAME_ASSET_URLS = [
  "/textura_fundo.png",
  "/yellowGrass.png",
  "/casabg.png",
  "/arvore-removebg-preview.png",
  "/boy.png",
  ...BOY_WALK_ASSETS,
];

export default function Game() {
  const gameRef = useRef<HTMLDivElement>(null);
  const [arEnabled, setArEnabled] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [isPreparingGame, setIsPreparingGame] = useState(false);
  const joystickDirection = useRef({ x: 0, y: 0 });
  const gameAssetsCached = useRef(false);
  const markerHandlingInProgress = useRef(false);

  const warmSingleAsset = useCallback(async (assetUrl: string) => {
    try {
      await fetch(assetUrl, { cache: "force-cache" });
    } catch {
      // Mesmo com falha no fetch, tentamos carregar via Image para aquecer cache/decoder.
    }

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (img.decode) {
          img
            .decode()
            .catch(() => undefined)
            .finally(() => resolve());
          return;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = assetUrl;
    });
  }, []);

  const warmGameAssets = useCallback(async () => {
    if (gameAssetsCached.current) return;

    await Promise.allSettled(
      GAME_ASSET_URLS.map((assetUrl) => warmSingleAsset(assetUrl)),
    );

    gameAssetsCached.current = true;
  }, [warmSingleAsset]);

  const handleMarkerFound = async (markerPattern: string) => {
    if (markerHandlingInProgress.current) return;

    const level = getLevelByMarker(markerPattern);
    if (!level) return;

    markerHandlingInProgress.current = true;
    setIsPreparingGame(true);
    setArEnabled(false); // Desativar AR para reduzir custo enquanto prepara assets

    try {
      await warmGameAssets();

      console.log(`Página detectada: ${level.chapter} - ${level.name}`);
      setCurrentLevel(level);
      setGameStarted(true);
      setLevelCompleted(false);
    } finally {
      setIsPreparingGame(false);
      markerHandlingInProgress.current = false;
    }
  };

  const handleMarkerLost = () => {
    console.log("Página perdida");
  };

  useEffect(() => {
    if (!gameRef.current || !gameStarted) return;

    let game: Phaser.Game | null = null;

    const initPhaser = async () => {
      const Phaser = await import("phaser");

      // Cena principal do jogo. Toda a lógica de fase, jogador e controles fica aqui.
      const MainScene = class extends Phaser.Scene {
        // Referência ao jogador (sprite físico controlável)
        private player!: Phaser.Physics.Arcade.Sprite;

        // Controlador do personagem para estados de animação
        private boyController!: Boy;

        // Teclas direcionais (setas do teclado)
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

        // Largura do mundo para detectar fim da fase
        private worldWidth = 0;

        // Flag para evitar múltiplas chamadas de conclusão
        private hasCompletedLevel = false;

        constructor() {
          super("MainScene");
        }

        preload() {
          // Textura de fundo do jogo
          this.load.image("backgroundTexture", "/textura_fundo.png");
          // Fundo de grama
          this.load.image("yellowgrass", "/yellowGrass.png");
          // Casa de fundo
          this.load.image("casabg", "/casabg.png");
          // Árvore
          this.load.image("arvore", "/arvore-removebg-preview.png");
          // Assets do personagem principal
          Boy.preload(this);
        }

        create() {
          const { width, height } = this.scale;

          // Aplicar cor de fundo da fase (se definida)
          const bgColor = currentLevel?.backgroundColor || "#0a0a0a";
          this.cameras.main.setBackgroundColor(bgColor);

          // Zoom out da câmera (0.6 = 60% do zoom normal, mais afastado)
          this.cameras.main.setZoom(0.6);

          // Dimensões expandidas para o zoom out
          const worldWidth = width * 3; // Mundo 3x maior
          const worldHeight = height * 2; // Altura 2x maior
          this.worldWidth = worldWidth; // Armazenar para usar no update()

          // Plano de fundo com textura em tile - dimensões maiores para mais repetições
          const backgroundTile = this.add
            .tileSprite(
              worldWidth / 2,
              worldHeight / 2,
              worldWidth * 2, // Dobra a largura para mais tiles
              worldHeight * 2, // Dobra a altura para mais tiles
              "backgroundTexture",
            )
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0);
          backgroundTile.setDepth(-2); // Background mais atrás

          // Casa de fundo (elemento único) - deve aparecer na frente do background
          const casa = this.add.image(
            worldWidth / 2 + 100, // Posicionada um pouco à direita do centro
            worldHeight - 400, // Posição mais alta para ficar visível
            "casabg",
          );
          casa.setOrigin(0.5, 1); // Ancorar pela base inferior
          casa.setScale(2.0); // Ajustar tamanho conforme necessário
          casa.setScrollFactor(0.3); // Parallax leve (move mais devagar que o mundo)
          casa.setDepth(-1); // Na frente do background mas atrás de outros elementos

          // Árvore de fundo (elemento único) - posicionada à esquerda
          const arvore = this.add.image(
            worldWidth / 2 - 2300, // Posicionada à esquerda do centro
            worldHeight - 300, // Posição mais alta para ficar visível
            "arvore",
          );
          arvore.setOrigin(0.5, 1); // Ancorar pela base inferior
          arvore.setScale(2.0); // Ajustar tamanho conforme necessário
          arvore.setScrollFactor(0.3); // Parallax leve (move mais devagar que o mundo)
          arvore.setDepth(-1); // Na frente do background mas atrás de outros elementos

          // Background de grama (somente visual, sem colisão)
          // TileSprite repete horizontalmente, altura fixa para não repetir verticalmente
          const grassHeight = 220; // Altura da textura original (não repete verticalmente)
          const grassY = worldHeight - grassHeight / 2; // 15px para cima

          this.add.tileSprite(
            worldWidth / 2,
            grassY,
            worldWidth * 2, // Largura grande para repetir horizontalmente
            grassHeight, // Altura igual à textura original
            "yellowgrass",
          );

          // Chão de colisão (retângulo acima da grama)
          const groundThickness = 120; // Mais espesso para o zoom
          const groundY = worldHeight - groundThickness / 2;
          const ground = this.add.rectangle(
            worldWidth / 2,
            groundY,
            worldWidth,
            groundThickness,
          );
          this.physics.add.existing(ground, true);

          const groundBody = ground.body as Phaser.Physics.Arcade.StaticBody;
          groundBody.setSize(worldWidth, groundThickness);
          groundBody.setOffset(-worldWidth / 2, -groundThickness / 2);
          groundBody.updateFromGameObject();

          // Definir limites do mundo
          this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

          // Criar player usando a classe Boy
          this.boyController = new Boy(this);
          this.player = this.boyController.create(
            worldWidth / 2,
            worldHeight - 600,
          );

          // Configurar física do player
          this.player.setBounce(0.5);
          this.player.setCollideWorldBounds(true);
          this.physics.add.collider(this.player, ground);

          // Câmera segue o player
          this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
          this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

          // Teclado como alternativa
          this.cursors = this.input.keyboard!.createCursorKeys();

          // Gatilho de teste: pressionar Enter para mostrar overlay de conclusão
          this.input.keyboard!.on("keydown-ENTER", () => {
            if (!this.hasCompletedLevel) {
              console.log("Enter pressionado - Mostrando overlay de conclusão");
              this.hasCompletedLevel = true;
              setLevelCompleted(true);
            }
          });
        }

        update() {
          const speed = Boy.TUNING.movement.runSpeed;
          const jumpVelocity = Boy.TUNING.movement.jumpVelocity;

          // Obter direção do joystick HTML externo
          const joyDir = joystickDirection.current;
          const hasJoystickInput =
            Math.abs(joyDir.x) > 0.1 || Math.abs(joyDir.y) > 0.1;

          let isWalking = false;

          // Controle via teclado
          if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true); // Virar para a esquerda
            isWalking = true;
          } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false); // Virar para a direita
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

            // Virar o sprite baseado na direção do joystick
            if (joyDir.x < -0.1) {
              this.player.setFlipX(true); // Virar para a esquerda
            } else if (joyDir.x > 0.1) {
              this.player.setFlipX(false); // Virar para a direita
            }

            // Pular se empurrar o joystick para cima
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

          // Verificar se o jogador chegou ao fim da fase
          if (
            !this.hasCompletedLevel &&
            this.player.x >= this.worldWidth - 50
          ) {
            console.log(
              `Fase concluída! Posição do jogador: ${this.player.x}, Limite: ${
                this.worldWidth - 50
              }`,
            );
            this.hasCompletedLevel = true;
            setLevelCompleted(true);
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
      gameInstanceRef.current = game;

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
  }, [currentLevel, gameStarted]);

  // Menu principal antes do jogo começar
  if (!gameStarted) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        {/* Câmera AR em tela cheia quando ativada */}
        {arEnabled ? (
          <div className="z-50 absolute inset-0">
            <ARCamera
              onMarkerFound={handleMarkerFound}
              onMarkerLost={handleMarkerLost}
              enabled={arEnabled}
            />
          </div>
        ) : (
          <>
            {/* Background com imagem */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url(/backgroundMenu.png)" }}
            />

            {/* Overlay com degradê */}
            <div className="absolute inset-0 bg-linear-to-b from-yellow-400/80 via-green-400/70 to-blue-300/80" />

            {/* Conteúdo do menu */}
            <div className="z-10 relative flex flex-col justify-center items-center h-full">
              {/* Título do jogo */}
              <div className="mb-8 text-center">
                <h1 className="mb-4 font-bold text-white text-8xl">
                  Morto Vivo
                </h1>
                <p className="opacity-80 text-white text-xl">
                  Aventura em Realidade Aumentada
                </p>
              </div>

              {/* Instruções */}
              <div className="space-y-4 bg-black/50 backdrop-blur-md mb-8 p-8 border-2 border-yellow-400 rounded-2xl max-w-lg">
                <h2 className="mb-4 font-bold text-white text-2xl">
                  📖 Como Jogar
                </h2>
                <div className="space-y-3 text-white">
                  <p className="flex items-start gap-3">
                    <span className="font-bold text-yellow-400">1.</span>
                    <span>
                      Clique no botão <strong>&ldquo;Ativar AR&rdquo;</strong>{" "}
                      abaixo
                    </span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="font-bold text-yellow-400">2.</span>
                    <span>
                      Aponte a câmera para o <strong>livro físico</strong>
                    </span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="font-bold text-yellow-400">3.</span>
                    <span>
                      Quando a página for detectada, o jogo iniciará
                      automaticamente
                    </span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="font-bold text-yellow-400">4.</span>
                    <span>
                      Use o joystick virtual para controlar o personagem
                    </span>
                  </p>
                </div>
              </div>

              {/* Botão de AR */}
              <button
                onClick={() => setArEnabled(true)}
                className="flex items-center gap-4 bg-white hover:bg-gray-50 shadow-2xl hover:shadow-green-400/50 px-10 py-5 border-4 border-green-400 rounded-2xl font-extrabold text-green-600 text-3xl hover:scale-110 transition-all animate-pulse transform"
                style={{
                  boxShadow:
                    "0 0 30px rgba(74, 222, 128, 0.6), 0 10px 40px rgba(0, 0, 0, 0.3)",
                }}
              >
                <span className="text-4xl">📷</span>
                <span>Ativar AR e Começar</span>
              </button>
            </div>
          </>
        )}

        {isPreparingGame && (
          <div className="z-60 absolute inset-0 flex justify-center items-center bg-black/80 backdrop-blur-sm">
            <div className="bg-black/60 p-6 border border-white/20 rounded-xl text-center">
              <p className="font-semibold text-white text-xl">
                Preparando fase...
              </p>
              <p className="opacity-80 mt-2 text-white text-sm">
                Carregando imagens no cache para evitar travamentos iniciais.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={gameRef} className="relative w-full h-full">
      {/* Câmera AR sobreposta ao jogo quando ativada */}
      {arEnabled && !levelCompleted && (
        <div className="z-50 absolute inset-0">
          <ARCamera
            onMarkerFound={handleMarkerFound}
            onMarkerLost={handleMarkerLost}
            enabled={arEnabled}
          />
        </div>
      )}

      {/* Overlay de fase concluída */}
      {levelCompleted && (
        <div className="z-50 absolute inset-0 flex flex-col justify-center items-center bg-black/90 backdrop-blur-md">
          <div className="space-y-6 bg-linear-to-b from-green-900/80 to-blue-900/80 p-10 border-4 border-green-400 rounded-3xl max-w-2xl text-center">
            <div className="mb-4">
              <span className="text-8xl">🎉</span>
            </div>
            <h2 className="mb-4 font-extrabold text-white text-6xl">
              Fase Concluída!
            </h2>
            <p className="mb-6 text-white text-2xl">
              Parabéns! Você completou {currentLevel?.name || "esta fase"}.
            </p>

            <div className="space-y-4 bg-black/50 backdrop-blur-sm mb-6 p-6 border-2 border-yellow-400 rounded-xl">
              <p className="flex justify-center items-center gap-3 text-white text-xl">
                <span className="font-bold text-yellow-400 text-3xl">📖</span>
                <span>
                  Para continuar, volte ao modo AR e escaneie a próxima página
                  do livro
                </span>
              </p>
            </div>

            <button
              onClick={() => {
                setLevelCompleted(false);
                setArEnabled(true);
              }}
              className="bg-white hover:bg-gray-50 shadow-2xl hover:shadow-green-400/50 px-10 py-5 border-4 border-green-400 rounded-2xl font-extrabold text-green-600 text-2xl hover:scale-105 transition-all transform"
            >
              📷 Ativar AR e Escanear Próxima Página
            </button>
          </div>
        </div>
      )}

      {/* Botão de voltar ao menu principal */}
      <div className="top-4 right-4 z-50 absolute">
        <button
          onClick={() => {
            setGameStarted(false);
            setCurrentLevel(null);
            setArEnabled(false);
            setLevelCompleted(false);
          }}
          className="bg-red-600/90 hover:bg-red-700/90 shadow-lg backdrop-blur-sm px-4 py-2 rounded-lg font-semibold text-white transition-all"
        >
          ← Menu Principal
        </button>
      </div>

      {/* Joystick Touch HTML */}
      <TouchJoystick
        onMove={(direction) => {
          joystickDirection.current = direction;
        }}
      />
    </div>
  );
}
