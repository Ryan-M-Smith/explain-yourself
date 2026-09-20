//
// Filename: phaser-game.tsx
// Description: React Phaser game component
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

import type OpenAI from "openai";
import { GameProgress } from "./enums";

interface ChatMLMessage {
	role: "user" | "system" | "assistant";
	content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[];
}

interface Theme {
	occupation: string;
	location: string;
	background: string;
	audioPath?: string;
}

/**
 * Personality and mood traits for the AI agent in the game
 */
interface Trait {
	name: string;
	value: number;
}

interface GameState {
	/** Likelihood of success (0.0 to 1.0)  */
	success: number;

	/** The current player progress, which can be one of the following values:
	 * - "in_progress": The game is still ongoing.
	 * - "can_succeed": The player can succeed in the current scenario.
	 * - "can_fail": The player can fail in the current scenario.
	 * - "success": The player has succeeded in the game.
	 * - "failure": The player has failed in the game.
	 */
	progress: GameProgress;
}