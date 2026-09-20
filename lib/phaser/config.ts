import Phaser from "phaser";
import { GameScene } from "./scenes/game-scene";

export function createPhaserGame(parent: HTMLDivElement) {
	return new Phaser.Game({
		type: Phaser.AUTO,
		width: window.innerWidth,
		height: window.innerHeight,
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		backgroundColor: "#999999",
		audio: {
			noAudio: true,
		},
		scene: GameScene,
		parent: parent,
	});
}
