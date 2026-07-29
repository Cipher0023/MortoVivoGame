
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class blinkingText extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.
	awake(){
		const target = this.gameObject;

		if (!target) return;

		this.scene.tweens.add({
			targets: target,
            alpha: 0,            // Transição de alpha atual até 0
            duration: 500,       // Duração de cada metade do ciclo (ms)
            yoyo: true,          // Retorna ao valor original (1 -> 0 -> 1)
            repeat: -1,          // -1 faz a animação repetir indefinidamente
            ease: 'Sine.easeInOut'
		})
		
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
