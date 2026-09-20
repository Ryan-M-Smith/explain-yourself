//
// Filename: phaser-game.tsx
// Route: /api/nemotron
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

let requestQueue: Promise<unknown> = Promise.resolve();

function wait(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isResourceExhausted(error: unknown) {
	const providerError = error as { status?: number; code?: string; message?: string };
	return providerError.status === 503
		|| providerError.code === "ResourceExhausted"
		|| providerError.message?.includes("Worker local total request limit");
}

export async function POST(request: NextRequest) {
	const { context } = await request.json();
	const runRequest = async () => {
		const result = await openai.chat.completions.create({
			model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
			messages: context,
			reasoning_effort: "none",
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
								minimum: -1,
								maximum: 1,
								description: "The change in the likelihood of success. Use a measured value: minor interaction changes should be around -0.1 to 0.1; reserve values near -1 or 1 for exceptionally decisive evidence.",
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
		return message;
	};

	const queuedRequest = requestQueue.then(async () => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			try {
				return await runRequest();
			} catch (error) {
				if (!isResourceExhausted(error) || attempt === 2) {
					throw error;
				}

				await wait(750 * (attempt + 1));
			}
		}

		throw new Error("Nemotron request could not be completed");
	});
	requestQueue = queuedRequest.catch(() => undefined);

	try {
		const message = await queuedRequest;
		return NextResponse.json({ message });
	} catch (error) {
		console.error("Error fetching from Nemotron:", error);
		const providerError = error as { status?: number; message?: string };
		const resourceExhausted = isResourceExhausted(error);
		return NextResponse.json(
			{ error: resourceExhausted ? "Nemotron is busy. Please try again shortly." : providerError.message ?? "Failed to fetch from Nemotron" },
			{
				status: resourceExhausted ? 503 : providerError.status ?? 500,
				headers: resourceExhausted ? { "Retry-After": "3" } : undefined,
			},
		);
	}
}