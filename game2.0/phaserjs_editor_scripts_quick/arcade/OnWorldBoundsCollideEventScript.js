// You can write more code here
/* START OF COMPILED CODE */
import OnEventScript from "../core/OnEventScript.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class OnWorldBoundsCollideEventScript extends OnEventScript {
    constructor(parent) {
        super(parent);
        // this (prefab fields)
        this.eventName = Phaser.Physics.Arcade.Events.WORLD_BOUNDS;
        this.eventEmitter = "scene.physics.world";
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    up = true;
    down = true;
    left = true;
    right = true;
    /* START-USER-CODE */
    executeChildren(body, up, down, left, right) {
        if (up && this.up || down && this.down || left && this.left || right && this.right) {
            super.executeChildren(body, up, down, left, right);
        }
    }
}
/* END OF COMPILED CODE */
// You can write more code here
