// Renee speaks only when Ferravine's state or an authored event gives her cause.
// These are temporary casting candidates; the runtime contract is stable even when
// Drew replaces every performance after auditory review.
export const RENEE_CUES = Object.freeze({
  "wake": Object.freeze({
    id: "wake",
    text: "Easy, Vine. Renee's got you.",
    path: "./voice/renee/renee-wake-v1.wav",
    duration: 2.80,
    priority: 90,
    cooldown: 9999,
  }),
  "first-motion": Object.freeze({
    id: "first-motion",
    text: "Both treads are answering. Take the road gently.",
    path: "./voice/renee/renee-first-motion-v1.wav",
    duration: 3.52,
    priority: 35,
    cooldown: 9999,
  }),
  "combat-begins": Object.freeze({
    id: "combat-begins",
    text: "Head down. Ferravine remembers the road.",
    path: "./voice/renee/renee-combat-begins-v1.wav",
    duration: 3.12,
    priority: 65,
    cooldown: 45,
  }),
  "small-arms": Object.freeze({
    id: "small-arms",
    text: "Noise on the scutes. The war party is the body in danger.",
    path: "./voice/renee/renee-small-arms-v1.wav",
    duration: 4.16,
    priority: 25,
    cooldown: 24,
  }),
  "armor-bounce": Object.freeze({
    id: "armor-bounce",
    text: "Good girl. Let it glance.",
    path: "./voice/renee/renee-armor-bounce-v1.wav",
    duration: 2.48,
    priority: 30,
    cooldown: 20,
  }),
  "penetration": Object.freeze({
    id: "penetration",
    text: "Hold still, love. That one got inside.",
    path: "./voice/renee/renee-penetration-v1.wav",
    duration: 3.36,
    priority: 82,
    cooldown: 14,
  }),
  "front-wound": Object.freeze({
    id: "front-wound",
    text: "Front scutes are opening. Face the next shot somewhere else.",
    path: "./voice/renee/renee-front-wound-v1.wav",
    duration: 3.84,
    priority: 75,
    cooldown: 60,
  }),
  "left-tread-wound": Object.freeze({
    id: "left-tread-wound",
    text: "Left tread is hurting. Give her room.",
    path: "./voice/renee/renee-left-tread-wound-v1.wav",
    duration: 3.04,
    priority: 78,
    cooldown: 60,
  }),
  "right-tread-wound": Object.freeze({
    id: "right-tread-wound",
    text: "Right tread is hurting. Ease the turn.",
    path: "./voice/renee/renee-right-tread-wound-v1.wav",
    duration: 3.36,
    priority: 78,
    cooldown: 60,
  }),
  "core-critical": Object.freeze({
    id: "core-critical",
    text: "Stay with Renee, Vine. Keep the warm organs covered.",
    path: "./voice/renee/renee-core-critical-v1.wav",
    duration: 4.00,
    priority: 100,
    cooldown: 9999,
  }),
  "formation-separated": Object.freeze({
    id: "formation-separated",
    text: "Ferravine outran her people. Open them a road.",
    path: "./voice/renee/renee-formation-separated-v1.wav",
    duration: 3.04,
    priority: 88,
    cooldown: 30,
  }),
  "formation-reconnected": Object.freeze({
    id: "formation-reconnected",
    text: "There they are. One body again.",
    path: "./voice/renee/renee-formation-reconnected-v1.wav",
    duration: 2.80,
    priority: 70,
    cooldown: 30,
  }),
  "artillery-flare": Object.freeze({
    id: "artillery-flare",
    text: "Observer's calling the sky. Find the flare.",
    path: "./voice/renee/renee-artillery-flare-v1.wav",
    duration: 2.96,
    priority: 92,
    cooldown: 30,
  }),
  "artillery-incoming": Object.freeze({
    id: "artillery-incoming",
    text: "Incoming. Leave the beaten ground now.",
    path: "./voice/renee/renee-artillery-incoming-v1.wav",
    duration: 3.12,
    priority: 98,
    cooldown: 18,
  }),
  "nutrient-ready": Object.freeze({
    id: "nutrient-ready",
    text: "The field has fed her. Choose what she grows.",
    path: "./voice/renee/renee-nutrient-ready-v1.wav",
    duration: 3.76,
    priority: 55,
    cooldown: 20,
  }),
  "graft-complete": Object.freeze({
    id: "graft-complete",
    text: "There. Fed, sealed, and stranger.",
    path: "./voice/renee/renee-graft-complete-v1.wav",
    duration: 3.76,
    priority: 68,
    cooldown: 10,
  }),
  "offspring-born": Object.freeze({
    id: "offspring-born",
    text: "Two organs answered together. Something new is breathing.",
    path: "./voice/renee/renee-offspring-born-v1.wav",
    duration: 4.00,
    priority: 80,
    cooldown: 9999,
  }),
  "capture": Object.freeze({
    id: "capture",
    text: "Ground taken. Let her swallow, clot, and breathe.",
    path: "./voice/renee/renee-capture-v1.wav",
    duration: 4.16,
    priority: 62,
    cooldown: 10,
  }),
  "repair": Object.freeze({
    id: "repair",
    text: "Scar suits Ferravine better than a wound.",
    path: "./voice/renee/renee-repair-v1.wav",
    duration: 2.48,
    priority: 58,
    cooldown: 20,
  }),
  "suppression-high": Object.freeze({
    id: "suppression-high",
    text: "The chamber is loud. Read the danger, not the noise.",
    path: "./voice/renee/renee-suppression-high-v1.wav",
    duration: 4.16,
    priority: 72,
    cooldown: 28,
  }),
  "calm": Object.freeze({
    id: "calm",
    text: "Easy now. Listen to her settle.",
    path: "./voice/renee/renee-calm-v1.wav",
    duration: 2.56,
    priority: 40,
    cooldown: 35,
  }),
  "hull-death": Object.freeze({
    id: "hull-death",
    text: "Ferravine is quiet. Renee is still here.",
    path: "./voice/renee/renee-hull-death-v1.wav",
    duration: 3.20,
    priority: 110,
    cooldown: 9999,
  }),
  "party-death": Object.freeze({
    id: "party-death",
    text: "The spear went on without its body.",
    path: "./voice/renee/renee-party-death-v1.wav",
    duration: 2.32,
    priority: 110,
    cooldown: 9999,
  }),
  "maintenance-complete": Object.freeze({
    id: "maintenance-complete",
    text: "Two taps. Feed closed. Armor honest. Move.",
    path: "./voice/renee/renee-maintenance-complete-v1.wav",
    duration: 4.08,
    priority: 45,
    cooldown: 30,
  }),
  "care-intake": Object.freeze({
    id: "care-intake",
    text: "Easy, Vine. Renee's got it.",
    path: "./voice/renee/renee-care-intake-candidate-v1.wav",
    duration: 2.88,
    priority: 60,
    cooldown: 4,
  }),
  "care-fuel": Object.freeze({
    id: "care-fuel",
    text: "Slow mouthfuls. Taste it first.",
    path: "./voice/renee/renee-care-fuel-candidate-v1.wav",
    duration: 2.72,
    priority: 54,
    cooldown: 4,
  }),
  "care-contamination": Object.freeze({
    id: "care-contamination",
    text: "No. Spit that filth out.",
    path: "./voice/renee/renee-care-contamination-candidate-v1.wav",
    duration: 2.32,
    priority: 76,
    cooldown: 4,
  }),
  "care-full": Object.freeze({
    id: "care-full",
    text: "There. Fed, sealed, and beautiful.",
    path: "./voice/renee/renee-care-full-candidate-v1.wav",
    duration: 3.36,
    priority: 55,
    cooldown: 4,
  }),
  "care-damage": Object.freeze({
    id: "care-damage",
    text: "Hold still, love. This part may bite.",
    path: "./voice/renee/renee-care-damage-candidate-v1.wav",
    duration: 3.36,
    priority: 68,
    cooldown: 4,
  })
});

