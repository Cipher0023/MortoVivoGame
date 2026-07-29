// You can write more code here
/* START OF COMPILED CODE */
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class DelayConfigComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__DelayConfigComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__DelayConfigComp"];
    }
    gameObject;
    delay = 0;
    /* START-USER-CODE */
    static getDelay(obj, defaultValue) {
        const comp = DelayConfigComp.getComponent(obj);
        if (comp) {
            return comp.delay;
        }
        return defaultValue;
    }
}
/* END OF COMPILED CODE */
// You can write more code here
