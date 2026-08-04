
// You can write more code here

/* START OF COMPILED CODE */

import PlayerController from "../Scripts/player/playerController.js";

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Player extends Phaser.GameObjects.Sprite {

	constructor(scene, x, y, texture, frame) {
		super(scene, x ?? 300, y ?? 502, texture || "boy-walk-01", frame);

		this.setOrigin(0.5, 1);

		/* START-USER-CTR-CODE */

		// physics.add.existing só anexa um Body ao sprite — não adiciona os
		// métodos de conveniência (setCollideWorldBounds, setBounce etc.), que só
		// existem em objetos criados via physics.add.sprite(). Por isso os
		// setters são chamados direto no body.
		scene.physics.add.existing(this);
		this.body.setCollideWorldBounds(true);
		this.body.setBounce(0.5, 0.5);

		this.controller = new PlayerController(this);

		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
