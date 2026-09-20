import Phaser from "phaser";
import { backgroundArtPath } from "../art";
import type { Role } from "@/types/types";

export class BackgroundScene extends Phaser.Scene {
	private backgroundImage!: Phaser.GameObjects.Image;
	private targetX = 0;
	private targetY = 0;

	constructor() {
		super("BackgroundScene");
	}

	preload() {
		const role = this.registry.get("role") as Role;
		this.load.image("role-background", backgroundArtPath(role));
	}

	create() {
		this.backgroundImage = this.add.image(this.scale.width / 2, this.scale.height / 2, "role-background")
			.setDisplaySize(this.scale.width, this.scale.height);
		this.input.on(Phaser.Input.Events.POINTER_MOVE, this.updateParallax, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyParallax, this);
	}

	update() {
		this.backgroundImage.x += (this.scale.width / 2 + this.targetX - this.backgroundImage.x) * 0.05;
		this.backgroundImage.y += (this.scale.height / 2 + this.targetY - this.backgroundImage.y) * 0.05;
	}

	private updateParallax(pointer: Phaser.Input.Pointer) {
		const horizontal = pointer.x / this.scale.width * 2 - 1;
		const vertical = pointer.y / this.scale.height * 2 - 1;
		this.targetX = -horizontal * 8;
		this.targetY = -vertical * 5;
	}

	private destroyParallax() {
		this.input.off(Phaser.Input.Events.POINTER_MOVE, this.updateParallax, this);
	}
}
