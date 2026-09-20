/**
 * Explain Yourself — presentation-only ending screen.
 * Import ending-screen.css once in the app's client/global stylesheet entry.
 * This file has no Phaser/React dependency and is safe to import during SSR.
 */
export type EndingOutcome = "win" | "loss" | "timeout";

export interface EndingScreenData {
  /** Identifies the completed round, not the next round. */
  sessionId: string;
  scenarioId: string;
  /** Authoritative result from the existing game engine. Never inferred here. */
  outcome: EndingOutcome;
  /** Display units are 0–100. Convert a 0–1 engine value exactly once upstream. */
  approvalPercent: number;
  timeRemainingSeconds: number;
  scenarioTitle: string;
  locationName: string;
  npcName: string;
  /** Optional scenario-specific outcome, supplied by the game. */
  outcomeSummary?: string;
  /** Use an actual evaluation reason, not a new post-game guess. */
  feedbackReason?: string;
  nextAttemptTip?: string;
  /** Already-approved final dialogue. The component does not generate/play audio. */
  finalNpcLine?: string;
  /** Supply the current scene/NPC images, including a runtime-generated NPC. */
  backgroundUrl?: string;
  portraitUrl?: string;
  /** Last resort if portraitUrl fails. Omit if no identity-consistent fallback exists. */
  fallbackPortraitUrl?: string;
}

export interface EndingActionContext {
  readonly sessionId: string;
  readonly scenarioId: string;
  /** Advisory cancellation; the caller must also check its current round identity. */
  readonly signal: AbortSignal;
}

export interface EndingScreenActions {
  /** Preserve NPC, scenario, traits, initial score, and art; reset round state. */
  onRetrySameScenario: (context: EndingActionContext) => void | Promise<void>;
  /** Generate a new setup. Context IDs identify the round being left. */
  onNewScenario: (context: EndingActionContext) => void | Promise<void>;
}

export interface EndingScreenHandle {
  readonly element: HTMLElement;
  /** Safe to call repeatedly. Cancels pending UI work, not the host/game scene. */
  destroy(): void;
}

let sequence = 0;
const mounted = new WeakMap<HTMLElement, EndingScreenHandle>();
const validOutcomes: readonly string[] = ["win", "loss", "timeout"];

function snapshotData(input: EndingScreenData): Readonly<EndingScreenData> {
  if (!input || !validOutcomes.includes(input.outcome)) throw new Error("Invalid ending outcome.");
  for (const key of ["sessionId", "scenarioId", "scenarioTitle", "locationName", "npcName"] as const) {
    if (typeof input[key] !== "string" || !input[key].trim()) throw new Error(`Missing ending field: ${key}.`);
  }
  if (!Number.isFinite(input.approvalPercent) || input.approvalPercent < 0 || input.approvalPercent > 100) {
    throw new Error("approvalPercent must be a finite number from 0 to 100.");
  }
  if (!Number.isFinite(input.timeRemainingSeconds) || input.timeRemainingSeconds < 0) {
    throw new Error("timeRemainingSeconds must be finite and nonnegative.");
  }
  for (const key of ["outcomeSummary", "feedbackReason", "nextAttemptTip", "finalNpcLine", "backgroundUrl", "portraitUrl", "fallbackPortraitUrl"] as const) {
    if (input[key] !== undefined && typeof input[key] !== "string") throw new Error(`Invalid ending field: ${key}.`);
  }
  return Object.freeze({ ...input });
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60).toString().padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}

/**
 * The host must be a positioned game wrapper (e.g. position:relative;
 * aspect-ratio:16/9). Call only in browser code, after the engine ends the round.
 * Mounting a second screen in the same host disposes the previous screen only.
 */
