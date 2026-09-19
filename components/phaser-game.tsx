//
// Filename: phaser-game.tsx
// Description: React Phaser game component
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

"use client";

import Phaser from "phaser";
import { useEffect, useRef } from "react";
import scene from "@/lib/phaser/scenes/scene";

export default function PhaserGame() {
	const gameRef = useRef<HTMLDivElement>(null);

	const createGame = ({ parent }: { parent: HTMLDivElement }) => new Phaser.Game({
		type: Phaser.AUTO,
		width: 1280,
		height: 720,
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		backgroundColor: "#999999",
		scene: scene,
		parent: parent
	});

	useEffect(() => {
		if (!gameRef.current) {
			return;
		}

		const game = createGame({ parent: gameRef.current });

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