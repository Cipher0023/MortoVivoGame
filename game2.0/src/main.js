import Level from "./scenes/Level.js";
import Preload from "./scenes/Preload.js";
import mainMenu from "./scenes/mainMenu.js";
import primeiraFase from "./scenes/primeiraFase.js"; // ✅ Corrigido o typo

window.addEventListener('load', function () {

    var game = new Phaser.Game({
        width: 1280,
        height: 720,
        type: Phaser.AUTO,
        backgroundColor: "#242424",
        parent: "game-container",
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: {
            default: 'arcade',
            arcade: {
                debug: true,
                gravity: {
                    x: 0, 
                    y: 800  // ✅ Corrigido: gravidade para platformer
                }
            }
        }
    });

    game.scene.add("mainMenu", mainMenu);
    game.scene.add("Level", Level);
    game.scene.add("Preload", Preload);
    game.scene.add("primeiraFase", primeiraFase);
    game.scene.add("Boot", Boot, true);

});

class Boot extends Phaser.Scene {

    constructor() {
        super({ key: "Boot" });
    }

    preload() {  // ✅ Corrigido: era mainMenu(), agora é preload()
        this.load.pack("pack", "assets/preload-asset-pack.json");
    }

    create() {
        this.scene.start("Preload");
    }
}