import Phaser from "phaser";
import { GameProgress } from "@/types/enums";

export class ProgressScene extends Phaser.Scene {
	private fill!: Phaser.GameObjects.Rectangle;
	private label!: Phaser.GameObjects.Text;
	private timerText!: Phaser.GameObjects.Text;
	private value = 0.5;

	constructor() {
		super("ProgressScene");
	}

	create() {
		const panel = this.add.graphics().setDepth(10);
		panel.fillStyle(0x07111f, 0.82);
		panel.fillRoundedRect(this.scale.width - 340, 20, 300, 94, 20);
		panel.lineStyle(2, 0x9bdcff, 0.28);
		panel.strokeRoundedRect(this.scale.width - 340, 20, 300, 94, 20);
		this.add.text(this.scale.width - 315, 32, "PROGRESS", {
			color: "#bae6fd",
			fontFamily: "Arial, sans-serif",
			fontSize: "16px",
			fontStyle: "bold",
		}).setDepth(11);
		const timerPanel = this.add.graphics().setDepth(10);
		timerPanel.fillStyle(0x07111f, 0.88);
		timerPanel.fillRoundedRect(this.scale.width - 590, 20, 220, 94, 20);
		timerPanel.lineStyle(2, 0xfbbf24, 0.35);
		timerPanel.strokeRoundedRect(this.scale.width - 590, 20, 220, 94, 20);
		this.add.text(this.scale.width - 565, 32, "TALK TIME", {
			color: "#fde68a",
			fontFamily: "Arial, sans-serif",
			fontSize: "14px",
			fontStyle: "bold",
		}).setDepth(11);
		this.timerText = this.add.text(this.scale.width - 565, 52, "2:00", {
			color: "#f8fafc",
			fontFamily: "Arial, sans-serif",
			fontSize: "34px",
			fontStyle: "bold",
		}).setDepth(11);
		const track = this.add.graphics().setDepth(11);
		track.fillStyle(0x1e293b, 1);
		track.fillRoundedRect(this.scale.width - 315, 62, 250, 16, 8);
		this.fill = this.add.rectangle(this.scale.width - 315, 70, 0, 16, 0x22c55e, 1).setOrigin(0, 0.5).setDepth(12);
		this.label = this.add.text(this.scale.width - 315, 84, "steady 50%", {
			color: "#e2e8f0",
			fontFamily: "Arial, sans-serif",
			fontSize: "15px",
		}).setDepth(11);

		this.game.events.on("game-progress", this.updateProgress, this);
		this.game.events.on("game-recording-time", this.updateTimer, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyProgress, this);
	}

	private updateProgress(success: number, progress: GameProgress) {
		this.value = success;
		const width = 240 * success;
		this.fill.setSize(width, 18);
		this.fill.setFillStyle(success >= 0.8 ? 0x22c55e : success <= 0.2 ? 0xef4444 : 0x38bdf8);
		const adjective = progress === GameProgress.Success ? "Winning" : progress === GameProgress.Failure ? "Losing" : success >= 0.6 ? "Hopeful" : success <= 0.4 ? "Worrying" : "Uncertain";
		this.label.setText(`${adjective} ${Math.round(this.value * 100)}%`);
	}

	private updateTimer(elapsedSeconds: number) {
		const remainingSeconds = Math.max(0, 120 - elapsedSeconds);
		const minutes = Math.floor(remainingSeconds / 60);
		const seconds = String(remainingSeconds % 60).padStart(2, "0");
		this.timerText.setText(`${minutes}:${seconds}`);
		this.timerText.setColor(remainingSeconds <= 10 ? "#f87171" : "#f8fafc");
	}

	private destroyProgress() {
		this.game.events.off("game-progress", this.updateProgress, this);
		this.game.events.off("game-recording-time", this.updateTimer, this);
	}
}
