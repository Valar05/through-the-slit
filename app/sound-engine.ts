type FireKind =
  | "he"
  | "ap"
  | "bow"
  | "top"
  | "rib-mortar"
  | "tooth"
  | "trench-tooth"
  | "sapper"
  | "rifle"
  | "artillery"
  | "satchel"
  | "machine-gun"
  | "infantry"
  | "anti-armor"
  | "flanker"
  | "observer"
  | "carrier";

type ImpactKind =
  | "ap"
  | "he"
  | "artillery"
  | "crush"
  | "muzzle"
  | "needle"
  | "crown"
  | "cyst"
  | "tooth"
  | "choir"
  | "trench"
  | "toxic"
  | "dirt"
  | "rupture";

type ArmorFace = "front" | "left" | "right" | "rear";

type SampleKey =
  | "organic-concussion-a"
  | "organic-concussion-b"
  | "organic-concussion-c"
  | "rupture-wet-a"
  | "artillery-organic-a"
  | "graft-birth-a"
  | "membrane-shot-a"
  | "membrane-shot-b"
  | "membrane-shot-c"
  | "tendon-snap-a"
  | "scute-impact-a"
  | "rib-mortar-a"
  | "toxic-exhale-a"
  | "artillery-incoming-a"
  | "artillery-flare-a"
  | "ground-capture-a"
  | "death-collapse-a"
  | "wake-organ-a";

const SAMPLE_PATHS: Record<SampleKey, string> = {
  "organic-concussion-a": "/sfx/processed/organic-concussion-a.ogg",
  "organic-concussion-b": "/sfx/processed/organic-concussion-b.ogg",
  "organic-concussion-c": "/sfx/processed/organic-concussion-c.ogg",
  "rupture-wet-a": "/sfx/processed/rupture-wet-a.ogg",
  "artillery-organic-a": "/sfx/processed/artillery-organic-a.ogg",
  "graft-birth-a": "/sfx/processed/graft-birth-a.ogg",
  "membrane-shot-a": "/sfx/processed/membrane-shot-a.ogg",
  "membrane-shot-b": "/sfx/processed/membrane-shot-b.ogg",
  "membrane-shot-c": "/sfx/processed/membrane-shot-c.ogg",
  "tendon-snap-a": "/sfx/processed/tendon-snap-a.ogg",
  "scute-impact-a": "/sfx/processed/scute-impact-a.ogg",
  "rib-mortar-a": "/sfx/processed/rib-mortar-a.ogg",
  "toxic-exhale-a": "/sfx/processed/toxic-exhale-a.ogg",
  "artillery-incoming-a": "/sfx/processed/artillery-incoming-a.ogg",
  "artillery-flare-a": "/sfx/processed/artillery-flare-a.ogg",
  "ground-capture-a": "/sfx/processed/ground-capture-a.ogg",
  "death-collapse-a": "/sfx/processed/death-collapse-a.ogg",
  "wake-organ-a": "/sfx/processed/wake-organ-a.ogg",
};

const CONCUSSION_SAMPLES: SampleKey[] = [
  "organic-concussion-a",
  "organic-concussion-b",
  "organic-concussion-c",
];

const MEMBRANE_SAMPLES: SampleKey[] = [
  "membrane-shot-a",
  "membrane-shot-b",
  "membrane-shot-c",
];

