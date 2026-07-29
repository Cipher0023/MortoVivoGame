// You can write more code here
/* START OF COMPILED CODE */
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class RandomBetweenComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__RandomBetweenComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__RandomBetweenComp"];
    }
    gameObject;
    min = 0;
    max = 1000;
    /* START-USER-CODE */
    getRandomBetween() {
        return Phaser.Math.Between(this.min, this.max);
    }
}
/* END OF COMPILED CODE */
// You can write more code here
