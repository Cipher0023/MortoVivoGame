
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class virtualJoystick extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */

		this.baseRadius = 60;
		this.thumbRadius = 30;
		this.maxDistance = 50;
		this.active = false;
		this.direction = { x: 0, y: 0 };

		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Joystick desenhado inteiramente em Phaser (dois círculos fixos na tela),
	// substituindo o componente React/DOM `TouchJoystick.tsx` do protótipo
	// antigo por uma versão nativa, já que game2.0 não tem React.
	// Usa start() em vez de awake() pelo mesmo motivo do playerController:
	// este script é criado depois que "scene-awake" já disparou.
	start() {
		const cam = this.scene.cameras.main;

		this.baseX = this.baseRadius + 50;
		this.baseY = cam.height - this.baseRadius - 50;

		this.base = this.scene.add.circle(this.baseX, this.baseY, this.baseRadius, 0x333333, 0.5);
		this.base.setScrollFactor(0);
		this.base.setDepth(1000);
		this.base.setInteractive({ useHandCursor: true });

		this.thumb = this.scene.add.circle(this.baseX, this.baseY, this.thumbRadius, 0x4a90d9, 0.8);
		this.thumb.setScrollFactor(0);
		this.thumb.setDepth(1001);

		this.onPointerDown = (pointer) => {
			this.active = true;
			this.updateThumb(pointer);
		};
		this.onPointerMove = (pointer) => {
			if (!this.active) return;
			this.updateThumb(pointer);
		};
		this.onPointerUp = () => {
			this.active = false;
			this.direction = { x: 0, y: 0 };
			this.thumb.setPosition(this.baseX, this.baseY);
		};

		this.base.on("pointerdown", this.onPointerDown);
		this.scene.input.on("pointermove", this.onPointerMove);
		this.scene.input.on("pointerup", this.onPointerUp);
	}

	updateThumb(pointer) {
		const dx = pointer.x - this.baseX;
		const dy = pointer.y - this.baseY;
		const distance = Math.sqrt(dx * dx + dy * dy);

		let x = dx;
		let y = dy;
		if (distance > this.maxDistance) {
			const angle = Math.atan2(dy, dx);
			x = Math.cos(angle) * this.maxDistance;
			y = Math.sin(angle) * this.maxDistance;
		}

		this.thumb.setPosition(this.baseX + x, this.baseY + y);
		this.direction = { x: x / this.maxDistance, y: y / this.maxDistance };
	}

	destroy() {
		this.scene.input.off("pointermove", this.onPointerMove);
		this.scene.input.off("pointerup", this.onPointerUp);
		this.base?.destroy();
		this.thumb?.destroy();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