export function mountEndingScreen(
  host: HTMLElement,
  input: EndingScreenData,
  actions: EndingScreenActions,
): EndingScreenHandle {
  const data = snapshotData(input);
  if (!host?.ownerDocument || !host.isConnected) throw new Error("Ending screen needs a connected DOM host.");
  if (typeof actions?.onRetrySameScenario !== "function" || typeof actions?.onNewScenario !== "function") {
    throw new Error("Both ending action callbacks are required.");
  }
  // Snapshot callbacks too: parent mutation must not change an in-flight action.
  const retryAction = actions.onRetrySameScenario;
  const newAction = actions.onNewScenario;
  mounted.get(host)?.destroy();
  const doc = host.ownerDocument;
  const previousFocus = doc.activeElement as HTMLElement | null;
  const id = `ey-ending-${++sequence}`;
  const disposers: Array<() => void> = [];
  let destroyed = false;
  let busy = false;
  let requestId = 0;
  let activeAction: AbortController | null = null;

  function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const element = doc.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function listen(target: EventTarget, name: string, callback: EventListener): void {
    target.addEventListener(name, callback);
    disposers.push(() => target.removeEventListener(name, callback));
  }
  function image(url: string | undefined, className: string, fallback?: string): HTMLImageElement | null {
    if (!url) return null;
    const img = node("img", className);
    img.alt = ""; // Decorative; result and speaker are available as text.
    img.draggable = false;
    let fallbackUsed = false;
    listen(img, "error", () => {
      if (destroyed) return;
      if (fallback && !fallbackUsed && fallback !== url) { fallbackUsed = true; img.src = fallback; }
      else img.hidden = true; // Preserve usable UI even when every image fails.
    });
    img.src = url;
    return img;
  }
  const root = node("section", `ey-ending-screen ey-ending--${data.outcome}`);
  root.dataset.sessionId = data.sessionId;
  root.setAttribute("role", "region");
  root.setAttribute("aria-labelledby", `${id}-title`);
  root.tabIndex = -1;
  const art = node("div", "ey-ending-art");
  const background = image(data.backgroundUrl, "ey-ending-background");
  if (background) art.append(background);
  art.append(node("div", "ey-ending-shade"));
  const portrait = image(data.portraitUrl, "ey-ending-portrait", data.fallbackPortraitUrl);
  if (portrait) art.append(portrait);
  art.append(node("div", "ey-ending-floor"));
  root.append(art);
  const header = node("header", "ey-ending-masthead");
  header.append(node("span", "ey-ending-brand", "EXPLAIN YOURSELF."), node("span", "ey-ending-location", data.locationName));
  root.append(header);

  const panel = node("div", "ey-ending-panel");
  const kicker = node("p", "ey-ending-kicker", data.outcome === "win" ? "PERSUASION SUCCESSFUL" : data.outcome === "loss" ? "REQUEST DECLINED" : "TIME LIMIT REACHED");
  const title = node("h2", "ey-ending-title", data.outcome === "win" ? "YOU WON THEM OVER." : data.outcome === "loss" ? "NOT THIS TIME." : "TIME’S UP.");
  title.id = `${id}-title`;
  const summary = data.outcomeSummary?.trim() || (data.outcome === "win" ? "You secured approval." : data.outcome === "loss" ? "Your request was declined." : "Time ran out before you secured approval.");
  panel.append(kicker, title, node("p", "ey-ending-summary", summary));
  const stats = node("dl", "ey-ending-stats");
  const scoreText = `${Math.round(data.approvalPercent * 10) / 10}%`;
  for (const [label, value] of [["FINAL APPROVAL", scoreText], ["TIME REMAINING", formatTime(data.timeRemainingSeconds)], ["SCENARIO", data.scenarioTitle]]) {
    const group = node("div", "ey-ending-stat");
    group.append(node("dt", "", label), node("dd", "", value)); stats.append(group);
  }
  panel.append(stats);
  // Missing feedback stays absent. No invented concern, accusation, or strategy.
  if (data.feedbackReason?.trim() || data.nextAttemptTip?.trim()) {
    const feedback = node("div", "ey-ending-feedback");
    if (data.feedbackReason?.trim()) {
      feedback.append(node("h3", "", data.outcome === "win" ? "WHAT WORKED" : data.outcome === "loss" ? "WHAT HELD YOU BACK" : "WHAT HAPPENED"), node("p", "", data.feedbackReason));
    }
    if (data.nextAttemptTip?.trim()) {
      const tip = node("p", "ey-ending-tip");
      tip.append(node("strong", "", "Try next time: "), doc.createTextNode(data.nextAttemptTip)); feedback.append(tip);
    }
    panel.append(feedback);
  }
  const controls = node("div", "ey-ending-actions");
  const retryLabel = data.outcome === "win" ? "Play Again" : "Try Again";
  const retry = node("button", "ey-ending-primary", retryLabel);
  const next = node("button", "ey-ending-secondary", "New Scenario");
  retry.type = "button"; next.type = "button";
  controls.append(retry, next);
  const note = node("p", "ey-ending-note", `${retryLabel} keeps this character and scenario.`);
  const status = node("p", "ey-ending-action-status");
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.setAttribute("aria-atomic", "true");
  panel.append(controls, note, status);
  root.append(panel);
  if (data.finalNpcLine?.trim()) {
    const dialogue = node("aside", "ey-ending-dialogue");
    dialogue.append(node("p", "ey-ending-speaker", data.npcName), node("blockquote", "", data.finalNpcLine));
    root.append(dialogue);
  }

  function setBusy(value: boolean): void {
    busy = value;
    retry.disabled = value; next.disabled = value;
    controls.setAttribute("aria-busy", String(value));
  }
  async function runAction(kind: "retry" | "new"): Promise<void> {
    if (destroyed || busy) return;
    setBusy(true);
    const currentRequest = ++requestId;
    const controller = new AbortController();
    activeAction = controller;
    const context = Object.freeze({ sessionId: data.sessionId, scenarioId: data.scenarioId, signal: controller.signal });
    status.textContent = kind === "retry" ? "Starting the same scenario…" : "Preparing a new scenario…";
    try {
      await (kind === "retry" ? retryAction : newAction)(context);
      if (destroyed || currentRequest !== requestId) return;
      // Do not abort successful game work when removing its old UI.
      activeAction = null;
      destroy();
    } catch {
      if (destroyed || currentRequest !== requestId) return;
      activeAction = null;
      setBusy(false);
      status.textContent = "Couldn’t start the next round. Please try again.";
    }
  }
  listen(retry, "click", () => { void runAction("retry"); });
  listen(next, "click", () => { void runAction("new"); });
  function destroy(): void {
    if (destroyed) return;
    const ownsFocus = root.contains(doc.activeElement);
    destroyed = true;
    requestId += 1;
    const actionToCancel = activeAction;
    activeAction = null;
    disposers.forEach(dispose => dispose());
    root.remove(); // Never replace/empty the host or remove another screen.
    if (mounted.get(host)?.element === root) mounted.delete(host);
    if (ownsFocus && previousFocus?.isConnected && typeof previousFocus.focus === "function") previousFocus.focus({ preventScroll: true });
    // Abort listeners run synchronously and may mount/focus replacement UI.
    // Complete our own cleanup first so their new focus/content wins.
    actionToCancel?.abort();
  }
  const handle: EndingScreenHandle = Object.freeze({ element: root, destroy });
  mounted.set(host, handle);
  host.append(root);
  root.focus({ preventScroll: true });
  return handle;
}
