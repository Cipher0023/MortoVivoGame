// You can write more code here
/* START OF COMPILED CODE */
import OnEventScript from "./OnEventScript.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class OnPointerDownScript extends OnEventScript {
    constructor(parent) {
        super(parent);
        // this (prefab fields)
        this.eventName = "pointerdown";
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    /* START-USER-CODE */
    awake() {
        if (!this.gameObject) {
            return;
        }
        if (!this.gameObject.input) {
            this.gameObject.setInteractive();
        }
        super.awake();
    }
}
/* END OF COMPILED CODE */
// You can write more code here
