//
// Filename: phaser-game.tsx
// Description: React Phaser game component
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

"use client";

import { useEffect, useRef } from "react";
import { createPhaserGame } from "@/lib/phaser/config";

export default function PhaserGame() {
	const gameRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!gameRef.current) {
			return;
		}

		const game = createPhaserGame(gameRef.current);

		return () => {
			game.destroy(true);
		};
	}, []);

	return (
		<>
			<div ref={gameRef}/>
		</>
	);
}