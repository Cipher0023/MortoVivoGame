// Classe do personagem jogável "Boy".
// Aqui centralizamos tudo relacionado ao personagem: carregamento de assets,
// criação do sprite, configurações de física e, futuramente, animações.

export class Boy {
  // Referência ao sprite físico do personagem
  public sprite!: Phaser.Physics.Arcade.Sprite;

  constructor(private scene: Phaser.Scene) {}

  // Responsável por carregar todos os assets necessários do personagem.
  // Deve ser chamada no método preload() da cena.
  static preload(scene: Phaser.Scene) {
    // Carrega boy.png como imagem simples (não spritesheet)
    // Se futuramente for spritesheet, trocar para load.spritesheet com frameWidth/frameHeight corretos
    scene.load.image("boy", "/boy.png");
  }

  // Cria o sprite do personagem na cena, com física configurada.
  // Retorna a instância para ser usada na cena principal.
  create(startX: number, startY: number) {
    this.sprite = this.scene.physics.add.sprite(startX, startY, "boy");

    // Ajustes iniciais de física e aparência
    this.sprite.setCollideWorldBounds(true);

    // Escala reduzida para melhor proporção com o zoom out
    // Ajuste conforme o tamanho real da imagem boy.png
    this.sprite.setScale(1);

    return this.sprite;
  }

  // Método de atualização futura (animações, estados, etc.).
  // Pode ser chamado a partir do update() da cena.
  update(cursors?: Phaser.Types.Input.Keyboard.CursorKeys) {
    if (!this.sprite) return;

    // Lógica básica de movimentação pode ser adicionada aqui futuramente.
    // No momento, deixamos o método preparado para expansão.
  }
}
