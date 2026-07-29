// You can write more code here
/* START OF COMPILED CODE */
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class RandomMultipleComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__RandomMultipleComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__RandomMultipleComp"];
    }
    gameObject;
    multiple = 10;
    min = 0;
    max = 1000;
    /* START-USER-CODE */
    getRandomMultipleInRange(min, max, multiple) {
        // Calculate the range of numbers between min and max
        const range = max - min + 1;
        // Generate a random number within the range
        const randomOffset = Math.floor(Math.random() * range);
        // Find the closest multiple within the chosen range
        const randomMultiple = min + randomOffset - ((min + randomOffset) % multiple);
        return randomMultiple;
    }
    getRandomMultiple() {
        return this.getRandomMultipleInRange(this.min, this.max, this.multiple);
    }
}
/* END OF COMPILED CODE */
// You can write more code here