type TreadState = {
  leftSpool: number;
  rightSpool: number;
  forwardVelocity: number;
  yawVelocity: number;
  core: number;
  leftTread: number;
  rightTread: number;
  suppression: number;
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/**
 * Hybrid recorded/designed Foley. Provenance-locked public-domain and CC0
 * donors provide contact, deformation, pressure, warnings, and state cues;
 * browser noise synthesis keeps continuous treads, spatial glue, and graceful
 * fallbacks without exposed oscillator tones.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private bed: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private enabled = true;
  private noiseBuffers = new Map<string, AudioBuffer>();
  private samples = new Map<SampleKey, AudioBuffer>();
  private sampleLoad: Promise<void> | null = null;
  private sampleSequence = 0;

  playSapperRescue(
    stage: "brace" | "contact" | "strain" | "success" | "overload" | "severed" | "casualty",
  ) {
    if (!this.allowed(`sapper-rescue:${stage}`, stage === "strain" ? 0.55 : 0.12)) return;
    if (stage === "brace") {
      this.playSample("ground-capture-a", { gain: 0.46, playbackRate: 0.82, lowpass: 1600 });
      this.noiseBurst({ duration: 0.32, gain: 0.24, lowpass: 720, color: "brown" });
      return;
    }
    if (stage === "contact") {
      this.playSample("graft-birth-a", { gain: 0.3, playbackRate: 0.9, lowpass: 2100 });
      this.playSample("tendon-snap-a", { gain: 0.2, playbackRate: 0.72, lowpass: 1700, delay: 0.08 });
      return;
    }
    if (stage === "strain") {
      this.playSample("wake-organ-a", { gain: 0.22, playbackRate: 0.78, lowpass: 1050 });
      this.noiseBurst({ duration: 0.42, gain: 0.16, lowpass: 560, color: "brown" });
      return;
    }
    if (stage === "success") {
      this.playSample("ground-capture-a", { gain: 0.58, playbackRate: 0.96, lowpass: 2400 });
      this.playSample("wake-organ-a", { gain: 0.24, playbackRate: 1.08, delay: 0.1 });
      return;
    }
    if (stage === "severed") {
      this.playSample("tendon-snap-a", { gain: 0.62, playbackRate: 0.86, lowpass: 2600 });
      this.playSample("rupture-wet-a", { gain: 0.36, playbackRate: 1.05, delay: 0.04 });
      return;
    }
    this.playSample(stage === "casualty" ? "death-collapse-a" : "rupture-wet-a", {
      gain: 0.5,
      playbackRate: stage === "casualty" ? 0.92 : 0.76,
      lowpass: 1800,
    });
  }
  private lastEvent = new Map<string, number>();
  private leftTreadGain: GainNode | null = null;
  private rightTreadGain: GainNode | null = null;
  private strainGain: GainNode | null = null;
  private started = false;
  private lastArtilleryCue = "";

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(enabled ? 0.72 : 0, this.context.currentTime, 0.025);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async start() {
    if (!this.context) this.buildGraph();
    if (!this.context) return;
    if (this.context.state === "suspended") await this.context.resume();
    await this.preloadSamples();
    if (!this.started) {
      this.started = true;
      this.startInteriorBed();
      this.playWake();
    }
  }

  stop() {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.035);
  }

  private buildGraph() {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor({ latencyHint: "interactive" });
    const master = context.createGain();
    const effects = context.createGain();
    const bed = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = this.enabled ? 0.72 : 0;
    effects.gain.value = 0.9;
    bed.gain.value = 0.56;
    compressor.threshold.value = -16;
    compressor.knee.value = 15;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    effects.connect(compressor);
    bed.connect(compressor);
    compressor.connect(master);
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.effects = effects;
    this.bed = bed;
    this.compressor = compressor;
  }

  private preloadSamples() {
    if (!this.context) return Promise.resolve();
    if (this.sampleLoad) return this.sampleLoad;
    const context = this.context;
    this.sampleLoad = Promise.all(
      (Object.entries(SAMPLE_PATHS) as [SampleKey, string][]).map(async ([key, path]) => {
        try {
          const response = await fetch(path);
          if (!response.ok) return;
          const encoded = await response.arrayBuffer();
          const decoded = await context.decodeAudioData(encoded);
          this.samples.set(key, decoded);
        } catch {
          // The procedural layer remains a complete fallback when an asset is
          // unavailable or a browser rejects its codec.
        }
      }),
    ).then(() => undefined);
    return this.sampleLoad;
  }

  private playSample(
    keys: SampleKey | SampleKey[],
    options: {
      gain: number;
      pan?: number;
      delay?: number;
      playbackRate?: number;
      lowpass?: number;
      highpass?: number;
    },
  ) {
    if (!this.context || !this.effects || !this.enabled) return false;
    const choices = Array.isArray(keys) ? keys : [keys];
    const key = choices[this.sampleSequence % choices.length];
    this.sampleSequence += 1;
    const buffer = this.samples.get(key);
    if (!buffer) return false;
    const now = this.context.currentTime + (options.delay ?? 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(options.playbackRate ?? 1, now);
    let last: AudioNode = source;
    if (options.highpass) {
      const filter = this.context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = options.highpass;
      last.connect(filter);
      last = filter;
    }
    if (options.lowpass) {
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = options.lowpass;
      filter.Q.value = 0.55;
      last.connect(filter);
      last = filter;
    }
    const route = this.busPanGain(this.effects, options.gain, options.pan, now);
    last.connect(route.input);
    source.start(now);
    return true;
  }

  private seededNoise(duration: number, color: "white" | "brown" | "grain") {
    if (!this.context) throw new Error("Audio context is not ready");
    const key = `${duration}:${color}`;
    const cached = this.noiseBuffers.get(key);
    if (cached) return cached;
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 0x6d2b79f5 ^ length;
    let brown = 0;
    for (let index = 0; index < length; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const white = ((state >>> 0) / 0xffffffff) * 2 - 1;
      if (color === "brown") {
        brown = (brown + 0.022 * white) / 1.022;
        data[index] = brown * 3.2;
      } else if (color === "grain") {
        const gate = ((index * 37 + state) & 127) < 13 ? 1 : 0.14;
        data[index] = white * gate;
      } else {
        data[index] = white;
      }
    }
    this.noiseBuffers.set(key, buffer);
    return buffer;
  }

  private busPanGain(
    bus: AudioNode,
    gainValue: number,
    pan = 0,
    start = this.context?.currentTime ?? 0,
  ) {
    if (!this.context) throw new Error("Audio context is not ready");
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(gainValue, start);
    if (typeof this.context.createStereoPanner === "function") {
      const panner = this.context.createStereoPanner();
      panner.pan.setValueAtTime(clamp(pan, -0.62, 0.62), start);
      panner.connect(gain);
      gain.connect(bus);
      return { input: panner as AudioNode, gain };
    }
    gain.connect(bus);
    return { input: gain as AudioNode, gain };
  }

  private spatial(x: number, listenerX: number, distance = 0) {
    return {
      pan: clamp((x - listenerX) / 300, -0.58, 0.58),
      falloff: clamp(1 / (1 + Math.max(0, distance - 24) / 410), 0.16, 1),
    };
  }

  private allowed(key: string, cooldown: number) {
    if (!this.enabled || !this.context || !this.effects) return false;
    const now = this.context.currentTime;
    const previous = this.lastEvent.get(key) ?? -Infinity;
    if (now - previous < cooldown) return false;
    this.lastEvent.set(key, now);
    return true;
  }

  private noiseBurst(options: {
    duration: number;
    gain: number;
    lowpass?: number;
    highpass?: number;
    color?: "white" | "brown" | "grain";
    pan?: number;
    delay?: number;
    attack?: number;
    bus?: AudioNode;
  }) {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime + (options.delay ?? 0);
    const source = this.context.createBufferSource();
    source.buffer = this.seededNoise(options.duration, options.color ?? "white");
    let last: AudioNode = source;
    if (options.highpass) {
      const filter = this.context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = options.highpass;
      last.connect(filter);
      last = filter;
    }
    if (options.lowpass) {
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = options.lowpass;
      filter.Q.value = 0.65;
      last.connect(filter);
      last = filter;
    }
    const route = this.busPanGain(options.bus ?? this.effects, 0.0001, options.pan, now);
    last.connect(route.input);
    const attack = options.attack ?? 0.003;
    route.gain.gain.exponentialRampToValueAtTime(Math.max(0.001, options.gain), now + attack);
    route.gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    source.start(now);
    source.stop(now + options.duration + 0.03);
  }

  private startInteriorBed() {
    if (!this.context || !this.bed) return;
    const context = this.context;
    const makeTread = (pan: number) => {
      const source = context.createBufferSource();
      source.buffer = this.seededNoise(2.3, "brown");
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 115;
      filter.Q.value = 0.7;
      const route = this.busPanGain(this.bed!, 0.0001, pan);
      source.connect(filter);
      filter.connect(route.input);
      source.start();
      return route.gain;
    };
    this.leftTreadGain = makeTread(-0.48);
    this.rightTreadGain = makeTread(0.48);

    const strain = context.createBufferSource();
    strain.buffer = this.seededNoise(3.7, "brown");
    strain.loop = true;
    const strainFilter = context.createBiquadFilter();
    strainFilter.type = "bandpass";
    strainFilter.frequency.value = 74;
    strainFilter.Q.value = 1.2;
    this.strainGain = context.createGain();
    this.strainGain.gain.value = 0.01;
    strain.connect(strainFilter);
    strainFilter.connect(this.strainGain);
    this.strainGain.connect(this.bed);
    strain.start();

    const room = context.createBufferSource();
    room.buffer = this.seededNoise(4.1, "brown");
    room.loop = true;
    const roomFilter = context.createBiquadFilter();
    roomFilter.type = "lowpass";
    roomFilter.frequency.value = 420;
    const roomGain = context.createGain();
    roomGain.gain.value = 0.018;
    room.connect(roomFilter);
    roomFilter.connect(roomGain);
    roomGain.connect(this.bed);
    room.start();
  }

  syncTreads(state: TreadState) {
    if (!this.context || !this.started) return;
    const now = this.context.currentTime;
    const leftMotion = Math.abs(state.leftSpool);
    const rightMotion = Math.abs(state.rightSpool);
    this.leftTreadGain?.gain.setTargetAtTime(
      0.008 + leftMotion * (0.09 + (1 - state.leftTread / 100) * 0.055),
      now,
      0.045,
    );
    this.rightTreadGain?.gain.setTargetAtTime(
      0.008 + rightMotion * (0.09 + (1 - state.rightTread / 100) * 0.055),
      now,
      0.045,
    );
    const effort = clamp(
      (Math.abs(state.forwardVelocity) / 135 + Math.abs(state.yawVelocity) * 1.6) *
        (1.15 - state.core / 250),
      0,
      1,
    );
    this.strainGain?.gain.setTargetAtTime(
      0.008 + effort * 0.055 + state.suppression * 0.00012,
      now,
      0.075,
    );
  }

  playFire(
    kind: FireKind,
    owner: "landship" | "infantry" | "defense",
    x: number,
    listenerX: number,
    distance: number,
    intensity = 1,
  ) {
    const family = owner === "defense" ? `defense-${kind}` : `${owner}-${kind}`;
    const cooldown = owner === "landship" ? (kind === "rifle" ? 0.055 : 0.025) : 0.065;
    if (!this.allowed(`fire:${family}`, cooldown)) return;
    const { pan, falloff } = this.spatial(x, listenerX, distance);
    const weight = clamp(falloff * (0.72 + intensity * 0.16), 0.12, 1.22);

    if (kind === "ap" || kind === "he") {
      const he = kind === "he";
      const recorded = this.playSample(CONCUSSION_SAMPLES, {
        gain: (he ? 0.68 : 0.52) * weight,
        pan,
        playbackRate: he ? 0.92 : 1.06,
        lowpass: he ? 3900 : 5100,
      });
      this.noiseBurst({ duration: 0.075, gain: (recorded ? 0.18 : 0.45) * weight, highpass: 1250, lowpass: 6200, pan });
      if (!recorded) {
        this.noiseBurst({ duration: he ? 0.56 : 0.38, gain: (he ? 0.78 : 0.62) * weight, lowpass: he ? 980 : 1500, color: "brown", pan });
      }
      return;
    }
    if (kind === "rib-mortar") {
      const recorded = this.playSample("rib-mortar-a", { gain: 0.52 * weight, pan, playbackRate: 0.94 });
      if (!recorded) this.noiseBurst({ duration: 0.42, gain: 0.35 * weight, lowpass: 920, color: "brown", pan });
      return;
    }
    if (kind === "bow") {
      this.playSample("tendon-snap-a", { gain: 0.35 * weight, pan, playbackRate: 1.08, highpass: 260 });
      this.noiseBurst({ duration: 0.075, gain: 0.2 * weight, highpass: 1700, lowpass: 7600, color: "grain", pan });
      return;
    }
    if (kind === "top") {
      this.playSample(MEMBRANE_SAMPLES, { gain: 0.29 * weight, pan, playbackRate: 1.18, highpass: 320 });
      this.noiseBurst({ duration: 0.055, gain: 0.18 * weight, highpass: 900, lowpass: 6200, pan });
      return;
    }
    if (kind === "tooth" || kind === "trench-tooth") {
      this.playSample("tendon-snap-a", { gain: 0.3 * weight, pan, playbackRate: kind === "tooth" ? 1.22 : 0.94, lowpass: 4300 });
      this.noiseBurst({ duration: 0.12, gain: 0.19 * weight, highpass: 650, lowpass: 3900, color: "grain", pan });
      return;
    }
    if (kind === "sapper") {
      this.playSample("rupture-wet-a", { gain: 0.28 * weight, pan, playbackRate: 1.14, lowpass: 1800 });
      this.noiseBurst({ duration: 0.18, gain: 0.19 * weight, lowpass: 920, color: "brown", pan });
      return;
    }
    if (kind === "anti-armor" || kind === "flanker" || kind === "satchel") {
      this.playSample(CONCUSSION_SAMPLES, { gain: (kind === "satchel" ? 0.5 : 0.36) * weight, pan, playbackRate: kind === "satchel" ? 0.82 : 1.17, lowpass: 3100 });
      this.noiseBurst({ duration: 0.24, gain: 0.42 * weight, lowpass: 1450, color: "brown", pan });
      return;
    }
    this.playSample(MEMBRANE_SAMPLES, { gain: 0.24 * weight, pan, playbackRate: kind === "machine-gun" ? 1.24 : 1.06, highpass: 240 });
    this.noiseBurst({ duration: 0.075, gain: 0.13 * weight, highpass: 500, lowpass: 4800, pan });
  }

  playImpact(
    kind: ImpactKind,
    x: number,
    listenerX: number,
    distance: number,
    intensity = 1,
  ) {
    if (kind === "muzzle" || !this.allowed(`impact:${kind}`, kind === "rupture" ? 0.045 : 0.028)) return;
    const { pan, falloff } = this.spatial(x, listenerX, distance);
    const weight = clamp(falloff * (0.66 + intensity * 0.12), 0.1, 1.15);
    if (kind === "artillery") {
      const recorded = this.playSample("artillery-organic-a", { gain: 0.88 * weight, pan, playbackRate: 0.94 });
      this.noiseBurst({ duration: 0.12, gain: (recorded ? 0.22 : 0.52) * weight, highpass: 800, lowpass: 6500, pan });
      this.noiseBurst({ duration: 0.7, gain: 0.16 * weight, lowpass: 680, color: "grain", pan, delay: 0.11 });
      if (!recorded) {
        this.noiseBurst({ duration: 1.05, gain: 0.82 * weight, lowpass: 1250, color: "brown", pan });
      }
      return;
    }
    if (kind === "he") {
      const recorded = this.playSample(CONCUSSION_SAMPLES, { gain: 0.72 * weight, pan, playbackRate: 0.88 });
      this.noiseBurst({ duration: 0.28, gain: 0.17 * weight, highpass: 950, lowpass: 5800, color: "grain", pan, delay: 0.035 });
      if (!recorded) {
        this.noiseBurst({ duration: 0.68, gain: 0.62 * weight, lowpass: 1750, color: "brown", pan });
      }
      return;
    }
    if (kind === "ap") {
      const recorded = this.playSample(CONCUSSION_SAMPLES, { gain: 0.44 * weight, pan, playbackRate: 1.09, lowpass: 4200 });
      if (!recorded) {
        this.noiseBurst({ duration: 0.22, gain: 0.42 * weight, highpass: 420, lowpass: 3200, color: "grain", pan });
      }
      return;
    }
    if (kind === "crush") {
      const recorded = this.playSample("rupture-wet-a", { gain: 0.52 * weight, pan, playbackRate: 0.82, lowpass: 2600 });
      if (!recorded) {
        this.noiseBurst({ duration: 0.36, gain: 0.34 * weight, lowpass: 980, color: "grain", pan });
      }
      return;
    }
    if (kind === "dirt") {
      this.noiseBurst({
        duration: 0.09,
        gain: 0.12 * weight,
        highpass: 180,
        lowpass: 1150,
        color: "brown",
        pan,
      });
      return;
    }
    if (kind === "toxic") {
      this.playSample("toxic-exhale-a", { gain: 0.42 * weight, pan, playbackRate: 0.96, lowpass: 2600 });
      this.noiseBurst({ duration: 0.88, gain: 0.17 * weight, lowpass: 1250, highpass: 130, color: "brown", pan, attack: 0.09 });
      return;
    }
    if (kind === "rupture" || kind === "cyst" || kind === "trench") {
      const recorded = this.playSample("rupture-wet-a", { gain: (kind === "rupture" ? 0.45 : 0.32) * weight, pan, playbackRate: kind === "cyst" ? 1.11 : 0.9 });
      if (!recorded) {
        this.noiseBurst({ duration: 0.24, gain: 0.22 * weight, lowpass: kind === "rupture" ? 1100 : 1500, color: "brown", pan });
      }
      return;
    }
    if (kind === "crown") {
      this.playSample("scute-impact-a", { gain: 0.34 * weight, pan, playbackRate: 1.16, highpass: 310 });
      this.noiseBurst({ duration: 0.13, gain: 0.2 * weight, highpass: 1100, lowpass: 7200, color: "grain", pan });
      return;
    }
    this.playSample(MEMBRANE_SAMPLES, { gain: 0.22 * weight, pan, playbackRate: 1.12, highpass: 300 });
    this.noiseBurst({ duration: 0.12, gain: 0.16 * weight, highpass: 700, lowpass: 5200, color: "grain", pan });
  }

  playArmorImpact(outcome: "small-arms" | "bounce" | "penetration", face: ArmorFace) {
    if (!this.allowed(`armor:${outcome}`, outcome === "small-arms" ? 0.075 : 0.04)) return;
    const pan = face === "left" ? -0.5 : face === "right" ? 0.5 : 0;
    if (outcome === "small-arms") {
      this.playSample("scute-impact-a", { gain: 0.24, pan, playbackRate: 1.31, highpass: 520 });
      this.noiseBurst({ duration: 0.075, gain: 0.18, highpass: 650, lowpass: 4200, color: "grain", pan });
      return;
    }
    this.noiseBurst({ duration: outcome === "penetration" ? 0.62 : 0.3, gain: outcome === "penetration" ? 0.68 : 0.44, lowpass: outcome === "penetration" ? 1550 : 2500, color: "grain", pan });
    if (outcome === "penetration") {
      const recorded = this.playSample(CONCUSSION_SAMPLES, { gain: 0.68, pan, playbackRate: 0.79, lowpass: 3300 });
      if (!recorded) {
        this.noiseBurst({ duration: 0.5, gain: 0.18, lowpass: 720, color: "brown", pan, delay: 0.08 });
      }
    } else {
      this.playSample("scute-impact-a", { gain: 0.46, pan, playbackRate: 0.86, lowpass: 3600 });
    }
  }

  artilleryCue(mission: number, stage: "flare" | "ranging" | "incoming") {
    const key = `${mission}:${stage}`;
    if (this.lastArtilleryCue === key || !this.allowed(`artillery-cue:${key}`, 0)) return;
    this.lastArtilleryCue = key;
    if (stage === "flare") {
      this.playSample("artillery-flare-a", { gain: 0.34, playbackRate: 1.04, highpass: 240 });
      this.noiseBurst({ duration: 0.72, gain: 0.12, highpass: 1500, lowpass: 7100, attack: 0.08 });
    } else if (stage === "ranging") {
      this.playSample("artillery-incoming-a", { gain: 0.32, playbackRate: 1.22, highpass: 310, lowpass: 4400 });
    } else {
      this.playSample("artillery-incoming-a", { gain: 0.52, playbackRate: 0.88, lowpass: 3900 });
      this.noiseBurst({ duration: 1.15, gain: 0.08, highpass: 900, lowpass: 4700, attack: 0.28 });
    }
  }

  playGraft(level: number, offspring: boolean) {
    if (!this.allowed("graft", 0.08)) return;
    const recorded = this.playSample("graft-birth-a", { gain: offspring ? 0.58 : 0.46, playbackRate: 0.94 - Math.min(level, 8) * 0.012 });
    if (!recorded) this.noiseBurst({ duration: 0.72, gain: 0.3, lowpass: 860, color: "brown", attack: 0.035 });
    for (let pulse = 0; pulse < (offspring ? 3 : 2); pulse += 1) {
      this.playSample("membrane-shot-a", { gain: 0.13 + Math.min(level, 8) * 0.005, delay: 0.12 + pulse * 0.17, playbackRate: 0.72 + pulse * 0.08, lowpass: 1450 });
    }
    this.noiseBurst({ duration: 0.26, gain: 0.13, highpass: 700, lowpass: 3600, color: "grain", delay: 0.18 });
  }

  playCapture() {
    if (!this.allowed("capture", 0.3)) return;
    this.playSample("ground-capture-a", { gain: 0.54, playbackRate: 0.94, lowpass: 2400 });
    this.noiseBurst({ duration: 0.9, gain: 0.19, lowpass: 780, color: "brown", attack: 0.12 });
    this.noiseBurst({ duration: 0.34, gain: 0.1, highpass: 650, lowpass: 3300, color: "grain", delay: 0.22 });
  }

  playDeath() {
    if (!this.allowed("death", 1)) return;
    this.playSample("death-collapse-a", { gain: 0.72, playbackRate: 0.94, lowpass: 2200 });
    this.noiseBurst({ duration: 2.1, gain: 0.31, lowpass: 620, color: "brown", attack: 0.12 });
    if (this.context) {
      const now = this.context.currentTime;
      this.leftTreadGain?.gain.setTargetAtTime(0.0001, now, 0.18);
      this.rightTreadGain?.gain.setTargetAtTime(0.0001, now, 0.18);
      this.strainGain?.gain.setTargetAtTime(0.0001, now, 0.45);
    }
  }

  private playWake() {
    if (!this.allowed("wake", 0.5)) return;
    this.playSample("wake-organ-a", { gain: 0.48, playbackRate: 0.96, lowpass: 2100 });
    this.noiseBurst({ duration: 0.9, gain: 0.14, lowpass: 700, color: "brown", attack: 0.14 });
  }
}
