import Phaser from "phaser";
import { mountEndingScreen, type EndingScreenData, type EndingScreenHandle } from "@/lib/ui/endings/ending-screen";
import type { GameScene } from "./game-scene";

export class EndScene extends Phaser.Scene {
	private endingUI?: EndingScreenHandle;
	private shownSessionId?: string;

	constructor() {
		super("EndScene");
	}

	create() {
		this.game.events.on("ending-ready", this.showEnd, this);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyEnd, this);
		this.events.once(Phaser.Scenes.Events.DESTROY, this.destroyEnd, this);

		const snapshot = (this.scene.get("GameScene") as GameScene).getEndingSnapshot();
		if (snapshot) {
			this.showEnd(snapshot);
		}
	}

	private showEnd(snapshot: Readonly<EndingScreenData>) {
		if (snapshot.sessionId === this.shownSessionId) {
			return;
		}

		const host = this.game.canvas.parentElement;
		if (!host) {
			return;
		}

		const controller = this.scene.get("GameScene") as GameScene;
		this.endingUI?.destroy();
		this.endingUI = mountEndingScreen(host, snapshot, {
			onRetrySameScenario: (context) => controller.restartRound("retry", context),
			onNewScenario: (context) => controller.restartRound("new", context),
		});
		this.shownSessionId = snapshot.sessionId;
	}

	private destroyEnd() {
		this.game.events.off("ending-ready", this.showEnd, this);
		this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroyEnd, this);
		this.events.off(Phaser.Scenes.Events.DESTROY, this.destroyEnd, this);
		this.endingUI?.destroy();
		this.endingUI = undefined;
		this.shownSessionId = undefined;
	}
}
