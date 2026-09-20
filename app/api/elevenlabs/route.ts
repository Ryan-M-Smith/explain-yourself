//
// Filename: phaser-game.tsx
// Route: /api/elevenlabs
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	const { voiceId, text } = await request.json();

	const elevenlabs = new ElevenLabsClient({
		apiKey: process.env.ELEVENLABS_API_KEY ?? "",
	});

	const audio = await elevenlabs.textToSpeech.convert(voiceId, {
		text,
		modelId: "eleven_flash_v2_5",
		outputFormat: "mp3_44100_128",
		optimizeStreamingLatency: 0
	});

	return new Response(audio, {
		headers: {
			"Content-Type": "audio/mpeg",
			"Cache-Control": "no-store",
		},
	});
}