const RECENT_WINDOW = 3;
const GLOBAL_GAP = 1.15;

export class ReneeDirector {
  constructor(emit) {
    this.emit = emit;
    this.enabled = true;
    this.lastCueAt = new Map();
    this.recent = [];
    this.pending = null;
    this.previous = null;
    this.lastEmissionAt = -Infinity;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.pending = null;
  }

  reset() {
    this.lastCueAt.clear();
    this.recent = [];
    this.pending = null;
    this.previous = null;
    this.lastEmissionAt = -Infinity;
  }

  signal(id, now, force = false) {
    const cue = RENEE_CUES[id];
    if (!cue || !this.enabled) return false;
    const at = Number.isFinite(now) ? now : 0;
    const lastAt = this.lastCueAt.get(id) ?? -Infinity;
    if (!force && at - lastAt < cue.cooldown) return false;
    if (!force && this.recent.includes(id)) return false;
    if (!force && at - this.lastEmissionAt < GLOBAL_GAP) {
      if (!this.pending || cue.priority > this.pending.cue.priority) {
        this.pending = { cue, requestedAt: at };
      }
      return false;
    }
    return this.emitCue(cue, at);
  }

  flush(now) {
    if (!this.pending || !this.enabled) return false;
    const at = Number.isFinite(now) ? now : 0;
    if (at - this.lastEmissionAt < GLOBAL_GAP) return false;
    const { cue } = this.pending;
    this.pending = null;
    const lastAt = this.lastCueAt.get(cue.id) ?? -Infinity;
    if (at - lastAt < cue.cooldown || this.recent.includes(cue.id)) return false;
    return this.emitCue(cue, at);
  }

