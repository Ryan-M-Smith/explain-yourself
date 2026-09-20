//
// Filename: phaser-game.tsx
// Description: React Phaser game component
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

import Phaser from "phaser";
import { MicRecorder } from "@/lib/phaser/audio/mic-recorder";
import type { ChatMLMessage, GameState, Role, Trait } from "@/types/types";
import { GameProgress } from "@/types/enums";
import { roles, traits } from "@/lib/phaser/params";
import { BackgroundScene } from "@/lib/phaser/scenes/background-scene";
import { CharacterScene } from "@/lib/phaser/scenes/character-scene";
import { DialogueScene } from "@/lib/phaser/scenes/dialogue-scene";
import { ProgressScene } from "@/lib/phaser/scenes/progress-scene";
import { SpeakingScene } from "@/lib/phaser/scenes/speaking-scene";
import { EndScene } from "@/lib/phaser/scenes/end-scene";
import type { RoleExpression } from "@/lib/phaser/art";

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

function removeToneTags(text: string) {
	return text.replace(/\[[^\]]+\]\s*/g, "").trim();
}

const VOICE_VOLUME = 0.8;
const MUSIC_VOLUME = 0.1;

export class GameScene extends Phaser.Scene {
	private recorder: MicRecorder | null = null;
	private micEnabled = false;
	private recordingRequest: Promise<void> | null = null;
	private openingTurnInFlight = false;
	private aiSpeaking = false;
	private recordingStartedAt = 0;
	private talkingElapsedMs = 0;
	private recordingTimer?: Phaser.Time.TimerEvent;
	private readonly maxTalkingTimeMs = 120_000;
	private voiceAudio: HTMLAudioElement | null = null;
	private musicAudio: HTMLAudioElement | null = null;
	private audioPlaybackReject?: (reason?: unknown) => void;
	private pendingAudioUrl: string | null = null;
	private gameOverEmitted = false;
	private readonly maxContextMessages = 8;
	private readonly systemMessageCount = 2;
	
	private messages: ChatMLMessage[] = [];
	private role: Role | null = null;
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
		
		// Randomly select a role and traits for the game
		this.role = roles[Math.floor(Math.random() * roles.length)];
		this.registry.set("role", this.role);
		this.traits = traits.map((category) => {
			return category.traits[Math.floor(Math.random() * category.traits.length)]
		});
		this.registry.set("traits", this.traits);

		this.updateSuccess(this.traits.reduce((sum, trait) => sum + trait.value, 0) / this.traits.length);

