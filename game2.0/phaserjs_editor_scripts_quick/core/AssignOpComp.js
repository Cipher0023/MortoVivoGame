// You can write more code here
/* END-USER-IMPORTS */
export default class AssignOpComp {
    constructor(gameObject) {
        this.gameObject = gameObject;
        gameObject["__AssignOpComp"] = this;
        /* START-USER-CTR-CODE */
        // Write your code here.
        /* END-USER-CTR-CODE */
    }
    static getComponent(gameObject) {
        return gameObject["__AssignOpComp"];
    }
    gameObject;
    operator = "=";
    /* START-USER-CODE */
    static computeValue(node, oldValue, newValue) {
        const comp = AssignOpComp.getComponent(node);
        if (comp) {
            switch (comp.operator) {
                case "+=":
                    return oldValue + newValue;
                case "*=":
                    return oldValue * newValue;
                default:
                    return newValue;
            }
        }
        return newValue;
    }
}
/* END OF COMPILED CODE */
// You can write more code here
