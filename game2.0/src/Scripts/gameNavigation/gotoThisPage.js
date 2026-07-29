// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class gotoThisPage extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		
		/**
		 * Nome da cena para a qual o jogo deve ir
		 * @type {string}
		 */
		this.targetScene = "primeiraFase";

		/**
		 * Cor do texto ao passar o mouse (se for um objeto de texto)
		 * @type {string}
		 */
		this.hoverColor = "#ffff00";

		/**
		 * Cor normal do texto
		 * @type {string}
		 */
		this.normalColor = "#ffffff";

		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Este método é chamado automaticamente pelo ScriptNode quando o objeto é criado
	awake() {
		const obj = this.gameObject;
		if (!obj) return;

		// 1. Torna o objeto clicável e muda o cursor para "mãozinha"
		obj.setInteractive({ useHandCursor: true });

		// 2. Evento de Clique
		obj.on('pointerdown', () => {
			// Efeito visual de "afundar" ao clicar
			obj.scene.tweens.add({
				targets: obj,
			 scaleX: 0.9,
				scaleY: 0.9,
				duration: 100,
				yoyo: true,
				onComplete: () => {
					// Troca de cena usando a variável configurável
					obj.scene.scene.start(this.targetScene);
				}
			});
		});

		// 3. Efeito de Hover (Passar o mouse)
		obj.on('pointerover', () => {
			// Verifica se é um texto para mudar a cor, senão muda a transparência (funciona para sprites também)
			if (obj.setStyle) {
				obj.setStyle({ fill: this.hoverColor });
			} else {
				obj.setAlpha(0.8);
			}
		});

		obj.on('pointerout', () => {
			if (obj.setStyle) {
				obj.setStyle({ fill: this.normalColor });
			} else {
				obj.setAlpha(1);
			}
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here