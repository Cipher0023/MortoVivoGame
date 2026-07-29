import RandomMultipleComp from "./RandomMultipleComp.js";
import RandomInArrayComp from "./RandomInArrayComp.js";
import RandomBetweenComp from "./RandomBetweenComp.js";
export default class GetRandom {
    static getRandom(node) {
        let result = 0;
        {
            const comp = RandomMultipleComp.getComponent(node);
            if (comp) {
                result = comp.getRandomMultiple();
            }
        }
        {
            const comp = RandomInArrayComp.getComponent(node);
            if (comp) {
                result = comp.getRandomInArray();
            }
        }
        {
            const comp = RandomBetweenComp.getComponent(node);
            if (comp) {
                result = comp.getRandomBetween();
            }
        }
        return result;
    }
}
