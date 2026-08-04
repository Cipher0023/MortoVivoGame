
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class playerController extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */

		this.tuning = {
			runSpeed: 380,
			jumpVelocity: -420,
			// Hitbox proporcional ao tamanho nativo dos frames (202x291), na
			// mesma razão que o protótipo antigo usava para o sprite distorcido
			// (250x400 -> 42x70).
			bodySize: { width: 34, height: 51 },
			walk: { frameCount: 12, frameRate: 16 },
		};

		this.currentAnim = "stopped";

		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Usa start() (dispara no primeiro tick de update), não awake() — este
	// script é anexado em create() do USER-CODE da cena, depois que
	// "scene-awake" já foi emitido dentro de editorCreate(), então awake()
	// nunca chegaria a ser chamado.
	start() {
		const sprite = this.gameObject;
		if (!sprite) return;

		this.cursors = this.scene.input.keyboard.createCursorKeys();

		this.createAnimations();
		this.applyFixedBody();
	}

	createAnimations() {
		if (this.scene.anims.exists("boy-walk")) return;

		const frames = [];
		for (let i = 1; i <= this.tuning.walk.frameCount; i++) {
			const key = `boy-walk-${String(i).padStart(2, "0")}`;
			if (this.scene.textures.exists(key)) frames.push({ key });
		}
		if (frames.length === 0) return;

		this.scene.anims.create({
			key: "boy-walk",
			frames,
			frameRate: this.tuning.walk.frameRate,
			repeat: -1,
		});
	}

	applyFixedBody() {
		const sprite = this.gameObject;
		if (!sprite.body) return;

		const { width, height } = this.tuning.bodySize;
		sprite.body.setSize(width, height, false);
		sprite.body.setOffset((sprite.width - width) / 2, sprite.height - height);
	}

	update() {
		const sprite = this.gameObject;
		if (!sprite || !sprite.body) return;

		const joystick = this.scene.virtualJoystick;
		const joyDir = joystick ? joystick.direction : { x: 0, y: 0 };
		const hasJoystickInput = Math.abs(joyDir.x) > 0.1 || Math.abs(joyDir.y) > 0.1;

		let isWalking = false;

		if (this.cursors.left.isDown) {
			sprite.body.setVelocityX(-this.tuning.runSpeed);
			sprite.setFlipX(true);
			isWalking = true;
		} else if (this.cursors.right.isDown) {
			sprite.body.setVelocityX(this.tuning.runSpeed);
			sprite.setFlipX(false);
			isWalking = true;
		} else if (!hasJoystickInput) {
			sprite.body.setVelocityX(0);
		}

		const isOnGround = sprite.body.blocked.down || sprite.body.touching.down;

		if (hasJoystickInput) {
			sprite.body.setVelocityX(joyDir.x * this.tuning.runSpeed);
			isWalking = Math.abs(joyDir.x) > 0.1;

			if (joyDir.x < -0.1) sprite.setFlipX(true);
			else if (joyDir.x > 0.1) sprite.setFlipX(false);

			if (joyDir.y < -0.5 && isOnGround) {
				sprite.body.setVelocityY(this.tuning.jumpVelocity);
			}
		}

		if (this.cursors.up.isDown && isOnGround) {
			sprite.body.setVelocityY(this.tuning.jumpVelocity);
		}

		// Não há frames de pulo no acervo de arte atual — em vez de tentar tocar
		// uma animação inexistente (o protótipo antigo já fazia isso e falhava
		// silenciosamente), o personagem só anima ao caminhar no chão.
		const nextAnim = isOnGround && isWalking ? "walk" : "stopped";
		if (nextAnim !== this.currentAnim) {
			this.currentAnim = nextAnim;
			if (nextAnim === "walk" && this.scene.anims.exists("boy-walk")) {
				sprite.play("boy-walk", true);
			} else {
				sprite.anims.stop();
				sprite.setTexture("boy-walk-01");
			}
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
