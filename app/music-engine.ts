const OST_TRACKS = [
  "/ost/iron-bellows.mp3",
  "/ost/iron-bellows-ii.mp3",
  "/ost/bellows-grit.mp3",
  "/ost/bellows-breach.mp3",
  "/ost/bellows-breach-ii.mp3",
  "/ost/ruptured-bellows.mp3",
  "/ost/ruptured-bellows-ii.mp3",
] as const;

const CROSSFADE_SECONDS = 6;
const MUSIC_VOLUME = 0.26;

const randomUnit = () => {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] / 0x1_0000_0000;
  }
  return Math.random();
};

/**
 * One persistent, streaming OST player for the whole client session. Gameplay
 * may replace runs and screens; it never replaces this player or its timeline.
 */
export class OstPlayer {
  private readonly decks: [HTMLAudioElement, HTMLAudioElement];
  private activeDeck = 0;
  private currentTrack = -1;
  private queuedTrack = -1;
  private bag: number[] = [];
  private enabled = true;
  private started = false;
  private crossfading = false;
  private crossfadeFrame = 0;
  private monitor = 0;
  private focusResumeTime = 0;

  constructor() {
    const makeDeck = () => {
      const deck = new Audio();
      deck.preload = "auto";
      deck.loop = false;
      deck.playsInline = true;
      return deck;
    };
    this.decks = [makeDeck(), makeDeck()];
    this.decks.forEach((deck, index) => {
      deck.addEventListener("ended", () => {
        if (index === this.activeDeck && !this.crossfading) {
          void this.beginCrossfade(true);
        }
      });
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.started) return;
    const active = this.decks[this.activeDeck];
    const inactive = this.decks[1 - this.activeDeck];
    if (!this.crossfading) {
      active.volume = enabled ? MUSIC_VOLUME : 0;
      inactive.volume = 0;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async start() {
    if (this.started) {
      const active = this.decks[this.activeDeck];
      if (active.paused) await active.play().catch(() => undefined);
      return;
    }

    this.started = true;
    this.currentTrack = this.takeTrack();
    const active = this.decks[this.activeDeck];
    active.src = OST_TRACKS[this.currentTrack];
    active.volume = this.enabled ? MUSIC_VOLUME : 0;
    this.primeNextDeck();

    // Both streaming decks are unlocked by the first gameplay gesture. The
    // quiet deck is immediately rewound, ready for later autonomous crossfades.
    const inactive = this.decks[1 - this.activeDeck];
    const activePlay = active.play();
    void inactive.play().then(() => {
      inactive.pause();
      inactive.currentTime = 0;
    }).catch(() => undefined);
    await activePlay.catch(() => undefined);

    this.monitor = window.setInterval(() => this.tick(), 250);
  }

  /**
   * Stop being an Android media candidate when the game leaves the foreground.
   * Muting is insufficient: a silent, still-playing HTMLAudioElement can retain
   * the headset transport controls. Detaching the decks lets the previous
   * native player (for example Spotify) reclaim those controls.
   */
  surrenderAudioFocus() {
    if (!this.started) return;
    if (this.crossfading) {
      cancelAnimationFrame(this.crossfadeFrame);
      this.crossfading = false;
    }
    const active = this.decks[this.activeDeck];
    this.focusResumeTime = active.currentTime || 0;
    this.decks.forEach((deck) => {
      deck.pause();
      deck.removeAttribute("src");
      deck.load();
    });
    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
        for (const action of [
          "play",
          "pause",
          "stop",
          "seekbackward",
          "seekforward",
          "seekto",
          "previoustrack",
          "nexttrack",
        ] as MediaSessionAction[]) {
          navigator.mediaSession.setActionHandler(action, null);
        }
      }
    } catch {}
  }

  async reclaimAudioFocus() {
    if (!this.started || this.currentTrack < 0) return;
    const active = this.decks[this.activeDeck];
    active.src = OST_TRACKS[this.currentTrack];
    active.currentTime = this.focusResumeTime;
    active.volume = this.enabled ? MUSIC_VOLUME : 0;
    const inactive = this.decks[1 - this.activeDeck];
    inactive.src = OST_TRACKS[this.queuedTrack];
    inactive.currentTime = 0;
    inactive.volume = 0;
    await active.play().catch(() => undefined);
  }

  private refillBag() {
    const nextBag = OST_TRACKS.map((_, index) => index);
    for (let index = nextBag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(randomUnit() * (index + 1));
      [nextBag[index], nextBag[swap]] = [nextBag[swap], nextBag[index]];
    }
    if (nextBag.length > 1 && nextBag[0] === this.currentTrack) {
      [nextBag[0], nextBag[1]] = [nextBag[1], nextBag[0]];
    }
    this.bag = nextBag;
  }

  private takeTrack() {
    if (this.bag.length === 0) this.refillBag();
    return this.bag.shift() ?? 0;
  }

  private primeNextDeck() {
    this.queuedTrack = this.takeTrack();
    const inactive = this.decks[1 - this.activeDeck];
    inactive.src = OST_TRACKS[this.queuedTrack];
    inactive.currentTime = 0;
    inactive.volume = 0;
    inactive.load();
  }

  private tick() {
    if (!this.started || this.crossfading) return;
    const active = this.decks[this.activeDeck];
    if (!Number.isFinite(active.duration) || active.duration <= 0) return;
    if (active.duration - active.currentTime <= CROSSFADE_SECONDS) {
      void this.beginCrossfade(false);
    }
  }

  private async beginCrossfade(fromEnded: boolean) {
    if (this.crossfading || this.queuedTrack < 0) return;
    this.crossfading = true;
    const outgoing = this.decks[this.activeDeck];
    const incoming = this.decks[1 - this.activeDeck];
    incoming.volume = 0;
    await incoming.play().catch(() => undefined);

    const durationMs = fromEnded ? 900 : CROSSFADE_SECONDS * 1000;
    const startedAt = performance.now();
    const fade = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const level = this.enabled ? MUSIC_VOLUME : 0;
      outgoing.volume = level * (1 - progress);
      incoming.volume = level * progress;
      if (progress < 1) {
        this.crossfadeFrame = requestAnimationFrame(fade);
        return;
      }

      outgoing.pause();
      outgoing.removeAttribute("src");
      outgoing.load();
      this.activeDeck = 1 - this.activeDeck;
      this.currentTrack = this.queuedTrack;
      this.queuedTrack = -1;
      this.crossfading = false;
      this.primeNextDeck();
    };
    this.crossfadeFrame = requestAnimationFrame(fade);
  }
}

let sessionPlayer: OstPlayer | null = null;

export const getOstPlayer = () => {
  sessionPlayer ??= new OstPlayer();
  return sessionPlayer;
};

export const OST_POLICY = {
  tracks: OST_TRACKS.length,
  shuffle: "full-bag-no-immediate-repeat",
  crossfadeSeconds: CROSSFADE_SECONDS,
  lifecycle: "session-persistent-across-runs-and-scenes",
} as const;
