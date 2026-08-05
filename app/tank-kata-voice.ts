import type { OstPlayer } from "./music-engine";
import { TANK_KATA_CUES, TANK_KATA_POLICY } from "./tank-kata-policy.mjs";

export type TankKataCue = keyof typeof TANK_KATA_CUES;
type CueDefinition = (typeof TANK_KATA_CUES)[TankKataCue];
type CaptionSink = (caption: string, seconds: number) => void;

type PendingCue = {
  key: TankKataCue;
  definition: CueDefinition;
  requestedAt: number;
};

/**
 * Regnet's single-voice tactical conductor. Meaningful state changes may speak;
 * routine combat may not. Urgent doctrine preempts lesser calls while all
 * other delivery waits only a bounded distance to the next OST pulse.
 */
export class TankKataVoiceConductor {
  private readonly audio: HTMLAudioElement;
  private readonly pending: PendingCue[] = [];
  private readonly lastPlayed = new Map<TankKataCue, number>();
  private current: PendingCue | null = null;
  private enabled = true;
  private scheduleTimer = 0;

  constructor(
    private readonly music: OstPlayer,
    private readonly publishCaption: CaptionSink,
  ) {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.playsInline = true;
    this.audio.addEventListener("ended", () => this.finishCurrent());
    this.audio.addEventListener("error", () => this.finishCurrent());

    for (const cue of Object.values(TANK_KATA_CUES)) {
      const preload = new Audio();
      preload.preload = "auto";
      preload.src = cue.file;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.audio.muted = !enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  async unlock() {
    const cue = TANK_KATA_CUES["force-enters"];
    this.audio.src = cue.file;
    this.audio.muted = true;
    await this.audio.play().then(() => {
      this.audio.pause();
      this.audio.currentTime = 0;
    }).catch(() => undefined);
    this.audio.muted = !this.enabled;
  }

  resetForRun() {
    window.clearTimeout(this.scheduleTimer);
    this.audio.pause();
    this.audio.currentTime = 0;
    this.pending.length = 0;
    this.current = null;
  }

  trigger(key: TankKataCue) {
    const definition = TANK_KATA_CUES[key];
    const now = performance.now();
    const lastPlayed = this.lastPlayed.get(key) ?? Number.NEGATIVE_INFINITY;
    if (now - lastPlayed < definition.cooldownMs) return false;
    if (this.current?.key === key || this.pending.some((cue) => cue.key === key)) {
      return false;
    }

    const requested = { key, definition, requestedAt: now };
    const canPreempt =
      definition.urgent &&
      this.current &&
      definition.priority >=
        this.current.definition.priority + TANK_KATA_POLICY.preemptPriorityDelta;
    if (canPreempt) {
      this.cancelCurrent();
      this.current = requested;
      this.schedule(requested);
      return true;
    }

    this.pending.push(requested);
    this.pending.sort(
      (a, b) =>
        b.definition.priority - a.definition.priority ||
        a.requestedAt - b.requestedAt,
    );
    this.pump();
    return true;
  }

  surrenderAudioFocus() {
    window.clearTimeout(this.scheduleTimer);
    this.audio.pause();
  }

  reclaimAudioFocus() {
    if (this.current && this.audio.src) {
      void this.audio.play().catch(() => undefined);
    } else {
      this.pump();
    }
  }

  stop() {
    window.clearTimeout(this.scheduleTimer);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.pending.length = 0;
    this.current = null;
  }

  private pump() {
    if (this.current || this.pending.length === 0) return;
    const next = this.pending.shift() ?? null;
    if (!next) return;
    this.current = next;
    this.schedule(next);
  }

  private schedule(cue: PendingCue) {
    const delayMs = cue.definition.urgent
      ? 0
      : this.music.nextPulseDelayMs(TANK_KATA_POLICY.maxSyncDelayMs);
    window.clearTimeout(this.scheduleTimer);
    this.scheduleTimer = window.setTimeout(() => this.play(cue), delayMs);
  }

  private play(cue: PendingCue) {
    if (this.current !== cue) return;
    this.lastPlayed.set(cue.key, performance.now());
    this.publishCaption(cue.definition.caption, cue.definition.durationSeconds + 0.45);

    if (!this.enabled) {
      this.finishCurrent();
      return;
    }

    this.audio.src = cue.definition.file;
    this.audio.currentTime = 0;
    this.audio.muted = false;
    this.music.duckForVoice(
      cue.definition.durationSeconds * 1000 + TANK_KATA_POLICY.voiceDuckTailMs,
    );
    void this.audio.play().catch(() => this.finishCurrent());
  }

  private cancelCurrent() {
    window.clearTimeout(this.scheduleTimer);
    this.audio.pause();
    this.audio.currentTime = 0;
    this.current = null;
  }

  private finishCurrent() {
    window.clearTimeout(this.scheduleTimer);
    this.current = null;
    this.pump();
  }
}
