// You can write more code here
/* START OF COMPILED CODE */
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */
export default class EaseConfigComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__EaseConfigComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__EaseConfigComp"];
    }
    gameObject;
    ease = "Linear";
    /* START-USER-CODE */
    static getEase(obj, defaultValue) {
        const comp = EaseConfigComp.getComponent(obj);
        if (comp) {
            return comp.ease;
        }
        return defaultValue;
    }
}
/* END OF COMPILED CODE */
// You can write more code here
