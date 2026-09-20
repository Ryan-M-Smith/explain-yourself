# Explain Yourself — ending screen handoff

Status: independent integration component, not a patch against the team's current local checkout. The current local game source was not available for this handoff. Existing gameplay, score calculation, model prompts, microphone control, and routing remain owned by the game.

## Files and proposed locations

| File | Suggested project location |
| --- | --- |
| `ending-screen.ts` | `lib/ui/endings/ending-screen.ts` |
| `ending-screen.css` | `lib/ui/endings/ending-screen.css` |
| This guide | `art-working/handoff/ending-integration-guide.md` |
| `ending-component-demo.html` | `art-working/previews/ending-component-demo.html` |

The component uses standard browser DOM APIs and TypeScript. It has no React or Phaser import and introduces no runtime package dependency. It can be called from the client-side Phaser integration already used by the project. All visible UI text is English.

## 1. Register the stylesheet and choose the host

Import the stylesheet once from the existing app stylesheet/layout entry supported by your Next.js setup:

```ts
import "@/lib/ui/endings/ending-screen.css";
```

Use the existing DOM wrapper around the game canvas as `gameHost`. The wrapper must be positioned and have dimensions, for example:

```css
.game-host {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
}
```

Mount once per completed round, on the browser side. Do not append DOM elements inside the `<canvas>` itself. Do not insert a second independent 16:9 game next to the existing game. If the wrapper contains other overlays, coordinate their stacking order (this component uses z-index 50).

The component is a labeled region, not a global modal dialog. It focuses itself on mount. The game must already have stopped gameplay input, including any global space-to-record handler; DOM focus alone does not disable Phaser or microphone listeners.

## 2. Feed the authoritative result into the display

The exported `EndingScreenData` is the contract. Map your current game fields to it in one adapter. The field names below describe this new UI contract, not fields verified to exist in your current engine.

```ts
import {
  mountEndingScreen,
  type EndingScreenData,
  type EndingScreenActions,
  type EndingScreenHandle,
} from "@/lib/ui/endings/ending-screen";

// Define these in your existing client/game integration:
// gameHost: the positioned HTMLElement around the Phaser canvas
// result: an EndingScreenData snapshot built from the completed round
// actions: callbacks into your actual round/session controller

let endingUI: EndingScreenHandle | undefined;

function presentEnding(
  gameHost: HTMLElement,
  result: EndingScreenData,
  actions: EndingScreenActions,
) {
  endingUI?.destroy();
  endingUI = mountEndingScreen(gameHost, result, actions);
}

function disposeEnding() {
  endingUI?.destroy();
  endingUI = undefined;
}
```

Call `disposeEnding()` when the owning game view unmounts or the relevant scene lifecycle ends. Choose ownership carefully: do not destroy the screen immediately by mounting it in a scene that you stop in the same operation. A persistent UI owner or a dedicated ending scene is suitable.

### Required result fields

| Field | Meaning |
| --- | --- |
| `sessionId` | Unique ID of the completed round. A retry receives a new round ID. |
| `scenarioId` | ID of the scenario/setup that was played. |
| `outcome` | `"win"`, `"loss"`, or `"timeout"`, decided upstream. |
| `approvalPercent` | Finite display value between 0 and 100. |
| `timeRemainingSeconds` | Finite nonnegative number in seconds. |
| `scenarioTitle` | Player-facing scenario title. |
| `locationName` | Location name, e.g. Club or Museum. |
| `npcName` | The NPC's current name or occupation. |

If the engine stores approval on 0–1, multiply by 100 once in the adapter. If it already uses 0–100, pass it directly. `83` means 83%; `0.83` means 0.83% in this contract. Do not infer units from the number itself.

Optional fields: `outcomeSummary`, `feedbackReason`, `nextAttemptTip`, `finalNpcLine`, `backgroundUrl`, `portraitUrl`, `fallbackPortraitUrl`. Missing specific feedback stays absent. Generic outcome text is used if no outcome summary is available. The screen does not invent contradictions, unresolved concerns, or quoted dialogue.

This layer **does not decide whether a player wins**. The proposed upstream win rule remains:

```text
Win = (S >= 95) OR (80 <= S < 95 AND AI approves)
```

The same win presentation covers an approved 83% and an automatic win at 95%. A score below 80 is not automatically a loss. Use the agreed loss/time rules in the existing engine. Technical/API failures must stay outside this game-outcome contract.

## 3. Connect the two buttons

Supply both callbacks:

