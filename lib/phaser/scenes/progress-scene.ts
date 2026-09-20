import Phaser from "phaser";
import { GameProgress } from "@/types/enums";
import type { Role, Trait } from "@/types/types";

export class ProgressScene extends Phaser.Scene {
	private fill!: Phaser.GameObjects.Graphics;
	private label!: Phaser.GameObjects.Text;
	private timerText!: Phaser.GameObjects.Text;
	private value = 0.5;
	private displayedValue = 0.5;
	private targetValue = 0.5;

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
		this.fill = this.add.graphics().setDepth(12);
		this.label = this.add.text(this.scale.width - 315, 84, "steady 50%", {
			color: "#e2e8f0",
			fontFamily: "Arial, sans-serif",
			fontSize: "15px",
		}).setDepth(11);
		this.createSituationCard();

		this.game.events.on("game-progress", this.updateProgress, this);
		this.game.events.on("game-recording-time", this.updateTimer, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyProgress, this);
	}

	private createSituationCard() {
		const role = this.registry.get("role") as Role | undefined;
		const selectedTraits = this.registry.get("traits") as Trait[] | undefined;
		const cardX = this.scale.width - 590;
		const cardY = 130;
		const cardWidth = 550;
		const cardHeight = 170;
		const card = this.add.graphics().setDepth(10);
		card.fillStyle(0x07111f, 0.82);
		card.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 20);
		card.lineStyle(2, 0x9bdcff, 0.28);
		card.strokeRoundedRect(cardX, cardY, cardWidth, cardHeight, 20);

		this.add.text(cardX + 24, cardY + 18, role ? `${role.occupation.toUpperCase()} • ${role.location.toUpperCase()}` : "SITUATION", {
			color: "#bae6fd",
			fontFamily: "Arial, sans-serif",
			fontSize: "14px",
			fontStyle: "bold",
		}).setDepth(11);

		const overview = role?.background ?? "Your situation is loading.";
		const words = overview.split(/\s+/).filter(Boolean).slice(0, 50);
		this.add.text(cardX + 24, cardY + 44, words.join(" "), {
			color: "#e2e8f0",
			fontFamily: "Arial, sans-serif",
			fontSize: "15px",
			lineSpacing: 4,
			wordWrap: { width: cardWidth - 48 },
		}).setDepth(11);

		let pillX = cardX + 24;
		const pillY = cardY + 126;
		for (const [index, trait] of (selectedTraits ?? []).entries()) {
			const text = trait.name.toUpperCase();
			const pillWidth = 30 + text.length * 7;
			if (pillX + pillWidth > cardX + cardWidth - 24) {
				break;
			}

			const colors = [0x38bdf8, 0xa78bfa, 0xfbbf24];
			const pill = this.add.graphics().setDepth(11);
			pill.fillStyle(colors[index % colors.length], 0.85);
			pill.fillRoundedRect(pillX, pillY, pillWidth, 26, 13);
			this.add.text(pillX + 12, pillY + 6, text, {
				color: "#07111f",
				fontFamily: "Arial, sans-serif",
				fontSize: "12px",
				fontStyle: "bold",
			}).setDepth(12);
			pillX += pillWidth + 8;
		}
	}

	private updateProgress(success: number, progress: GameProgress) {
		this.value = success;
		this.targetValue = success;
		this.tweens.add({
			targets: this,
			displayedValue: success,
			duration: 650,
			ease: "Cubic.easeOut",
			onUpdate: () => this.renderFill(),
		});
		this.renderFill();
		const adjective = progress === GameProgress.Success ? "Winning" : progress === GameProgress.Failure ? "Losing" : success >= 0.6 ? "Hopeful" : success <= 0.4 ? "Worrying" : "Uncertain";
		this.label.setText(`${adjective} ${Math.round(this.value * 100)}%`);
	}

	private renderFill() {
		const color = this.targetValue >= 0.8 ? 0x22c55e : this.targetValue <= 0.2 ? 0xef4444 : 0x38bdf8;
		this.fill.clear();
		this.fill.fillStyle(color, 1);
		this.fill.fillRoundedRect(this.scale.width - 315, 62, 240 * this.displayedValue, 16, 8);
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
