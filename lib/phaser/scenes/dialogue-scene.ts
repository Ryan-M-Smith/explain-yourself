import Phaser from "phaser";

export class DialogueScene extends Phaser.Scene {
	private dialogueText!: Phaser.GameObjects.Text;
	private typewriterTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super("DialogueScene");
	}

	create() {
		const box = this.add.graphics().setDepth(10);
		box.fillStyle(0x07111f, 0.82);
		box.fillRoundedRect(40, this.scale.height - 242, this.scale.width - 80, 218, 22);
		box.lineStyle(2, 0x9bdcff, 0.28);
		box.strokeRoundedRect(40, this.scale.height - 242, this.scale.width - 80, 218, 22);

		this.dialogueText = this.add.text(70, this.scale.height - 210, "", {
			color: "#ffffff",
			fontFamily: "Arial, sans-serif",
			fontSize: "22px",
			fontStyle: "normal",
			lineSpacing: 8,
			wordWrap: { width: this.scale.width - 140 },
		});
		this.dialogueText.setDepth(11);
		this.add.text(68, this.scale.height - 226, "", {
			color: "#7dd3fc",
			fontFamily: "Arial, sans-serif",
			fontSize: "13px",
			fontStyle: "bold",
		}).setDepth(11);

		this.game.events.on("game-dialogue", this.updateDialogue, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyDialogue, this);
	}

	private updateDialogue(occupation: string, text: string) {
		this.typeText(`${occupation}:\n${this.renderMarkdown(text)}`);
	}

	private renderMarkdown(text: string) {
		return text
			.replace(/^###?\s+/gm, "")
			.replace(/^[-*]\s+/gm, "• ")
			.replace(/\*\*(.*?)\*\*/g, "$1")
			.replace(/__(.*?)__/g, "$1")
			.replace(/\*(.*?)\*/g, "$1")
			.replace(/_(.*?)_/g, "$1")
			.replace(/`(.*?)`/g, "$1");
	}

	private typeText(text: string) {
		this.typewriterTimer?.remove(false);
		this.dialogueText.setText("");
		let index = 0;
		this.typewriterTimer = this.time.addEvent({
							delay: 42,
			loop: true,
			callback: () => {
				this.dialogueText.setText(text.slice(0, index));
				index += 1;
				if (index > text.length) {
					this.typewriterTimer?.remove(false);
				}
			},
		});
	}

	private destroyDialogue() {
		this.game.events.off("game-dialogue", this.updateDialogue, this);
		this.typewriterTimer?.remove(false);
	}
}
