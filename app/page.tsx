//
// Filename: page.tsx
// Route: /
// Copyright (c) 2026 Team Vibes
// Authors: Ethan Gao, Nathan Smith, Ryan Smith, and Tianyi Wang
//

import PhaserGameLoader from "@/components/phaser-game-loader";

export default function Home() {
	return (
		<div className="flex flex-col justify-center items-center min-h-screen font-sans dark:bg-black">
			<main className="w-screen h-screen">
				<PhaserGameLoader/>
			</main>
		</div>
	);
}
