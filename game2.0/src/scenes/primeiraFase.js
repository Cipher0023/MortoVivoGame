
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class primeiraFase extends Phaser.Scene {

	constructor() {
		super("primeiraFase");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// editabletilemap
		this.cache.tilemap.add("editabletilemap_88a5ecfa-353f-4125-8c9f-bf01a271088a", {
			format: 1,
			data: {
				width: 10,
				height: 10,
				orientation: "orthogonal",
				tilewidth: 32,
				tileheight: 32,
				tilesets: [
					{
						columns: 18,
						margin: 0,
						spacing: 0,
						tilewidth: 32,
						tileheight: 32,
						tilecount: 108,
						firstgid: 1,
						image: "chao",
						name: "chao",
						imagewidth: 589,
						imageheight: 218,
					},
				],
				layers: [
					{
						type: "tilelayer",
						name: "Chão e tiles adicionais",
						width: 10,
						height: 10,
						opacity: 1,
						data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56, 56, 56, 56, 56, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			},
		});
		const editabletilemap = this.add.tilemap("editabletilemap_88a5ecfa-353f-4125-8c9f-bf01a271088a");
		editabletilemap.addTilesetImage("chao");

		// backgroundTeste
		const backgroundTeste = this.add.image(681, 361, "backgroundTeste");
		backgroundTeste.scaleX = 0.9717082853336187;
		backgroundTeste.scaleY = 1.0980239536007053;

		// Chão e tiles adicionais
		const ch_o_e_tiles_adicionais = editabletilemap.createLayer("Chão e tiles adicionais", ["chao"], -90, -6);
		ch_o_e_tiles_adicionais.scaleX = 5.3162196042833605;
		ch_o_e_tiles_adicionais.scaleY = 2.493258411020801;

		this.backgroundTeste = backgroundTeste;
		this.editabletilemap = editabletilemap;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.GameObjects.Image} */
	backgroundTeste;
	/** @type {Phaser.Tilemaps.Tilemap} */
	editabletilemap;

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
