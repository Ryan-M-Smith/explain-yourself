//
// Filename: phaser-game.tsx
// Description: React Phaser game component
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

import Phaser from "phaser";
import { MicRecorder } from "@/lib/phaser/audio/mic-recorder";
import type { ChatMLMessage, GameState, Theme, Trait } from "@/types/types";
import { GameProgress } from "@/types/enums";
import { themes, traits } from "@/lib/phaser/params";

function blobToBase64(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			const result = String(reader.result);
			resolve(result.substring(result.indexOf(",") + 1));
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

export class GameScene extends Phaser.Scene {
	private recorder: MicRecorder | null = null;
	private micEnabled = false;
	private recordingRequest: Promise<void> | null = null;
	
	private messages: ChatMLMessage[] = [];
	private theme: Theme | null = null;
	private traits: Trait[] = [];
	private gameState: GameState = {
		success: 0.5,
		progress: GameProgress.InProgress
	}

	constructor() {
		super("GameScene");
	}

	preload() {
		// Load the system prompt from a file
		this.load.text("system-prompt", "/prompts/SYSTEM.prompt");
		
		// Randomly select a theme and traits for the game
		this.theme = themes[Math.floor(Math.random() * themes.length)];
		this.traits = traits.map((category) => {
			return category.traits[Math.floor(Math.random() * category.traits.length)]
		});

		this.updateSuccess(this.traits.reduce((sum, trait) => sum + trait.value, 0));

		console.dir(this.theme);
		console.dir(this.traits);
		console.log(`Chance of success: ${this.gameState.success * 100}%`);
	}

	create() {
		console.log("Scene created");
		
		this.messages = [
			// The overarching system prompt for Nemotron
			{
				role: "system",
				content: this.cache.text.get("system-prompt") ?? "",
			},

			// The NPC role and context for this game session
			{
				role: "system",
				content: [{
					type: "text",
					text: JSON.stringify({
						theme: this.theme,
						traits: this.traits,
						gameState: this.gameState
					}),
				}]
			}
		];

		console.log(this.messages);

		this.recorder = new MicRecorder({
			sampleRate: 16_000,
			samplesPerChunk: 1_024,
		});

		this.input.keyboard?.on("keydown-SPACE", this.openMic, this);
		this.input.keyboard?.on("keyup-SPACE", this.closeMic, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyRecorder, this);
	}

	update(time: number, delta: number) {
		void time;
		void delta;
		// Update game objects here.
	}

	private updateSuccess(successDelta: number) {
		this.gameState.success = Math.min(Math.max(this.gameState.success + successDelta, 0), 1);
	}

	private updateProgress(progress: GameProgress) {
		this.gameState.progress = progress;
	}

	private async openMic() {
		if (this.micEnabled || this.recordingRequest || !this.recorder) {
			return;
		}

		this.micEnabled = true;
		this.recordingRequest = this.recorder.start();

		try {
			await this.recordingRequest;
		} catch (error: unknown) {
			this.micEnabled = false;
			console.error("Unable to start microphone recording", error);
		} finally {
			this.recordingRequest = null;
		}
	}

	private async closeMic() {
		if (!this.micEnabled) {
			return;
		}

		this.micEnabled = false;
		const startRequest = this.recordingRequest;
		await this.recorder?.stop();
		
		try {
			await startRequest;
		} catch (error: unknown) {
			console.error("Unable to stop microphone recording", error);
		}
		
		await this.sendAudio();
	}

	private async sendAudio() {
		if (!this.recorder || this.recorder.recordedChunks.length === 0) {
			return;
		}

		const audioBase64 = await blobToBase64(this.recorder.toWav());
		
		try {
			this.messages.push({
				role: "user",
				content: [
					// Current game state
					{
						type: "text",
						text: JSON.stringify(this.gameState),
					},

					// Audio input
					{
						type: "input_audio",
						input_audio: { data: audioBase64, format: "wav" },
					}
				]
			});

			const response = await fetch("/api/nemotron", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context: this.messages })
			});

			if (!response.ok) {
				throw new Error(`Nemotron request failed: ${response.status}`);
			}

			const { message } = await response.json();
			console.log("Nemotron response:", message);

			const { npcResponse } = JSON.parse(message.content);
			console.log(`Response: ${npcResponse}`);

			if (message) {
				this.messages.push(message as ChatMLMessage);
			}
		} catch (error: unknown) {
			console.error("Unable to send recording to Nemotron", error);
		} finally {
			this.recordingRequest = null;
		}
	}

	private destroyRecorder() {
		this.input.keyboard?.off("keydown-SPACE", this.openMic, this);
		this.input.keyboard?.off("keyup-SPACE", this.closeMic, this);
		void this.recorder?.stop();
		this.recorder = null;
	}
}