  sync(snapshot, now) {
    if (!snapshot || !this.enabled) return false;
    const previous = this.previous;
    this.previous = { ...snapshot };
    if (!previous) return this.flush(now);

    const candidates = [];
    if (Math.abs(snapshot.forwardVelocity) > 8 && Math.abs(previous.forwardVelocity) <= 8) candidates.push("first-motion");
    if (snapshot.suppression > 3 && previous.suppression <= 3) candidates.push("combat-begins");
    if (snapshot.core <= 32 && previous.core > 32) candidates.push("core-critical");
    if (snapshot.front <= 62 && previous.front > 62) candidates.push("front-wound");
    if (snapshot.leftTread <= 48 && previous.leftTread > 48) candidates.push("left-tread-wound");
    if (snapshot.rightTread <= 48 && previous.rightTread > 48) candidates.push("right-tread-wound");
    if (["separated", "overrun"].includes(snapshot.formationState) &&
        !["separated", "overrun"].includes(previous.formationState)) candidates.push("formation-separated");
    if (snapshot.formationState === "connected" &&
        ["separated", "overrun", "reconnecting"].includes(previous.formationState)) candidates.push("formation-reconnected");
    if (snapshot.suppression >= 70 && previous.suppression < 70) candidates.push("suppression-high");
    if (snapshot.suppression <= 18 && previous.suppression > 18) candidates.push("calm");

    candidates
      .map((id) => RENEE_CUES[id])
      .sort((a, b) => b.priority - a.priority)
      .forEach((cue) => this.signal(cue.id, now));
    return this.flush(now);
  }

  emitCue(cue, now) {
    this.lastCueAt.set(cue.id, now);
    this.lastEmissionAt = now;
    this.recent = [cue.id, ...this.recent.filter((id) => id !== cue.id)].slice(0, RECENT_WINDOW);
    this.emit(cue);
    return true;
  }
}

export const RENEE_POLICY = Object.freeze({
  cueCount: Object.keys(RENEE_CUES).length,
  triggerModel: "authored-events-and-state-transitions-only",
  randomChatter: false,
  semanticCaptions: true,
  voiceBus: "ReneeVoice",
  bodyBus: "FerravineBody",
  criticalBus: "CriticalCue",
  temporaryVoice: "Katie - Friendly Fixer",
  castingStatus: "candidate-unaccepted",
});
