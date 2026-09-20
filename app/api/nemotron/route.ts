//
// Filename: phaser-game.tsx
// Description: React Phaser game component
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

import { GameProgress } from "@/types/enums";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Access Nvidia Nemotron through the OpenAI standard API interface
const openai = new OpenAI({
	apiKey: process.env.NEMOTRON_API_KEY,
	baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function POST(request: NextRequest) {
	const { context } = await request.json();
	
	try {
		const result = await openai.chat.completions.create({
			model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
			messages: context,
			reasoning_effort: "medium",
			response_format: {
				type: "json_schema",
				json_schema: {
					name: "model_response",
					description: "Nemotron response to player interactions.",
					strict: true,
					schema: {
						type: "object",
						properties: {
							npcResponse: {
								type: "string",
								description: "Your response to the player's most recent interaction.",
							},

							successDelta: {
								type: "number",
								description: "The change in the likelihood of success (between -1.0 and 1.0) based on the player's most recent interaction.",
							},

							progress: {
								type: "string",
								enum: Object.values(GameProgress),
								description: "The current player progress, which can be one of the following values: 'in_progress', 'can_succeed', 'can_fail', 'success', or 'failure'.",
							},

							gameOver: {
								type: "boolean",
								description: "Indicates whether the game is over based on the player's most recent interaction.",
							},
						},
						required: ["npcResponse", "successDelta", "progress", "gameOver"],
						additionalProperties: false,
					},
				}
			}
		}, { stream: false });

		const message = result.choices[0]?.message;

		const reasoningContent =
			"reasoning_content" in message
				? message.reasoning_content
				: undefined;

		const reasoningTokens =
			result.usage?.completion_tokens_details?.reasoning_tokens;

		console.log("Reasoning:", reasoningContent);
		console.log("Reasoning tokens:", reasoningTokens);

		
		return NextResponse.json({ message });
	} catch (error) {
		console.error("Error fetching from Nemotron:", error);
		return NextResponse.json({ error: "Failed to fetch from Nemotron" }, { status: 500 });
	}
}