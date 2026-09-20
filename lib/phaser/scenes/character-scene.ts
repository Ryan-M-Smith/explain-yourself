import Phaser from "phaser";
import { roleArtPath, type RoleExpression } from "../art";
import type { Role } from "@/types/types";

export class CharacterScene extends Phaser.Scene {
	private characterImage!: Phaser.GameObjects.Image;
	private thinkingGlow!: Phaser.GameObjects.Graphics;
	private thoughtBubble!: Phaser.GameObjects.Graphics;
	private thinking = false;
	private phase = 0;
	private targetX = 0;
	private targetY = 0;

	constructor() {
		super("CharacterScene");
	}

	preload() {
		const role = this.registry.get("role") as Role;
		this.load.image("role-neutral", roleArtPath(role, "neutral"));
		this.load.image("role-skeptical", roleArtPath(role, "skeptical"));
		this.load.image("role-pleased", roleArtPath(role, "pleased"));
		this.load.image("role-stern", roleArtPath(role, "stern"));
	}

	create() {
		this.thinkingGlow = this.add.graphics();
		this.thinkingGlow.setDepth(0);
		this.thoughtBubble = this.add.graphics().setDepth(2);
		this.characterImage = this.add.image(this.scale.width / 2, this.scale.height / 2, "role-neutral")
			.setDisplaySize(this.scale.width, this.scale.height);
		this.characterImage.setDepth(1);
		this.input.on(Phaser.Input.Events.POINTER_MOVE, this.updateParallax, this);
		this.game.events.on("game-thinking", this.setThinking, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyParallax, this);
	}

	update(_: number, delta: number) {
		this.phase += delta * 0.004;
		const thinkingOffset = this.thinking ? Math.sin(this.phase) * 3 : 0;
		this.characterImage.x += (this.scale.width / 2 + this.targetX - this.characterImage.x) * 0.08;
		this.characterImage.y += (this.scale.height / 2 + this.targetY + thinkingOffset - this.characterImage.y) * 0.08;

		this.thinkingGlow.clear();
		this.thoughtBubble.clear();
		if (this.thinking) {
			const pulse = 0.16 + (Math.sin(this.phase * 2) + 1) * 0.04;
			this.thinkingGlow.fillStyle(0x7dd3fc, pulse);
			this.thinkingGlow.fillCircle(this.scale.width / 2, this.scale.height / 2, 250 + Math.sin(this.phase) * 8);
			const bubbleX = this.scale.width * 0.72;
			const bubbleY = this.scale.height * 0.18;
			this.thoughtBubble.fillStyle(0xf8fafc, 0.92);
			this.thoughtBubble.fillCircle(bubbleX, bubbleY, 42);
			this.thoughtBubble.fillCircle(bubbleX - 46, bubbleY + 54, 18);
			this.thoughtBubble.fillCircle(bubbleX - 70, bubbleY + 78, 9);
			this.thoughtBubble.fillStyle(0x334155, 1);
			this.thoughtBubble.fillCircle(bubbleX - 14, bubbleY, 5);
			this.thoughtBubble.fillCircle(bubbleX, bubbleY, 5);
			this.thoughtBubble.fillCircle(bubbleX + 14, bubbleY, 5);
		}
	}

	setExpression(expression: RoleExpression) {
		this.characterImage.setTexture(`role-${expression}`);
	}

	private setThinking(thinking: boolean) {
		this.thinking = thinking;
	}

	private updateParallax(pointer: Phaser.Input.Pointer) {
		const horizontal = pointer.x / this.scale.width * 2 - 1;
		const vertical = pointer.y / this.scale.height * 2 - 1;
		this.targetX = horizontal * 18;
		this.targetY = vertical * 11;
	}

	private destroyParallax() {
		this.input.off(Phaser.Input.Events.POINTER_MOVE, this.updateParallax, this);
		this.game.events.off("game-thinking", this.setThinking, this);
	}
}
