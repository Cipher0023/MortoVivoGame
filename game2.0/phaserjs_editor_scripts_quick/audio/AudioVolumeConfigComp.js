// You can write more code here
/* START OF COMPILED CODE */
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class AudioVolumeConfigComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__AudioVolumeConfigComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__AudioVolumeConfigComp"];
    }
    gameObject;
    volume = 1;
}
/* END OF COMPILED CODE */
// You can write more code here
