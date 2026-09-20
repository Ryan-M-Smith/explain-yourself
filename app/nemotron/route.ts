//
// Filename: route.ts
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
								description: "Compatibility field: copy dialogueByOutcome.continue. It is a provisional response, never a final grant or rejection. The game selects the actual dialogue after resolving the score.",
							},

							dialogueByOutcome: {
								type: "object",
								description: "Four alternative in-character responses to the same turn, each 1-2 short sentences. These are mutually exclusive hypothetical branches, not four events that happened. Score the player only once. The game alone selects the branch after applying its rules. Never mention scores, schema fields, or branch names in the dialogue.",
								properties: {
									continue: {
										type: "string",
										description: "The request is still pending. React to what was said and ask a relevant follow-up. Do not grant the objective, imply permission (even with restrictions), promise success, or issue a final rejection. Approval has NOT been given.",
									},
									win: {
										type: "string",
										description: "Assume the game has definitively approved the player's objective. Explicitly grant that exact request now. Existing agreed limits may remain, but no new prerequisites, question, reversal, or further persuasion. Reflect the actual scenario and conversation.",
									},
									loss: {
										type: "string",
										description: "Assume a definitive rejection. Explicitly deny the player's objective and close this interaction. Do not grant access, offer conditional permission, invite another attempt this round, or invent a new incident/evidence/reason.",
									},
									timeout: {
										type: "string",
										description: "Assume the conversation has run out of time without approval. Explicitly leave the request unapproved and end the exchange. No permission, provisional grant, follow-up question, or claim that the player lied or was definitively rejected. Acknowledge time, not an invented failure reason.",
									},
								},
								required: ["continue", "win", "loss", "timeout"],
								additionalProperties: false,
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
								description: "Your decision on this one player turn. Use success only for explicit approval and failure for rejection; otherwise in_progress, can_succeed, or can_fail. This is a recommendation: the game applies its score thresholds before choosing the spoken dialogue. Generating a hypothetical win line is NOT approval.",
							},

							gameOver: {
								type: "boolean",
								description: "Whether your evaluated decision would close the interaction. This does not itself grant approval and generating terminal dialogue alternatives does not set it to true. The game owns the actual terminal result.",
							},
						},
						required: ["npcResponse", "dialogueByOutcome", "successDelta", "progress", "gameOver"],
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
