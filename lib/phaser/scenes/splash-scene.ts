import Phaser from "phaser";
import { MicRecorder } from "@/lib/phaser/audio/mic-recorder";

export class SplashScene extends Phaser.Scene {
	private progressFill!: Phaser.GameObjects.Graphics;
	private progressLabel!: Phaser.GameObjects.Text;
	private playButton!: Phaser.GameObjects.Container;
	private pendingProgress = 0;
	private permissionReady = false;
	private assetsReady = false;

	constructor() {
		super("SplashScene");
	}

	preload() {
		this.load.image("splash-logo", "/assets/splash.png");
		this.load.on(Phaser.Loader.Events.PROGRESS, this.updateProgress, this);
		this.load.once(Phaser.Loader.Events.COMPLETE, () => {
			this.assetsReady = true;
			this.updateReadyState();
		});
	}

	create() {
		this.cameras.main.setBackgroundColor("#07111f");
		this.add.image(this.scale.width / 2, this.scale.height * 0.31, "splash-logo")
			.setDisplaySize(Math.min(520, this.scale.width * 0.56), Math.min(300, this.scale.height * 0.32));

		this.add.text(this.scale.width / 2, this.scale.height * 0.56, "EXPLAIN YOURSELF", {
			color: "#f8fafc",
			fontFamily: "Arial, sans-serif",
			fontSize: "32px",
			fontStyle: "bold",
		}).setOrigin(0.5);

		this.add.text(this.scale.width / 2, this.scale.height * 0.62, "A conversation can change everything.", {
			color: "#bae6fd",
			fontFamily: "Arial, sans-serif",
			fontSize: "18px",
		}).setOrigin(0.5);

		const track = this.add.graphics();
		track.fillStyle(0x1e293b, 1);
		track.fillRoundedRect(this.scale.width / 2 - 180, this.scale.height * 0.72, 360, 14, 7);
		this.progressFill = this.add.graphics();
		this.progressLabel = this.add.text(this.scale.width / 2, this.scale.height * 0.76, "Preparing microphone...", {
			color: "#94a3b8",
			fontFamily: "Arial, sans-serif",
			fontSize: "15px",
		}).setOrigin(0.5);
		this.updateProgress(this.pendingProgress);

		this.playButton = this.createPlayButton();
		this.playButton.setVisible(false);
		void this.requestMicrophonePermission();
	}

	private async requestMicrophonePermission() {
		try {
			await new MicRecorder().requestPermission();
			this.permissionReady = true;
			this.progressLabel.setText("Microphone ready");
		} catch (error: unknown) {
			console.error("Unable to request microphone permission", error);
			this.permissionReady = true;
			this.progressLabel.setText("Microphone permission can be enabled in your browser");
		} finally {
			this.updateReadyState();
		}
	}

	private updateProgress(value: number) {
		this.pendingProgress = value;
		if (!this.progressFill) {
			return;
		}

		this.progressFill.clear();
		this.progressFill.fillStyle(0x38bdf8, 1);
		this.progressFill.fillRoundedRect(this.scale.width / 2 - 180, this.scale.height * 0.72, 360 * value, 14, 7);
	}

	private updateReadyState() {
		if (!this.assetsReady || !this.permissionReady) {
			return;
		}

		this.updateProgress(1);
		this.progressLabel.setText("Ready");
		this.playButton.setVisible(true);
	}

	private createPlayButton() {
		const background = this.add.graphics();
		background.fillStyle(0x38bdf8, 1);
		background.fillRoundedRect(-110, -30, 220, 60, 18);
		const label = this.add.text(0, 0, "PLAY", {
			color: "#062033",
			fontFamily: "Arial, sans-serif",
			fontSize: "20px",
			fontStyle: "bold",
		}).setOrigin(0.5);
		const hitArea = this.add.zone(0, 0, 220, 60).setInteractive({ useHandCursor: true });
		const button = this.add.container(this.scale.width / 2, this.scale.height * 0.85, [background, label, hitArea]);
		button.setDepth(20);
		hitArea.on("pointerover", () => background.setAlpha(0.78));
		hitArea.on("pointerout", () => background.setAlpha(1));
		hitArea.on("pointerup", () => this.startGame());
		return button;
	}

	private startGame() {
		void this.unlockAudio();
		this.scene.start("GameScene");
	}

	private async unlockAudio() {
		try {
			const AudioContextClass = window.AudioContext
				?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (AudioContextClass) {
				const context = new AudioContextClass();
				await context.resume();
				await context.close();
			}

			const silentAudio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
			silentAudio.volume = 0;
			await silentAudio.play();
			silentAudio.pause();
		} catch (error: unknown) {
			console.warn("Browser audio could not be unlocked during splash", error);
		}
	}
}
