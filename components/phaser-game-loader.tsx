//
// Filename: phaser-game-loader.tsx
// Description: React Phaser game lazy-loader
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

"use client";

import dynamic from "next/dynamic";

const PhaserGame = dynamic(() => import("./phaser-game"), {
	ssr: false,
});

export default function PhaserGameLoader() {
	return <PhaserGame/>;
}