```ts
const actions: EndingScreenActions = {
  onRetrySameScenario: async ({ sessionId, scenarioId, signal }) => {
    // Connect your real round controller here.
    // 1. Confirm sessionId is still the completed round being replaced.
    // 2. Stop old audio/mic/timers and invalidate old model requests.
    // 3. Keep the setup identified by scenarioId: NPC, attributes, art,
    //    initial approval, scenario facts, and initial time limit.
    // 4. Clear dialogue, claims, turn IDs, score deltas, and verdict flags.
    // 5. Start a fresh round with a NEW sessionId.
    // After each await, check signal.aborted and the controller's session ID.
    // Resolve only when the new round has actually started.
    // Throw on failure so the ending screen offers another attempt.
    throw new Error("Wire this callback to the real round controller.");
  },
  onNewScenario: async ({ sessionId, scenarioId, signal }) => {
    // Context IDs refer to the OLD round/setup, not the next one.
    // Prepare the new scenario using the game's existing generation flow.
    // Check cancellation and round identity before committing the result.
    // Start the new round with a NEW sessionId, then resolve.
    throw new Error("Wire this callback to the real scenario controller.");
  },
};
```

The callbacks intentionally fail until connected, so copying the example cannot silently pretend to restart a game. `AbortSignal` is advisory: pass it to supported requests and check it before committing results. Cancellation cannot undo game state changes already applied by a callback; the controller must prevent partial commits or recover from them.

While one callback runs, both buttons are disabled. On success, the old ending UI removes itself without deleting the host or replacement content. On failure, it keeps the result visible, re-enables the buttons, and shows an English retry message. Destroying the UI aborts its pending action signal and ignores late UI continuations. It restores previous focus only if focus still belongs to the ending screen.

## 4. Reuse the same screen across all ten themes

Pass the current scenario's display name, background, and current NPC portrait. Select the supplied NPC's `pleased` portrait for wins and `stern` for losses, with a neutral portrait for timeout if appropriate. If the current character was generated at runtime, pass that character's own expression URL; do not replace them with an unrelated premade character at the end.

The following are display labels, not hardcoded path mappings:

| Occupation | Location |
| --- | --- |
| Bouncer | Club |
| Angel Investor | Tech Lounge |
| Night Guard | Museum |
| Professor | University |
| Hotel Clerk | Hotel Lobby |
| Guard Soldier | Military Base |
| Landlord | Apartment Office |
| Interrogator | Police Station |
| Job Interviewer | Corporate Office |
| Waiter | Restaurant |

The existing portraits are full 16:9 transparent canvases; this stylesheet positions them on the right. Portraits with a different aspect ratio or character anchor need a deliberate CSS adjustment in your integration. Image URLs may be deployed asset URLs, data URLs, or live blob URLs owned by the game. Keep blob URLs valid while the ending uses them; the component does not revoke URLs it does not own.

If an image fails, the text and buttons remain usable against the dark background. An optional portrait fallback should preserve identity whenever possible. No new background or character artwork is required for this handoff.

## 5. End-of-round sequence

1. The engine commits one final result and marks the round ended.
2. Freeze scoring, the timer, and recording input. Ignore late responses from older turns/rounds.
3. Present the ending using that immutable result. Play an approved final NPC line through the existing audio controller if available. Display must not depend indefinitely on audio success.
4. A restart cancels old media/requests and creates a new session as described above.

Do not infer victory from a smiling portrait or from the word “yes” in free text. The ending receives the engine's structured result. If the AI/engine returns a specific explanation, store it with the final evaluation so the feedback corresponds to what actually happened.

## Validation and acceptance

Strict standalone TypeScript checking and 15 behavioral DOM checks passed. Checks cover authoritative result display, omitted feedback, literal text, duplicate-click protection, restart failure/retry, original round identifiers, cancellation/late responses, same-host replacement, immutable snapshots, validation, image fallback, and focus ownership. The tests use Linkedom; focus is modeled with a shim, not verified in a browser.

Open `ending-component-demo.html` locally to run this exact component with the approved Club assets, preset outcomes, and simulated restart callbacks. It embeds the compiled component and all images; no build or API key is needed. The failure checkbox tests the retry UI. This is separate from the older visual-only preview.

This standalone component is supplied for integration review. Current-project build, actual game events, AI responses, browser visuals, and real audio cleanup must be checked in the team's local checkout. Browser rendering is restricted in the preparation environment.

After integration, verify a win, loss, and timeout; same-setup retry and new scenario; repeated rapid clicks; rejected restart; restarting while an old model request is pending; shutdown/unmount; long feedback; and a runtime-generated NPC image. Confirm that an API/network error does not display a defeat.

The existing `club-ending-preview.html` and two PNG concepts remain the visual references; they are not production result data.

## References

- Phaser scene lifecycle and reset pitfalls: https://docs.phaser.io/phaser/concepts/scenes
- React Effect cleanup, if the game wrapper is React-owned: https://react.dev/reference/react/useEffect
- Cornell game development playtesting lecture (scope the check to the behavior under review): https://www.cs.cornell.edu/courses/cs3152/2025sp/lectures/lecture24/slides-24.pdf
