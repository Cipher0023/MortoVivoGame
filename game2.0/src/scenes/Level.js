
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Level extends Phaser.Scene {

	constructor() {
		super("Level");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// upkey
		const upkey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);

		// downkey
		const downkey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

		// leftkey
		const leftkey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);

		// rightkey
		const rightkey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

		// dino
		const dino = this.physics.add.image(640, 288, "dino");
		dino.setInteractive(new Phaser.Geom.Rectangle(0, 0, 250, 250), Phaser.Geom.Rectangle.Contains);
		dino.body.immovable = true;
		dino.body.setSize(250, 250, false);

		// welcome
		const welcome = this.add.text(640, 478, "", {});
		welcome.setOrigin(0.5, 0.5);
		welcome.text = "Phaser 4 + Phaser Editor v5";
		welcome.setStyle({ "fontFamily": "Arial", "fontSize": "30px" });

		// backgroundTeste
		this.add.image(1643, 356, "backgroundTeste");

		// dino_1
		const dino_1 = this.physics.add.image(135, 167, "dino");
		dino_1.setInteractive(new Phaser.Geom.Rectangle(0, 0, 250, 250), Phaser.Geom.Rectangle.Contains);
		dino_1.body.collideWorldBounds = true;
		dino_1.body.setSize(250, 250, false);

		// collider
		this.physics.add.collider(dino, dino_1);

		this.dino = dino;
		this.welcome = welcome;
		this.dino_1 = dino_1;
		this.upkey = upkey;
		this.downkey = downkey;
		this.leftkey = leftkey;
		this.rightkey = rightkey;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.Physics.Arcade.Image} */
	dino;
	/** @type {Phaser.GameObjects.Text} */
	welcome;
	/** @type {Phaser.Physics.Arcade.Image} */
	dino_1;
	/** @type {Phaser.Input.Keyboard.Key} */
	upkey;
	/** @type {Phaser.Input.Keyboard.Key} */
	downkey;
	/** @type {Phaser.Input.Keyboard.Key} */
	leftkey;
	/** @type {Phaser.Input.Keyboard.Key} */
	rightkey;

	/* START-USER-CODE */

	// Write more your code here

	create() {

		this.editorCreate();

		this.dino.on("pointerdown", ()=> {
			this.welcome.text = "hello world!";
		})
		this.dino_1.on("pointerdown", ()=> {
			this.welcome.text = "hi!";
		})
	}

	update(){
		if (this.upkey.isDown){
			this.dino_1.setVelocityY(-200);
		} else if (this.downkey.isDown){
			this.dino_1.setVelocityY(+200);
		} else if (this.leftkey.isDown){
			this.dino_1.setVelocityX(-200);
		} else if (this.rightkey.isDown){
			this.dino_1.setVelocityX(+200);
		} else  {
			this.dino_1.setVelocityY(0)
			this.dino_1.setVelocityX(0)
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
