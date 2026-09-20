import Phaser from "phaser";
import { GameProgress } from "@/types/enums";

export class EndScene extends Phaser.Scene {
	private overlay!: Phaser.GameObjects.Container;
	private backdrop!: Phaser.GameObjects.Graphics;
	private accentBar!: Phaser.GameObjects.Graphics;
	private logo!: Phaser.GameObjects.Image;
	private eyebrow!: Phaser.GameObjects.Text;
	private title!: Phaser.GameObjects.Text;
	private detail!: Phaser.GameObjects.Text;
	private button!: Phaser.GameObjects.Graphics;
	private panelX = 0;
	private panelY = 0;
	private panelHeight = 0;

	constructor() {
		super("EndScene");
	}

	preload() {
		this.load.image("success-logo", "/assets/success.png");
		this.load.image("fail-logo", "/assets/fail.png");
	}

	create() {
		const panelWidth = Math.min(760, this.scale.width - 80);
		const panelHeight = Math.min(610, this.scale.height - 80);
		const panelX = -panelWidth / 2;
		const panelY = -panelHeight / 2;
		this.panelX = panelX;
		this.panelY = panelY;
		this.panelHeight = panelHeight;

		this.backdrop = this.add.graphics();
		this.backdrop.fillStyle(0x0c0b13, 0.88);
		this.backdrop.fillRect(-this.scale.width / 2, -this.scale.height / 2, this.scale.width, this.scale.height);

		const panel = this.add.graphics();
		panel.fillStyle(0x100d18, 0.98);
		panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
		panel.lineStyle(1, 0xcdb7f7, 0.42);
		panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);

		this.accentBar = this.add.graphics();
		this.accentBar.fillRect(panelX, panelY, 5, panelHeight);

		this.logo = this.add.image(0, panelY + 145, "success-logo");
		this.logo.setDisplaySize(Math.min(250, panelWidth * 0.42), 150);

		this.eyebrow = this.add.text(0, panelY + 255, "NEGOTIATION RESULT", {
			color: "#cdb7f7",
			fontFamily: "Avenir Next, Avenir, sans-serif",
			fontSize: "13px",
			fontStyle: "bold",
			letterSpacing: 2.5,
		}).setOrigin(0.5);
		this.title = this.add.text(0, panelY + 300, "YOU GOT THROUGH", {
			color: "#faf8f3",
			fontFamily: "Avenir Next, Avenir, sans-serif",
			fontSize: "42px",
			fontStyle: "bold",
			letterSpacing: 1,
		}).setOrigin(0.5);
		this.detail = this.add.text(0, panelY + 365, "", {
			color: "#d3cddc",
			fontFamily: "Avenir Next, Avenir, sans-serif",
			fontSize: "20px",
			align: "center",
			wordWrap: { width: panelWidth - 100 },
		}).setOrigin(0.5);
		this.button = this.add.graphics();
		this.button.fillRoundedRect(-155, panelY + panelHeight - 105, 310, 58, 6);
		const buttonText = this.add.text(0, panelY + panelHeight - 76, "NEXT SITUATION  →", {
			color: "#211a2f",
			fontFamily: "Avenir Next, Avenir, sans-serif",
			fontSize: "17px",
			fontStyle: "bold",
		}).setOrigin(0.5);
		const buttonZone = this.add.zone(0, panelY + panelHeight - 76, 310, 58).setInteractive({ useHandCursor: true });
		buttonZone.on("pointerover", () => this.button.setAlpha(0.78));
		buttonZone.on("pointerout", () => this.button.setAlpha(1));
		buttonZone.on("pointerdown", () => this.game.events.emit("next-situation"));

		this.overlay = this.add.container(this.scale.width / 2, this.scale.height / 2, [this.backdrop, panel, this.accentBar, this.logo, this.eyebrow, this.title, this.detail, this.button, buttonText, buttonZone]);
		this.overlay.setDepth(50).setVisible(false);
		this.game.events.on("game-over", this.showEnd, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyEnd, this);
	}

	private showEnd(progress: GameProgress, success: number) {
		const won = progress === GameProgress.Success;
		const accent = won ? 0xe5c58b : 0xf1a591;
		this.logo.setTexture(won ? "success-logo" : "fail-logo");
		this.accentBar.clear();
		this.accentBar.fillStyle(accent, 1);
		this.accentBar.fillRect(this.panelX, this.panelY, 5, this.panelHeight);
		this.eyebrow.setColor(won ? "#e5c58b" : "#f1a591");
		this.title.setText(won ? "YOU GOT THROUGH" : "ACCESS DENIED");
		this.detail.setText(`${won ? "The situation is resolved." : "The conversation is over."}\n${Math.round(success * 100)}% likelihood of success`);
		this.button.clear();
		this.button.fillStyle(accent, 1);
		this.button.fillRoundedRect(-155, this.panelY + this.panelHeight - 105, 310, 58, 6);
		this.overlay.setVisible(true);
	}

	private destroyEnd() {
		this.game.events.off("game-over", this.showEnd, this);
	}
}
