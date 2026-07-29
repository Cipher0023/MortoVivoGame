// You can write more code here
/* START OF COMPILED CODE */
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class AudioLoopConfigComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__AudioLoopConfigComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__AudioLoopConfigComp"];
    }
    gameObject;
    loop = true;
}
/* END OF COMPILED CODE */
// You can write more code here
