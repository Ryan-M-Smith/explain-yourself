import Phaser from "phaser";

export class SpeakingScene extends Phaser.Scene {
	private waveform!: Phaser.GameObjects.Graphics;
	private speaking: "player" | "ai" | null = null;
	private finalizing = false;
	private phase = 0;
	private roleName = "AI AGENT";
	private turnText!: Phaser.GameObjects.Text;
	private hintText!: Phaser.GameObjects.Text;

	constructor() {
		super("SpeakingScene");
	}

	create() {
		const panel = this.add.graphics().setDepth(10);
		panel.fillStyle(0x07111f, 0.84);
		panel.fillRoundedRect(24, 20, 240, 104, 20);
		panel.lineStyle(2, 0x9bdcff, 0.28);
		panel.strokeRoundedRect(24, 20, 240, 104, 20);
		this.turnText = this.add.text(42, 32, "YOUR TURN", {
			color: "#bae6fd",
			fontFamily: "Arial, sans-serif",
			fontSize: "16px",
			fontStyle: "bold",
		}).setDepth(11);
		this.hintText = this.add.text(42, 102, "HOLD SPACE TO TALK", {
			color: "#7dd3fc",
			fontFamily: "Arial, sans-serif",
			fontSize: "10px",
			fontStyle: "bold",
		}).setDepth(11);
		this.waveform = this.add.graphics().setDepth(11);
		const role = this.registry.get("role") as { occupation?: string } | undefined;
		this.roleName = role?.occupation?.toUpperCase() ?? "AI AGENT";
		this.game.events.on("game-speaking", this.setSpeaking, this);
		this.game.events.on("game-finalizing", this.setFinalizing, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroySpeaking, this);
	}

	update(_: number, delta: number) {
		this.phase += delta * 0.012;
		this.waveform.clear();
		const color = this.speaking === "ai" ? 0xfbbf24 : this.speaking === "player" ? 0x38bdf8 : 0x475569;
		for (let index = 0; index < 18; index += 1) {
			const height = this.speaking ? 8 + Math.abs(Math.sin(this.phase + index * 0.7)) * (this.speaking === "ai" ? 22 : 28) : 5;
			this.waveform.fillStyle(color, this.speaking ? 0.9 : 0.55);
			this.waveform.fillRoundedRect(43 + index * 11, 86 - height / 2, 6, height, 3);
		}
	}

	private setSpeaking(speaking: "player" | "ai" | null) {
		this.speaking = speaking;
		this.renderTurn();
	}

	private setFinalizing(finalizing: boolean) {
		this.finalizing = finalizing;
		this.renderTurn();
	}

	private renderTurn() {
		if (this.finalizing) {
			this.turnText.setText("FINAL EVALUATION");
			this.turnText.setColor("#fcd34d");
			this.hintText.setVisible(false);
			return;
		}

		this.turnText.setText(this.speaking === "ai" ? `${this.roleName}'S TURN` : "YOUR TURN");
		this.turnText.setColor(this.speaking === "ai" ? "#fcd34d" : "#bae6fd");
		this.hintText.setVisible(this.speaking !== "ai");
	}

	private destroySpeaking() {
		this.game.events.off("game-speaking", this.setSpeaking, this);
		this.game.events.off("game-finalizing", this.setFinalizing, this);
	}
}
