import Phaser from "phaser";
import { GameProgress } from "@/types/enums";

export class EndScene extends Phaser.Scene {
	private overlay!: Phaser.GameObjects.Container;

	constructor() {
		super("EndScene");
	}

	create() {
		const panel = this.add.graphics();
		panel.fillStyle(0x07111f, 0.94);
		panel.fillRoundedRect(this.scale.width / 2 - 260, this.scale.height / 2 - 150, 520, 300, 28);
		panel.lineStyle(2, 0x9bdcff, 0.4);
		panel.strokeRoundedRect(this.scale.width / 2 - 260, this.scale.height / 2 - 150, 520, 300, 28);

		const title = this.add.text(0, -92, "SITUATION COMPLETE", {
			color: "#f8fafc",
			fontFamily: "Arial, sans-serif",
			fontSize: "28px",
			fontStyle: "bold",
		}).setOrigin(0.5);
		const detail = this.add.text(0, -42, "", {
			color: "#bae6fd",
			fontFamily: "Arial, sans-serif",
			fontSize: "18px",
		}).setOrigin(0.5);
		const button = this.add.graphics();
		button.fillStyle(0x38bdf8, 1);
		button.fillRoundedRect(-125, 28, 250, 56, 16);
		const buttonText = this.add.text(0, 56, "NEXT SITUATION", {
			color: "#062033",
			fontFamily: "Arial, sans-serif",
			fontSize: "17px",
			fontStyle: "bold",
		}).setOrigin(0.5);
		const buttonZone = this.add.zone(0, 56, 250, 56).setInteractive({ useHandCursor: true });
		buttonZone.on("pointerover", () => button.setAlpha(0.78));
		buttonZone.on("pointerout", () => button.setAlpha(1));
		buttonZone.on("pointerdown", () => this.game.events.emit("next-situation"));

		this.overlay = this.add.container(this.scale.width / 2, this.scale.height / 2, [panel, title, detail, button, buttonText, buttonZone]);
		this.overlay.setDepth(50).setVisible(false);
		this.game.events.on("game-over", this.showEnd, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyEnd, this);
	}

	private showEnd(progress: GameProgress, success: number) {
		const detail = this.overlay.list[2] as Phaser.GameObjects.Text;
		detail.setText(`${progress === GameProgress.Success ? "You won" : "You lost"} • ${Math.round(success * 100)}% likelihood`);
		this.overlay.setVisible(true);
	}

	private destroyEnd() {
		this.game.events.off("game-over", this.showEnd, this);
	}
}
