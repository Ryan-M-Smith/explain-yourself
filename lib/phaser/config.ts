import Phaser from "phaser";
import { GameScene } from "./scenes/game-scene";
import { SplashScene } from "./scenes/splash-scene";

export function createPhaserGame(parent: HTMLDivElement) {
	return new Phaser.Game({
		type: Phaser.AUTO,
		width: window.innerWidth,
		height: window.innerHeight,
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		backgroundColor: "var(--background)",
		audio: {
			noAudio: true,
		},
		scene: [SplashScene, GameScene],
		parent: parent,
	});
}
