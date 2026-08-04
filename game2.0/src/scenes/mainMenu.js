
// You can write more code here

/* START OF COMPILED CODE */

import OnPointerDownScript from "../../phaserjs_editor_scripts_quick/core/OnPointerDownScript.js";
import gotoThisPage from "../Scripts/gameNavigation/gotoThisPage.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class mainMenu extends Phaser.Scene {

	constructor() {
		super("mainMenu");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// Game Title
		const game_Title = this.add.text(628, 152, "", {});
		game_Title.setOrigin(0.5, 0.5);
		game_Title.text = "Morto Vivo Game Alpha 0.02\n";
		game_Title.setStyle({ "fontSize": "30px" });

		// backgroundTeste
		this.add.image(734, 767, "backgroundTeste");

		// Start
		const start = this.add.text(580, 376, "", {});
		start.setInteractive(new Phaser.Geom.Rectangle(0, 0, 77, 17), Phaser.Geom.Rectangle.Contains);
		start.text = "Start";
		start.setStyle({ "fontSize": "25px" });

		// onPointerDownScript
		const onPointerDownScript = new OnPointerDownScript(start);

		// gotoThisPage
		new gotoThisPage(onPointerDownScript);

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