		console.dir(this.role);
		console.dir(this.traits);
		console.log(`Chance of success: ${this.gameState.success * 100}%`);
	}

	create() {
		console.log("Scene created");
		this.talkingElapsedMs = 0;
		this.scene.add("BackgroundScene", BackgroundScene, true);
		this.scene.add("CharacterScene", CharacterScene, true);
		this.scene.add("DialogueScene", DialogueScene, true);
		this.scene.add("ProgressScene", ProgressScene, true);
		this.scene.add("SpeakingScene", SpeakingScene, true);
		this.scene.add("EndScene", EndScene, true);
		this.gameOverEmitted = false;
		this.game.events.on("next-situation", this.nextSituation, this);
		this.time.delayedCall(0, () => this.emitProgress());
		
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
						 role: this.role,
						traits: this.traits,
						gameState: this.gameState
					}),
				}]
			}
		];

		this.recorder = new MicRecorder({
			sampleRate: 16000,
			samplesPerChunk: 1024,
		});
		
		void this.requestMic();
		this.input.on(Phaser.Input.Events.POINTER_DOWN, this.unlockAudio, this);
		this.input.keyboard?.on("keydown", this.unlockAudio, this);
		void this.startMusic().finally(() => this.startOpeningTurn());
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyRecorder, this);
	}

	update(time: number, delta: number) {
		void time;
		void delta;
		// Update game objects here.
	}

	private updateSuccess(successDelta: number) {
		this.gameState.success = Math.min(Math.max(this.gameState.success + successDelta, 0), 1);
		if (this.gameState.success >= 0.95) {
			this.gameState.progress = GameProgress.Success;
		} else if (this.gameState.success <= 0.05) {
			this.gameState.progress = GameProgress.Failure;
		} else if (this.gameState.success >= 0.8 && this.gameState.progress === GameProgress.InProgress) {
			this.gameState.progress = GameProgress.CanSucceed;
		} else if (this.gameState.success <= 0.2 && this.gameState.progress === GameProgress.InProgress) {
			this.gameState.progress = GameProgress.CanFail;
		}
		this.emitProgress();
	}

	private applySuccessDelta(rawDelta: number) {
		const boundedDelta = Math.max(-1, Math.min(1, rawDelta));
		if (boundedDelta === 0) {
			return 0;
		}

		const normalizedMagnitude = Math.abs(boundedDelta);
		const magnitude = Math.max(
			0.015,
			Math.min(0.35, normalizedMagnitude * 0.22 + normalizedMagnitude ** 2 * 0.28),
		);
		const appliedDelta = Math.sign(boundedDelta) * magnitude;
		console.debug("Applied success delta", { rawDelta, appliedDelta });
		this.updateSuccess(appliedDelta);
		return appliedDelta;
	}

	private updateProgress(progress: GameProgress, modelGameOver = false) {
		if (this.gameState.success >= 0.95) {
			this.gameState.progress = GameProgress.Success;
		} else if (this.gameState.success <= 0.05) {
			this.gameState.progress = GameProgress.Failure;
		} else if ((progress === GameProgress.Success || (modelGameOver && this.gameState.success >= 0.8)) && this.gameState.success >= 0.8) {
			this.gameState.progress = progress;
			if (modelGameOver && progress !== GameProgress.Success) {
				this.gameState.progress = GameProgress.Success;
			}
		} else if ((progress === GameProgress.Failure || (modelGameOver && this.gameState.success <= 0.2)) && this.gameState.success <= 0.2) {
			this.gameState.progress = progress === GameProgress.Failure ? progress : GameProgress.Failure;
		} else if (this.gameState.success >= 0.8) {
			this.gameState.progress = GameProgress.CanSucceed;
		} else if (this.gameState.success <= 0.2) {
			this.gameState.progress = GameProgress.CanFail;
		} else {
			this.gameState.progress = GameProgress.InProgress;
		}
		this.emitProgress();
	}

	private isGameOver() {
		return this.gameState.progress === GameProgress.Success || this.gameState.progress === GameProgress.Failure;
	}

	private emitProgress() {
		this.game.events.emit("game-progress", this.gameState.success, this.gameState.progress);
		if (this.isGameOver() && !this.gameOverEmitted) {
			this.gameOverEmitted = true;
			this.game.events.emit("game-over", this.gameState.progress, this.gameState.success);
		}
	}

	private appendMessage(message: ChatMLMessage) {
		this.messages.push(message);
		const systemMessages = this.messages.slice(0, this.systemMessageCount);
		const conversationMessages = this.messages.slice(this.systemMessageCount).slice(-(this.maxContextMessages - this.systemMessageCount));
		this.messages = [...systemMessages, ...conversationMessages];
	}

	private setExpression(successDelta: number, progress: GameProgress) {
		let expression: RoleExpression;

		if (progress === GameProgress.Success) {
			expression = "pleased";
		} else if (progress === GameProgress.Failure) {
			expression = "stern";
		} else if (successDelta > 0.1) {
			expression = "pleased";
		} else if (successDelta < -0.1) {
			expression = "skeptical";
		} else {
			expression = "neutral";
		}

		const characterScene = this.scene.get("CharacterScene") as CharacterScene;
		characterScene.setExpression(expression);
	}

	private async requestMic() {
		try {
			await this.recorder?.requestPermission();
			console.log("Microphone permission granted");
		} catch (error: unknown) {
			console.error("Unable to request microphone permission", error);
		}
	}

	private async unlockAudio() {
		if (!this.pendingAudioUrl) {
			void this.startMusic();
			return;
		}

		const audioUrl = this.pendingAudioUrl;
		this.pendingAudioUrl = null;
		this.aiSpeaking = true;
		this.game.events.emit("game-speaking", "ai");
		try {
			await this.playAudio(audioUrl);
		} finally {
			this.aiSpeaking = false;
			this.game.events.emit("game-speaking", null);
		}
	}

	private async openMic() {
		if (this.aiSpeaking || this.micEnabled || this.recordingRequest || !this.recorder || this.talkingElapsedMs >= this.maxTalkingTimeMs) {
			return;
		}

		this.micEnabled = true;
		this.recordingStartedAt = performance.now();
		this.recordingTimer = this.time.addEvent({
			delay: 250,
			loop: true,
			callback: () => {
				const elapsedMs = this.talkingElapsedMs + performance.now() - this.recordingStartedAt;
				const elapsedSeconds = Math.floor(elapsedMs / 1000);
				this.game.events.emit("game-recording-time", elapsedSeconds);
				if (elapsedMs >= this.maxTalkingTimeMs) {
					void this.closeMic();
				}
			},
		});
		this.game.events.emit("game-speaking", "player");
		this.recordingRequest = this.recorder.start();

		try {
			await this.recordingRequest;
		} catch (error: unknown) {
			this.micEnabled = false;
			this.game.events.emit("game-speaking", null);
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
		this.talkingElapsedMs = Math.min(
			this.maxTalkingTimeMs,
			this.talkingElapsedMs + performance.now() - this.recordingStartedAt,
		);
		this.game.events.emit("game-recording-time", Math.floor(this.talkingElapsedMs / 1000));
		this.recordingTimer?.remove(false);
		this.recordingTimer = undefined;
		this.game.events.emit("game-speaking", null);
		const startRequest = this.recordingRequest;
		await this.recorder?.stop();
		
		try {
			await startRequest;
		} catch (error: unknown) {
			console.error("Unable to stop microphone recording", error);
		}
		
		await this.sendAudio();
	}

	private async sendToNemotron() {
		return fetch("/api/nemotron", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ context: this.messages }),
		});
	}

	private async startOpeningTurn() {
		if (this.openingTurnInFlight) {
			return;
		}

		this.openingTurnInFlight = true;
		this.game.events.emit("game-thinking", true);

		try {
			const response = await this.sendToNemotron();
			if (!response.ok) {
				throw new Error(`Opening Nemotron request failed: ${response.status}`);
			}

			const { message } = await response.json() as {
				message?: { content?: string };
			};
			const modelResponse = this.parseModelResponse(message);
			this.game.events.emit("game-thinking", false);

			const appliedDelta = this.applySuccessDelta(modelResponse.successDelta);
			this.updateProgress(modelResponse.progress, modelResponse.gameOver);
			this.setExpression(appliedDelta, this.gameState.progress);
			this.game.events.emit("game-dialogue", this.role?.occupation ?? "Agent", removeToneTags(modelResponse.npcResponse));
			await this.speakText(removeToneTags(modelResponse.npcResponse), this.role?.voice ?? "");
			if (message) {
				this.appendMessage(message as ChatMLMessage);
			}

			if (!this.isGameOver()) {
				this.input.keyboard?.on("keydown-SPACE", this.openMic, this);
				this.input.keyboard?.on("keyup-SPACE", this.closeMic, this);
			}
		} catch (error: unknown) {
			console.error("Unable to send opening Nemotron turn", error);
			this.game.events.emit("game-thinking", false);
		} finally {
			this.openingTurnInFlight = false;
		}
	}

	private parseModelResponse(message?: { content?: string }) {
		if (!message?.content) {
			throw new Error("Nemotron returned an empty response");
		}

		return JSON.parse(message.content) as {
			npcResponse: string;
			successDelta: number;
			progress: GameProgress;
			gameOver: boolean;
		};
	}

	private async sendAudio() {
		if (!this.recorder || this.recorder.recordedChunks.length === 0) {
			return;
		}

		const wav = this.recorder.toWav();
		const audioBase64 = await blobToBase64(wav);
		console.log("Player audio captured", {
			chunks: this.recorder.recordedChunks.length,
			samples: this.recorder.recordedSampleCount,
			peakAmplitude: this.recorder.peakAmplitude,
			wavBytes: wav.size,
			base64Characters: audioBase64.length,
		});
		
		try {
			this.game.events.emit("game-thinking", true);
			this.appendMessage({
				role: "user",
				content: [
					// Audio input. Nemotron Omni expects audio_url content parts.
					{
						type: "audio_url",
						audio_url: { url: `data:audio/wav;base64,${audioBase64}` },
					},

					// Current game state
					{
						type: "text",
						text: JSON.stringify(this.gameState),
					}
				]
			});

			const response = await fetch("/api/nemotron", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context: this.messages })
			});

			if (!response.ok) {
				const errorBody = await response.json().catch(() => null) as { error?: string } | null;
				throw new Error(errorBody?.error ?? `Nemotron request failed: ${response.status}`);
			}

			const { message } = await response.json() as {
				message?: { content?: string };
			};

			const modelResponse = this.parseModelResponse(message);
			this.game.events.emit("game-thinking", false);
			const appliedDelta = this.applySuccessDelta(modelResponse.successDelta);
			this.updateProgress(modelResponse.progress, modelResponse.gameOver);
			this.setExpression(appliedDelta, this.gameState.progress);
			this.game.events.emit("game-dialogue", this.role?.occupation ?? "Agent", removeToneTags(modelResponse.npcResponse));
			await this.speakText(removeToneTags(modelResponse.npcResponse), this.role?.voice ?? "");

			if (message) {
				this.appendMessage(message as ChatMLMessage);
			}

			if (this.isGameOver()) {
				this.input.keyboard?.off("keydown-SPACE", this.openMic, this);
				this.input.keyboard?.off("keyup-SPACE", this.closeMic, this);
			}
		} catch (error: unknown) {
			console.error("Unable to send recording to Nemotron", error);
			this.game.events.emit("game-thinking", false);
		} finally {
			this.recordingRequest = null;
		}
	}

	private async speakText(text: string, voiceId: string) {
		this.aiSpeaking = true;
		this.game.events.emit("game-speaking", "ai");

		try {
			const response = await fetch("/api/elevenlabs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ voiceId, text }),
			});

			if (!response.ok) {
				const errorBody = await response.json().catch(() => null) as { error?: string } | null;
				throw new Error(errorBody?.error ?? `ElevenLabs request failed: ${response.status}`);
			}

			const audioBlob = await response.blob();
			const audioUrl = URL.createObjectURL(audioBlob);
			await this.playAudio(audioUrl);
		} catch (error: unknown) {
			console.error("Unable to send text to ElevenLabs", error);
		} finally {
			this.aiSpeaking = false;
			this.game.events.emit("game-speaking", null);
		}
	}

	private async playAudio(audioUrl: string) {
		this.audioPlaybackReject?.(new Error("Audio playback interrupted by a new response"));
		this.voiceAudio?.pause();
		this.voiceAudio = new Audio(audioUrl);
		this.voiceAudio.preload = "auto";
		this.voiceAudio.volume = VOICE_VOLUME;
		const resumeMusic = this.musicAudio !== null && !this.musicAudio.paused;
		this.musicAudio?.pause();

		try {
			await new Promise<void>((resolve, reject) => {
				this.audioPlaybackReject = reject;
				if (!this.voiceAudio) {
					reject(new Error("Audio element was cleared before playback completed"));
					return;
				}

				this.voiceAudio.onplaying = () => {
					console.debug("ElevenLabs audio playing", this.audioDebugState());
					this.game.events.emit("game-audio-state", "playing");
				};
				this.voiceAudio.onpause = () => {
					console.warn("ElevenLabs audio paused", this.audioDebugState());
					this.game.events.emit("game-audio-state", "paused");
					if (!this.voiceAudio?.ended) {
						reject(new Error("ElevenLabs audio paused before playback ended"));
					}
				};
				this.voiceAudio.onwaiting = () => {
					console.warn("ElevenLabs audio waiting for data", this.audioDebugState());
					this.game.events.emit("game-audio-state", "waiting");
				};
				this.voiceAudio.onstalled = () => {
					console.warn("ElevenLabs audio stalled", this.audioDebugState());
					this.game.events.emit("game-audio-state", "stalled");
				};
				this.voiceAudio.ontimeupdate = () => {
					this.game.events.emit("game-audio-time", this.voiceAudio?.currentTime ?? 0, this.voiceAudio?.duration ?? 0);
				};
				this.voiceAudio.onended = () => {
					console.debug("ElevenLabs audio ended", this.audioDebugState());
					URL.revokeObjectURL(audioUrl);
					this.game.events.emit("game-audio-state", "ended");
					this.audioPlaybackReject = undefined;
					resolve();
				};
				this.voiceAudio.onerror = () => {
					URL.revokeObjectURL(audioUrl);
					this.audioPlaybackReject = undefined;
					reject(new Error("ElevenLabs audio playback failed"));
				};

				void this.voiceAudio.play().catch(reject);
			});
			this.audioPlaybackReject = undefined;
		} catch (error: unknown) {
			if (error instanceof DOMException && error.name === "NotAllowedError") {
				this.pendingAudioUrl = audioUrl;
				return;
			}

			URL.revokeObjectURL(audioUrl);
			throw error;
		} finally {
			if (resumeMusic) {
				void this.startMusic();
			}
		}
	}

	private audioDebugState() {
		return {
			paused: this.voiceAudio?.paused,
			currentTime: this.voiceAudio?.currentTime,
			duration: this.voiceAudio?.duration,
			readyState: this.voiceAudio?.readyState,
			networkState: this.voiceAudio?.networkState,
		};
	}

	private destroyRecorder() {
		this.game.events.off("next-situation", this.nextSituation, this);
		this.input.off(Phaser.Input.Events.POINTER_DOWN, this.unlockAudio, this);
		this.input.keyboard?.off("keydown", this.unlockAudio, this);
		this.input.keyboard?.off("keydown-SPACE", this.openMic, this);
		this.input.keyboard?.off("keyup-SPACE", this.closeMic, this);
		if (this.pendingAudioUrl) {
			URL.revokeObjectURL(this.pendingAudioUrl);
			this.pendingAudioUrl = null;
		}
		this.musicAudio?.pause();
		this.musicAudio = null;
		void this.recorder?.stop();
		this.recorder = null;
	}

	private async startMusic() {
		if (!this.musicAudio && this.role?.music) {
			this.musicAudio = new Audio(this.role.music);
			this.musicAudio.preload = "auto";
			this.musicAudio.loop = true;
			this.musicAudio.volume = MUSIC_VOLUME;
		}

		if (!this.musicAudio || !this.musicAudio.paused) {
			return;
		}

		try {
			await this.musicAudio.play();
		} catch (error: unknown) {
			console.debug("Background music is waiting for user interaction", error);
		}
	}
	private nextSituation() {
		if (!this.isGameOver()) {
			return;
		}

		this.voiceAudio?.pause();
		void this.recorder?.stop();
		for (const sceneKey of ["BackgroundScene", "CharacterScene", "DialogueScene", "ProgressScene", "SpeakingScene", "EndScene"]) {
			this.scene.stop(sceneKey);
			this.scene.remove(sceneKey);
		}
		this.scene.restart();
	}
}
