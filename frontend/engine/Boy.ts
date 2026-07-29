// Classe do personagem jogável "Boy".
// Aqui centralizamos tudo relacionado ao personagem: carregamento de assets,
// criação do sprite, configurações de física e, futuramente, animações.

export class Boy {
  // Configurações centralizadas para facilitar ajustes sem caçar valores no arquivo.
  static readonly TUNING = {
    movement: {
      runSpeed: 380,
      jumpVelocity: -420,
    },
    displaySize: {
      width: 250,
      height: 400,
    },
    bodySize: {
      width: 42,
      height: 70,
    },
    walkAnimation: {
      frameCount: 12,
      frameRate: 16,
    },
    jumpAnimation: {
      frameCount: 2,
      frameRate: 10,
    },
  } as const;

  // Referência ao sprite físico do personagem
  public sprite!: Phaser.Physics.Arcade.Sprite;

  // Tamanho visual fixo para o personagem, independente do tamanho real do frame.
  private readonly displaySize = Boy.TUNING.displaySize;

  // Hitbox fixa para colisão estável entre animações com frames de tamanhos diferentes.
  private readonly bodySize = Boy.TUNING.bodySize;

  private readonly staticTextureKey = "boy";
  private readonly standTextureKey = "boy-walk-01";
  private readonly animKeys = {
    walk: "boy-walk",
    jump: "boy-jump",
  };

  private currentAnim: "stopped" | "walk" | "jump" = "stopped";

  constructor(private scene: Phaser.Scene) {}

  // Responsável por carregar todos os assets necessários do personagem.
  // Deve ser chamada no método preload() da cena.
  static preload(scene: Phaser.Scene) {
    // Fallback: imagem estática para manter compatibilidade
    scene.load.image("boy", "/boy.png");

    // Sequência atual de caminhada/corrida em public/boy/walk_01..walk_12
    for (let i = 1; i <= Boy.TUNING.walkAnimation.frameCount; i++) {
      const index = String(i).padStart(2, "0");
      const key = `boy-walk-${index}`;
      scene.load.image(key, `/boy/walk_${index}.png`);
    }
  }

  // Cria o sprite do personagem na cena, com física configurada.
  // Retorna a instância para ser usada na cena principal.
  create(startX: number, startY: number) {
    const initialTexture = this.scene.textures.exists(this.standTextureKey)
      ? this.standTextureKey
      : this.staticTextureKey;
    this.sprite = this.scene.physics.add.sprite(startX, startY, initialTexture);

    // Ajustes iniciais de física e aparência
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDisplaySize(this.displaySize.width, this.displaySize.height);
    this.applyFixedBody();

    this.createAnimations();

    return this.sprite;
  }

  private createAnimations() {
    const animationDefs = [
      {
        key: this.animKeys.walk,
        prefix: "boy-walk",
        count: Boy.TUNING.walkAnimation.frameCount,
        frameRate: Boy.TUNING.walkAnimation.frameRate,
        repeat: -1,
      },
      {
        key: this.animKeys.jump,
        prefix: "boy-jump",
        count: Boy.TUNING.jumpAnimation.frameCount,
        frameRate: Boy.TUNING.jumpAnimation.frameRate,
        repeat: 0,
      },
    ];

    animationDefs.forEach(({ key, prefix, count, frameRate, repeat }) => {
      if (this.scene.anims.exists(key)) return;

      const frames = Array.from({ length: count }, (_, index) => {
        const frameNo = String(index + 1).padStart(2, "0");
        return { key: `${prefix}-${frameNo}` };
      }).filter((frame) => this.scene.textures.exists(frame.key));

      if (frames.length === 0) return;

      this.scene.anims.create({
        key,
        frames,
        frameRate,
        repeat,
      });
    });
  }

  updateAnimation(params: {
    isMovingHorizontally: boolean;
    isOnGround: boolean;
  }) {
    if (!this.sprite) return;

    let nextAnim: "stopped" | "walk" | "jump" = "stopped";
    if (!params.isOnGround) {
      nextAnim = "jump";
    } else if (params.isMovingHorizontally) {
      nextAnim = "walk";
    }

    if (nextAnim === this.currentAnim) return;
    this.currentAnim = nextAnim;

    if (nextAnim === "stopped") {
      this.sprite.anims.stop();
      if (this.scene.textures.exists(this.standTextureKey)) {
        this.sprite.setTexture(this.standTextureKey);
      }
      this.applyFixedBody();
      return;
    }

    const animKey = this.animKeys[nextAnim];
    if (this.scene.anims.exists(animKey)) {
      this.sprite.play(animKey, true);
      this.applyFixedBody();
    }
  }

  private applyFixedBody() {
    if (!this.sprite || !this.sprite.body) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.bodySize.width, this.bodySize.height, false);

    // Mantém a hitbox centralizada no eixo X e alinhada aos "pés" no eixo Y.
    const offsetX = (this.sprite.width - this.bodySize.width) / 2;
    const offsetY = this.sprite.height - this.bodySize.height;
    body.setOffset(offsetX, offsetY);
  }
}
