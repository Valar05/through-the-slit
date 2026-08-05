"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type * as ThreeTypes from "three";
import {
  captureAcre,
  createAcreDirector,
  getCaptureBlockers,
  loseRun,
  setDirectorPhase,
} from "./acre-director.mjs";
import {
  defenseEchelonAt,
  defenseDamageForSector,
  formationStateFor,
  formationPressure,
} from "./difficulty-model.mjs";
import { stepTreads } from "./tread-model.mjs";
import { resolveGameViewport } from "./viewport-model.mjs";
import {
  ARTILLERY_BLAST_RADIUS,
  aimedVerticalVelocity,
  armorFaceFromSource,
  artilleryMarkForTank,
  artilleryMissionProfile,
  artilleryPressureAt,
  artilleryRangingPoint,
  artillerySalvoPoint,
  cannonProfile,
  chooseAntiArmorEmplacement,
  defenseHullContactPolicy,
  heBlastDamage,
  heShotInterval,
  isCrushable,
  nextCombatRandom,
  projectileHitsTarget,
  resolveArtilleryImpact,
  resolveHeavyArmorImpact,
  sternumContact,
  trenchquakeDamage,
  treadContactSide,
} from "./combat-model.mjs";
import {
  getTerrainSeed,
  setTerrainSeed,
  solveTreadSupport,
  terrainBlocksSegment,
  terrainDecorationsInRange,
  terrainFeaturesInRange,
  terrainFootprintReliefAt,
  terrainFootprintSeatHeight,
  terrainHeightAt,
  terrainSectorProfile,
  terrainSurfaceAt,
  trenchFrontZAt,
  TERRAIN_GRID_STEP,
  TREAD_SAMPLE_BUDGET,
} from "./terrain-model.mjs";
import { SoundEngine } from "./sound-engine";
import { getOstPlayer, OST_POLICY } from "./music-engine";
import { ReneeDirector, RENEE_CUES, RENEE_POLICY } from "./renee-director.mjs";
import { CARE_AUDIO_POLICY, CARE_SEQUENCE, FERRAVINE_CARE_CUES, RENEE_HUM_LOOPS } from "./care-audio.mjs";
import { TANK_KATA_POLICY } from "./tank-kata-policy.mjs";
import { TankKataVoiceConductor } from "./tank-kata-voice";
import MendelJudgment, {
  loadLineageInState,
  loadObservedLineage,
  loadSubmittedLineage,
  persistLineage,
} from "./mendel-judgment";
import {
  MARTYRS_WINCH,
  JUDGMENT_DECISIONS,
  LINEAGE_STATES,
  createObservedLineage,
  evaluateMartyrsWinchForeignExpression,
  evaluateMartyrsWinchDiscovery,
  judgeObservedLineage,
  recordMartyrsWinchForeignExpression,
  selectMartyrsWinchForeignExpression,
} from "./inheritance-model.mjs";
import IntroExperience, { type IntroMode } from "./intro-experience";

// Keep the rendering engine in its own browser chunk, but let the game module
// own and await that dependency. The former cross-script global/event handshake
// could strand or mis-order mobile startup before React had a useful frame.
const THREE = await import("three");
const {
  awardNutrients,
  spendNutrientLevel,
  nutrientTargetForLevel,
  nutrientValueForDefender,
} = await import("./progression-model.mjs");
const {
  arsenalVolleyProfile,
  commonShelterCasualtyMultiplier,
  fieldConsolidationRepair,
  graftIsEligible,
  scarLarderRepair,
  toxicCloudDamage,
} = await import("./graft-model.mjs");
const {
  FRIENDLY_FORMATION_BODIES,
  activeFriendlyFireteams,
  chooseFriendlyRifleTarget,
  chooseFriendlyFiringPosition,
  chooseFriendlySuppressionTarget,
  friendlyRifleDamage,
  machineGunControlsFormation,
  friendlySuppressionFor,
  friendlyVolleyCadence,
  softTargetPinned,
  suppressedFireCadenceMultiplier,
} = await import("./infantry-combat-model.mjs");
const {
  counterattackUnits,
  defenderLabel,
  defenderStats,
  isHumanScaleDefender,
  defenseSectorPlan,
  stepDefenderDoctrine,
  tendDefensiveLine,
  terrainDecorationVisual,
  updateSectorControl,
  canPresentGraftOffer,
  tacticalExplosionRadiusCap,
} = await import("./defense-depth-model.mjs");
const {
  ENEMY_ATLAS_POSE_RECTS,
  THREAT_ATLAS_POSE_RECTS,
  enemyCorpseCell,
} = await import("./sprite-atlas-model.mjs");
const GraftCatalog = lazy(() => import("./graft-catalog"));
const CanonizationPlate = lazy(() => import("./canonization-plate"));

const TAU = Math.PI * 2;
// The authored friendly sheet's wounded row deliberately reaches 64 pixels
// upward into the nominal middle-row gutter. Equal 4x3 slicing cut the heads
// off wounded bodies and pasted those pixels onto the kneeling poses above.
// Keep the source art intact and move the extraction seam into the real
// transparent gap between those two pose families.
const FRIENDLY_ATLAS_VERTICAL_OVERLAP = 64;
const FIELD_HALF_WIDTH = 430;
const START_Z = 90;
const FIRST_SECTOR_Z = 250;
const SECTOR_LENGTH = 620;
const FORMATION_WIDTH = 118;
const BREACH_CLEARANCE = 8;
const DEFENSE_HORIZON_SECTORS = 5;
const TRENCH_LINE_OFFSET = 300;
const MAX_ACTIVE_PROJECTILES = 320;
const MAX_POOLED_PROJECTILES = 384;
const MAX_ACTIVE_EXPLOSIONS = 64;
const MAX_POOLED_EXPLOSIONS = 80;
const MAX_ACTIVE_CRUSH_MARKS = 40;
const MAX_POOLED_CRUSH_MARKS = 48;
// Keep the combat layer at one real backing pixel per CSS pixel. Retro texture
// comes from authored atlases, nearest-neighbor sampling, and the world-locked
// effect grid—not from lowering the resolution of the entire battlefield.
const COMBAT_RENDER_DPR_CAP = 1;
const EFFECT_PIXEL_GRID = 2;
const TERRAIN_CHUNK_BUILD_BUDGET = 2;
const TERRAIN_CAMERA_NEAR = 0.35;
const SKYBOX_URL = "./textures/western-front-skybox-v59.webp";
type Screen = "menu" | "care" | "playing" | "graft" | "dead";
type MenuPanel = "main" | "settings" | "controls";
type SettingsOrigin = "menu" | "pause";
type IntroStage = "checking" | "hidden" | "consent" | "playing";
type ReneeCue = { id: string; text: string; duration: number; priority: number };
type GameSettings = {
  reducedMotion: boolean;
  reducedFlashes: boolean;
  screenShake: boolean;
  highContrast: boolean;
  largeHud: boolean;
  wideTouch: boolean;
  autoPause: boolean;
  reneeVoice: boolean;
};

const SETTINGS_KEY = "through-the-slit.humane-settings.v1";
const INTRO_CHOICE_KEY = "through-the-slit.intro-v4.choice";
const DEFAULT_SETTINGS: GameSettings = {
  reducedMotion: false,
  reducedFlashes: false,
  screenShake: true,
  highContrast: false,
  largeHud: false,
  wideTouch: true,
  autoPause: true,
  reneeVoice: true,
};

const HUMANE_SETTING_OPTIONS: Array<{
  key: keyof GameSettings;
  label: string;
  detail: string;
}> = [
  {
    key: "reducedMotion",
    label: "Reduced motion",
    detail: "Softens hull roll, pitch, recoil, and pulsing interface motion.",
  },
  {
    key: "reducedFlashes",
    label: "Reduced flashes",
    detail: "Removes the full-port impact flash while preserving damage readouts.",
  },
  {
    key: "screenShake",
    label: "Camera movement",
    detail: "Allows the observation port to pitch and roll with the landship.",
  },
  {
    key: "highContrast",
    label: "Strong contrast",
    detail: "Strengthens text, meters, focus rings, and panel separation.",
  },
  {
    key: "largeHud",
    label: "Large field text",
    detail: "Enlarges combat readouts without changing the battlefield view.",
  },
  {
    key: "wideTouch",
    label: "Wide tread touch zones",
    detail: "Expands each invisible tread control toward the center of the screen.",
  },
  {
    key: "autoPause",
    label: "Pause when interrupted",
    detail: "Freezes combat when the app loses focus or the screen changes.",
  },
  {
    key: "reneeVoice",
    label: "Renee voice",
    detail: "Lets Renee answer real landship state changes. Every spoken cue is captioned.",
  },
];
type MacroPhase = "breach" | "cross" | "consolidate" | "graft";
type FormationState =
  | "connected"
  | "stretched"
  | "separated"
  | "reconnecting"
  | "overrun";
type DefenseEchelon =
  | "screen"
  | "main-line"
  | "support-line"
  | "reserve-line"
  | "consolidation";
type GraftSource = { kind: "nutrition"; level: number } | null;
type Vec = { x: number; z: number };
type ForeignExpressionStage =
  | "dormant"
  | "refusal"
  | "rotate"
  | "brace"
  | "contact"
  | "strain"
  | "success"
  | "overload"
  | "severed"
  | "casualty"
  | "canonical";
type BroodRescue = {
  mode: "foreign" | "correction";
  stage: ForeignExpressionStage;
  age: number;
  startedAt: number;
  originX: number;
  originZ: number;
  destinationX: number;
  destinationZ: number;
  x: number;
  z: number;
  movedDistance: number;
  assetIntegrity: number;
  organismsCommitted: number;
  fireSupportWithheldSeconds: number;
  terrainAnchors: number;
  hostileContacts: number;
  soundStage: string;
  deniedTargetX: number;
  deniedTargetZ: number;
  survivorsRecovered: number;
};
type AncestorRescue = {
  age: number;
  stage: number;
  hostileContacts: number;
  armorDamage: number;
  organDamage: number;
  assetIntegrity: number;
  recoveredDistance: number;
};
type ArmorFace = "front" | "left" | "right" | "rear";
type DefenderKind =
  | "infantry"
  | "machine-gun"
  | "observer"
  | "flanker"
  | "anti-armor"
  | "carrier"
  | "satchel"
  | "reserve-assault"
  | "engineer";
type WeaponKind =
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
  | "satchel";
type GraftKey =
  | "bow-gunner"
  | "needle-lattice"
  | "rupture-bloom"
  | "scute-borer"
  | "funeral-lung"
  | "bone-harpoon"
  | "butchers-reel"
  | "top-gunner"
  | "rib-mortar-brood"
  | "whelping-shot"
  | "battering-sternum"
  | "trenchquake-bladders"
  | "scar-larder"
  | "rifle-choir"
  | "sapper-brood"
  | "trench-teeth"
  | "witness-cilia"
  | "common-shelter"
  | "munition-womb";

type Defender = {
  id: number;
  kind: DefenderKind;
  sector: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  fireClock: number;
  alive: boolean;
  flash: number;
  intent: number;
  suppression: number;
};

type Projectile = {
  owner: "landship" | "infantry" | "defense";
  kind: WeaponKind | DefenderKind;
  x: number;
  z: number;
  previousX: number;
  previousZ: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  life: number;
  tracer: boolean;
  elevation: number;
  previousElevation: number;
  verticalVelocity: number;
  intensity: number;
  age: number;
  visualMuzzle: "world" | "top-cannon" | "top-coax";
  defenseResolved: boolean;
  pierceRemaining: number;
  hitIds: number[];
  graftExplosive: boolean;
  graftToxic: boolean;
  executionBurst: boolean;
  aimTargetId: number | null;
  infantryResolved: boolean;
};

type CombatTelemetry = {
  defenseFired: number;
  terrain: number;
  formation: number;
  hull: number;
  bounces: number;
  penetrations: number;
  expired: number;
  artilleryShells: number;
  artilleryHullContacts: number;
  artilleryArmorDamage: number;
  artilleryOrganDamage: number;
  infantryFired: number;
  infantryTerrain: number;
  infantryNearMisses: number;
  infantryHits: number;
  infantryKills: number;
  infantryMisses: number;
};

type TerrainCrater = { x: number; z: number; radius: number; depth: number };

type TerrainChunk = {
  key: string;
  centerX: number;
  centerZ: number;
  mesh: ThreeTypes.Mesh<ThreeTypes.BufferGeometry, ThreeTypes.MeshToonMaterial>;
  worldSeed: number;
};

type WireLine = {
  z: number;
  gapCenter: number;
  gapWidth: number;
  torn: boolean;
};

type CaptureNode = {
  x: number;
  z: number;
  sector: number;
  captured: boolean;
  consolidationStartedAt: number | null;
  counterattackSpawned: boolean;
  counterattackBroken: boolean;
  counterattackBrokenAt?: number | null;
  holdSeconds: number;
};

type Explosion = {
  x: number;
  z: number;
  age: number;
  life: number;
  radius: number;
  kind:
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
  seed: number;
  intensity: number;
};

type GraftBloom = {
  title: string;
  tree: string;
  level: number;
  age: number;
  life: number;
  offspring: boolean;
};

type CrushMark = {
  x: number;
  z: number;
  age: number;
  life: number;
  side: "left" | "right";
};

type BreachWake = {
  x: number;
  z: number;
  radius: number;
  expiresAt: number;
};

type TrenchBarricade = {
  id: string;
  x: number;
  z: number;
  bankSide: -1 | 1;
};

type Formation = {
  x: number;
  z: number;
  width: number;
  cohesion: number;
  suppression: number;
  casualties: number;
  connected: boolean;
  state: FormationState;
  routeContested: boolean;
  surgeClock: number;
  capturedGround: number;
  signalPulse: number;
  volleyClock: number;
  volleyPulse: number;
  targetId: number | null;
  shotsFired: number;
  intent: "advance" | "engage" | "suppressed";
};

type Tank = {
  x: number;
  z: number;
  angle: number;
  turret: number;
  topTurret: number;
  leftDemand: number;
  rightDemand: number;
  leftSpool: number;
  rightSpool: number;
  forwardVelocity: number;
  yawVelocity: number;
  leftTread: number;
  rightTread: number;
  core: number;
  armor: Record<ArmorFace, number>;
  scars: Record<ArmorFace, number>;
  invulnerable: number;
  elevation: number;
  pitch: number;
  roll: number;
  terrainState: string;
  turretRecoil: number;
  coaxRecoil: number;
};

type ArtilleryStrike = {
  observerId: number;
  x: number;
  z: number;
  warning: number;
  stage: "flare" | "ranging" | "incoming";
  observed: boolean;
  mission: number;
  salvoSize: number;
  cadence: number;
  batteryPause: number;
  dispersion: number;
  rangingRoundsFired: number;
  shellsRemaining: number;
  shellClock: number;
};

type Runtime = {
  worldSeed: number;
  width: number;
  height: number;
  dpr: number;
  status: Screen;
  elapsed: number;
  combatRngState: number;
  combatTelemetry: CombatTelemetry;
  tank: Tank;
  formation: Formation;
  defenders: Defender[];
  projectiles: Projectile[];
  explosions: Explosion[];
  graftBloom: GraftBloom | null;
  crushMarks: CrushMark[];
  breachWakes: BreachWake[];
  crushedBarricades: Set<string>;
  wires: WireLine[];
  captureNodes: CaptureNode[];
  keys: Set<string>;
  nextId: number;
  nextSector: number;
  enemyKills: number;
  crushedEnemies: number;
  mainShotsFired: number;
  apImpacts: number;
  heImpacts: number;
  mainClock: number;
  bowClock: number;
  topClock: number;
  bowOrganClocks: number[];
  topOrganClocks: number[];
  mortarOrganClocks: number[];
  choirOrganClocks: number[];
  sapperClock: number;
  trenchTeethClock: number;
  trenchquakeClock: number;
  ramImpacts: number;
  shake: number;
  impactFlash: number;
  impactFace: ArmorFace;
  learnedScar: ArmorFace;
  caption: string;
  captionClock: number;
  grafts: Record<GraftKey, number>;
  offeredAt: number;
  lastGraftKills: number;
  nutrientXp: number;
  nutrientLevel: number;
  pendingGraftSource: GraftSource;
  selectedTargetId: number | null;
  heCycle: number;
  artillery: ArtilleryStrike | null;
  artilleryClock: number;
  artilleryMissions: number;
  totalGrafts: number;
  arsenalMissilesFired: number;
  arsenalDetonations: number;
  arsenalPenetrations: number;
  toxicCloudsBorn: number;
  toxicKills: number;
  counterbatteryClock: number;
  ciliaClock: number;
  director: ReturnType<typeof createAcreDirector>;
  captureBlockers: string[];
  nextLineDistance: number;
  terrainCraters: TerrainCrater[];
  terrainRevision: number;
  battlefieldCleanupClock: number;
  defenseEchelon: DefenseEchelon;
  ancestorRescue: AncestorRescue | null;
  ancestorResolved: boolean;
  submittedLineage: ReturnType<typeof loadSubmittedLineage>;
  correctionLineage: ReturnType<typeof loadLineageInState>;
  broodRescue: BroodRescue | null;
  foreignExpressionResolved: boolean;
  lineageEventLog: string;
  phaseThreeQa: boolean;
  phaseFourQa: boolean;
};

type Hud = {
  time: number;
  core: number;
  leftTread: number;
  rightTread: number;
  front: number;
  left: number;
  right: number;
  rear: number;
  leftSpool: number;
  rightSpool: number;
  cohesion: number;
  suppression: number;
  casualties: number;
  connected: boolean;
  formationState: FormationState;
  breachWakeSeconds: number;
  capturedGround: number;
  distance: number;
  enemyKills: number;
  crushedEnemies: number;
  heCycle: number;
  heArmed: boolean;
  bowLevel: number;
  topLevel: number;
  scuteLevel: number;
  caption: string;
  targetLabel: string;
  targetReady: boolean;
  formationWidth: number;
  corridorWidth: number;
  phase: MacroPhase;
  totalGrafts: number;
  pendingOfferTokens: number;
  nutrientXp: number;
  nutrientLevel: number;
  captureBlockers: string[];
  nextLineDistance: number;
  nextGraftTarget: number;
  defenseState: string;
  lossCause: string;
  graftLevels: Record<GraftKey, number>;
  offspring: string[];
  foreignExpressionState: ForeignExpressionStage;
  lineageEventLog: string;
};

const GRAFT_KEYS: GraftKey[] = [
  "bow-gunner", "needle-lattice", "rupture-bloom", "scute-borer",
  "funeral-lung", "bone-harpoon", "butchers-reel", "top-gunner",
  "rib-mortar-brood", "whelping-shot", "battering-sternum",
  "trenchquake-bladders", "scar-larder", "rifle-choir", "sapper-brood",
  "trench-teeth", "witness-cilia", "common-shelter", "munition-womb",
];

const ROOT_GRAFT_KEYS: GraftKey[] = [
  "bow-gunner",
  "battering-sternum",
  "rifle-choir",
];

const GRAFT_TITLES: Record<GraftKey, string> = {
  "bow-gunner": "Bow Gunner",
  "needle-lattice": "Needle Lattice",
  "rupture-bloom": "Rupture Bloom",
  "scute-borer": "Scute Borer",
  "funeral-lung": "Funeral Lung",
  "bone-harpoon": "Bone Harpoon",
  "butchers-reel": "Butcher's Reel",
  "top-gunner": "Top Gunner",
  "rib-mortar-brood": "Rib-Mortar Brood",
  "whelping-shot": "Whelping Shot",
  "battering-sternum": "Battering Sternum",
  "trenchquake-bladders": "Trenchquake Bladders",
  "scar-larder": "Scar Larder",
  "rifle-choir": "Rifle Choir",
  "sapper-brood": "Sapper Brood",
  "trench-teeth": "Trench Teeth",
  "witness-cilia": "Witness Cilia",
  "common-shelter": "Common Shelter",
  "munition-womb": "Munition Womb",
};

const graftFamilyKey = (
  key: GraftKey,
): "LIVING ARSENAL" | "BREACH BODY" | "WAR PARTY" => {
  if (
    key === "battering-sternum" ||
    key === "trenchquake-bladders" ||
    key === "scar-larder"
  ) return "BREACH BODY";
  if (
    key === "rifle-choir" ||
    key === "sapper-brood" ||
    key === "trench-teeth" ||
    key === "witness-cilia" ||
    key === "common-shelter" ||
    key === "munition-womb"
  ) return "WAR PARTY";
  return "LIVING ARSENAL";
};

type GraftChoice = {
  key: GraftKey;
  title: string;
  tree: string;
};
const activeOffspring = (grafts: Record<GraftKey, number>) => {
  const born: string[] = [];
  if (grafts["bow-gunner"] > 0 && grafts["whelping-shot"] > 0) {
    born.push("Needle Litter");
  }
  if (grafts["rib-mortar-brood"] > 0 && grafts["whelping-shot"] > 0) {
    born.push("Rib Nursery");
  }
  if (grafts["battering-sternum"] > 0 && grafts["rifle-choir"] > 0) {
    born.push("War Convulsion");
  }
  if (grafts["sapper-brood"] > 0 && grafts["trench-teeth"] > 0) {
    born.push("Occupation Maw");
  }
  return born;
};

const chooseOffers = (runtime: Runtime): GraftKey[] => {
  if (runtime.offeredAt === 0) {
    return ROOT_GRAFT_KEYS;
  }

  const hasWeapon =
    runtime.grafts["bow-gunner"] > 0 ||
    runtime.grafts["top-gunner"] > 0 ||
    runtime.grafts["rib-mortar-brood"] > 0;
  const eligible = GRAFT_KEYS.filter((key) => {
    if (runtime.grafts[key] > 0) return false;
    if (!graftIsEligible(key, runtime.grafts)) return false;
    if (key === "whelping-shot" && !hasWeapon) {
      return false;
    }
    if (key === "trench-teeth" && runtime.formation.capturedGround < 1) {
      return false;
    }
    return true;
  });

  const seed = runtime.formation.capturedGround * 17 + runtime.totalGrafts * 31;
  const arsenalPriority: GraftKey[] =
    runtime.grafts["bow-gunner"] > 0 &&
    runtime.grafts["needle-lattice"] === 0 &&
    runtime.grafts["bone-harpoon"] === 0
      ? ["needle-lattice", "bone-harpoon"]
      : runtime.grafts["needle-lattice"] > 0 && runtime.grafts["rupture-bloom"] === 0
        ? ["rupture-bloom"]
        : runtime.grafts["rupture-bloom"] > 0 && runtime.grafts["scute-borer"] === 0
          ? ["scute-borer"]
          : runtime.grafts["scute-borer"] > 0 && runtime.grafts["funeral-lung"] === 0
            ? ["funeral-lung"]
            : runtime.grafts["bone-harpoon"] > 0 && runtime.grafts["butchers-reel"] === 0
              ? ["butchers-reel"]
              : [];
  const breachPriority: GraftKey[] =
    runtime.grafts["battering-sternum"] > 0
      ? ["trenchquake-bladders", "scar-larder"]
      : [];
  const partyPriority: GraftKey[] = [
    ...(runtime.grafts["rifle-choir"] > 0
      ? (["witness-cilia", "common-shelter"] as GraftKey[])
      : []),
    ...(runtime.grafts["trench-teeth"] > 0
      ? (["munition-womb"] as GraftKey[])
      : []),
  ];
  const priority = [...arsenalPriority, ...breachPriority, ...partyPriority]
    .filter((key) => eligible.includes(key));
  const remainder = eligible
    .filter((key) => !priority.includes(key))
    .sort(
      (a, b) =>
        hash01(seed + GRAFT_KEYS.indexOf(a) * 7) -
        hash01(seed + GRAFT_KEYS.indexOf(b) * 7),
    );
  const selected: GraftKey[] = [];
  for (const key of priority) {
    if (selected.length >= 2) break;
    if (!selected.includes(key)) selected.push(key);
  }
  for (const family of ["LIVING ARSENAL", "BREACH BODY", "WAR PARTY"] as const) {
    if (selected.length >= 3) break;
    if (selected.some((key) => graftFamilyKey(key) === family)) continue;
    const candidate = remainder.find((key) => graftFamilyKey(key) === family);
    if (candidate) selected.push(candidate);
  }
  for (const key of remainder) {
    if (selected.length >= 3) break;
    if (!selected.includes(key)) selected.push(key);
  }
  return selected;
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

const angleDelta = (from: number, to: number) => {
  let value = ((to - from + Math.PI) % TAU) - Math.PI;
  if (value < -Math.PI) value += TAU;
  return value;
};

const distanceSq = (a: Vec, b: Vec) => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

const hash01 = (value: number) => {
  const wave = Math.sin(value * 91.733 + 17.11 + getTerrainSeed() * 0.017) * 43758.5453;
  return wave - Math.floor(wave);
};

const BARRICADE_OFFSETS = [-0.78, -0.26, 0.26, 0.78] as const;
const BARRICADE_SITE_OFFSETS = [76, 92, 108, 4, -76, -92, -108] as const;
const trenchBarricadeCache = new Map<string, TrenchBarricade[]>();

const flatBarricadeSite = (
  x: number,
  lineZ: number,
  bankSide: -1 | 1,
  bend: number,
) =>
  BARRICADE_SITE_OFFSETS
    .map((offset) => bankSide * offset)
    .map((offset) => {
      const z = lineZ + offset + bend;
      const relief = terrainFootprintReliefAt(x, z, 27, 10);
      return {
        z,
        relief,
        // Prefer the near shoulders of the defense line when several sites
        // are equally flat, but let actual terrain contact decide.
        score: relief + Math.abs(Math.abs(offset) - 84) * 0.015,
      };
    })
    .sort((a, b) => a.score - b.score)[0];

const trenchBarricadesForSector = (sector: number): TrenchBarricade[] => {
  const seed = getTerrainSeed();
  const cacheKey = `${seed}:${sector}`;
  const cached = trenchBarricadeCache.get(cacheKey);
  if (cached) return cached;
  const profile = terrainSectorProfile(sector);
  const barricades = BARRICADE_OFFSETS.map((offset, index) => {
    const strongpoint = profile.strongpoints[index] ?? {
      x: offset * FIELD_HALF_WIDTH,
      z: trenchFrontZAt(sector, offset * FIELD_HALF_WIDTH),
    };
    const bankSide: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const x = strongpoint.x;
    const site = flatBarricadeSite(x, strongpoint.z, bankSide, 0);
    return {
      id: `${seed}:${sector}:${index}`,
      x,
      z: site.z,
      bankSide,
    };
  });
  trenchBarricadeCache.set(cacheKey, barricades);
  return barricades;
};

const trenchBarricadesInRange = (minZ: number, maxZ: number) => {
  const first = Math.max(
    0,
    Math.floor((minZ - FIRST_SECTOR_Z - 300) / SECTOR_LENGTH) - 1,
  );
  const last = Math.max(
    first,
    Math.ceil((maxZ - FIRST_SECTOR_Z - 300) / SECTOR_LENGTH) + 1,
  );
  const barricades: TrenchBarricade[] = [];
  for (let sector = first; sector <= last; sector += 1) {
    barricades.push(...trenchBarricadesForSector(sector));
  }
  return barricades.filter((barricade) => barricade.z >= minZ && barricade.z <= maxZ);
};

const trenchInfantryPosition = (
  sector: number,
  lateral: number,
  index: number,
  count: number,
  lineZ?: number,
) => {
  const columns = Math.min(9, Math.max(6, Math.ceil(count / 3)));
  const rows = Math.ceil(count / columns);
  const row = Math.floor(index / columns);
  const file = index % columns;
  const widthStep = columns === 1 ? 0 : 650 / (columns - 1);
  const x = clamp(
      lateral - 325 + file * widthStep + (row % 2 === 0 ? -8 : 14),
      -FIELD_HALF_WIDTH + 58,
      FIELD_HALF_WIDTH - 58,
    );
  return {
    x,
    z:
      (lineZ ?? trenchFrontZAt(sector, x)) +
      (row - (rows - 1) * 0.5) * 11 +
      (hash01(sector * 211 + index * 19) - 0.5) * 5,
  };
};

const placeDefender = (
  runtime: Runtime,
  kind: DefenderKind,
  x: number,
  z: number,
  fireDelay: number,
  sector = 0,
) => {
  const stats = defenderStats(kind, sector);
  runtime.defenders.push({
    id: runtime.nextId,
    kind,
    sector,
    x,
    z,
    hp: stats.hp,
    maxHp: stats.hp,
    cooldown: stats.cooldown,
    fireClock: fireDelay,
    alive: true,
    flash: 0,
    intent: 0,
    suppression: 0,
  });
  runtime.nextId += 1;
};

const placeAntiArmorDefender = (
  runtime: Runtime,
  desiredX: number,
  sector: number,
  fireDelay: number,
  lineZ?: number,
) => {
  const sectorBase = FIRST_SECTOR_Z + sector * SECTOR_LENGTH;
  const emplacement = chooseAntiArmorEmplacement({
    desiredX,
    sector,
    approachZ: lineZ === undefined ? sectorBase - 160 : lineZ - 220,
    trenchZAt: (x: number) => lineZ ?? trenchFrontZAt(sector, x),
    heightAt: (x: number, z: number) =>
      terrainHeightAt(x, z, runtime.terrainCraters),
    fieldHalfWidth: FIELD_HALF_WIDTH,
  });
  placeDefender(
    runtime,
    "anti-armor",
    emplacement.x,
    emplacement.z,
    fireDelay,
    sector,
  );
};

const seedOpeningDefense = (runtime: Runtime) => {
  const base = FIRST_SECTOR_Z;
  const profile = terrainSectorProfile(0);
  const plan = defenseSectorPlan(0, profile.centerZ);
  runtime.wires.push({
    z: base + 72,
    gapCenter: -34,
    gapWidth: 30,
    torn: false,
  });
  runtime.captureNodes.push({
    x: profile.occupationAnchor.x,
    z: profile.occupationAnchor.z,
    sector: 0,
    captured: false,
    consolidationStartedAt: null,
    counterattackSpawned: false,
    counterattackBroken: false,
    holdSeconds: plan.consolidationSeconds,
  });

  // The opening force is already dug into the first line. Range and sightline,
  // not a wake timer, decide when each organ engages.
  placeDefender(runtime, "machine-gun", -96, trenchFrontZAt(0, -96) - 8, 0.55);
  // The opening flare is the movement lesson. It is registered before the
  // automatic main mouth can clear the nearer center files and acquire the
  // observer, so doing nothing cannot accidentally counterbattery itself.
  placeDefender(runtime, "observer", 148, trenchFrontZAt(0, 148) + 9, 0.55);
  placeAntiArmorDefender(runtime, -184, 0, 8.5);
  for (let index = 0; index < 12; index += 1) {
    const position = trenchInfantryPosition(0, 0, index, 12);
    placeDefender(
      runtime,
      "infantry",
      position.x,
      position.z,
      1.4 + index * 0.13,
    );
  }
  runtime.nextSector = 1;
};

const seedTrenchSector = (runtime: Runtime, sector: number) => {
  const base = FIRST_SECTOR_Z + sector * SECTOR_LENGTH;
  const profile = terrainSectorProfile(sector);
  const plan = defenseSectorPlan(sector, profile.centerZ);
  const lateral = (hash01(sector * 23) - 0.5) * 180;
  const gapWidth = clamp(38 + sector * 3, 38, 76);
  runtime.wires.push({
    z: base + 72,
    gapCenter: lateral,
    gapWidth,
    torn: false,
  });
  runtime.captureNodes.push({
    x: profile.occupationAnchor.x,
    z: profile.occupationAnchor.z,
    sector,
    captured: false,
    consolidationStartedAt: null,
    counterattackSpawned: false,
    counterattackBroken: false,
    holdSeconds: plan.consolidationSeconds,
  });

  // A sector is four successive defensive problems. The screen delays and
  // reveals, the front line fixes, the support line owns the anti-armor piece,
  // and the reserve keeps the acre contested after the first trench breaks.
  // The total force stays compact; its depth, not simultaneous fire, carries
  // the difficulty.
  const screenCount = 4 + Math.min(2, Math.floor(sector / 3));
  const mainCount = 8 + Math.min(4, sector);
  const reserveCount = 2 + Math.min(3, Math.floor(sector / 2));

  for (let index = 0; index < screenCount; index += 1) {
    const position = trenchInfantryPosition(
      sector,
      lateral * 0.4,
      index,
      screenCount,
      profile.centerZ - 136,
    );
    placeDefender(
      runtime,
      "infantry",
      position.x,
      position.z,
      1.15 + index * 0.18,
      sector,
    );
  }

  placeDefender(
    runtime,
    "machine-gun",
    lateral - 118,
    trenchFrontZAt(sector, lateral - 118) - 8,
    1.8,
    sector,
  );
  const hardpointX = plan.hardpoint.x;
  if (plan.family === "sunken-road") {
    placeDefender(
      runtime,
      "flanker",
      hardpointX,
      plan.hardpoint.z,
      6.4,
      sector,
    );
  } else {
    placeAntiArmorDefender(
      runtime,
      hardpointX,
      sector,
      6.4,
      plan.hardpoint.z,
    );
  }
  if (sector % 2 === 0 || sector >= 4) {
    placeDefender(
      runtime,
      "observer",
      plan.observer.x,
      plan.observer.z,
      7.2,
      sector,
    );
  }
  if (sector >= 2) {
    placeDefender(
      runtime,
      "carrier",
      lateral - 34,
      profile.reserveZ - 18,
      4.2,
      sector,
    );
    placeDefender(
      runtime,
      "satchel",
      lateral + (sector % 2 === 0 ? 126 : -126),
      profile.supportZ + 36,
      4.8,
      sector,
    );
  }

  for (let index = 0; index < mainCount; index += 1) {
    const position = trenchInfantryPosition(
      sector,
      lateral * 0.28,
      index,
      mainCount,
    );
    placeDefender(
      runtime,
      "infantry",
      position.x,
      position.z,
      2.1 + index * 0.11,
      sector,
    );
  }
  for (let index = 0; index < reserveCount; index += 1) {
    const position = trenchInfantryPosition(
      sector,
      lateral * -0.22,
      index,
      reserveCount,
      profile.reserveZ,
    );
    placeDefender(
      runtime,
      "infantry",
      position.x,
      position.z,
      5.2 + index * 0.18,
      sector,
    );
  }
  runtime.nextSector = sector + 1;
};

const seedDefenseHorizon = (runtime: Runtime, throughSector: number) => {
  while (runtime.nextSector <= throughSector) {
    seedTrenchSector(runtime, runtime.nextSector);
  }
};

const spawnSectorCounterattack = (runtime: Runtime, node: CaptureNode) => {
  if (node.counterattackSpawned) return;
  const profile = terrainSectorProfile(node.sector);
  const plan = defenseSectorPlan(node.sector, profile.centerZ);
  for (const unit of counterattackUnits(plan)) placeDefender(
    runtime, unit.kind as DefenderKind, unit.x, unit.z, unit.delay, node.sector,
  );
};

const DEFENSE_ECHELON_LABEL: Record<DefenseEchelon, string> = {
  screen: "OUTPOST SCREEN",
  "main-line": "MAIN FIRE TRENCH",
  "support-line": "SUPPORT LINE",
  "reserve-line": "RESERVE POSITION",
  consolidation: "CONSOLIDATION GROUND",
};

const defenseEchelonForRuntime = (runtime: Runtime): DefenseEchelon => {
  const nextNode = runtime.captureNodes.find((node) => !node.captured);
  if (!nextNode) return "consolidation";
  const profile = terrainSectorProfile(nextNode.sector);
  return defenseEchelonAt(
    Math.max(runtime.tank.z, runtime.formation.z),
    profile,
  );
};

const captureBlockersFor = (
  runtime: Runtime,
  nextNode: CaptureNode | undefined,
) => {
  if (!nextNode) return ["NEXT LINE ABSENT"];
  const { formation, director } = runtime;
  const sectorWire = runtime.wires.find(
    (wire) => wire.z < nextNode.z && wire.z > nextNode.z - 280,
  );
  let heavyThreats = 0;
  let localInfantry = 0;
  for (const defender of runtime.defenders) {
    if (!defender.alive) continue;
    const lineDistance = Math.abs(defender.z - nextNode.z);
    if (
      (defender.kind === "infantry" ||
        defender.kind === "reserve-assault" ||
        defender.kind === "engineer") &&
      lineDistance < 330
    ) {
      localInfantry += 1;
    } else if (
      lineDistance < 390 &&
      (defender.kind === "machine-gun" ||
        defender.kind === "anti-armor" ||
        defender.kind === "flanker" ||
        defender.kind === "observer" ||
        defender.kind === "carrier")
    ) {
      heavyThreats += 1;
    }
  }

  return getCaptureBlockers({
    phase: director.phase,
    connected: formation.connected,
    cohesion: formation.cohesion,
    formationX: formation.x,
    formationZ: formation.z,
    formationWidth: formation.width,
    nodeX: nextNode.x,
    nodeZ: nextNode.z,
    wire: sectorWire
      ? { gapCenter: sectorWire.gapCenter, gapWidth: sectorWire.gapWidth }
      : null,
    breachClearance: BREACH_CLEARANCE,
    heavyThreats,
    localInfantry,
  });
};

const activeBreachWakeFor = (runtime: Runtime) => {
  let best: BreachWake | null = null;
  for (const wake of runtime.breachWakes) {
    if (wake.expiresAt <= runtime.elapsed) continue;
    if (
      wake.z < runtime.formation.z - 80 ||
      wake.z > runtime.formation.z + 520 ||
      wake.z > runtime.tank.z + 140
    ) {
      continue;
    }
    if (!best || wake.z < best.z) best = wake;
  }
  return best;
};

const phaseThreeRuntimeLineage = () => {
  const stored = loadSubmittedLineage();
  if (stored) return stored;
  const qa =
    window.location.hostname === "terminal.local" &&
    new URLSearchParams(window.location.search).get("qaLineage") === "submitted";
  if (!qa) return null;
  return judgeObservedLineage(
    createObservedLineage(
      evaluateMartyrsWinchDiscovery({
        runId: "qa-ancestor-run",
        eventId: "qa-martyrs-winch-observed",
        elapsed: 94,
        endangeredAsset: true,
        hostileContacts: 3,
        exposedSeconds: 7,
        armorDamage: 12,
        organDamage: 0,
        suppressionPeak: 61,
        recoveredDistance: 96,
        assetIntegrityAfter: 38,
        formationConnectedAfter: true,
        formationCohesionAfter: 67,
        priorQualifiedEvents: 0,
      }),
    ),
    JUDGMENT_DECISIONS.SUBMIT,
  ) as unknown as ReturnType<typeof loadSubmittedLineage>;
};

const phaseFourRuntimeLineage = () => {
  return loadLineageInState(LINEAGE_STATES.FOREIGN_EXPRESSION);
};

const initialRuntime = (): Runtime => {
  const phaseThreeQa =
    window.location.hostname === "terminal.local" &&
    new URLSearchParams(window.location.search).get("qaLineage") === "submitted";
  const phaseFourQa =
    window.location.hostname === "terminal.local" &&
    new URLSearchParams(window.location.search).get("qaLineage") === "correction";
  const runtime: Runtime = {
    worldSeed: getTerrainSeed(),
    width: 1,
    height: 1,
    dpr: 1,
    status: "menu",
    elapsed: 0,
    combatRngState: (getTerrainSeed() * 2654435761) >>> 0,
    combatTelemetry: {
      defenseFired: 0,
      terrain: 0,
      formation: 0,
      hull: 0,
      bounces: 0,
      penetrations: 0,
      expired: 0,
      artilleryShells: 0,
      artilleryHullContacts: 0,
      artilleryArmorDamage: 0,
      artilleryOrganDamage: 0,
      infantryFired: 0,
      infantryTerrain: 0,
      infantryNearMisses: 0,
      infantryHits: 0,
      infantryKills: 0,
      infantryMisses: 0,
    },
    tank: {
      x: 0,
      z: START_Z,
      angle: Math.PI / 2,
      turret: Math.PI / 2,
      topTurret: Math.PI / 2,
      leftDemand: 0,
      rightDemand: 0,
      leftSpool: 0,
      rightSpool: 0,
      forwardVelocity: 0,
      yawVelocity: 0,
      leftTread: 100,
      rightTread: 100,
      core: 100,
      armor: { front: 100, left: 72, right: 72, rear: 44 },
      scars: { front: 0, left: 0, right: 0, rear: 0 },
      invulnerable: 0,
      elevation: terrainHeightAt(0, START_Z),
      pitch: 0,
      roll: 0,
      terrainState: "supported",
      turretRecoil: 0,
      coaxRecoil: 0,
    },
    formation: {
      x: 0,
      z: 0,
      width: FORMATION_WIDTH,
      cohesion: 100,
      suppression: 0,
      casualties: 0,
      connected: true,
      state: "connected",
      routeContested: false,
      surgeClock: 0,
      capturedGround: 0,
      signalPulse: 0,
      volleyClock: 0.5,
      volleyPulse: 0,
      targetId: null,
      shotsFired: 0,
      intent: "advance",
    },
    defenders: [],
    projectiles: [],
    explosions: [],
    graftBloom: null,
    crushMarks: [],
    breachWakes: [],
    crushedBarricades: new Set(),
    wires: [],
    captureNodes: [],
    keys: new Set(),
    nextId: 1,
    nextSector: 0,
    enemyKills: 0,
    crushedEnemies: 0,
    mainShotsFired: 0,
    apImpacts: 0,
    heImpacts: 0,
    mainClock: 0.5,
    bowClock: 0,
    topClock: 0,
    bowOrganClocks: [],
    topOrganClocks: [],
    mortarOrganClocks: [],
    choirOrganClocks: [],
    sapperClock: 0,
    trenchTeethClock: 0,
    trenchquakeClock: 0,
    ramImpacts: 0,
    shake: 0,
    impactFlash: 0,
    impactFace: "front",
    learnedScar: "front",
    caption:
      "STEER THE MG NEST INTO THE FORWARD NERVE — THE GUN FIRES WHEN THE BODY AGREES",
    captionClock: 7,
    grafts: {
      "bow-gunner": 0,
      "needle-lattice": 0,
      "rupture-bloom": 0,
      "scute-borer": 0,
      "funeral-lung": 0,
      "bone-harpoon": 0,
      "butchers-reel": 0,
      "top-gunner": 0,
      "rib-mortar-brood": 0,
      "whelping-shot": 0,
      "battering-sternum": 0,
      "trenchquake-bladders": 0,
      "scar-larder": 0,
      "rifle-choir": 0,
      "sapper-brood": 0,
      "trench-teeth": 0,
      "witness-cilia": 0,
      "common-shelter": 0,
      "munition-womb": 0,
    },
    offeredAt: 0,
    lastGraftKills: 0,
    nutrientXp: 0,
    nutrientLevel: 0,
    pendingGraftSource: null,
    selectedTargetId: null,
    heCycle: 0,
    artillery: null,
    artilleryClock: 0,
    artilleryMissions: 0,
    totalGrafts: 0,
    arsenalMissilesFired: 0,
    arsenalDetonations: 0,
    arsenalPenetrations: 0,
    toxicCloudsBorn: 0,
    toxicKills: 0,
    counterbatteryClock: 0,
    ciliaClock: 0,
    director: createAcreDirector(),
    captureBlockers: ["LESSON 44s"],
    nextLineDistance: FIRST_SECTOR_Z + 300,
    terrainCraters: [],
    // Seed identity participates in the revision so pooled terrain chunks are
    // repainted when the next run advances to a new deterministic front.
    terrainRevision: getTerrainSeed() * 1000,
    battlefieldCleanupClock: 0.25,
    defenseEchelon: "screen",
    ancestorRescue: null,
    ancestorResolved: Boolean(
      loadObservedLineage() ||
        loadSubmittedLineage() ||
        loadLineageInState(LINEAGE_STATES.FOREIGN_EXPRESSION) ||
        loadLineageInState(LINEAGE_STATES.CANONICAL),
    ),
    submittedLineage: phaseThreeRuntimeLineage(),
    correctionLineage: phaseFourRuntimeLineage(),
    broodRescue: null,
    foreignExpressionResolved: false,
    lineageEventLog: "",
    phaseThreeQa,
    phaseFourQa,
  };
  seedOpeningDefense(runtime);
  seedDefenseHorizon(runtime, DEFENSE_HORIZON_SECTORS);
  return runtime;
};

const emptyHud: Hud = {
  time: 0,
  core: 100,
  leftTread: 100,
  rightTread: 100,
  front: 100,
  left: 72,
  right: 72,
  rear: 44,
  leftSpool: 0,
  rightSpool: 0,
  cohesion: 100,
  suppression: 0,
  casualties: 0,
  connected: true,
  formationState: "connected",
  breachWakeSeconds: 0,
  capturedGround: 0,
  distance: 0,
  enemyKills: 0,
  crushedEnemies: 0,
  heCycle: 0,
  heArmed: false,
  bowLevel: 0,
  topLevel: 0,
  scuteLevel: 0,
  caption:
    "STEER THE MG NEST INTO THE FORWARD NERVE — THE GUN FIRES WHEN THE BODY AGREES",
  targetLabel: "NO TARGET",
  targetReady: false,
  formationWidth: FORMATION_WIDTH,
  corridorWidth: 0,
  phase: "breach",
  totalGrafts: 0,
  pendingOfferTokens: 0,
  nutrientXp: 0,
  nutrientLevel: 0,
  captureBlockers: ["TRENCH LINE AHEAD"],
  nextLineDistance: FIRST_SECTOR_Z + 300,
  nextGraftTarget: nutrientTargetForLevel(0),
  defenseState: "DEFENSE EMPLACED AHEAD — ADVANCE THROUGH THE TRENCHES",
  lossCause: "",
  graftLevels: {
    "bow-gunner": 0,
    "needle-lattice": 0,
    "rupture-bloom": 0,
    "scute-borer": 0,
    "funeral-lung": 0,
    "bone-harpoon": 0,
    "butchers-reel": 0,
    "top-gunner": 0,
    "rib-mortar-brood": 0,
    "whelping-shot": 0,
    "battering-sternum": 0,
    "trenchquake-bladders": 0,
    "scar-larder": 0,
    "rifle-choir": 0,
    "sapper-brood": 0,
    "trench-teeth": 0,
    "witness-cilia": 0,
    "common-shelter": 0,
    "munition-womb": 0,
  },
  offspring: [],
  foreignExpressionState: "dormant",
  lineageEventLog: "",
};

export default function GameClient() {
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const turretOverlayRef = useRef<HTMLDivElement>(null);
  const turretBarrelRef = useRef<HTMLElement>(null);
  const turretCoaxRef = useRef<HTMLElement>(null);
  // Do not build the battlefield, defenders, or a GPU context merely to show
  // the title card. Mobile browsers must receive a real first frame before
  // the expensive world wakes behind an explicit player action.
  const [coldSeed] = useState(getTerrainSeed);
  const runtimeRef = useRef<Runtime | null>(null);
  const projectilePoolRef = useRef<Projectile[]>([]);
  const explosionPoolRef = useRef<Explosion[]>([]);
  const crushMarkPoolRef = useRef<CrushMark[]>([]);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const reneeDirectorRef = useRef<ReneeDirector | null>(null);
  const voiceEngineRef = useRef<TankKataVoiceConductor | null>(null);
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const pausedRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const musicEnabledRef = useRef(true);
  const voiceEnabledRef = useRef(true);
  const audioFocusMutedRef = useRef(false);
  const careAdvanceTimerRef = useRef(0);
  const pointers = useRef<
    Record<"left" | "right", { id: number; originY: number } | null>
  >({ left: null, right: null });
  const [screen, setScreen] = useState<Screen>("menu");
  const [menuPanel, setMenuPanel] = useState<MenuPanel>("main");
  const [settingsOrigin, setSettingsOrigin] = useState<SettingsOrigin>("menu");
  const [paused, setPaused] = useState(false);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [offerGraftKeys, setOfferGraftKeys] = useState<GraftKey[]>(
    ROOT_GRAFT_KEYS,
  );
  const [rendererState, setRendererState] = useState<"ready" | "failed">(
    "ready",
  );
  const [engineState, setEngineState] = useState<
    "idle" | "building" | "ready" | "failed"
  >("idle");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [careStepIndex, setCareStepIndex] = useState(0);
  const [careBusy, setCareBusy] = useState(false);
  const [careCompleted, setCareCompleted] = useState(false);
  const [careReneeCaption, setCareReneeCaption] = useState("");
  const [careBodyCaption, setCareBodyCaption] = useState("");
  const [careHumCaption, setCareHumCaption] = useState("");
  const [introStage, setIntroStage] = useState<IntroStage>("checking");
  const [introMode, setIntroMode] = useState<IntroMode>("safe");
  const [judgmentCandidate, setJudgmentCandidate] = useState<ReturnType<
    typeof loadObservedLineage
  >>(null);
  const [judgmentOpen, setJudgmentOpen] = useState(false);
  const [canonizationOpen, setCanonizationOpen] = useState(false);

  useEffect(() => {
    let loaded = DEFAULT_SETTINGS;
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      const systemReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      loaded = stored
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        : { ...DEFAULT_SETTINGS, reducedMotion: systemReducedMotion };
    } catch {}
    const hydration = window.setTimeout(() => {
      setSettings(loaded);
      settingsRef.current = loaded;
      setSettingsLoaded(true);
    }, 0);
    return () => window.clearTimeout(hydration);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    if (!settingsLoaded) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || introStage !== "checking") return;
    let hasChoice = false;
    try {
      hasChoice = window.localStorage.getItem(INTRO_CHOICE_KEY) !== null;
    } catch {}
    const syncIntro = window.setTimeout(() => {
      setIntroMode("safe");
      setIntroStage(hasChoice ? "hidden" : "consent");
    }, 0);
    return () => window.clearTimeout(syncIntro);
  }, [introStage, settings.reducedFlashes, settings.reducedMotion, settingsLoaded]);

  const rememberIntroChoice = useCallback((choice: string) => {
    try {
      window.localStorage.setItem(
        INTRO_CHOICE_KEY,
        JSON.stringify({ version: 4, choice, chosenAt: new Date().toISOString() }),
      );
    } catch {}
  }, []);

  const chooseIntroMode = useCallback((mode: IntroMode) => {
    rememberIntroChoice(mode);
    setIntroMode(mode);
    setIntroStage("playing");
  }, [rememberIntroChoice]);

  const refuseIntro = useCallback(() => {
    rememberIntroChoice("refused");
    setIntroStage("hidden");
  }, [rememberIntroChoice]);

  const finishIntro = useCallback(() => {
    rememberIntroChoice("completed-or-skipped");
    setIntroStage("hidden");
  }, [rememberIntroChoice]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!audioFocusMutedRef.current) {
      soundEngineRef.current?.setEnabled(soundEnabled);
    }
  }, [soundEnabled]);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
    if (!audioFocusMutedRef.current) {
      getOstPlayer().setEnabled(musicEnabled);
    }
  }, [musicEnabled]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    if (!audioFocusMutedRef.current) {
      voiceEngineRef.current?.setEnabled(voiceEnabled);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    soundEngineRef.current?.setReneeEnabled(settings.reneeVoice);
    reneeDirectorRef.current?.setEnabled(settings.reneeVoice);
  }, [settings.reneeVoice]);

  const updateSetting = useCallback(
    (key: keyof GameSettings, value: boolean) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    const root = document.documentElement;
    const visualViewport = window.visualViewport;
    let followupFrame = 0;

    const syncViewport = () => {
      const [width, height] = resolveGameViewport(window);
      const landscape = width > height;

      root.style.setProperty("--app-width", `${width}px`);
      root.style.setProperty("--app-height", `${height}px`);
      root.classList.toggle(
        "viewport-landscape-compact",
        landscape && height <= 560,
      );
      root.classList.toggle(
        "viewport-landscape-tight",
        landscape && height <= 360,
      );

      cancelAnimationFrame(followupFrame);
      followupFrame = requestAnimationFrame(() => {
        const [settledWidth, settledHeight] = resolveGameViewport(window);
        root.style.setProperty("--app-width", `${settledWidth}px`);
        root.style.setProperty("--app-height", `${settledHeight}px`);
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);

    return () => {
      cancelAnimationFrame(followupFrame);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      visualViewport?.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("scroll", syncViewport);
      root.classList.remove(
        "viewport-landscape-compact",
        "viewport-landscape-tight",
      );
    };
  }, []);

  const publishHud = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { tank, formation } = runtime;
    const ground = terrainSurfaceAt(tank.x, tank.z);
    const target = runtime.defenders.find(
      (defender) =>
        defender.alive && defender.id === runtime.selectedTargetId,
    );
    const targetAngle = target
      ? Math.atan2(target.z - tank.z, target.x - tank.x)
      : tank.turret;
    const targetReady =
      !!target &&
      Math.abs(angleDelta(tank.turret, targetAngle)) < 0.08 &&
      Math.abs(angleDelta(tank.angle, targetAngle)) < 0.64;
    const nearestWire = runtime.wires.find(
      (wire) => wire.z > formation.z - 18 && wire.z < formation.z + 180,
    );
    const nextNode = runtime.captureNodes.find((node) => !node.captured);
    const activeWake = activeBreachWakeFor(runtime);
    const activeEchelon = defenseEchelonForRuntime(runtime);
    runtime.captureBlockers = captureBlockersFor(runtime, nextNode);
    runtime.nextLineDistance = Math.max(
      0,
      (nextNode?.z ?? formation.z) - formation.z,
    );
    setHud({
      time: runtime.elapsed,
      core: Math.max(0, tank.core),
      leftTread: Math.max(0, tank.leftTread),
      rightTread: Math.max(0, tank.rightTread),
      front: Math.max(0, tank.armor.front),
      left: Math.max(0, tank.armor.left),
      right: Math.max(0, tank.armor.right),
      rear: Math.max(0, tank.armor.rear),
      leftSpool: tank.leftSpool,
      rightSpool: tank.rightSpool,
      cohesion: formation.cohesion,
      suppression: formation.suppression,
      casualties: formation.casualties,
      connected: formation.connected,
      formationState: formation.state,
      breachWakeSeconds: activeWake
        ? Math.max(0, activeWake.expiresAt - runtime.elapsed)
        : 0,
      capturedGround: formation.capturedGround,
      distance: Math.max(0, tank.z - START_Z),
      enemyKills: runtime.enemyKills,
      crushedEnemies: runtime.crushedEnemies,
      heCycle: runtime.heCycle,
      heArmed:
        runtime.heCycle >= heShotInterval(1) - 1,
      bowLevel: runtime.grafts["bow-gunner"],
      topLevel: runtime.grafts["top-gunner"],
      scuteLevel: 0,
      caption: runtime.caption,
      targetLabel: target ? defenderLabel(target.kind) : "NO TARGET",
      targetReady,
      formationWidth: formation.width,
      corridorWidth: nearestWire?.gapWidth ?? formation.width,
      phase: runtime.director.phase,
      totalGrafts: runtime.totalGrafts,
      pendingOfferTokens: runtime.pendingGraftSource ? 1 : 0,
      nutrientXp: runtime.nutrientXp,
      nutrientLevel: runtime.nutrientLevel,
      captureBlockers: runtime.captureBlockers,
      nextLineDistance: runtime.nextLineDistance,
      nextGraftTarget: nutrientTargetForLevel(runtime.nutrientLevel),
      defenseState: `${DEFENSE_ECHELON_LABEL[activeEchelon]} · ${ground.region.toUpperCase()} · ${ground.landform.replaceAll("-", " ").toUpperCase()} · ${ground.encounter.replaceAll("-", " ").toUpperCase()}`,
      lossCause: runtime.director.lossCause ?? "",
      graftLevels: { ...runtime.grafts },
      offspring: activeOffspring(runtime.grafts),
      foreignExpressionState: runtime.broodRescue?.stage ?? "dormant",
      lineageEventLog: runtime.lineageEventLog,
    });
  }, []);

  const speakRenee = useCallback(
    (cue: ReneeCue) => {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.status === "dead" && cue.id !== "hull-death" && cue.id !== "party-death") return;
      const commandVoice = voiceEngineRef.current;
      if (commandVoice?.isSpeaking() && cue.priority < 90) return;
      commandVoice?.suppressFor((cue.duration + 0.75) * 1000);
      const played = soundEngineRef.current?.playReneeCue(cue.id);
      if (!played) return;
      getOstPlayer().duckFor(cue.duration + 0.35);
      runtime.caption = `RENEE — ${cue.text}`;
      runtime.captionClock = Math.max(runtime.captionClock, cue.duration + 0.8);
      publishHud();
    },
    [publishHud],
  );

  const leaveCare = useCallback(() => {
    window.clearTimeout(careAdvanceTimerRef.current);
    soundEngineRef.current?.stopReneeHum();
    getOstPlayer().setCareLayer(false);
    setCareBusy(false);
    setCareCompleted(false);
    setCareReneeCaption("");
    setCareBodyCaption("");
    setCareHumCaption("");
    setMenuPanel("main");
    setScreen("menu");
  }, []);

  const performCareAction = useCallback(() => {
    if (careBusy || careCompleted) return;
    const step = CARE_SEQUENCE[careStepIndex];
    if (!step) return;
    const sound = soundEngineRef.current;
    const cue = step.reneeCue ? RENEE_CUES[step.reneeCue] : null;
    setCareBusy(true);
    setCareReneeCaption(cue?.text ?? "");
    setCareBodyCaption(
      step.bodyCues.map((id: keyof typeof FERRAVINE_CARE_CUES) => FERRAVINE_CARE_CUES[id].caption).join(" "),
    );
    setCareHumCaption(RENEE_HUM_LOOPS[step.hum].caption);
    sound?.stopReneeHum();
    if (cue && settings.reneeVoice) {
      sound?.playReneeCue(cue.id);
      getOstPlayer().duckFor(cue.duration + 0.35);
    }
    const voiceDelayMs = cue && settings.reneeVoice ? cue.duration * 1000 + 350 : 0;
    window.setTimeout(() => {
      sound?.playReneeCareFoley(step.careFoley);
      step.bodyCues.forEach((id: keyof typeof FERRAVINE_CARE_CUES, index: number) => {
        window.setTimeout(() => sound?.playFerravineCareCue(id), index * 700);
      });
    }, voiceDelayMs);
    const bodyDurationMs = Math.max(1, step.bodyCues.length) * 700;
    if (!cue) {
      window.setTimeout(() => sound?.playReneeHum(step.hum), voiceDelayMs + bodyDurationMs + 450);
    }
    const holdSeconds = Math.max(2.2, (voiceDelayMs + bodyDurationMs + 900) / 1000);
    window.clearTimeout(careAdvanceTimerRef.current);
    careAdvanceTimerRef.current = window.setTimeout(() => {
      if (careStepIndex >= CARE_SEQUENCE.length - 1) {
        setCareCompleted(true);
        setCareBusy(false);
        return;
      }
      setCareStepIndex((index) => index + 1);
      setCareBusy(false);
    }, holdSeconds * 1000);
  }, [careBusy, careCompleted, careStepIndex, settings.reneeVoice]);

  const beginCare = useCallback(async () => {
    setEngineState("building");
    const music = getOstPlayer();
    music.setEnabled(musicEnabled);
    music.setCareLayer(true);
    const sound = soundEngineRef.current ?? new SoundEngine();
    soundEngineRef.current = sound;
    sound.setEnabled(soundEnabled);
    sound.setReneeEnabled(settings.reneeVoice);
    await Promise.all([music.start(), sound.start()]);
    setCareStepIndex(0);
    setCareBusy(false);
    setCareCompleted(false);
    setCareReneeCaption("");
    setCareBodyCaption("");
    setCareHumCaption("");
    setPaused(false);
    setScreen("care");
    setEngineState("ready");
  }, [musicEnabled, settings.reneeVoice, soundEnabled]);

  const startGame = useCallback(() => {
    getOstPlayer().setCareLayer(false);
    soundEngineRef.current?.stopReneeHum();
    const music = getOstPlayer();
    music.setEnabled(musicEnabled);
    void music.start();
    const sound = soundEngineRef.current ?? new SoundEngine();
    soundEngineRef.current = sound;
    sound.setEnabled(soundEnabled);
    sound.setReneeEnabled(settings.reneeVoice);
    void sound.start();
    const reneeDirector = new ReneeDirector(speakRenee);
    reneeDirector.setEnabled(settings.reneeVoice);
    reneeDirectorRef.current = reneeDirector;
    const voice =
      voiceEngineRef.current ??
      new TankKataVoiceConductor(music, (caption, seconds) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        runtime.caption = caption;
        runtime.captionClock = seconds;
      });
    voiceEngineRef.current = voice;
    voice.setEnabled(voiceEnabled);
    void voice.unlock();
    const old = runtimeRef.current;
    if (old) {
      projectilePoolRef.current.push(...old.projectiles.splice(0));
      explosionPoolRef.current.push(...old.explosions.splice(0));
      crushMarkPoolRef.current.push(...old.crushMarks.splice(0));
    }
    projectilePoolRef.current.length = Math.min(
      projectilePoolRef.current.length,
      MAX_POOLED_PROJECTILES,
    );
    explosionPoolRef.current.length = Math.min(
      explosionPoolRef.current.length,
      MAX_POOLED_EXPLOSIONS,
    );
    crushMarkPoolRef.current.length = Math.min(
      crushMarkPoolRef.current.length,
      MAX_POOLED_CRUSH_MARKS,
    );
    // First entry preserves the cold-start seed. A completed/lost run advances
    // to another deterministic battlefield rather than replaying the same
    // oatmeal with different corpses.
    const nextSeed = old?.status === "dead" ? old.worldSeed + 1 : (old?.worldSeed ?? coldSeed);
    setTerrainSeed(nextSeed);
    setEngineState("building");
    setRendererState("ready");
    setCanonizationOpen(false);

    // Two frames guarantee that the title card and its waking state reach the
    // compositor before deterministic terrain and defenses are constructed.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const runtime = initialRuntime();
          runtime.width = old?.width ?? 1;
          runtime.height = old?.height ?? 1;
          runtime.dpr = old?.dpr ?? 1;
          runtime.status = "playing";
          const qaWeapon = new URLSearchParams(window.location.search).get("qaWeapon");
          if (qaWeapon === "he") {
            runtime.heCycle = heShotInterval(1) - 1;
          }
          runtimeRef.current = runtime;
          voice.resetForRun();
          voice.trigger("force-enters");
          setHasActiveRun(true);
          setPaused(false);
          setMenuPanel("main");
          setOfferGraftKeys(ROOT_GRAFT_KEYS);
          setScreen("playing");
          setEngineState("ready");
          publishHud();
          requestAnimationFrame(() => canvasRef.current?.focus());
        } catch (error) {
          console.error("Through the Slit battlefield construction failed", error);
          setEngineState("failed");
        }
      });
    });
  }, [coldSeed, musicEnabled, publishHud, settings.reneeVoice, soundEnabled, speakRenee, voiceEnabled]);

  const clearLiveInput = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.keys.clear();
    runtime.tank.leftDemand = 0;
    runtime.tank.rightDemand = 0;
    pointers.current.left = null;
    pointers.current.right = null;
    soundEngineRef.current?.syncTreads({
      leftSpool: 0,
      rightSpool: 0,
      forwardVelocity: 0,
      yawVelocity: 0,
      core: runtime.tank.core,
      leftTread: runtime.tank.leftTread,
      rightTread: runtime.tank.rightTread,
      suppression: runtime.formation.suppression,
    });
  }, []);

  const pauseGame = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.status !== "playing" || screen !== "playing") return;
    clearLiveInput();
    setMenuPanel("main");
    setPaused(true);
  }, [clearLiveInput, screen]);

  const resumeGame = useCallback(() => {
    setMenuPanel("main");
    setPaused(false);
    requestAnimationFrame(() => canvasRef.current?.focus());
  }, []);

  const returnToMainMenu = useCallback(() => {
    getOstPlayer().setCareLayer(false);
    soundEngineRef.current?.stopReneeHum();
    clearLiveInput();
    setPaused(true);
    setMenuPanel("main");
    setScreen("menu");
  }, [clearLiveInput]);

  const resumeFromMainMenu = useCallback(() => {
    if (!hasActiveRun || runtimeRef.current?.status !== "playing") {
      startGame();
      return;
    }
    setScreen("playing");
    resumeGame();
  }, [hasActiveRun, resumeGame, startGame]);

  const openSettings = useCallback((origin: SettingsOrigin) => {
    setSettingsOrigin(origin);
    setMenuPanel("settings");
  }, []);

  useEffect(() => {
    const muteForLostFocus = () => {
      if (audioFocusMutedRef.current) return;
      audioFocusMutedRef.current = true;
      void soundEngineRef.current?.surrenderAudioFocus();
      voiceEngineRef.current?.surrenderAudioFocus();
      getOstPlayer().surrenderAudioFocus();
    };
    const restoreFocusedAudio = () => {
      if (!audioFocusMutedRef.current || document.hidden) return;
      audioFocusMutedRef.current = false;
      void soundEngineRef.current?.reclaimAudioFocus(soundEnabledRef.current);
      voiceEngineRef.current?.setEnabled(voiceEnabledRef.current);
      voiceEngineRef.current?.reclaimAudioFocus();
      getOstPlayer().setEnabled(musicEnabledRef.current);
      void getOstPlayer().reclaimAudioFocus();
    };
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key.toLowerCase() !== "p") return;
      if (screen !== "playing" || runtimeRef.current?.status !== "playing") return;
      event.preventDefault();
      if (pausedRef.current) resumeGame();
      else pauseGame();
    };
    const onVisibilityChange = () => {
      if (document.hidden) muteForLostFocus();
      else restoreFocusedAudio();
      if (
        document.hidden &&
        settingsRef.current.autoPause &&
        screen === "playing" &&
        runtimeRef.current?.status === "playing" &&
        !pausedRef.current
      ) {
        pauseGame();
      }
    };
    const onBlur = () => {
      muteForLostFocus();
      if (
        settingsRef.current.autoPause &&
        screen === "playing" &&
        runtimeRef.current?.status === "playing" &&
        !pausedRef.current
      ) {
        pauseGame();
      }
    };
    const onFocus = () => restoreFocusedAudio();
    const onPageHide = () => muteForLostFocus();
    window.addEventListener("keydown", onGlobalKeyDown);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pauseGame, resumeGame, screen]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      soundEngineRef.current?.setEnabled(next);
      if (next) void soundEngineRef.current?.start();
      return next;
    });
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((current) => {
      const next = !current;
      getOstPlayer().setEnabled(next);
      return next;
    });
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((current) => {
      const next = !current;
      voiceEngineRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  const chooseGraft = useCallback(
    (graft: GraftChoice) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const source = runtime.pendingGraftSource;
      if (runtime.status !== "graft" || source === null) return;
      const offspringBefore = activeOffspring(runtime.grafts);
      runtime.grafts[graft.key] += 1;
      runtime.totalGrafts += 1;
      runtime.offeredAt += 1;
      runtime.graftBloom = {
        title: graft.title,
        tree: graft.tree,
        level: runtime.grafts[graft.key],
        age: 0,
        life: 1.35,
        offspring: false,
      };
      soundEngineRef.current?.playGraft(runtime.grafts[graft.key], false);
      reneeDirectorRef.current?.signal("graft-complete", runtime.elapsed);
      const spentLevel = spendNutrientLevel(
        runtime.nutrientXp,
        runtime.nutrientLevel,
      );
      if (!spentLevel) return;
      runtime.nutrientXp = spentLevel.nutrientXp;
      runtime.nutrientLevel = spentLevel.nutrientLevel;
      if (graft.key === "bow-gunner") runtime.bowOrganClocks.push(0.08);
      if (graft.key === "top-gunner") runtime.topOrganClocks.push(0.12);
      if (graft.key === "rib-mortar-brood") runtime.mortarOrganClocks.push(0.2);
      if (graft.key === "rifle-choir") runtime.choirOrganClocks.push(0.16);
      if (graft.key === "sapper-brood") {
        runtime.formation.width = Math.min(190, runtime.formation.width + 8);
        runtime.formation.cohesion = Math.min(100, runtime.formation.cohesion + 6);
      }
      runtime.caption = `${graft.title.toUpperCase()} ${runtime.grafts[graft.key]} GRAFTED — NOTHING REPLACED`;
      runtime.captionClock = 4;
      runtime.pendingGraftSource = null;
      runtime.caption = `${graft.title.toUpperCase()} GRAFTED — LEVEL ${runtime.nutrientLevel} FED FROM THE FIELD`;
      const newborn = activeOffspring(runtime.grafts).filter(
        (name) => !offspringBefore.includes(name),
      );
      if (newborn.length > 0) {
        runtime.caption = `${newborn.join(" + ").toUpperCase()} BORN — BOTH PARENT ORGANS REMAIN`;
        runtime.captionClock = 5;
        runtime.graftBloom = {
          title: newborn.join(" + "),
          tree: "OFFSPRING · CROSS-GRAFT",
          level: 1,
          age: 0,
          life: 1.75,
          offspring: true,
        };
        soundEngineRef.current?.playGraft(runtime.grafts[graft.key], true);
        reneeDirectorRef.current?.signal("offspring-born", runtime.elapsed, true);
      }
      runtime.status = "playing";
      setScreen("playing");
      publishHud();
      canvasRef.current?.focus();
    },
    [publishHud],
  );

  useEffect(() => {
    if (engineState !== "ready" || !runtimeRef.current) return;
    const canvas = canvasRef.current;
    const terrainCanvas = terrainCanvasRef.current;
    if (!canvas || !terrainCanvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let terrainRenderer: ThreeTypes.WebGLRenderer;
    try {
      terrainRenderer = new THREE.WebGLRenderer({
        canvas: terrainCanvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      canvas.dataset.renderer = "webgl-unavailable";
      queueMicrotask(() => setRendererState("failed"));
      return;
    }
    terrainRenderer.outputColorSpace = THREE.SRGBColorSpace;
    terrainRenderer.toneMapping = THREE.NeutralToneMapping;
    terrainRenderer.toneMappingExposure = 0.92;
    terrainRenderer.setClearColor(0x000000, 0);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      canvas.dataset.renderer = "webgl-context-lost";
      setRendererState("failed");
    };
    terrainCanvas.addEventListener("webglcontextlost", onContextLost);

    type SpriteAtlas = {
      image: HTMLImageElement;
      ready: boolean;
      failed: boolean;
    };
    const loadAtlas = (src: string): SpriteAtlas => {
      const atlas: SpriteAtlas = {
        image: new Image(),
        ready: false,
        failed: false,
      };
      atlas.image.onload = () => {
        atlas.ready = true;
      };
      atlas.image.onerror = () => {
        atlas.failed = true;
      };
      atlas.image.src = src;
      return atlas;
    };
    const atlases = {
      enemy: loadAtlas("./sprites/v28/enemy-threats-sheet.png"),
      friendly: loadAtlas("./sprites/friendly-infantry-fleshpunk-v43.png"),
      effects: loadAtlas("./sprites/v28/impact-effects-sheet.png"),
      environment: loadAtlas("./sprites/v43-environment-atlas-hyperbolic-hair.png"),
      threats: loadAtlas("./sprites/v31/threat-variants-atlas-v31.png"),
      vfx: loadAtlas("./sprites/v31/vfx-atlas-v31.png"),
      martyrsWinch: loadAtlas("./sprites/martyrs-winch-ancestor-v82.png"),
      sapperBrood: loadAtlas("./sprites/sapper-brood-martyrs-winch-v81.png"),
    };
    const terrainScene = new THREE.Scene();
    terrainScene.fog = new THREE.Fog(0x686866, 510, 1120);
    terrainScene.add(new THREE.HemisphereLight(0xaeb7bd, 0x211b17, 1.68));
    const battlefieldLight = new THREE.DirectionalLight(0xd2aa8d, 2.04);
    battlefieldLight.position.set(-340, 520, -180);
    terrainScene.add(battlefieldLight);

    const textureLoader = new THREE.TextureLoader();
    const skyboxTexture = textureLoader.load(
      SKYBOX_URL,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = Math.min(
          4,
          terrainRenderer.capabilities.getMaxAnisotropy(),
        );
        texture.needsUpdate = true;
        terrainScene.background = texture;
        terrainScene.backgroundIntensity = 0.86;
        terrainCanvas.dataset.skybox = "equirectangular-ready";
      },
      undefined,
      () => {
        terrainCanvas.dataset.skybox = "css-fallback";
      },
    );
    const groundTextureState = { ready: false, failed: false };
    const configureGroundTexture = (texture: ThreeTypes.Texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      // The terrain texture is intentionally resolved as stable world-space
      // texels. Nearest filtering keeps the mud chunky without lowering the
      // skybox or sprite resolution, while nearest mip selection prevents the
      // distant ground from becoming a glittering alias field.
      texture.minFilter = THREE.NearestMipmapNearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(
        2,
        terrainRenderer.capabilities.getMaxAnisotropy(),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };
    // Rasterize the ground once into a tiny authored palette texture. This
    // gives the terrain 96 stable world-space texels per repeat without a
    // custom fragment shader or a screen-space post-process. The previous
    // mobile shader could fail before its first draw; Three's built-in toon
    // material keeps the same look on the engine's proven render path.
    const pixelGroundCanvas = document.createElement("canvas");
    pixelGroundCanvas.width = 96;
    pixelGroundCanvas.height = 96;
    const pixelGroundContext = pixelGroundCanvas.getContext("2d");
    if (pixelGroundContext) {
      pixelGroundContext.fillStyle = "#55483a";
      pixelGroundContext.fillRect(0, 0, 96, 96);
    }
    const groundColorTexture = new THREE.CanvasTexture(pixelGroundCanvas);
    configureGroundTexture(groundColorTexture);
    const groundImage = new Image();
    groundImage.onload = () => {
      if (!pixelGroundContext) {
        groundTextureState.failed = true;
        return;
      }
      pixelGroundContext.imageSmoothingEnabled = true;
      pixelGroundContext.drawImage(groundImage, 0, 0, 96, 96);
      // Crush the source into a small, bruised battlefield palette once. The
      // texture remains matte; wetness is carried by hard authored crater and
      // water sprites instead of a broad specular sheet.
      const pixels = pixelGroundContext.getImageData(0, 0, 96, 96);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const dither = ((index / 4) % 4) * 2;
        pixels.data[index] = Math.floor((pixels.data[index] * 0.92 + 10 + dither) / 12) * 12;
        pixels.data[index + 1] = Math.floor((pixels.data[index + 1] * 0.82 + dither) / 12) * 12;
        pixels.data[index + 2] = Math.floor((pixels.data[index + 2] * 0.78 + 4) / 12) * 12;
      }
      pixelGroundContext.putImageData(pixels, 0, 0);
      groundColorTexture.needsUpdate = true;
      groundTextureState.ready = true;
    };
    groundImage.onerror = () => {
      groundTextureState.failed = true;
    };
    groundImage.src = "./textures/muddy-ground-v29.webp";

    const toonBands = new Uint8Array([42, 91, 154, 224]);
    const toonGradient = new THREE.DataTexture(
      toonBands,
      toonBands.length,
      1,
      THREE.RedFormat,
    );
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.generateMipmaps = false;
    toonGradient.needsUpdate = true;
    const terrainMaterial = new THREE.MeshToonMaterial({
      color: 0xd4b9a0,
      map: groundColorTexture,
      gradientMap: toonGradient,
      vertexColors: true,
      fog: true,
    });
    terrainCanvas.dataset.terrainShader = "engine-toon-four-band-v61";
    terrainCanvas.dataset.terrainPixelSpace = "world-locked-96-texel-canvas";
    terrainCanvas.dataset.terrainSpecular = "none-authored-wet-decals-only";

    // These are true GPU meshes on an immutable global lattice. Moving the
    // landship changes the camera; only an explicit crater changes vertices.
    const TERRAIN_CHUNK_SIZE = 240;
    const TERRAIN_CHUNK_SUBDIVISIONS =
      TERRAIN_CHUNK_SIZE / TERRAIN_GRID_STEP;
    const TERRAIN_TEXTURE_WORLD_SIZE = 185;
    const TERRAIN_VIEW_RADIUS = 1320;
    const TERRAIN_RECYCLE_RADIUS = 1680;
    // Chunks whose centers fall inside this radius make up the floor directly
    // beneath and immediately ahead of the observation slit. They are a
    // correctness budget, not an optional scenery budget: build them before
    // distant chunks and never let a second frustum test make them disappear.
    const TERRAIN_NEAR_FIELD_RADIUS = TERRAIN_CHUNK_SIZE * 0.9;
    const terrainChunks = new Map<string, TerrainChunk>();
    // Artillery changes only the chunks touched by a crater. The previous
    // global revision invalidated every visible mesh for every shell; chunks
    // that missed the two-build phone budget were then hidden for a frame,
    // making the battlefield blink during a barrage.
    const terrainDirtyChunks = new Set<string>();

    const markCraterChunksDirty = (crater: TerrainCrater) => {
      const influence = crater.radius * 1.18 + TERRAIN_GRID_STEP;
      const firstChunkX = Math.floor((crater.x - influence) / TERRAIN_CHUNK_SIZE);
      const lastChunkX = Math.floor((crater.x + influence) / TERRAIN_CHUNK_SIZE);
      const firstChunkZ = Math.floor((crater.z - influence) / TERRAIN_CHUNK_SIZE);
      const lastChunkZ = Math.floor((crater.z + influence) / TERRAIN_CHUNK_SIZE);
      for (let chunkZ = firstChunkZ; chunkZ <= lastChunkZ; chunkZ += 1) {
        for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX += 1) {
          const key = `${chunkX}:${chunkZ}`;
          // A chunk created later samples the current crater list immediately;
          // only already-painted meshes need an invalidation marker.
          if (terrainChunks.has(key)) terrainDirtyChunks.add(key);
        }
      }
    };

    const paintTerrainGeometry = (
      geometry: ThreeTypes.BufferGeometry,
      originX: number,
      originZ: number,
      groundAt: (x: number, z: number) => number,
    ) => {
      const positions = geometry.getAttribute("position") as ThreeTypes.BufferAttribute;
      const colors = geometry.getAttribute("color") as ThreeTypes.BufferAttribute;
      const step = TERRAIN_CHUNK_SIZE / TERRAIN_CHUNK_SUBDIVISIONS;
      for (let row = 0; row <= TERRAIN_CHUNK_SUBDIVISIONS; row += 1) {
        for (let column = 0; column <= TERRAIN_CHUNK_SUBDIVISIONS; column += 1) {
          const index = row * (TERRAIN_CHUNK_SUBDIVISIONS + 1) + column;
          const worldX = originX + column * step;
          const worldZ = originZ + row * step;
          const elevation = groundAt(worldX, worldZ);
          positions.setY(index, elevation);
          const slopeX = groundAt(worldX + 3, worldZ) - groundAt(worldX - 3, worldZ);
          const slopeZ = groundAt(worldX, worldZ + 3) - groundAt(worldX, worldZ - 3);
          const slope = Math.hypot(slopeX, slopeZ) / 6;
          const mottling = (hash01(worldX * 0.071 + worldZ * 0.113) - 0.5) * 0.1;
          const shade = clamp(0.96 - slope * 0.08 + elevation * 0.002 + mottling, 0.64, 1.04);
          const surface = terrainSurfaceAt(worldX, worldZ);
          const regional = surface.region === "flanders"
            ? [0.68, 0.64, 0.52]
            : surface.region === "picardy"
              ? [1.02, 0.96, 0.78]
              : surface.region === "aisne"
                ? [0.88, 0.82, 0.67]
                : [0.66, 0.69, 0.55];
          const wetDarken = 1 - surface.wetness * 0.34;
          const trenchDarken = surface.trenchDistance < 18 ? 0.78 : 1;
          colors.setXYZ(
            index,
            shade * regional[0] * wetDarken * trenchDarken,
            shade * regional[1] * wetDarken * trenchDarken,
            shade * regional[2] * wetDarken * trenchDarken,
          );
        }
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    };

    const getTerrainChunk = (
      chunkX: number,
      chunkZ: number,
      groundAt: (x: number, z: number) => number,
      worldSeed: number,
    ) => {
      const key = `${chunkX}:${chunkZ}`;
      const cached = terrainChunks.get(key);
      if (cached) {
        if (cached.worldSeed !== worldSeed || terrainDirtyChunks.has(key)) {
          paintTerrainGeometry(
            cached.mesh.geometry,
            chunkX * TERRAIN_CHUNK_SIZE,
            chunkZ * TERRAIN_CHUNK_SIZE,
            groundAt,
          );
          cached.worldSeed = worldSeed;
          terrainDirtyChunks.delete(key);
        }
        return cached;
      }
      const originX = chunkX * TERRAIN_CHUNK_SIZE;
      const originZ = chunkZ * TERRAIN_CHUNK_SIZE;
      const step = TERRAIN_CHUNK_SIZE / TERRAIN_CHUNK_SUBDIVISIONS;
      const vertexCount = (TERRAIN_CHUNK_SUBDIVISIONS + 1) ** 2;
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      const indices: number[] = [];
      for (let row = 0; row <= TERRAIN_CHUNK_SUBDIVISIONS; row += 1) {
        for (let column = 0; column <= TERRAIN_CHUNK_SUBDIVISIONS; column += 1) {
          const index = row * (TERRAIN_CHUNK_SUBDIVISIONS + 1) + column;
          const localX = column * step;
          const localZ = row * step;
          positions[index * 3] = localX;
          positions[index * 3 + 2] = localZ;
          uvs[index * 2] = (originX + localX) / TERRAIN_TEXTURE_WORLD_SIZE;
          uvs[index * 2 + 1] = (originZ + localZ) / TERRAIN_TEXTURE_WORLD_SIZE;
        }
      }
      for (let row = 0; row < TERRAIN_CHUNK_SUBDIVISIONS; row += 1) {
        for (let column = 0; column < TERRAIN_CHUNK_SUBDIVISIONS; column += 1) {
          const a = row * (TERRAIN_CHUNK_SUBDIVISIONS + 1) + column;
          const b = a + 1;
          const d = (row + 1) * (TERRAIN_CHUNK_SUBDIVISIONS + 1) + column;
          const c = d + 1;
          indices.push(a, d, b, b, d, c);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      paintTerrainGeometry(geometry, originX, originZ, groundAt);
      const mesh = new THREE.Mesh(geometry, terrainMaterial);
      mesh.position.set(originX, 0, originZ);
      // renderTerrain already performs a bounded, camera-aware visibility
      // pass. Three's second frustum test could reject a displaced heightfield
      // at the bottom edge of the slit after a crater rebuild or sharp hull
      // pitch, exposing the sky below the battlefield.
      mesh.frustumCulled = false;
      terrainScene.add(mesh);
      const chunk = {
        key,
        centerX: originX + TERRAIN_CHUNK_SIZE * 0.5,
        centerZ: originZ + TERRAIN_CHUNK_SIZE * 0.5,
        mesh,
        worldSeed,
      };
      terrainDirtyChunks.delete(key);
      terrainChunks.set(key, chunk);
      return chunk;
    };

    const drawAtlasCell = (
      atlas: SpriteAtlas,
      cell: number,
      centerX: number,
      groundY: number,
      height: number,
      options: {
        alpha?: number;
        flip?: boolean;
        cropBottom?: number;
        rotation?: number;
        scaleY?: number;
        centered?: boolean;
      } = {},
    ) => {
      if (!atlas.ready) return false;
      const sourceWidth = atlas.image.naturalWidth / 4;
      const sourceHeight = atlas.image.naturalHeight / 3;
      const row = Math.floor(cell / 4);
      const column = cell % 4;
      const cropBottom = clamp(options.cropBottom ?? 0, 0, 0.42);
      const visibleSourceHeight = sourceHeight * (1 - cropBottom);
      const width = height * (sourceWidth / sourceHeight);
      const visibleHeight = height * (1 - cropBottom);
      context.save();
      context.globalAlpha = options.alpha ?? 1;
      context.imageSmoothingEnabled = false;
      context.translate(centerX, groundY);
      context.rotate(options.rotation ?? 0);
      context.scale(options.flip ? -1 : 1, options.scaleY ?? 1);
      context.drawImage(
        atlas.image,
        column * sourceWidth,
        row * sourceHeight,
        sourceWidth,
        visibleSourceHeight,
        -width / 2,
        options.centered ? -visibleHeight / 2 : -height,
        width,
        visibleHeight,
      );
      context.restore();
      return true;
    };

    const snapEffectPixel = (value: number) =>
      Math.round(value / EFFECT_PIXEL_GRID) * EFFECT_PIXEL_GRID;

    // Grounded battlefield art belongs in the same WebGL scene and depth
    // buffer as the terrain. The upper Canvas remains only for HUD/VFX that
    // are intentionally screen-space.
    const worldSpritePool: ThreeTypes.Sprite[] = [];
    const worldSpriteTextures = new Map<SpriteAtlas, Map<number, ThreeTypes.Texture>>();
    let worldSpriteCursor = 0;
    const scenerySeatCache = new Map<string, number>();
    let scenerySeatRevision = -1;

    const scenerySeatHeight = (
      key: string,
      x: number,
      z: number,
      halfWidth: number,
      halfDepth: number,
      sink: number,
      runtime: Runtime,
    ) => {
      if (scenerySeatRevision !== runtime.terrainRevision) {
        scenerySeatCache.clear();
        scenerySeatRevision = runtime.terrainRevision;
      }
      const cached = scenerySeatCache.get(key);
      if (cached !== undefined) return cached;
      const seat = terrainFootprintSeatHeight(
        x,
        z,
        halfWidth,
        halfDepth,
        runtime.terrainCraters,
      ) - sink;
      scenerySeatCache.set(key, seat);
      return seat;
    };

    const textureForAtlasCell = (atlas: SpriteAtlas, cell: number) => {
      if (!atlas.ready) return null;
      let atlasCells = worldSpriteTextures.get(atlas);
      if (!atlasCells) {
        atlasCells = new Map();
        worldSpriteTextures.set(atlas, atlasCells);
      }
      const cached = atlasCells.get(cell);
      if (cached) return cached;

      const sourceWidth = atlas.image.naturalWidth / 4;
      const sourceHeight = atlas.image.naturalHeight / 3;
      const row = Math.floor(cell / 4);
      const column = cell % 4;
      const isFriendlyAtlas = atlas === atlases.friendly;
      const cleanPoseRect =
        atlas === atlases.enemy
          ? ENEMY_ATLAS_POSE_RECTS[cell]
          : atlas === atlases.threats
            ? THREAT_ATLAS_POSE_RECTS[cell]
            : undefined;
      const woundedRow = isFriendlyAtlas && row === 2;
      const kneelingRow = isFriendlyAtlas && row === 1;
      const sourceY =
        row * sourceHeight -
        (woundedRow ? FRIENDLY_ATLAS_VERTICAL_OVERLAP : 0);
      const sourceDrawHeight =
        sourceHeight -
        (kneelingRow ? FRIENDLY_ATLAS_VERTICAL_OVERLAP : 0);
      const cellCanvas = document.createElement("canvas");
      cellCanvas.width = sourceWidth;
      cellCanvas.height = sourceHeight;
      const cellContext = cellCanvas.getContext("2d");
      if (!cellContext) return null;
      if (cleanPoseRect) {
        const inset = 2;
        const scale = Math.min(
          1,
          (sourceWidth - inset * 2) / cleanPoseRect.width,
          (sourceHeight - inset * 2) / cleanPoseRect.height,
        );
        const destinationWidth = cleanPoseRect.width * scale;
        const destinationHeight = cleanPoseRect.height * scale;
        cellContext.drawImage(
          atlas.image,
          cleanPoseRect.x,
          cleanPoseRect.y,
          cleanPoseRect.width,
          cleanPoseRect.height,
          (sourceWidth - destinationWidth) / 2,
          sourceHeight - destinationHeight - inset,
          destinationWidth,
          destinationHeight,
        );
      } else {
        cellContext.drawImage(
          atlas.image,
          column * sourceWidth,
          sourceY,
          sourceWidth,
          sourceDrawHeight,
          0,
          0,
          sourceWidth,
          sourceDrawHeight,
        );
      }
      const texture = new THREE.CanvasTexture(cellCanvas);
      const pixels = cellContext.getImageData(
        0,
        0,
        sourceWidth,
        sourceHeight,
      ).data;
      let lastOpaqueRow = sourceHeight - 1;
      findOpaqueBottom: for (let y = sourceHeight - 1; y >= 0; y -= 1) {
        for (let x = 0; x < sourceWidth; x += 1) {
          if (pixels[(y * sourceWidth + x) * 4 + 3] > 12) {
            lastOpaqueRow = y;
            break findOpaqueBottom;
          }
        }
      }
      // Atlas cells carry inconsistent transparent padding below their art.
      // Anchor the lowest visible pixel to the terrain and sink it a hair so
      // boots, wreckage, and trench lips make contact instead of hovering.
      texture.userData.groundAnchor = clamp(
        (sourceHeight - 1 - lastOpaqueRow) / sourceHeight + 0.012,
        0,
        0.18,
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(
        4,
        terrainRenderer.capabilities.getMaxAnisotropy(),
      );
      texture.needsUpdate = true;
      atlasCells.set(cell, texture);
      return texture;
    };

    const beginWorldSprites = () => {
      worldSpriteCursor = 0;
      for (const sprite of worldSpritePool) sprite.visible = false;
    };

    const drawWorldAtlasCell = (
      atlas: SpriteAtlas,
      cell: number,
      worldX: number,
      worldY: number,
      worldZ: number,
      height: number,
      options: {
        alpha?: number;
        flip?: boolean;
        rotation?: number;
        scaleX?: number;
        scaleY?: number;
        centered?: boolean;
      } = {},
    ) => {
      const texture = textureForAtlasCell(atlas, cell);
      if (!texture) return false;
      let sprite = worldSpritePool[worldSpriteCursor];
      if (!sprite) {
        const material = new THREE.SpriteMaterial({
          transparent: true,
          alphaTest: 0.06,
          depthTest: true,
          depthWrite: false,
          fog: true,
        });
        sprite = new THREE.Sprite(material);
        sprite.frustumCulled = true;
        terrainScene.add(sprite);
        worldSpritePool.push(sprite);
      }
      worldSpriteCursor += 1;
      const material = sprite.material as ThreeTypes.SpriteMaterial;
      material.map = texture;
      material.opacity = options.alpha ?? 1;
      material.rotation = -(options.rotation ?? 0);
      material.needsUpdate = true;
      const aspect = texture.image.width / texture.image.height;
      const visibleHeight = height * (options.scaleY ?? 1);
      sprite.center.set(
        0.5,
        options.centered ? 0.5 : (texture.userData.groundAnchor as number),
      );
      sprite.position.set(worldX, worldY, worldZ);
      sprite.scale.set(
        height * aspect * (options.scaleX ?? 1) * (options.flip ? -1 : 1),
        visibleHeight,
        1,
      );
      sprite.visible = true;
      return true;
    };

    let frame = 0;
    let redirectHeld = false;
    let previous = performance.now();
    let hudClock = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const runtime = runtimeRef.current;
      if (!runtime) return;
      // Screen-space art stays sharp at CSS-pixel resolution. The Three.js
      // terrain keeps a separate slightly higher budget on high-DPI screens.
      runtime.dpr = Math.min(
        window.devicePixelRatio || 1,
        COMBAT_RENDER_DPR_CAP,
      );
      const terrainDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      runtime.width = Math.max(1, rect.width);
      runtime.height = Math.max(1, rect.height);
      canvas.width = Math.floor(runtime.width * runtime.dpr);
      canvas.height = Math.floor(runtime.height * runtime.dpr);
      context.setTransform(runtime.dpr, 0, 0, runtime.dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      terrainRenderer.setPixelRatio(terrainDpr);
      terrainRenderer.setSize(runtime.width, runtime.height, false);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const setCaption = (runtime: Runtime, text: string, seconds = 3) => {
      runtime.caption = text;
      runtime.captionClock = seconds;
    };

    const beginAncestorRescue = (runtime: Runtime) => {
      if (runtime.ancestorResolved || runtime.ancestorRescue) return;
      const hostileContacts = runtime.defenders.filter(
        (defender) =>
          defender.alive &&
          Math.hypot(defender.x - runtime.tank.x, defender.z - runtime.tank.z) < 640,
      ).length;
      const armorDamage = Math.min(4.5, Math.max(0, runtime.tank.armor.front - 1));
      const organDamage = armorDamage > 0 ? 0 : Math.min(3, Math.max(0, runtime.tank.core - 1));
      runtime.tank.armor.front -= armorDamage;
      runtime.tank.core -= organDamage;
      runtime.ancestorRescue = {
        age: 0,
        stage: 0,
        hostileContacts: Math.max(1, hostileContacts),
        armorDamage,
        organDamage,
        assetIntegrity: 100,
        recoveredDistance: 0,
      };
      runtime.mainClock = Math.max(runtime.mainClock, 1.1);
      runtime.lineageEventLog =
        "Ancestor expression began: the landship opened Martyr's Winch under hostile pressure and accepted exposed tissue as the cost.";
      setCaption(
        runtime,
        "MARTYR'S WINCH OPENS — THE MAIN MOUTH PAUSES WHILE THE LANDSHIP TAKES THE LOAD",
        5,
      );
    };

    const updateAncestorRescue = (runtime: Runtime, dt: number) => {
      if (
        !runtime.ancestorRescue &&
        !runtime.ancestorResolved &&
        runtime.elapsed >= 16 &&
        runtime.formation.connected &&
        runtime.formation.cohesion > 20 &&
        runtime.defenders.some((defender) => defender.alive)
      ) {
        beginAncestorRescue(runtime);
      }
      const rescue = runtime.ancestorRescue;
      if (!rescue) return;
      if (runtime.ancestorResolved) {
        rescue.age += dt;
        if (rescue.age >= 9) runtime.ancestorRescue = null;
        return;
      }
      rescue.age += dt;
      rescue.stage = Math.min(8, Math.floor(rescue.age / 0.62));
      if (rescue.age >= 1.8) {
        runtime.mainClock = Math.max(runtime.mainClock, 0.3);
        rescue.assetIntegrity = Math.max(
          1,
          rescue.assetIntegrity - dt * (0.4 + runtime.formation.suppression / 80),
        );
        rescue.recoveredDistance = Math.min(96, (rescue.age - 1.8) * 22);
      }
      if (
        runtime.formation.cohesion <= 12 ||
        !runtime.formation.connected ||
        rescue.assetIntegrity <= 1
      ) {
        rescue.stage = rescue.assetIntegrity <= 1 ? 10 : 11;
        rescue.age = 6.2;
        runtime.ancestorResolved = true;
        runtime.lineageEventLog =
          "Ancestor expression failed under load. Knowledge retained; no Observed lineage created.";
        setCaption(runtime, "THE WINCH FAILS LOUDLY — MENDEL RECEIVES NO COUNTERFEIT OBSERVATION", 5);
        return;
      }
      if (rescue.recoveredDistance < 90 || rescue.age < 6.2) return;
      const discovery = evaluateMartyrsWinchDiscovery({
        runId: `breach-${runtime.worldSeed}`,
        eventId: `martyrs-winch-${runtime.worldSeed}-${Math.round(runtime.elapsed * 10)}`,
        elapsed: runtime.elapsed,
        endangeredAsset: true,
        hostileContacts: rescue.hostileContacts,
        exposedSeconds: rescue.age,
        armorDamage: rescue.armorDamage,
        organDamage: rescue.organDamage,
        suppressionPeak: runtime.formation.suppression,
        recoveredDistance: rescue.recoveredDistance,
        assetIntegrityAfter: rescue.assetIntegrity,
        formationConnectedAfter: runtime.formation.connected,
        formationCohesionAfter: runtime.formation.cohesion,
        priorQualifiedEvents: 0,
      });
      runtime.ancestorResolved = true;
      rescue.stage = discovery.qualifying ? 8 : 11;
      if (!discovery.qualifying) {
        runtime.lineageEventLog =
          `Ancestor expression remained knowledge only: ${discovery.failedRails.join(", ")}.`;
        setCaption(runtime, "THE BODY RETURNS, BUT THE EVIDENCE DOES NOT — NO LINEAGE ADVANCEMENT", 5);
        return;
      }
      persistLineage(
        createObservedLineage(discovery) as unknown as NonNullable<
          ReturnType<typeof loadObservedLineage>
        >,
      );
      runtime.formation.cohesion = Math.min(100, runtime.formation.cohesion + 7);
      runtime.lineageEventLog =
        "Observed: Martyr's Winch recovered a vulnerable ally under fire, paid in exposed tissue, and preserved formation integrity.";
      setCaption(
        runtime,
        "OBSERVED — THE BODY RETURNS. THE BUILD STILL DIES. MENDEL WAITS BEYOND THE BREACH.",
        6,
      );
    };

    const setBroodStage = (
      runtime: Runtime,
      rescue: BroodRescue,
      stage: ForeignExpressionStage,
    ) => {
      if (rescue.stage === stage) return;
      rescue.stage = stage;
      if (
        stage === "brace" ||
        stage === "refusal" ||
        stage === "contact" ||
        stage === "strain" ||
        stage === "success" ||
        stage === "overload" ||
        stage === "severed" ||
        stage === "casualty" ||
        stage === "canonical"
      ) {
        soundEngineRef.current?.playSapperRescue(
          stage === "refusal" ? "brace" : stage === "canonical" ? "success" : stage,
        );
      }
      rescue.soundStage = stage;
    };

    const beginForeignExpression = (runtime: Runtime) => {
      const lineage = runtime.submittedLineage;
      if (!lineage || runtime.broodRescue || runtime.foreignExpressionResolved) return;
      const expression = selectMartyrsWinchForeignExpression({
        lineage,
        terrainNeed: "breach-casualty-route",
        formationNeed: "endangered-asset",
        campaignContext: "later-breach",
      });
      if (!expression.eligible) return;
      const side = runtime.worldSeed % 2 === 0 ? -1 : 1;
      const hostileContacts = runtime.defenders.filter(
        (defender) =>
          defender.alive &&
          Math.hypot(
            defender.x - runtime.formation.x,
            defender.z - runtime.formation.z,
          ) < 620,
      ).length;
      runtime.broodRescue = {
        mode: "foreign",
        stage: "rotate",
        age: 0,
        startedAt: runtime.elapsed,
        originX: runtime.formation.x + side * 42,
        originZ: runtime.formation.z + 32,
        destinationX: runtime.formation.x + side * 126,
        destinationZ: runtime.formation.z - 44,
        x: runtime.formation.x + side * 42,
        z: runtime.formation.z + 32,
        movedDistance: 0,
        assetIntegrity: 100,
        organismsCommitted: 4,
        fireSupportWithheldSeconds: 0,
        terrainAnchors: 4,
        hostileContacts: Math.max(1, hostileContacts),
        soundStage: "rotate",
        deniedTargetX: 0,
        deniedTargetZ: 0,
        survivorsRecovered: 1,
      };
      runtime.lineageEventLog =
        "Foreign expression began: four Sapper Brood bodies left the firing line to recover a wounded ally.";
      setCaption(
        runtime,
        "THE LANDSHIP HAS NO WINCH — THE SAPPER BROOD TURNS TOWARD THE FALLEN",
        4.2,
      );
    };

    const beginCorrection = (runtime: Runtime) => {
      const lineage = runtime.correctionLineage;
      if (!lineage || runtime.broodRescue || runtime.foreignExpressionResolved) return;
      const side = runtime.worldSeed % 2 === 0 ? -1 : 1;
      const hostileContacts = runtime.defenders.filter(
        (defender) =>
          defender.alive &&
          Math.hypot(defender.x - runtime.formation.x, defender.z - runtime.formation.z) < 620,
      ).length;
      runtime.broodRescue = {
        mode: "correction",
        stage: "refusal",
        age: 0,
        startedAt: runtime.elapsed,
        originX: runtime.formation.x + side * 52,
        originZ: runtime.formation.z + 26,
        destinationX: runtime.formation.x - side * 132,
        destinationZ: runtime.formation.z - 58,
        x: runtime.formation.x + side * 52,
        z: runtime.formation.z + 26,
        movedDistance: 0,
        assetIntegrity: 100,
        organismsCommitted: 4,
        fireSupportWithheldSeconds: 0,
        terrainAnchors: 4,
        hostileContacts: Math.max(1, hostileContacts),
        soundStage: "refusal",
        deniedTargetX: runtime.formation.x + side * 152,
        deniedTargetZ: runtime.formation.z + 92,
        survivorsRecovered: 0,
      };
      runtime.lineageEventLog =
        "Correction conflict: the landship marked a captured anti-tank gun; the Sapper Brood refused and turned toward the casualty route.";
      setCaption(
        runtime,
        "RECOVER THE CAPTURED GUN — COMMAND REFUSED: THE CASUALTY ROAD IS THE BODY IN DANGER",
        6,
      );
    };

    const resolveCorrection = (runtime: Runtime, rescue: BroodRescue) => {
      const lineage = runtime.correctionLineage;
      if (runtime.foreignExpressionResolved || !lineage) return;
      runtime.foreignExpressionResolved = true;
      rescue.survivorsRecovered = 3;
      void import("./correction-runtime.mjs")
        .then(({ correctAndCanonizeMartyrsWinch }) => {
          const { evaluation, canonical } = correctAndCanonizeMartyrsWinch(lineage, {
            runId: `breach-${runtime.worldSeed}`,
            eventId: `sapper-correction-${runtime.worldSeed}-${Math.round(rescue.startedAt * 10)}`,
            elapsed: runtime.elapsed,
            playerPriority: "recover-captured-gun",
            successorPriority: "clear-casualty-route",
            playerCommandRedirected: true,
            immediateProfitDenied: true,
            endangeredFormation: true,
            casualtyRoutePreserved: true,
            survivorsRecovered: rescue.survivorsRecovered,
            organismsCommitted: rescue.organismsCommitted,
            fireSupportWithheldSeconds: rescue.fireSupportWithheldSeconds,
            hostileContacts: rescue.hostileContacts,
            formationCohesionAfter: runtime.formation.cohesion,
            capabilityUsefulAfterRefusal: true,
          });
          if (!evaluation.qualifying || !canonical) {
            runtime.lineageEventLog =
              "Correction remained inconclusive. The gun was denied, but the casualty route did not survive intact.";
            setBroodStage(runtime, rescue, "casualty");
            setCaption(runtime, "MENDEL WITHHOLDS THE THIRD MARK — REFUSAL WITHOUT PRESERVATION IS NOT WISDOM", 5);
            return;
          }
          persistLineage(
            canonical as unknown as NonNullable<ReturnType<typeof loadLineageInState>>,
          );
          runtime.correctionLineage = null;
          runtime.formation.cohesion = Math.min(100, runtime.formation.cohesion + 14);
          runtime.formation.suppression = Math.max(0, runtime.formation.suppression - 18);
          setBroodStage(runtime, rescue, "canonical");
          setCanonizationOpen(true);
          runtime.lineageEventLog =
            "Canonical: the Sapper Brood denied the profitable gun, preserved the casualty route, and released rescue jurisdiction into future coalition possibility.";
          setCaption(
            runtime,
            "CANONICAL — THE GUN ROTS. THREE LIVING BODIES RETURN. THE ARMY LEARNED.",
            7,
          );
        })
        .catch(() => {
          runtime.lineageEventLog =
            "Correction evidence could not be sealed. The lineage remains at foreign expression.";
          setBroodStage(runtime, rescue, "casualty");
          setCaption(runtime, "MENDEL'S SEAL FAILS — THE LINEAGE DOES NOT ADVANCE ON AN AMBIGUOUS WRITE", 5);
        });
    };

    const resolveForeignExpression = (
      runtime: Runtime,
      rescue: BroodRescue,
      outcome: "success" | "overload" | "severed" | "casualty",
    ) => {
      if (runtime.foreignExpressionResolved) return;
      if (rescue.mode === "correction") {
        runtime.foreignExpressionResolved = true;
        setBroodStage(runtime, rescue, outcome);
        runtime.lineageEventLog =
          `Correction failed: ${outcome}. The refusal was real, but the casualty route did not survive; canonization remains withheld.`;
        setCaption(
          runtime,
          "THE BROOD REFUSED THE GUN, BUT COULD NOT SAVE THE ROAD — NO FALSE CANON",
          5.5,
        );
        return;
      }
      runtime.foreignExpressionResolved = true;
      setBroodStage(runtime, rescue, outcome);
      if (outcome !== "success" || !runtime.submittedLineage) {
        runtime.lineageEventLog = `Foreign expression failed: ${outcome}. Evidence retained; no lineage advancement.`;
        setCaption(
          runtime,
          outcome === "severed"
            ? "THE SHARED TENDON PARTS — THE BROOD COVERS THE FALLEN"
            : outcome === "casualty"
              ? "ONE BODY TAKES THE LOAD — THE OTHERS REFUSE TO ABANDON IT"
              : "THE BROOD BUCKLES UNDER THE SHARED WEIGHT — NO FALSE INHERITANCE",
          5,
        );
        return;
      }
      const evaluation = evaluateMartyrsWinchForeignExpression({
        runId: `breach-${runtime.worldSeed}`,
        eventId: `sapper-brood-${runtime.worldSeed}-${Math.round(rescue.startedAt * 10)}`,
        elapsed: runtime.elapsed,
        lineageState: runtime.submittedLineage.state,
        vessel: MARTYRS_WINCH.foreignVesselId,
        expression: MARTYRS_WINCH.foreignExpressionId,
        organismsCommitted: rescue.organismsCommitted,
        fireSupportWithheldSeconds: rescue.fireSupportWithheldSeconds,
        terrainAnchors: rescue.terrainAnchors,
        hostileContacts: rescue.hostileContacts,
        movedDistance: rescue.movedDistance,
        assetIntegrityAfter: rescue.assetIntegrity,
        formationCohesionAfter: runtime.formation.cohesion,
        responsibilityPreserved: true,
        outcome,
      });
      if (!evaluation.qualifying) {
        runtime.lineageEventLog =
          "Foreign expression remained inconclusive. Evidence retained; no lineage advancement.";
        setCaption(runtime, "THE BODY LIVES — MENDEL WITHHOLDS THE SECOND MARK", 4.6);
        return;
      }
      const advanced = recordMartyrsWinchForeignExpression(
        runtime.submittedLineage,
        evaluation,
      );
      persistLineage(
        advanced as unknown as NonNullable<ReturnType<typeof loadSubmittedLineage>>,
      );
      runtime.submittedLineage = null;
      runtime.formation.cohesion = Math.min(100, runtime.formation.cohesion + 10);
      runtime.lineageEventLog =
        "Foreign expression witnessed: the Sapper Brood preserved the rescue responsibility in an unlike vessel. Correction remains required.";
      setCaption(
        runtime,
        "THE BODY MOVES. THE TANK RECEIVES NOTHING. THE WAR PARTY REMEMBERS DIFFERENTLY.",
        6,
      );
    };

    const updateForeignExpression = (runtime: Runtime, dt: number) => {
      if (
        !runtime.broodRescue &&
        (runtime.submittedLineage || runtime.correctionLineage) &&
        runtime.elapsed >= (runtime.phaseThreeQa || runtime.phaseFourQa ? 1.5 : 22)
      ) {
        const breachNeed = runtime.wires.some(
          (wire) =>
            wire.z >= runtime.formation.z - 24 &&
            wire.z - runtime.formation.z < 210 &&
            !wire.torn,
        );
        const hostileNeed = runtime.defenders.some(
          (defender) =>
            defender.alive && defender.z > runtime.formation.z - 90,
        );
        if ((breachNeed || runtime.phaseThreeQa || runtime.phaseFourQa) && hostileNeed) {
          if (runtime.correctionLineage) beginCorrection(runtime);
          else beginForeignExpression(runtime);
        }
      }

      const rescue = runtime.broodRescue;
      if (!rescue || runtime.foreignExpressionResolved) return;
      rescue.age += dt;
      if (rescue.mode === "correction" && rescue.age < 1.15) {
        setBroodStage(runtime, rescue, "refusal");
        runtime.formation.volleyClock = Math.max(runtime.formation.volleyClock, 0.35);
      } else if (rescue.age < (rescue.mode === "correction" ? 2 : 0.9)) {
        setBroodStage(runtime, rescue, "rotate");
      } else if (rescue.age < (rescue.mode === "correction" ? 2.85 : 1.8)) {
        setBroodStage(runtime, rescue, "brace");
      } else if (rescue.age < (rescue.mode === "correction" ? 3.55 : 2.55)) {
        setBroodStage(runtime, rescue, "contact");
      } else {
        setBroodStage(runtime, rescue, "strain");
        rescue.fireSupportWithheldSeconds += dt;
        runtime.formation.volleyClock = Math.max(runtime.formation.volleyClock, 0.24);
        const strainStart = rescue.mode === "correction" ? 3.55 : 2.55;
        const pull = clamp((rescue.age - strainStart) / (rescue.mode === "correction" ? 4.6 : 4.15), 0, 1);
        rescue.x = rescue.originX + (rescue.destinationX - rescue.originX) * pull;
        rescue.z = rescue.originZ + (rescue.destinationZ - rescue.originZ) * pull;
        rescue.movedDistance = Math.hypot(
          rescue.x - rescue.originX,
          rescue.z - rescue.originZ,
        );
        rescue.assetIntegrity = Math.max(
          1,
          rescue.assetIntegrity - dt * (0.45 + runtime.formation.suppression / 85),
        );

        if (runtime.formation.cohesion < 9) {
          resolveForeignExpression(runtime, rescue, "casualty");
        } else if (
          runtime.artillery?.stage === "incoming" &&
          Math.hypot(runtime.artillery.x - rescue.x, runtime.artillery.z - rescue.z) < 96
        ) {
          resolveForeignExpression(runtime, rescue, "severed");
        } else if (rescue.assetIntegrity <= 1 || runtime.formation.suppression >= 99.5) {
          resolveForeignExpression(runtime, rescue, "overload");
        } else if (pull >= 1) {
          if (rescue.mode === "correction") resolveCorrection(runtime, rescue);
          else resolveForeignExpression(runtime, rescue, "success");
        }
      }
    };

    const combatRandom = (runtime: Runtime) => {
      const next = nextCombatRandom(runtime.combatRngState);
      runtime.combatRngState = next.state;
      return next.value;
    };

    const projectilePool = projectilePoolRef.current;
    const explosionPool = explosionPoolRef.current;
    const crushMarkPool = crushMarkPoolRef.current;

    const recycleProjectileAt = (runtime: Runtime, index: number) => {
      const lastIndex = runtime.projectiles.length - 1;
      const recycled = runtime.projectiles[index];
      if (recycled.owner === "defense" && !recycled.defenseResolved) {
        recycled.defenseResolved = true;
        runtime.combatTelemetry.expired += 1;
      }
      if (recycled.owner === "infantry" && !recycled.infantryResolved) {
        recycled.infantryResolved = true;
        runtime.combatTelemetry.infantryMisses += 1;
      }
      if (index !== lastIndex) runtime.projectiles[index] = runtime.projectiles[lastIndex];
      runtime.projectiles.pop();
      if (projectilePool.length < MAX_POOLED_PROJECTILES) projectilePool.push(recycled);
    };

    const recycleExplosionAt = (runtime: Runtime, index: number) => {
      const lastIndex = runtime.explosions.length - 1;
      const recycled = runtime.explosions[index];
      if (index !== lastIndex) runtime.explosions[index] = runtime.explosions[lastIndex];
      runtime.explosions.pop();
      if (explosionPool.length < MAX_POOLED_EXPLOSIONS) explosionPool.push(recycled);
    };

    const recycleCrushMarkAt = (runtime: Runtime, index: number) => {
      const lastIndex = runtime.crushMarks.length - 1;
      const recycled = runtime.crushMarks[index];
      if (index !== lastIndex) runtime.crushMarks[index] = runtime.crushMarks[lastIndex];
      runtime.crushMarks.pop();
      if (crushMarkPool.length < MAX_POOLED_CRUSH_MARKS) crushMarkPool.push(recycled);
    };

    const addCrushMark = (
      runtime: Runtime,
      x: number,
      z: number,
      side: CrushMark["side"],
    ) => {
      if (runtime.crushMarks.length >= MAX_ACTIVE_CRUSH_MARKS) {
        recycleCrushMarkAt(runtime, 0);
      }
      const mark = crushMarkPool.pop() ?? ({ x, z, age: 0, life: 8, side } as CrushMark);
      mark.x = x;
      mark.z = z;
      mark.age = 0;
      mark.life = 8;
      mark.side = side;
      runtime.crushMarks.push(mark);
    };

    const landshipSpots = (runtime: Runtime, defender: Defender) => {
      if (runtime.formation.connected) return true;
      if (
        defender.kind === "infantry" ||
        defender.kind === "reserve-assault" ||
        defender.kind === "machine-gun"
      ) {
        return true;
      }
      return distanceSq(runtime.tank, defender) <= 360 * 360;
    };

    const nearestDefender = (
      runtime: Runtime,
      origin: Vec,
      range: number,
      arc?: { angle: number; width: number },
      requiresWarPartySpotting = false,
    ) => {
      let best: Defender | null = null;
      let bestDistance = range * range;
      for (const defender of runtime.defenders) {
        if (!defender.alive) continue;
        if (requiresWarPartySpotting && !landshipSpots(runtime, defender)) {
          continue;
        }
        const value = distanceSq(origin, defender);
        if (value >= bestDistance) continue;
        if (arc) {
          const targetAngle = Math.atan2(
            defender.z - origin.z,
            defender.x - origin.x,
          );
          if (Math.abs(angleDelta(arc.angle, targetAngle)) > arc.width) continue;
        }
        best = defender;
        bestDistance = value;
      }
      return best;
    };

    const fireProjectile = (
      runtime: Runtime,
      owner: Projectile["owner"],
      kind: Projectile["kind"],
      source: Vec,
      angle: number,
      speed: number,
      damage: number,
      radius: number,
      spread = 0,
      tracer = true,
      muzzleDistance?: number,
      target?: Vec,
    ) => {
      const actual = angle + (combatRandom(runtime) - 0.5) * spread;
      const intensity =
        kind === "bow"
          ? Math.max(1, runtime.grafts["bow-gunner"])
          : kind === "top"
            ? Math.max(1, runtime.grafts["top-gunner"])
            : kind === "rib-mortar"
              ? Math.max(1, runtime.grafts["rib-mortar-brood"])
              : kind === "tooth"
                ? Math.max(1, runtime.grafts["whelping-shot"])
                : kind === "rifle"
                  ? Math.max(1, runtime.grafts["rifle-choir"])
                  : kind === "sapper"
                    ? Math.max(1, runtime.grafts["sapper-brood"])
                    : kind === "trench-tooth"
                      ? Math.max(1, runtime.grafts["trench-teeth"])
                      : kind === "ap" || kind === "he"
                        ? 1.35
                        : 1;
      const visualMuzzle =
        kind === "ap" || kind === "he"
          ? "top-cannon"
          : kind === "top"
            ? "top-coax"
            : "world";
      const muzzle = muzzleDistance ?? (owner === "landship" ? 32 : owner === "infantry" ? 9 : 18);
      const x = source.x + Math.cos(actual) * muzzle;
      const z = source.z + Math.sin(actual) * muzzle;
      const muzzleHeight =
        kind === "rib-mortar"
          ? 36
          : kind === "he"
            ? 18
            : kind === "ap"
              ? 12
              : kind === "anti-armor" || kind === "flanker"
                ? 13
                : owner === "landship"
                  ? 14
                  : 9;
      const elevation =
        terrainHeightAt(x, z, runtime.terrainCraters) + muzzleHeight;
      const targetElevation = target
        ? terrainHeightAt(target.x, target.z, runtime.terrainCraters) + 11
        : elevation;
      if (runtime.projectiles.length >= MAX_ACTIVE_PROJECTILES) {
        recycleProjectileAt(runtime, 0);
      }
      const shot =
        projectilePool.pop() ??
        ({
          owner,
          kind,
          x,
          z,
          previousX: x,
          previousZ: z,
          vx: 0,
          vz: 0,
          radius,
          damage,
          life: 0,
          tracer,
          elevation,
          previousElevation: elevation,
          verticalVelocity: 0,
          intensity,
          age: 0,
          visualMuzzle,
          defenseResolved: false,
          pierceRemaining: 0,
          hitIds: [],
          graftExplosive: false,
          graftToxic: false,
          executionBurst: false,
          aimTargetId: null,
          infantryResolved: false,
        } as Projectile);
      shot.owner = owner;
      shot.kind = kind;
      shot.x = x;
      shot.z = z;
      shot.previousX = x;
      shot.previousZ = z;
      shot.vx = Math.cos(actual) * speed;
      shot.vz = Math.sin(actual) * speed;
      shot.radius = radius;
      shot.damage = damage;
      shot.life =
        kind === "tooth"
          ? 1.15
          : kind === "rib-mortar"
            ? 2.65
            : owner === "defense"
              ? 3.8
              : owner === "landship"
                ? 2.3
                : 1.7;
      shot.tracer = tracer;
      shot.elevation = elevation;
      shot.previousElevation = elevation;
      shot.verticalVelocity = target
        ? aimedVerticalVelocity({
            source: { x, z, elevation },
            target: { ...target, elevation: targetElevation },
            speed,
          })
        : 0;
      shot.intensity = intensity;
      shot.age = 0;
      shot.visualMuzzle = visualMuzzle;
      shot.defenseResolved = false;
      const arsenal = arsenalVolleyProfile(runtime.grafts);
      shot.pierceRemaining = kind === "bow" ? arsenal.pierce : 0;
      shot.hitIds.length = 0;
      shot.graftExplosive = kind === "bow" && arsenal.explosive;
      shot.graftToxic = kind === "bow" && arsenal.toxic;
      shot.executionBurst = kind === "bow" && arsenal.executionBurst;
      shot.aimTargetId =
        owner === "infantry" && target && "id" in target
          ? Number((target as Defender).id)
          : null;
      shot.infantryResolved = owner !== "infantry";
      runtime.projectiles.push(shot);
      if (owner === "defense") runtime.combatTelemetry.defenseFired += 1;
      if (owner === "infantry") runtime.combatTelemetry.infantryFired += 1;
      if (owner === "landship" && kind === "bow") runtime.arsenalMissilesFired += 1;
      soundEngineRef.current?.playFire(
        kind,
        owner,
        x,
        runtime.tank.x,
        Math.hypot(x - runtime.tank.x, z - runtime.tank.z),
        intensity,
      );
      if (owner === "landship") {
        runtime.shake = Math.max(
          runtime.shake,
          kind === "he" ? 18 : kind === "ap" ? 13 : 2.5 + intensity,
        );
        if (kind === "ap" || kind === "he") {
          runtime.mainShotsFired += 1;
          addExplosion(
            runtime,
            x,
            z,
            kind === "he" ? 52 : 38,
            "muzzle",
            kind === "he" ? 0.24 : 0.18,
            intensity,
          );
        }
        if (kind === "top") runtime.tank.coaxRecoil = 1;
      }
      return shot;
    };

    const birthWhelps = (
      runtime: Runtime,
      parent: Projectile,
      x: number,
      z: number,
    ) => {
      const level = runtime.grafts["whelping-shot"];
      if (
        level <= 0 ||
        parent.owner !== "landship" ||
        parent.kind === "tooth" ||
        parent.kind === "sapper" ||
        parent.kind === "trench-tooth"
      ) return;
      const offspring = activeOffspring(runtime.grafts);
      const bonus =
        parent.kind === "bow" && offspring.includes("Needle Litter")
          ? 1
          : parent.kind === "rib-mortar" && offspring.includes("Rib Nursery")
            ? 3
            : 0;
      const count = level + bonus;
      const target = nearestDefender(runtime, { x, z }, 560);
      if (!target) return;
      const centerAngle = Math.atan2(target.z - z, target.x - x);
      for (let child = 0; child < count; child += 1) {
        const fan = (child - (count - 1) / 2) * 0.12;
        fireProjectile(
          runtime,
          "landship",
          "tooth",
          { x, z },
          centerAngle + fan,
          520,
          6 + level * 2,
          2,
          0.02,
          true,
          0,
        );
      }
    };

    const killDefender = (
      runtime: Runtime,
      defender: Defender,
      cause: Projectile["kind"] | "crush" = "ap",
      intensity = 1,
    ) => {
      defender.alive = false;
      defender.flash = cause === "crush" ? 0.8 : 1.15;
      runtime.enemyKills += 1;
      if (cause === "rifle") runtime.combatTelemetry.infantryKills += 1;
      runtime.nutrientXp = awardNutrients(
        runtime.nutrientXp,
        runtime.nutrientLevel,
        nutrientValueForDefender(defender.kind, defender.sector),
      );
      runtime.shake = Math.max(
        runtime.shake,
        cause === "he" || cause === "rib-mortar"
          ? 18
          : cause === "ap" || cause === "crush"
            ? 12
            : 6 + intensity * 1.5,
      );
      if (cause !== "crush") {
        addExplosion(
          runtime,
          defender.x,
          defender.z,
          28 + Math.min(24, intensity * 5),
          "rupture",
          0.46,
          intensity,
        );
      }
      if (defender.kind === "carrier") {
        setCaption(
          runtime,
          "CARRIER RUPTURES — NOTHING NEW MATERIALIZES IN THE SLIT",
          4,
        );
        return;
      }
      if (defender.kind === "observer") {
        if (runtime.grafts["witness-cilia"] > 0 && cause === "rifle") {
          runtime.artilleryClock = Math.max(runtime.artilleryClock, 8);
          setCaption(
            runtime,
            "WITNESS CILIA CLOSE — THE CHOIR TEARS THE CORRECTION FROM THE BATTERY",
            4,
          );
        } else {
          setCaption(runtime, "OBSERVER THROAT SILENCED — NEXT LINE LEARNS LESS", 4);
        }
      } else if (defender.kind === "flanker") {
        setCaption(runtime, "FLANKING ORGAN BROKEN — LEFT WAKE BREATHES", 4);
      } else {
        setCaption(runtime, "DEFENSIVE ORGAN BROKEN — HOLD THE CORRIDOR", 3);
      }
    };

    const addExplosion = (
      runtime: Runtime,
      x: number,
      z: number,
      radius: number,
      kind: Explosion["kind"],
      life = 0.72,
      intensity = 1,
    ) => {
      if (runtime.explosions.length >= MAX_ACTIVE_EXPLOSIONS) {
        recycleExplosionAt(runtime, 0);
      }
      const explosion =
        explosionPool.pop() ??
        ({ x, z, age: 0, life, radius, kind, seed: 0, intensity } as Explosion);
      explosion.x = x;
      explosion.z = z;
      explosion.age = 0;
      explosion.life = life;
      explosion.radius = radius;
      explosion.kind = kind;
      explosion.seed =
        runtime.nextId * 19 +
        runtime.enemyKills * 31 +
        runtime.explosions.length * 53 +
        Math.floor(runtime.elapsed * 120);
      explosion.intensity = intensity;
      runtime.explosions.push(explosion);
      soundEngineRef.current?.playImpact(
        kind,
        x,
        runtime.tank.x,
        Math.hypot(x - runtime.tank.x, z - runtime.tank.z),
        intensity,
      );
    };

    const stampBreachWake = (
      runtime: Runtime,
      x: number,
      z: number,
      radius = 150,
    ) => {
      runtime.breachWakes = runtime.breachWakes.filter(
        (wake) => wake.expiresAt > runtime.elapsed,
      );
      const previous = runtime.breachWakes.at(-1);
      if (previous && Math.hypot(previous.x - x, previous.z - z) < 54) {
        previous.x = x;
        previous.z = z;
        previous.radius = Math.max(previous.radius, radius);
        previous.expiresAt = runtime.elapsed + 16;
      } else {
        runtime.breachWakes.push({
          x,
          z,
          radius,
          expiresAt: runtime.elapsed + 16,
        });
        if (runtime.breachWakes.length > 24) runtime.breachWakes.shift();
      }

      for (const defender of runtime.defenders) {
        if (!defender.alive) continue;
        if (Math.hypot(defender.x - x, defender.z - z) > radius * 1.15) {
          continue;
        }
        defender.fireClock = Math.max(defender.fireClock, 1.15);
        defender.intent = 0;
      }

      if (
        z >= runtime.formation.z - 80 &&
        z <= runtime.formation.z + 620
      ) {
        runtime.formation.surgeClock = Math.max(
          runtime.formation.surgeClock,
          6.5,
        );
        runtime.formation.suppression = Math.max(
          0,
          runtime.formation.suppression - 10,
        );
      }
    };

    const triggerTrenchquake = (runtime: Runtime, x: number, z: number) => {
      const level = runtime.grafts["trenchquake-bladders"];
      if (level <= 0 || runtime.trenchquakeClock > 0) return;
      runtime.trenchquakeClock = Math.max(0.28, 0.62 - level * 0.05);
      for (const victim of runtime.defenders) {
        if (!victim.alive) continue;
        const damage = trenchquakeDamage(Math.hypot(victim.x - x, victim.z - z), level);
        if (damage <= 0) continue;
        victim.hp -= damage;
        victim.flash = 0.28;
        if (victim.hp <= 0) killDefender(runtime, victim, "crush", level);
      }
      const quakeRadius = 82 + level * 18;
      for (const barricade of trenchBarricadesInRange(z - quakeRadius, z + quakeRadius)) {
        if (Math.hypot(barricade.x - x, barricade.z - z) <= quakeRadius) {
          runtime.crushedBarricades.add(barricade.id);
        }
      }
      addExplosion(runtime, x, z, quakeRadius, "crush", 0.58);
      runtime.shake = Math.max(runtime.shake, 22);
      setCaption(runtime, "TRENCHQUAKE VENTS SIDEWAYS — THE PARAPET LOSES ITS FEET", 2.4);
    };

    const updateCrushing = (runtime: Runtime) => {
      const { tank } = runtime;
      const sternumLevel = runtime.grafts["battering-sternum"];
      for (const defender of runtime.defenders) {
        if (!defender.alive || !isCrushable(defender.kind)) continue;
        const treadSide = treadContactSide(tank, defender);
        const sternumHit = sternumContact(tank, defender, sternumLevel);
        if (!treadSide && !sternumHit) continue;
        const side = treadSide ??
          (-((defender.x - tank.x) * Math.sin(tank.angle)) +
              (defender.z - tank.z) * Math.cos(tank.angle) > 0
            ? "left"
            : "right");
        const x = defender.x;
        const z = defender.z;
        killDefender(runtime, defender, "crush", sternumLevel);
        stampBreachWake(runtime, x, z, sternumHit ? 178 : 138);
        runtime.crushedEnemies += 1;
        if (sternumHit) {
          runtime.ramImpacts += 1;
          triggerTrenchquake(runtime, x, z);
          const larderLevel = runtime.grafts["scar-larder"];
          if (larderLevel > 0) {
            const worstFace = (["front", "left", "right", "rear"] as ArmorFace[])
              .sort(
                (a, b) =>
                  runtime.tank.armor[a] / (a === "front" ? 100 : a === "rear" ? 44 : 72) -
                  runtime.tank.armor[b] / (b === "front" ? 100 : b === "rear" ? 44 : 72),
              )[0];
            const maximum = worstFace === "front" ? 100 : worstFace === "rear" ? 44 : 72;
            const repair = scarLarderRepair(
              larderLevel,
              maximum - runtime.tank.armor[worstFace],
            );
            runtime.tank.armor[worstFace] += repair;
            if (repair > 0) {
              addExplosion(runtime, tank.x, tank.z, 34, "scute", 0.48, repair);
              setCaption(
                runtime,
                `SCAR LARDER PACKS ${repair.toFixed(1)} TISSUE INTO THE ${worstFace.toUpperCase()} SCUTE`,
                2.4,
              );
            }
          }
          if (activeOffspring(runtime.grafts).includes("War Convulsion")) {
            runtime.formation.volleyClock = 0;
            runtime.choirOrganClocks = runtime.choirOrganClocks.map(() => 0);
          }
        }
        addCrushMark(runtime, x, z, side);
        addExplosion(runtime, x, z, 42, "crush", 0.34);
        runtime.shake = Math.max(runtime.shake, 13);
        setCaption(
          runtime,
          sternumHit
            ? `BATTERING STERNUM TAKES THE BODY — ${runtime.ramImpacts} RAM IMPACTS`
            : `${side.toUpperCase()} TREAD TAKES THE BODY — ${runtime.crushedEnemies} CRUSHED`,
          1.7,
        );
      }

      for (const barricade of trenchBarricadesInRange(tank.z - 72, tank.z + 72)) {
        if (runtime.crushedBarricades.has(barricade.id)) continue;
        const side = treadContactSide(tank, barricade);
        if (!side) continue;
        runtime.crushedBarricades.add(barricade.id);
        stampBreachWake(runtime, barricade.x, barricade.z, 154);
        addCrushMark(runtime, barricade.x, barricade.z, side);
        addExplosion(runtime, barricade.x, barricade.z, 30, "crush", 0.28);
        runtime.shake = Math.max(runtime.shake, 8);
        setCaption(
          runtime,
          `${side.toUpperCase()} TREAD SQUASHES THE SANDBAGS INTO THE MUD`,
          1.6,
        );
      }
    };

    const armorFaceForShot = (tank: Tank, shot: Projectile): ArmorFace =>
      armorFaceFromSource(tank, shot);

    const impactTank = (
      runtime: Runtime,
      shot: Projectile,
    ): "small-arms" | "bounce" | "penetration" => {
      const tank = runtime.tank;
      const artilleryResolution =
        shot.kind === "artillery"
          ? resolveArtilleryImpact(tank, shot)
          : null;
      const face = (artilleryResolution?.face ??
        armorFaceForShot(tank, shot)) as ArmorFace;
      const armor = tank.armor[face];
      const scar = tank.scars[face];
      if (
        shot.kind === "machine-gun" ||
        shot.kind === "infantry" ||
        shot.kind === "reserve-assault"
      ) {
        runtime.impactFace = face;
        runtime.impactFlash = 0.08;
        runtime.shake = Math.max(runtime.shake, 4);
        tank.scars[face] = Math.min(18, scar + 0.015);
        setCaption(
          runtime,
          "MG BEATS THE SCUTES — THE WAR PARTY IS THE BODY IN DANGER",
          1.8,
        );
        soundEngineRef.current?.playArmorImpact("small-arms", face);
        reneeDirectorRef.current?.signal("small-arms", runtime.elapsed);
        return "small-arms";
      }
      const heavy =
        shot.kind === "flanker" ||
        shot.kind === "anti-armor" ||
        shot.kind === "artillery" ||
        shot.kind === "satchel";
      const resolved = heavy
        ? artilleryResolution ??
          resolveHeavyArmorImpact({
              face,
              armor,
              scar,
              core: tank.core,
              leftTread: tank.leftTread,
              rightTread: tank.rightTread,
              damage: shot.damage,
            })
        : null;
      const penetration = resolved?.outcome === "penetration";

      runtime.impactFace = face;
      runtime.impactFlash = penetration ? 0.28 : 0.13;
      runtime.shake = Math.max(runtime.shake, penetration ? 19 : 10);
      tank.scars[face] = resolved?.scar ?? Math.min(18, scar + 0.55);

      if (!resolved || !penetration) {
        tank.armor[face] = resolved?.armor ?? armor;
        setCaption(
          runtime,
          `${face.toUpperCase()} SCUTES CHIP — FORCE RINGS THROUGH THE CHAMBER`,
          2.3,
        );
        soundEngineRef.current?.playArmorImpact("bounce", face);
        reneeDirectorRef.current?.signal("armor-bounce", runtime.elapsed);
        return "bounce";
      }

      tank.armor[face] = resolved.armor;
      tank.core = resolved.core;
      tank.leftTread = resolved.leftTread;
      tank.rightTread = resolved.rightTread;
      if (face === "left") {
        setCaption(runtime, "LEFT TREAD PENETRATION — LIVING TRACK DRAGS", 3.5);
      } else if (face === "right") {
        setCaption(runtime, "RIGHT TREAD PENETRATION — LIVING TRACK DRAGS", 3.5);
      } else if (face === "rear") {
        setCaption(runtime, "REAR PENETRATION — WARM ORGANS OPEN TO AIR", 4);
      } else {
        setCaption(runtime, "OLD FRONTAL SCAR OPENS — THE DEFENSE REMEMBERED", 4);
      }
      soundEngineRef.current?.playArmorImpact("penetration", face);
      voiceEngineRef.current?.trigger("body-pays");
      return "penetration";
    };

    const updateTraction = (runtime: Runtime, dt: number) => {
      const tank = runtime.tank;
      let leftDemand = tank.leftDemand;
      let rightDemand = tank.rightDemand;
      if (runtime.keys.has("w")) leftDemand = 1;
      if (runtime.keys.has("s")) leftDemand = -1;
      if (runtime.keys.has("arrowup")) rightDemand = 1;
      if (runtime.keys.has("arrowdown")) rightDemand = -1;

      const opposedRedirect =
        Math.abs(leftDemand) > 0.42 &&
        Math.abs(rightDemand) > 0.42 &&
        Math.sign(leftDemand) !== Math.sign(rightDemand);
      if (opposedRedirect && !redirectHeld) {
        voiceEngineRef.current?.trigger("turn-it");
      }
      redirectHeld = opposedRedirect;

      const direction =
        Math.sign(leftDemand + rightDemand) || Math.sign(tank.forwardVelocity) || 1;
      const groundAt = (x: number, z: number) =>
        terrainHeightAt(x, z, runtime.terrainCraters);
      const surface = terrainSurfaceAt(tank.x, tank.z);
      const previous = { x: tank.x, z: tank.z, angle: tank.angle };
      stepTreads(tank, {
        leftDemand,
        rightDemand,
        leftHealth: tank.leftTread / 100,
        rightHealth: tank.rightTread / 100,
        // Terrain drives visible hull support, never player authority. The
        // landship climbs and rolls over broken ground without a scenery
        // collider cancelling or biasing tread input.
        dt,
        fieldHalfWidth: FIELD_HALF_WIDTH,
        traction: surface.traction,
      });
      const support = solveTreadSupport(tank, groundAt, direction);
      tank.turret += tank.angle - previous.angle;
      tank.elevation += (support.elevation - tank.elevation) * Math.min(1, dt * 8);
      tank.pitch += (support.pitch - tank.pitch) * Math.min(1, dt * 6.5);
      tank.roll += (support.roll - tank.roll) * Math.min(1, dt * 7.5);
      if (support.state !== tank.terrainState) {
        tank.terrainState = support.state;
        const terrainCaption = {
          left_mounting: "LEFT TREAD MOUNTS — THE HULL KEEPS COMING",
          right_mounting: "RIGHT TREAD MOUNTS — THE HULL KEEPS COMING",
          cresting: "WRECKAGE UNDER BOTH TREADS — THE BODY CLIMBS",
          climbing: "BROKEN GROUND — THE NOSE CLIMBS",
          descending: "BROKEN GROUND — THE NOSE DESCENDS",
        }[support.state as keyof typeof terrainCaption];
        if (terrainCaption) setCaption(runtime, terrainCaption, 2.1);
      }

      for (const wire of runtime.wires) {
        const crossing = Math.abs(tank.z - wire.z) < 38;
        if (!crossing || Math.abs(tank.forwardVelocity) < 18) continue;
        const bite = Math.abs(tank.forwardVelocity) * dt * 1.48;
        const previousWidth = wire.gapWidth;
        wire.gapCenter +=
          (tank.x - wire.gapCenter) * Math.min(1, dt * 0.9);
        wire.gapWidth = clamp(wire.gapWidth + bite, 0, 190);
        const requiredWidth = runtime.formation.width + BREACH_CLEARANCE;
        if (previousWidth < requiredWidth && wire.gapWidth >= requiredWidth) {
          wire.torn = true;
          stampBreachWake(runtime, wire.gapCenter, wire.z, requiredWidth * 0.75);
          setCaption(
            runtime,
            `BARBERED WIRE RIPS ${Math.ceil(requiredWidth)}m WIDE — ROOTED HAIR MAKES A WOUND THE FULL FORMATION CAN INHABIT`,
            4,
          );
        }
      }
    };

    const updateWeapons = (runtime: Runtime, dt: number) => {
      const tank = runtime.tank;
      runtime.mainClock -= dt;
      runtime.bowClock -= dt;
      runtime.topClock -= dt;
      for (let index = 0; index < runtime.bowOrganClocks.length; index += 1) {
        runtime.bowOrganClocks[index] -= dt;
      }
      for (let index = 0; index < runtime.topOrganClocks.length; index += 1) {
        runtime.topOrganClocks[index] -= dt;
      }
      for (let index = 0; index < runtime.mortarOrganClocks.length; index += 1) {
        runtime.mortarOrganClocks[index] -= dt;
      }

      let mainTarget: Defender | null = null;
      let mainTargetAngleError = Number.POSITIVE_INFINITY;
      let mainTargetDistance = Number.POSITIVE_INFINITY;
      for (const defender of runtime.defenders) {
        if (!defender.alive) continue;
        if (!landshipSpots(runtime, defender)) continue;
        const targetDistance = distanceSq(tank, defender);
        if (targetDistance >= 880 * 880) continue;
        const targetAngle = Math.atan2(defender.z - tank.z, defender.x - tank.x);
        const angleError = Math.abs(angleDelta(tank.angle, targetAngle));
        if (angleError >= 0.68) continue;
        if (
          angleError < mainTargetAngleError ||
          (angleError === mainTargetAngleError && targetDistance < mainTargetDistance)
        ) {
          mainTarget = defender;
          mainTargetAngleError = angleError;
          mainTargetDistance = targetDistance;
        }
      }
      runtime.selectedTargetId = mainTarget?.id ?? null;

      if (mainTarget && distanceSq(tank, mainTarget) < 880 * 880) {
        const targetAngle = Math.atan2(
          mainTarget.z - tank.z,
          mainTarget.x - tank.x,
        );
        const traverseError = angleDelta(tank.turret, targetAngle);
        const hullError = Math.abs(angleDelta(tank.angle, targetAngle));
        const traverseStep = 0.92 * dt;
        tank.turret += clamp(traverseError, -traverseStep, traverseStep);

        const heInterval = heShotInterval(1);
        const ammo = runtime.heCycle >= heInterval - 1 ? "he" : "ap";
        if (
          runtime.mainClock <= 0 &&
          hullError < 0.38 &&
          Math.abs(traverseError) < 0.08
        ) {
          const profile = cannonProfile(ammo);
          fireProjectile(
            runtime,
            "landship",
            ammo,
            tank,
            tank.turret,
            profile.speed,
            profile.damage,
            profile.projectileRadius,
            0.006,
            true,
          );
          runtime.heCycle = ammo === "he" ? 0 : runtime.heCycle + 1;
          runtime.mainClock = profile.cooldown;
          tank.turretRecoil = 1;
          setCaption(
            runtime,
            ammo === "he"
              ? `FIFTH SHOT — HE BROOD ERUPTS INTO ${defenderLabel(mainTarget.kind)}`
              : `COMPACT AP MOUTH FIRES — ${defenderLabel(mainTarget.kind)} INSIDE THE FORWARD NERVE`,
            1.1,
          );
        }
      }

      for (let organ = 0; organ < runtime.grafts["bow-gunner"]; organ += 1) {
        if ((runtime.bowOrganClocks[organ] ?? 0) > 0) continue;
        const arsenal = arsenalVolleyProfile(runtime.grafts);
        let target = nearestDefender(runtime, tank, 640, {
          angle: tank.angle,
          width: 0.38,
        }, true);
        if (arsenal.specialistPriority) {
          let specialistDistance = 640 * 640;
          for (const defender of runtime.defenders) {
            if (
              !defender.alive ||
              !landshipSpots(runtime, defender) ||
              defender.kind === "infantry" ||
              defender.kind === "machine-gun"
            ) continue;
            const value = distanceSq(tank, defender);
            const targetAngle = Math.atan2(defender.z - tank.z, defender.x - tank.x);
            if (value >= specialistDistance || Math.abs(angleDelta(tank.angle, targetAngle)) > 0.38) continue;
            target = defender;
            specialistDistance = value;
          }
        }
        if (!target) continue;
        const lateral = (organ - (runtime.grafts["bow-gunner"] - 1) / 2) * 11;
        const source = {
          x: tank.x - Math.sin(tank.angle) * lateral,
          z: tank.z + Math.cos(tank.angle) * lateral,
        };
        const volleyAngle = arsenal.specialistPriority
          ? Math.atan2(target.z - tank.z, target.x - tank.x)
          : tank.angle;
        for (let missile = 0; missile < arsenal.missiles; missile += 1) {
          const fork = (missile - (arsenal.missiles - 1) / 2) * arsenal.spreadStep;
          fireProjectile(
            runtime,
            "landship",
            "bow",
            source,
            volleyAngle + fork,
            arsenal.specialistPriority ? 810 : 720,
            arsenal.damage,
            arsenal.specialistPriority ? 5 : 3,
            0.018,
            true,
          );
        }
        runtime.bowOrganClocks[organ] = arsenal.specialistPriority ? 0.54 : 0.3;
      }

      let crownTarget: Defender | null = null;
      let crownTargetDistance = 720 * 720;
      for (const defender of runtime.defenders) {
        if (
          !defender.alive ||
          !landshipSpots(runtime, defender) ||
          (defender.kind !== "observer" &&
            defender.kind !== "carrier" &&
            defender.kind !== "flanker")
        ) {
          continue;
        }
        const targetDistance = distanceSq(tank, defender);
        if (targetDistance >= crownTargetDistance) continue;
        crownTarget = defender;
        crownTargetDistance = targetDistance;
      }
      crownTarget ??= nearestDefender(runtime, tank, 620, undefined, true);
      if (crownTarget) {
        const targetAngle = Math.atan2(crownTarget.z - tank.z, crownTarget.x - tank.x);
        const error = angleDelta(tank.topTurret, targetAngle);
        tank.topTurret += clamp(error, -2.6 * dt, 2.6 * dt);
        if (Math.abs(error) < 0.1) {
          for (let organ = 0; organ < runtime.grafts["top-gunner"]; organ += 1) {
            if ((runtime.topOrganClocks[organ] ?? 0) > 0) continue;
            const source = {
              x: tank.x + Math.cos(tank.topTurret + Math.PI / 2) * (organ * 8 - 4),
              z: tank.z + Math.sin(tank.topTurret + Math.PI / 2) * (organ * 8 - 4),
            };
            fireProjectile(runtime, "landship", "top", source, tank.topTurret, 760, 9, 3, 0.045, true);
            runtime.topOrganClocks[organ] = 0.36 + organ * 0.051;
          }
        }
      }

      for (let organ = 0; organ < runtime.grafts["rib-mortar-brood"]; organ += 1) {
        if ((runtime.mortarOrganClocks[organ] ?? 0) > 0) continue;
        const target = nearestDefender(runtime, tank, 820, undefined, true);
        if (!target) continue;
        const targetAngle = Math.atan2(target.z - tank.z, target.x - tank.x);
        const lateral = (organ - (runtime.grafts["rib-mortar-brood"] - 1) / 2) * 16;
        const source = {
          x: tank.x - Math.sin(tank.angle) * lateral,
          z: tank.z + Math.cos(tank.angle) * lateral,
        };
        fireProjectile(runtime, "landship", "rib-mortar", source, targetAngle, 360, 34, 8, 0.06, true);
        runtime.mortarOrganClocks[organ] = 1.18 + organ * 0.19;
        setCaption(runtime, "RIB-MORTAR COUGHS — ANOTHER BODY JOINS THE BARRAGE", 1.4);
      }
    };

    const updateBattlefield = (runtime: Runtime, dt: number) => {
      // Maintain a deep, invisible defense horizon. New endless sectors are
      // authored several trench lines beyond the renderer, never inside the
      // player's slit and never as a response to capture or battlefield quiet.
      const advanceSector = Math.max(
        runtime.formation.capturedGround,
        Math.floor(
          (Math.max(runtime.tank.z, runtime.formation.z) -
            FIRST_SECTOR_Z -
            TRENCH_LINE_OFFSET) /
            SECTOR_LENGTH,
        ),
      );
      seedDefenseHorizon(
        runtime,
        Math.max(DEFENSE_HORIZON_SECTORS, advanceSector + DEFENSE_HORIZON_SECTORS),
      );
      const nextEchelon = defenseEchelonForRuntime(runtime);
      if (
        nextEchelon !== runtime.defenseEchelon &&
        runtime.captionClock <= 0.8
      ) {
        runtime.defenseEchelon = nextEchelon;
        const layerCaption: Record<DefenseEchelon, string> = {
          screen: "NEXT SCREEN AHEAD — THE DEFENSE HAS ANOTHER BODY",
          "main-line": "OUTPOST SCREEN BROKEN — MAIN FIRE TRENCH ENGAGES",
          "support-line": "FRONT TRENCH BREACHED — SUPPORT GUNS OWN THE DEPTH",
          "reserve-line": "SUPPORT LINE RUPTURES — THE RESERVE STILL CONTESTS THE ACRE",
          consolidation: "RESERVE BROKEN — BRING THE WAR PARTY UP AND OWN THE GROUND",
        };
        setCaption(runtime, layerCaption[nextEchelon], 3.2);
      }
      runtime.battlefieldCleanupClock -= dt;
      if (runtime.battlefieldCleanupClock > 0) return;
      runtime.battlefieldCleanupClock = 0.5;
      const rearLimit = Math.min(runtime.tank.z, runtime.formation.z) - 980;
      runtime.defenders = runtime.defenders.filter(
        (defender) => defender.z > rearLimit || defender.flash > 0,
      );
      runtime.wires = runtime.wires.filter((wire) => wire.z > rearLimit);
      runtime.captureNodes = runtime.captureNodes.filter(
        (node) => !node.captured || node.z > rearLimit,
      );
      runtime.breachWakes = runtime.breachWakes.filter(
        (wake) => wake.expiresAt > runtime.elapsed && wake.z > rearLimit,
      );
    };

    const updateDefense = (runtime: Runtime, dt: number) => {
      const tank = runtime.tank;

      for (const defender of runtime.defenders) {
        defender.flash = Math.max(0, defender.flash - dt);
        if (!defender.alive) continue;
        defender.suppression = Math.max(0, defender.suppression - dt * 10.5);
        const distance = Math.hypot(tank.x - defender.x, tank.z - defender.z);
        if (distance > 780) continue;
        const profile = terrainSectorProfile(defender.sector);
        const plan = defenseSectorPlan(defender.sector, profile.centerZ);
        if (softTargetPinned(defender.kind, defender.suppression)) {
          defender.fireClock = Math.max(defender.fireClock, 0.22);
          defender.flash = Math.max(
            defender.flash,
            0.12 + Math.sin(runtime.elapsed * 18 + defender.id) * 0.06,
          );
          continue;
        }
        const doctrine = stepDefenderDoctrine(defender, {
          dt, distance, tank, formation: runtime.formation, profile, plan,
        });
        if (doctrine === "engineer") {
          defender.fireClock -= dt;
          if (defender.fireClock <= 0) {
            tendDefensiveLine(defender, runtime.defenders);
            const repairable = trenchBarricadesForSector(defender.sector).find((barricade) =>
              runtime.crushedBarricades.has(barricade.id),
            );
            if (repairable) runtime.crushedBarricades.delete(repairable.id);
            defender.flash = 0.5;
            defender.fireClock = defender.cooldown;
          }
          continue;
        }
        if (doctrine === "withdraw") continue;

        if (defender.kind === "satchel") {
          const approachOpen = defender.z >= plan.coveredApproach.z - 20;
          const approachTarget = approachOpen ? tank : plan.coveredApproach;
          const targetAngle = Math.atan2(
            approachTarget.z - defender.z,
            approachTarget.x - defender.x,
          );
          if (defender.intent > 0) {
            defender.intent -= dt;
            defender.flash = 0.35 + Math.sin(runtime.elapsed * 24) * 0.22;
            defender.x += Math.cos(targetAngle) * 58 * dt;
            defender.z += Math.sin(targetAngle) * 58 * dt;
            const committedDistance = Math.hypot(
              tank.x - defender.x,
              tank.z - defender.z,
            );
            if (defender.intent <= 0) {
              if (committedDistance < 104) {
                impactTank(runtime, {
                  owner: "defense",
                  kind: "satchel",
                  x: defender.x,
                  z: defender.z,
                  previousX: defender.x,
                  previousZ: defender.z,
                  vx: 0,
                  vz: 0,
                  radius: 12,
          damage: defenseDamageForSector(54, defender.sector),
                  life: 0,
                  tracer: false,
                  elevation: terrainHeightAt(defender.x, defender.z, runtime.terrainCraters) + 9,
                  previousElevation: terrainHeightAt(
                    defender.x,
                    defender.z,
                    runtime.terrainCraters,
                  ) + 9,
                  verticalVelocity: 0,
                  intensity: 1,
                });
                defender.alive = false;
                runtime.shake = Math.max(runtime.shake, 24);
                setCaption(
                  runtime,
                  "SATCHEL ATTACHED — THE WARM HULL OPENS",
                  3,
                );
              } else {
                defender.intent = -3.8;
              }
            }
            continue;
          }
          if (defender.intent < 0) {
            defender.intent += dt;
            defender.x -= Math.cos(targetAngle) * 32 * dt;
            defender.z -= Math.sin(targetAngle) * 32 * dt;
            if (defender.intent >= 0) defender.fireClock = 1.8;
            continue;
          }
          defender.fireClock -= dt;
          if (defender.fireClock <= 0 && distance < 260) {
            defender.intent = 1.5;
            setCaption(
              runtime,
              "SATCHEL PAIR COMMITS — BREAK THE APPROACH OR TURN THE SKIRT",
              2.5,
            );
          } else if (distance >= 110) {
            defender.x += Math.cos(targetAngle) * 34 * dt;
            defender.z += Math.sin(targetAngle) * 34 * dt;
          }
          continue;
        }

        if (defender.kind === "carrier") {
          const targetAngle = Math.atan2(
            runtime.formation.z - defender.z,
            runtime.formation.x - defender.x,
          );
          if (distance > 170) {
            defender.x += Math.cos(targetAngle) * 21 * dt;
            defender.z += Math.sin(targetAngle) * 21 * dt;
          }
          defender.fireClock -= dt;
          if (defender.fireClock <= 0) {
            fireProjectile(
              runtime,
              "defense",
              "infantry",
              defender,
              targetAngle,
              410,
              defenseDamageForSector(5, defender.sector),
              3,
              0.12,
              true,
              undefined,
              runtime.formation,
            );
            defender.flash = 0.12;
            defender.fireClock = defender.cooldown;
          }
          continue;
        }

        if (defender.kind === "observer") {
          defender.fireClock -= dt;
          if (defender.fireClock <= 0) {
            defender.flash = 0.35 + Math.sin(runtime.elapsed * 10) * 0.2;
          }
          continue;
        }

        if (defender.kind === "anti-armor") {
          if (defender.intent > 0) {
            defender.intent -= dt;
            defender.flash = 0.25 + Math.sin(runtime.elapsed * 18) * 0.18;
            if (defender.intent <= 0) {
              const targetAngle = Math.atan2(
                tank.z - defender.z,
                tank.x - defender.x,
              );
              fireProjectile(
                runtime,
                "defense",
                "anti-armor",
                defender,
                targetAngle,
                330,
                defenseDamageForSector(58, defender.sector),
                8,
                0.28,
                true,
                undefined,
                tank,
              );
              defender.fireClock = 5.6;
              setCaption(runtime, "AP SHOT COMMITTED — PRESENT FLESH OR KILL IT", 2);
            }
            continue;
          }
          defender.fireClock -= dt;
          if (defender.fireClock <= 0) {
            defender.intent = 2.55;
            setCaption(
              runtime,
              "AP GUN TRAVERSES — FACE IT, BREAK IT, OR LEAVE ITS LINE",
              2.3,
            );
          }
          continue;
        }

        defender.fireClock -= dt;
        if (defender.fireClock > 0) continue;

        const aimsAtFormation =
          (defender.kind === "machine-gun" ||
            defender.kind === "infantry" ||
            defender.kind === "reserve-assault") &&
          runtime.formation.z > defender.z - 390 &&
          runtime.formation.z < defender.z + 80;
        const targetX = aimsAtFormation ? runtime.formation.x : tank.x;
        const targetZ = aimsAtFormation ? runtime.formation.z : tank.z;
        const targetAngle = Math.atan2(
          targetZ - defender.z,
          targetX - defender.x,
        );
        const heavy = defender.kind === "flanker";
        fireProjectile(
          runtime,
          "defense",
          defender.kind,
          defender,
          targetAngle,
          heavy ? 310 : defender.kind === "infantry" || defender.kind === "reserve-assault" ? 430 : 470,
          defenseDamageForSector(
            heavy ? 34 : defender.kind === "infantry" || defender.kind === "reserve-assault" ? 4.8 : 7,
            defender.sector,
          ),
          heavy ? 7 : 3,
          heavy ? 0.065 : defender.kind === "infantry" || defender.kind === "reserve-assault" ? 0.14 : 0.09,
          true,
          undefined,
          aimsAtFormation ? runtime.formation : tank,
        );
        defender.flash = 0.09;
        defender.fireClock =
          defender.cooldown *
          (defender.kind === "machine-gun"
            ? 0.9 + combatRandom(runtime) * 0.68
            : defender.kind === "flanker"
              ? 1.18
              : 1) *
          suppressedFireCadenceMultiplier(defender.suppression);
      }
    };

    const resolveArtilleryShell = (
      runtime: Runtime,
      impactX: number,
      impactZ: number,
    ) => {
      const tank = runtime.tank;
      const beforeArmor =
        tank.armor.front + tank.armor.left + tank.armor.right + tank.armor.rear;
      const beforeOrgans = tank.core + tank.leftTread + tank.rightTread;
      const resolution = resolveArtilleryImpact(tank, {
        x: impactX,
        z: impactZ,
      });
      runtime.combatTelemetry.defenseFired += 1;
      runtime.combatTelemetry.artilleryShells += 1;
      let artilleryOutcome: "terrain" | "formation" | "bounce" | "penetration" =
        "terrain";

      if (resolution.damage > 0) {
        const impact = impactTank(runtime, {
          owner: "defense",
          kind: "artillery",
          x: impactX,
          z: impactZ,
          previousX: impactX,
          previousZ: impactZ,
          vx: 0,
          vz: 0,
          radius: 18,
          damage: resolution.damage,
          life: 0,
          tracer: false,
          elevation:
            terrainHeightAt(impactX, impactZ, runtime.terrainCraters) + 18,
          previousElevation:
            terrainHeightAt(impactX, impactZ, runtime.terrainCraters) + 18,
          verticalVelocity: 0,
          intensity: 1,
        } as Projectile);
        artilleryOutcome = impact === "bounce" ? "bounce" : "penetration";
        runtime.combatTelemetry.artilleryHullContacts += 1;
        runtime.combatTelemetry.artilleryArmorDamage += Math.max(
          0,
          beforeArmor -
            (tank.armor.front + tank.armor.left + tank.armor.right + tank.armor.rear),
        );
        runtime.combatTelemetry.artilleryOrganDamage += Math.max(
          0,
          beforeOrgans - (tank.core + tank.leftTread + tank.rightTread),
        );
      }

      const formationDistance = Math.hypot(
        runtime.formation.x - impactX,
        runtime.formation.z - impactZ,
      );
      if (formationDistance < 152) {
        const formationFalloff = 1 - formationDistance / 152;
        const shelterMultiplier = commonShelterCasualtyMultiplier(
          runtime.grafts["common-shelter"],
          runtime.formation.connected,
        );
        runtime.formation.suppression = clamp(
          runtime.formation.suppression +
            (30 + formationFalloff * 28) * (shelterMultiplier < 1 ? 0.82 : 1),
          0,
          100,
        );
        runtime.formation.casualties = clamp(
          runtime.formation.casualties +
            (3 + formationFalloff * 6) * shelterMultiplier,
          0,
          100,
        );
        if (shelterMultiplier < 1) {
          setCaption(
            runtime,
            "COMMON SHELTER CLOSES — THE CHOIR STOPS FIRING TO KEEP THE CASUALTY ROAD ALIVE",
            3.4,
          );
        }
        if (artilleryOutcome === "terrain") artilleryOutcome = "formation";
      }

      if (artilleryOutcome === "terrain") runtime.combatTelemetry.terrain += 1;
      else if (artilleryOutcome === "formation") {
        runtime.combatTelemetry.formation += 1;
      } else {
        runtime.combatTelemetry.hull += 1;
        if (artilleryOutcome === "bounce") runtime.combatTelemetry.bounces += 1;
        else runtime.combatTelemetry.penetrations += 1;
      }

      runtime.shake = Math.max(runtime.shake, 28);
      addExplosion(
        runtime,
        impactX,
        impactZ,
        ARTILLERY_BLAST_RADIUS,
        "artillery",
        0.94,
      );
      const crater = {
        x: impactX,
        z: impactZ,
        radius: 112,
        depth: 20,
      };
      runtime.terrainCraters.push(crater);
      markCraterChunksDirty(crater);
      if (runtime.terrainCraters.length > 24) {
        const retiredCrater = runtime.terrainCraters.shift();
        if (retiredCrater) markCraterChunksDirty(retiredCrater);
      }
      runtime.terrainRevision += 1;
      return artilleryOutcome;
    };

    const beginArtilleryMission = (runtime: Runtime) => {
      const readyObserver = runtime.defenders.find(
        (defender) =>
          defender.alive &&
          defender.kind === "observer" &&
          defender.fireClock <= 0,
      );
      const observed = !!readyObserver;
      const profile = artilleryMissionProfile(
        runtime.elapsed,
        runtime.formation.capturedGround,
        observed,
      );
      const mark = artilleryMarkForTank(runtime.tank);

      if (!observed) {
        const errorAngle = combatRandom(runtime) * TAU;
        const errorDistance = 68 + combatRandom(runtime) * 54;
        mark.x += Math.cos(errorAngle) * errorDistance;
        mark.z += Math.sin(errorAngle) * errorDistance;
      }

      runtime.artilleryMissions += 1;
      runtime.artillery = {
        observerId: readyObserver?.id ?? -1,
        x: mark.x,
        z: mark.z,
        warning: profile.warning,
        stage: observed ? "flare" : "ranging",
        observed,
        mission: runtime.artilleryMissions,
        salvoSize: profile.salvoSize,
        cadence: profile.cadence,
        batteryPause: profile.batteryPause,
        dispersion: profile.dispersion,
        rangingRoundsFired: 0,
        shellsRemaining: profile.salvoSize,
        shellClock: 0,
      };
      soundEngineRef.current?.artilleryCue(
        runtime.artilleryMissions,
        observed ? "flare" : "ranging",
      );
      if (observed) reneeDirectorRef.current?.signal("artillery-flare", runtime.elapsed);
      if (readyObserver) {
        readyObserver.flash = 0.8;
        readyObserver.fireClock = profile.batteryPause;
      }
      setCaption(
        runtime,
        observed
          ? "OBSERVER FLARE — KILL THE THROAT BEFORE THE FIRST RANGING ROUND"
          : "REGISTERED MAP FIRE — THE BATTERY REMEMBERS THIS ROAD",
        3.3,
      );
    };

    const updateArtillery = (runtime: Runtime, dt: number) => {
      runtime.artilleryClock = Math.max(0, runtime.artilleryClock - dt);
      let strike = runtime.artillery;
      if (!strike) {
        // The first observer gets one brief chance to raise the flare. If the
        // automatic mouth kills it first, the pre-registered battery still
        // begins the lesson. Doing nothing can never counterbattery itself.
        if (runtime.artilleryClock > 0 || runtime.elapsed < 0.62) return;
        beginArtilleryMission(runtime);
        strike = runtime.artillery;
        if (!strike) return;
      }

      const observerAlive =
        strike.observerId >= 0 &&
        runtime.defenders.some(
          (defender) =>
            defender.alive &&
            defender.id === strike.observerId &&
            defender.kind === "observer",
        );
      // Before the first ranging shell, killing an active observer cancels the
      // observed correction. Once a real shell has landed, the battery owns a
      // registered point and the remaining mission cannot be recalled.
      if (
        strike.observed &&
        !observerAlive &&
        strike.rangingRoundsFired === 0 &&
        strike.warning > 4.45
      ) {
        runtime.artillery = null;
        runtime.artilleryClock = 4.5;
        setCaption(
          runtime,
          "OBSERVER DEAD — CORRECTION LOST, BUT THE BATTERY WILL RETURN",
          3,
        );
        return;
      }

      strike.warning -= dt;
      if (strike.warning <= 4.4 && strike.rangingRoundsFired === 0) {
        const offset = artilleryRangingPoint(
          0,
          runtime.tank.angle,
          strike.observed,
        );
        resolveArtilleryShell(runtime, strike.x + offset.x, strike.z + offset.z);
        strike.rangingRoundsFired = 1;
        strike.stage = "ranging";
        soundEngineRef.current?.artilleryCue(strike.mission, "ranging");
        setCaption(runtime, "RANGING ROUND — BRACKET LONG, BATTERY CORRECTING", 2.2);
      }
      if (strike.warning <= 2.65 && strike.rangingRoundsFired === 1) {
        const offset = artilleryRangingPoint(
          1,
          runtime.tank.angle,
          strike.observed,
        );
        resolveArtilleryShell(runtime, strike.x + offset.x, strike.z + offset.z);
        strike.rangingRoundsFired = 2;
        strike.stage = "incoming";
        soundEngineRef.current?.artilleryCue(strike.mission, "incoming");
        reneeDirectorRef.current?.signal("artillery-incoming", runtime.elapsed);
        setCaption(runtime, "BRACKET SPLIT — FIRE FOR EFFECT, MOVE NOW", 2.2);
      }
      if (strike.warning > 0) return;

      strike.shellClock -= dt;
      if (strike.shellClock > 0) return;

      const salvoIndex = strike.salvoSize - strike.shellsRemaining;
      const offset = artillerySalvoPoint(
        salvoIndex,
        runtime.tank.angle,
        strike.dispersion,
      );
      resolveArtilleryShell(runtime, strike.x + offset.x, strike.z + offset.z);
      setCaption(
        runtime,
        strike.shellsRemaining > 1
          ? `FIRE FOR EFFECT — ${strike.shellsRemaining - 1} SHELLS WALKING THE BEATEN ZONE`
          : "BATTERY LIFTS TO WORK THE GUNS — IT HAS NOT FORGOTTEN YOU",
        3.2,
      );
      strike.shellsRemaining -= 1;
      if (strike.shellsRemaining <= 0) {
        runtime.artillery = null;
        runtime.artilleryClock = strike.batteryPause;
      } else {
        strike.shellClock = strike.cadence;
      }
    };

    const addGraftImpact = (
      runtime: Runtime,
      shot: Projectile,
      x: number,
      z: number,
    ) => {
      const profile =
        shot.kind === "bow"
          ? { kind: "needle" as const, radius: 24, life: 0.32 }
          : shot.kind === "top"
            ? { kind: "crown" as const, radius: 30, life: 0.38 }
            : shot.kind === "rib-mortar"
              ? { kind: "cyst" as const, radius: 94, life: 0.86 }
              : shot.kind === "tooth"
                ? { kind: "tooth" as const, radius: 20, life: 0.3 }
                : shot.kind === "rifle"
                  ? { kind: "choir" as const, radius: 18, life: 0.26 }
                  : shot.kind === "sapper" || shot.kind === "trench-tooth"
                    ? { kind: "trench" as const, radius: 28, life: 0.38 }
                    : null;
      if (!profile) return;
      addExplosion(
        runtime,
        x,
        z,
        profile.radius + Math.min(28, shot.intensity * 3),
        profile.kind,
        profile.life,
        shot.intensity,
      );
    };

    const resolveBowMutationImpact = (
      runtime: Runtime,
      shot: Projectile,
      x: number,
      z: number,
      struck: Defender | null,
      killed: boolean,
    ) => {
      if (shot.kind !== "bow") return;
      if (shot.graftExplosive) {
        runtime.arsenalDetonations += 1;
        const radius = 68;
        for (const victim of runtime.defenders) {
          if (!victim.alive || victim === struck) continue;
          const distance = Math.hypot(victim.x - x, victim.z - z);
          if (distance >= radius) continue;
          victim.hp -= 18 * (1 - distance / radius);
          victim.flash = 0.18;
          if (victim.hp <= 0) killDefender(runtime, victim, "bow", 2.2);
        }
        addExplosion(runtime, x, z, radius, "cyst", 0.72, 2.4);
      }
      if (
        shot.executionBurst &&
        killed &&
        struck &&
        struck.kind !== "infantry" &&
        struck.kind !== "machine-gun"
      ) {
        const radius = 124;
        for (const victim of runtime.defenders) {
          if (!victim.alive || victim === struck) continue;
          const distance = Math.hypot(victim.x - x, victim.z - z);
          if (distance >= radius) continue;
          victim.hp -= 48 * (1 - distance / radius);
          victim.flash = 0.24;
          if (victim.hp <= 0) killDefender(runtime, victim, "bow", 3.8);
        }
        addExplosion(runtime, x, z, radius, "rupture", 1.05, 4.2);
        setCaption(runtime, "BUTCHER'S REEL — THE SPECIALIST TAKES ITS POSITION WITH IT", 2.4);
      }
      if (shot.graftToxic) {
        runtime.toxicCloudsBorn += 1;
        addExplosion(runtime, x, z, 82, "toxic", 6.5, 2.8);
      }
    };

    const completeDefenseShot = (
      runtime: Runtime,
      shot: Projectile,
      outcome: "terrain" | "formation" | "hull" | "bounce" | "penetration",
    ) => {
      if (shot.owner !== "defense" || shot.defenseResolved) return;
      shot.defenseResolved = true;
      if (outcome === "terrain") runtime.combatTelemetry.terrain += 1;
      else if (outcome === "formation") runtime.combatTelemetry.formation += 1;
      else if (outcome === "bounce") {
        runtime.combatTelemetry.hull += 1;
        runtime.combatTelemetry.bounces += 1;
      } else if (outcome === "penetration") {
        runtime.combatTelemetry.hull += 1;
        runtime.combatTelemetry.penetrations += 1;
      } else runtime.combatTelemetry.hull += 1;
    };

    const completeInfantryShot = (
      runtime: Runtime,
      shot: Projectile,
      outcome: "terrain" | "near-miss" | "hit",
    ) => {
      if (shot.owner !== "infantry" || shot.infantryResolved) return;
      shot.infantryResolved = true;
      if (outcome === "terrain") runtime.combatTelemetry.infantryTerrain += 1;
      else if (outcome === "near-miss") {
        runtime.combatTelemetry.infantryNearMisses += 1;
      } else runtime.combatTelemetry.infantryHits += 1;
    };

    const updateProjectiles = (runtime: Runtime, dt: number) => {
      const tank = runtime.tank;
      // Iterate backward so expired bodies can be swap-removed and returned to
      // the pool without copying the entire bullet heaven every frame.
      for (let shotIndex = runtime.projectiles.length - 1; shotIndex >= 0; shotIndex -= 1) {
        const shot = runtime.projectiles[shotIndex];
        shot.age += dt;
        shot.previousX = shot.x;
        shot.previousZ = shot.z;
        shot.previousElevation = shot.elevation;
        shot.x += shot.vx * dt;
        shot.z += shot.vz * dt;
        shot.elevation += shot.verticalVelocity * dt;
        shot.life -= dt;
        let consumed = shot.life <= 0;

        const terrainHit = consumed
          ? null
          : terrainBlocksSegment(
              { x: shot.previousX, z: shot.previousZ },
              shot,
              (x: number, z: number) =>
                terrainHeightAt(x, z, runtime.terrainCraters),
              {
                previous: shot.previousElevation,
                current: shot.elevation,
              },
            );
        if (terrainHit) {
          consumed = true;
          completeDefenseShot(runtime, shot, "terrain");
          if (shot.owner === "infantry") {
            const aimed = runtime.defenders.find(
              (defender) => defender.alive && defender.id === shot.aimTargetId,
            );
            const nearMiss =
              aimed &&
              Math.hypot(aimed.x - terrainHit.x, aimed.z - terrainHit.z) <= 122;
            if (nearMiss && aimed) {
              aimed.suppression = clamp(
                aimed.suppression + friendlySuppressionFor(aimed.kind, false),
                0,
                100,
              );
              completeInfantryShot(runtime, shot, "near-miss");
            } else {
              completeInfantryShot(runtime, shot, "terrain");
            }
            addExplosion(
              runtime,
              terrainHit.x,
              terrainHit.z,
              nearMiss ? 16 : 11,
              "dirt",
              nearMiss ? 0.24 : 0.18,
              nearMiss ? 1.25 : 0.75,
            );
          }
          if (
            shot.owner === "landship" &&
            (shot.kind === "ap" || shot.kind === "he" || shot.kind === "rib-mortar")
          ) {
            if (shot.kind === "rib-mortar") {
              for (const victim of runtime.defenders) {
                if (!victim.alive) continue;
                const distance = Math.hypot(victim.x - terrainHit.x, victim.z - terrainHit.z);
                if (distance > 96) continue;
                victim.hp -= Math.max(8, shot.damage * (1 - distance / 118));
                victim.flash = 0.18;
                if (victim.hp <= 0) {
                  killDefender(runtime, victim, "rib-mortar", shot.intensity);
                }
              }
              addGraftImpact(runtime, shot, terrainHit.x, terrainHit.z);
            } else if (shot.kind === "he") {
              runtime.heImpacts += 1;
              const profile = cannonProfile("he");
              for (const victim of runtime.defenders) {
                if (!victim.alive) continue;
                const distance = Math.hypot(victim.x - terrainHit.x, victim.z - terrainHit.z);
                victim.hp -= heBlastDamage(victim.kind, distance);
                if (victim.hp <= 0) killDefender(runtime, victim, "he", shot.intensity);
              }
              addExplosion(
                runtime,
                terrainHit.x,
                terrainHit.z,
                profile.blastRadius,
                "he",
                1.12,
                shot.intensity,
              );
            } else {
              runtime.apImpacts += 1;
              addExplosion(runtime, terrainHit.x, terrainHit.z, 52, "ap", 0.58, shot.intensity);
            }
            birthWhelps(runtime, shot, terrainHit.x, terrainHit.z);
            setCaption(runtime, "SHELL STRIKES RAISED EARTH — THE PARAPET TAKES THE MOUTH", 1.5);
          } else if (shot.owner !== "defense" && shot.owner !== "infantry") {
            addGraftImpact(runtime, shot, terrainHit.x, terrainHit.z);
            resolveBowMutationImpact(runtime, shot, terrainHit.x, terrainHit.z, null, false);
          }
        }

        if (!consumed && shot.owner !== "defense") {
          for (const defender of runtime.defenders) {
            if (!defender.alive) continue;
            if (
              projectileHitsTarget(
                { x: shot.previousX, z: shot.previousZ },
                shot,
                defender,
                shot.radius + (defender.kind === "observer" ? 14 : 24),
              )
            ) {
              if (shot.hitIds.includes(defender.id)) continue;
              shot.hitIds.push(defender.id);
              if (shot.kind === "he") {
                runtime.heImpacts += 1;
                const profile = cannonProfile("he");
                for (const victim of runtime.defenders) {
                  if (
                    !victim.alive ||
                    distanceSq(victim, defender) >
                      profile.blastRadius * profile.blastRadius
                  ) {
                    continue;
                  }
                  victim.hp -= heBlastDamage(
                    victim.kind,
                    Math.hypot(victim.x - defender.x, victim.z - defender.z),
                  );
                  victim.flash = 0.18;
                  if (victim.hp <= 0) killDefender(runtime, victim, "he", shot.intensity);
                }
                addExplosion(
                  runtime,
                  defender.x,
                  defender.z,
                  profile.blastRadius,
                  "he",
                  1.12,
                  shot.intensity,
                );
                runtime.shake = Math.max(runtime.shake, 22);
                setCaption(
                  runtime,
                  "HE DETONATION — THE TRENCH LINE COMES APART",
                  1.8,
                );
              } else if (shot.kind === "rib-mortar") {
                for (const victim of runtime.defenders) {
                  if (!victim.alive) continue;
                  const distance = Math.hypot(victim.x - defender.x, victim.z - defender.z);
                  if (distance > 96) continue;
                  victim.hp -= Math.max(8, shot.damage * (1 - distance / 118));
                  victim.flash = 0.18;
                  if (victim.hp <= 0) {
                    killDefender(runtime, victim, "rib-mortar", shot.intensity);
                  }
                }
                addGraftImpact(runtime, shot, defender.x, defender.z);
              } else {
                if (shot.owner === "infantry" && shot.kind === "rifle") {
                  defender.suppression = clamp(
                    defender.suppression +
                      friendlySuppressionFor(defender.kind, true),
                    0,
                    100,
                  );
                  completeInfantryShot(runtime, shot, "hit");
                }
                defender.hp -= shot.damage;
                defender.flash = 0.12;
                const killed = defender.hp <= 0;
                if (defender.hp <= 0) {
                  killDefender(runtime, defender, shot.kind, shot.intensity);
                }
                if (shot.kind === "ap") {
                  runtime.apImpacts += 1;
                  const profile = cannonProfile("ap");
                  for (const victim of runtime.defenders) {
                    if (
                      victim === defender ||
                      !victim.alive ||
                      distanceSq(victim, defender) >
                        profile.blastRadius * profile.blastRadius
                    ) {
                      continue;
                    }
                    victim.hp -= 18;
                    victim.flash = 0.08;
                    if (victim.hp <= 0) killDefender(runtime, victim, "ap", shot.intensity);
                  }
                  addExplosion(
                    runtime,
                    defender.x,
                    defender.z,
                    Math.max(52, profile.blastRadius),
                    "ap",
                    0.58,
                    shot.intensity,
                  );
                } else {
                  addGraftImpact(runtime, shot, defender.x, defender.z);
                  resolveBowMutationImpact(
                    runtime,
                    shot,
                    defender.x,
                    defender.z,
                    defender,
                    killed,
                  );
                }
              }
              birthWhelps(runtime, shot, defender.x, defender.z);
              if (shot.kind === "bow" && shot.pierceRemaining > 0) {
                runtime.arsenalPenetrations += 1;
                shot.pierceRemaining -= 1;
                consumed = false;
                continue;
              }
              consumed = true;
              break;
            }
          }
        } else if (!consumed) {
          const towardFormation =
            (shot.kind === "machine-gun" ||
              shot.kind === "infantry" ||
              shot.kind === "reserve-assault") &&
            Math.abs(shot.z - runtime.formation.z) < 20 &&
            Math.abs(shot.x - runtime.formation.x) <
              runtime.formation.width * 0.62;
          if (towardFormation) {
            runtime.formation.suppression = clamp(
              runtime.formation.suppression + 5,
              0,
              100,
            );
            if (combatRandom(runtime) < 0.12) {
              runtime.formation.casualties = clamp(
                runtime.formation.casualties + 0.4,
                0,
                100,
              );
            }
            completeDefenseShot(runtime, shot, "formation");
            consumed = true;
          } else if (distanceSq(shot, tank) <= (shot.radius + 29) ** 2) {
            const contactPolicy = defenseHullContactPolicy(
              shot.kind,
              tank.invulnerable,
            );
            if (contactPolicy === "resolve") {
              const impact = impactTank(runtime, shot);
              completeDefenseShot(
                runtime,
                shot,
                impact === "bounce"
                  ? "bounce"
                  : impact === "penetration"
                    ? "penetration"
                    : "hull",
              );
              if (
                shot.kind === "machine-gun" ||
                shot.kind === "infantry" ||
                shot.kind === "reserve-assault" ||
                shot.kind === "carrier"
              ) {
                tank.invulnerable = 0.08;
              }
            } else {
              completeDefenseShot(runtime, shot, "hull");
            }
            // Even a throttled cosmetic small-arms contact ends at the hull.
            // It cannot remain inside the collider and escort an AP round
            // through under a shared immunity window.
            consumed = true;
          }
        }

        if (
          consumed ||
          shot.x < -FIELD_HALF_WIDTH - 160 ||
          shot.x > FIELD_HALF_WIDTH + 160 ||
          shot.z < Math.min(tank.z, runtime.formation.z) - 1200 ||
          shot.z > tank.z + 2100
        ) {
          recycleProjectileAt(runtime, shotIndex);
        }
      }
    };

    const updateFormation = (runtime: Runtime, dt: number) => {
      const formation = runtime.formation;
      const tank = runtime.tank;
      const gap = Math.max(0, tank.z - formation.z);
      const activeWake = activeBreachWakeFor(runtime);
      formation.surgeClock = Math.max(0, formation.surgeClock - dt);
      formation.volleyPulse = Math.max(0, formation.volleyPulse - dt * 5.5);
      let activeMachineGun = false;
      let activeFlanker = false;
      let routeContested = false;
      const routeSpan = Math.max(1, tank.z - formation.z);
      for (const defender of runtime.defenders) {
        if (!defender.alive) continue;
        const relativeZ = defender.z - formation.z;
        if (machineGunControlsFormation(defender, formation, (x: number, z: number) =>
          terrainHeightAt(x, z, runtime.terrainCraters))) {
          activeMachineGun = true;
        }
        if (defender.kind === "flanker" && Math.abs(relativeZ) < 320) {
          activeFlanker = true;
        }
        if (defender.z >= formation.z - 40 && defender.z <= tank.z + 80) {
          const routeAmount = clamp(
            (defender.z - formation.z) / routeSpan,
            0,
            1,
          );
          const routeX = formation.x + (tank.x - formation.x) * routeAmount;
          if (Math.abs(defender.x - routeX) < formation.width * 0.85 + 34) {
            routeContested = true;
          }
        }
      }
      const firingSolution = chooseFriendlyFiringPosition({
        source: { x: formation.x, z: formation.z + 14 },
        defenders: runtime.defenders,
        heightAt: (x: number, z: number) =>
          terrainHeightAt(x, z, runtime.terrainCraters),
        range: 980,
        witnessCilia: runtime.grafts["witness-cilia"] > 0,
        routeX: tank.x,
      }) as {x:number;z:number;target:Defender} | null;
      const formationTarget = firingSolution?.target ?? null;
      formation.routeContested = routeContested;
      const previousFormationState = formation.state;
      formation.state = formationStateFor({
        gap,
        cohesion: formation.cohesion,
        suppression: formation.suppression,
        routeContested,
        breachWake: !!activeWake,
      });
      if (formation.state !== previousFormationState) {
        if (formation.state === "overrun") {
          voiceEngineRef.current?.trigger("spear-outrun");
        } else if (
          formation.state === "separated" &&
          previousFormationState !== "overrun"
        ) {
          voiceEngineRef.current?.trigger("never-evade");
        }
      }
      formation.connected = formation.state === "connected";
      formation.signalPulse += dt *
        (formation.state === "connected"
          ? 3.6
          : formation.state === "reconnecting"
            ? 5.4
            : 8);
      formation.targetId = formationTarget?.id ?? null;
      formation.intent =
        formation.state === "overrun" || formation.suppression >= 88
          ? "suppressed"
          : formationTarget
            ? "engage"
            : "advance";
      const formationAimX = activeWake
        ? activeWake.x
        : firingSolution
          ? firingSolution.x
          : tank.x;
      formation.x +=
        (formationAimX - formation.x) *
        Math.min(
          1,
          dt *
            (formation.state === "reconnecting"
              ? 1.05
              : formation.connected
                ? 0.62
                : 0.42),
        );

      const nearestWire = runtime.wires.find(
        (wire) =>
          formation.z < wire.z &&
          wire.z - formation.z < 42 &&
          (wire.gapWidth < formation.width ||
            Math.abs(wire.gapCenter - formation.x) >
              Math.max(0, (wire.gapWidth - formation.width) * 0.5)),
      );
      const pressure = formationPressure({
        connected: formation.connected,
        activeMachineGun,
        activeFlanker,
        routeContested,
        inBreachWake: !!activeWake,
        suppression: formation.suppression,
      });
      formation.suppression = clamp(
        formation.suppression + dt * pressure.suppressionPerSecond,
        0,
        100,
      );

      if (pressure.casualtyPerSecond > 0) {
        const loss = dt * pressure.casualtyPerSecond;
        formation.casualties = clamp(formation.casualties + loss, 0, 100);
        formation.cohesion = clamp(formation.cohesion - loss, 0, 100);
      } else {
        formation.cohesion = clamp(formation.cohesion + dt * 0.65, 0, 100);
      }

      const canAdvance =
        !nearestWire &&
        formation.suppression < (activeWake ? 92 : 86) &&
        gap > 72 &&
        formation.cohesion > 12 &&
        formation.state !== "overrun";
      if (canAdvance) {
        const routeObjective = activeWake
          ? Math.min(tank.z - 76, activeWake.z + activeWake.radius * 0.55)
          : tank.z - 118;
        const objectiveZ = formationTarget
          ? Math.min(routeObjective, formationTarget.z - 92)
          : routeObjective;
        const advanceGap = objectiveZ - formation.z;
        if (advanceGap > 0) {
          const statePace =
            formation.state === "reconnecting"
              ? 1.48
              : formation.state === "stretched"
                ? 1.16
                : formation.state === "separated"
                  ? 0.92
                  : 1;
          const surgePace = formation.surgeClock > 0 ? 1.24 : 1;
          formation.z +=
            dt *
            clamp(advanceGap * 0.48, 28, 74) *
            clamp(1 - formation.suppression / 125, 0.22, 1) *
            statePace *
            surgePace;
        }
      }

      formation.volleyClock -= dt;
      for (let index = 0; index < runtime.choirOrganClocks.length; index += 1) {
        runtime.choirOrganClocks[index] -= dt;
      }
      const shelterClosed =
        runtime.grafts["common-shelter"] > 0 &&
        formation.connected &&
        runtime.artillery?.stage === "incoming";
      const canFight =
        formation.cohesion > 12 && formation.suppression < 92 && !shelterClosed;
      if (shelterClosed) {
        formation.volleyClock = Math.max(formation.volleyClock, 0.28);
      }
      if (canFight && formation.volleyClock <= 0) {
        const fireteams = activeFriendlyFireteams(formation);
        let volleyShots = 0;
        for (let team = 0; team < fireteams; team += 1) {
          const lateral = (team - (fireteams - 1) / 2) * 30;
          const forward = 14 + (team % 2) * 8;
          const source = {
            x:
              formation.x +
              Math.cos(tank.angle) * forward -
              Math.sin(tank.angle) * lateral,
            z:
              formation.z +
              Math.sin(tank.angle) * forward +
              Math.cos(tank.angle) * lateral,
          };
          const suppressionTarget =
            team === 0
              ? chooseFriendlySuppressionTarget({
                  source,
                  defenders: runtime.defenders,
                  heightAt: (x: number, z: number) =>
                    terrainHeightAt(x, z, runtime.terrainCraters),
                  range: 900,
                })
              : null;
          const target = (suppressionTarget ??
            chooseFriendlyRifleTarget({
              source,
              defenders: runtime.defenders,
              heightAt: (x: number, z: number) =>
                terrainHeightAt(x, z, runtime.terrainCraters),
              range: 900,
              witnessCilia: runtime.grafts["witness-cilia"] > 0,
              routeX: tank.x,
            })) as Defender | null;
          if (!target) continue;
          const angle = Math.atan2(target.z - source.z, target.x - source.x);
          fireProjectile(
            runtime,
            "infantry",
            "rifle",
            source,
            angle,
            610,
            friendlyRifleDamage(target.kind),
            2.4,
            0.018,
            true,
            undefined,
            target,
          );
          volleyShots += 1;
          addExplosion(runtime, source.x, source.z, 16, "muzzle", 0.12, 0.85);
        }
        formation.shotsFired += volleyShots;
        if (volleyShots > 0) formation.volleyPulse = 1;
        formation.volleyClock =
          volleyShots > 0 ? friendlyVolleyCadence(formation) : 0.18;
      }

      if (canFight) {
        for (let voice = 0; voice < runtime.grafts["rifle-choir"]; voice += 1) {
          if ((runtime.choirOrganClocks[voice] ?? 0) > 0) continue;
          const source = {
            x: formation.x + (voice % 2 === 0 ? -1 : 1) * (34 + voice * 9),
            z: formation.z + 12 - voice * 5,
          };
          const target = chooseFriendlyRifleTarget({
            source,
            defenders: runtime.defenders,
            heightAt: (x: number, z: number) =>
              terrainHeightAt(x, z, runtime.terrainCraters),
            range: 1100,
            witnessCilia: runtime.grafts["witness-cilia"] > 0,
            routeX: tank.x,
          }) as Defender | null;
          if (!target) {
            runtime.choirOrganClocks[voice] = 0.16;
            continue;
          }
          const angle = Math.atan2(target.z - source.z, target.x - source.x);
          for (let rifle = 0; rifle < 3; rifle += 1) {
            fireProjectile(
              runtime,
              "infantry",
              "rifle",
              { x: source.x + rifle * 6, z: source.z - rifle * 3 },
              angle,
              620,
              friendlyRifleDamage(target.kind) * 1.08,
              2,
              0.055,
              true,
              undefined,
              target,
            );
          }
          formation.shotsFired += 3;
          formation.volleyPulse = 1;
          addExplosion(runtime, source.x, source.z, 24, "muzzle", 0.14);
          runtime.choirOrganClocks[voice] = 0.72 + voice * 0.083;
        }
      }

      const sapperLevel = runtime.grafts["sapper-brood"];
      if (formation.connected && sapperLevel > 0 && runtime.sapperClock <= 0) {
        const wire = runtime.wires.find(
          (candidate) => candidate.z >= formation.z - 20 && candidate.z - formation.z < 125,
        );
        if (wire) {
          wire.gapCenter += (formation.x - wire.gapCenter) * 0.45;
          wire.gapWidth = Math.min(220, wire.gapWidth + 10 + sapperLevel * 5);
          if (wire.gapWidth >= formation.width + BREACH_CLEARANCE) wire.torn = true;
        }
        const nearbyBarricades = trenchBarricadesInRange(formation.z - 52, formation.z + 112)
          .filter((barricade) => Math.abs(barricade.x - formation.x) < formation.width * 0.75)
          .slice(0, sapperLevel);
        for (const barricade of nearbyBarricades) runtime.crushedBarricades.add(barricade.id);
        const target = nearestDefender(runtime, formation, 360);
        if (target) {
          const angle = Math.atan2(target.z - formation.z, target.x - formation.x);
          for (let file = 0; file < sapperLevel; file += 1) {
            fireProjectile(
              runtime,
              "infantry",
              "sapper",
              { x: formation.x + (file - (sapperLevel - 1) / 2) * 16, z: formation.z },
              angle,
              470,
              12,
              4,
              0.08,
              true,
              undefined,
              target,
            );
          }
          formation.shotsFired += sapperLevel;
          formation.volleyPulse = 1;
        }
        runtime.sapperClock = Math.max(0.5, 1.18 - sapperLevel * 0.07);
      }

      const trenchTeethLevel = runtime.grafts["trench-teeth"];
      if (trenchTeethLevel > 0 && runtime.trenchTeethClock <= 0) {
        const occupationMaw = activeOffspring(runtime.grafts).includes("Occupation Maw");
        const munitionWomb = runtime.grafts["munition-womb"] > 0;
        for (const node of runtime.captureNodes) {
          if (!node.captured) continue;
          let target: Defender | null = null;
          let targetDistance = 760 * 760;
          const candidates = runtime.defenders
            .filter((defender) => defender.alive && defender.z > node.z - 20)
            .sort((a, b) => {
              if (munitionWomb) {
                const aHeavy = a.kind === "carrier" || a.kind === "anti-armor";
                const bHeavy = b.kind === "carrier" || b.kind === "anti-armor";
                if (aHeavy !== bHeavy) return aHeavy ? -1 : 1;
              }
              return distanceSq(node, a) - distanceSq(node, b);
            });
          for (const defender of candidates) {
            if (!defender.alive || defender.z <= node.z - 20) continue;
            const candidateDistance = distanceSq(node, defender);
            if (candidateDistance >= targetDistance) continue;
            target = defender;
            targetDistance = candidateDistance;
          }
          if (!target) continue;
          const angle = Math.atan2(target.z - node.z, target.x - node.x);
          for (let mouth = 0; mouth < trenchTeethLevel; mouth += 1) {
            fireProjectile(
              runtime,
              "infantry",
              munitionWomb
                ? "tooth"
                : occupationMaw
                  ? "sapper"
                  : "trench-tooth",
              { x: node.x + (mouth - (trenchTeethLevel - 1) / 2) * 18, z: node.z + 10 },
              angle,
              munitionWomb ? 640 : occupationMaw ? 520 : 580,
              munitionWomb ? 24 : occupationMaw ? 14 : 8,
              munitionWomb ? 6 : occupationMaw ? 4 : 3,
              0.06,
              true,
              undefined,
              target,
            );
          }
          formation.shotsFired += trenchTeethLevel;
        }
        runtime.trenchTeethClock = Math.max(0.38, 0.92 - trenchTeethLevel * 0.055);
      }

      const nextNode = runtime.captureNodes.find(
        (candidate) => !candidate.captured,
      );
      const tacticalBlockers = captureBlockersFor(runtime, nextNode);
      runtime.captureBlockers = tacticalBlockers;
      runtime.nextLineDistance = Math.max(
        0,
        (nextNode?.z ?? formation.z) - formation.z,
      );
      if (nextNode && !nextNode.captured) {
        const sectorWire = runtime.wires.find(
          (wire) => wire.z < nextNode.z && wire.z > nextNode.z - 280,
        );
        if (sectorWire && !sectorWire.torn) {
          setDirectorPhase(runtime.director, "breach", runtime.elapsed);
        } else if (formation.z < nextNode.z - 72) {
          setDirectorPhase(runtime.director, "cross", runtime.elapsed);
        } else {
          setDirectorPhase(runtime.director, "consolidate", runtime.elapsed);
        }
      }
      const counterattackAlive = !!nextNode && runtime.defenders.some(
        (defender) => defender.alive && defender.sector === nextNode.sector &&
          (defender.kind === "reserve-assault" || defender.kind === "engineer"),
      );
      const control = nextNode
        ? updateSectorControl(nextNode, runtime.elapsed, tacticalBlockers.length === 0, counterattackAlive)
        : null;
      if (nextNode && control?.spawn) spawnSectorCounterattack(runtime, nextNode);
      if (
        nextNode &&
        control?.secured &&
        captureAcre(
          runtime.director,
          nextNode.sector + 1,
          runtime.elapsed,
        )
      ) {
        nextNode.captured = true;
        formation.capturedGround = runtime.director.capturedAcres;
        formation.cohesion = clamp(formation.cohesion + 4, 0, 100);
        formation.suppression = clamp(formation.suppression - 8, 0, 100);
        tank.core += fieldConsolidationRepair(tank.core, 100);
        tank.leftTread += fieldConsolidationRepair(tank.leftTread, 100);
        tank.rightTread += fieldConsolidationRepair(tank.rightTread, 100);
        const armorMaximums: Record<ArmorFace, number> = {
          front: 100,
          left: 72,
          right: 72,
          rear: 44,
        };
        for (const face of Object.keys(armorMaximums) as ArmorFace[]) {
          tank.armor[face] += fieldConsolidationRepair(
            tank.armor[face],
            armorMaximums[face],
          );
        }
        setCaption(
          runtime,
          `GROUND ${formation.capturedGround} TAKEN — FIELD CONSOLIDATION CLOSES THE WORST WOUNDS`,
          4,
        );
        soundEngineRef.current?.playCapture();
        voiceEngineRef.current?.trigger("take-the-acre");
        runtime.lastGraftKills = runtime.enemyKills;
        seedDefenseHorizon(
          runtime,
          nextNode.sector + 1 + DEFENSE_HORIZON_SECTORS,
        );
      } else if (
        nextNode &&
        control &&
        ["holding", "counterattack", "summon-counterattack"].includes(control.state.stage)
      ) {
        runtime.captureBlockers = [
          ...tacticalBlockers,
          control.state.stage === "holding"
            ? `CONSOLIDATE ${Math.ceil(control.state.remaining)}s`
            : "RESERVE COUNTERATTACK",
        ];
      }
    };

    const queueNutritionGraft = (runtime: Runtime) => {
      if (runtime.status !== "playing") return;
      if (runtime.pendingGraftSource === null) {
        if (runtime.nutrientXp < nutrientTargetForLevel(runtime.nutrientLevel)) return;
        runtime.pendingGraftSource = {
          kind: "nutrition",
          level: runtime.nutrientLevel + 1,
        };
        const nextOffers = chooseOffers(runtime);
        if (nextOffers.length === 0) {
          runtime.pendingGraftSource = null;
          return;
        }
        setOfferGraftKeys(nextOffers);
        setCaption(
          runtime,
          "ORGAN READY · HELD FOR A FIRING LULL",
          1.6,
        );
        reneeDirectorRef.current?.signal("nutrient-ready", runtime.elapsed);
        return;
      }

      if (!canPresentGraftOffer(runtime)) return;
      runtime.status = "graft";
      setCaption(
        runtime,
        `NUTRIENT LEVEL ${runtime.nutrientLevel + 1} — THE BODY DEMANDS A NEW ORGAN`,
        4,
      );
      setScreen("graft");
    };

    const update = (runtime: Runtime, dt: number) => {
      if (runtime.status !== "playing") return;
      runtime.elapsed += dt;
      runtime.shake = Math.max(0, runtime.shake - dt * 22);
      runtime.impactFlash = Math.max(0, runtime.impactFlash - dt);
      runtime.captionClock = Math.max(0, runtime.captionClock - dt);
      runtime.counterbatteryClock = Math.max(
        0,
        runtime.counterbatteryClock - dt,
      );
      runtime.ciliaClock = Math.max(0, runtime.ciliaClock - dt);
      runtime.sapperClock = Math.max(0, runtime.sapperClock - dt);
      runtime.trenchTeethClock = Math.max(0, runtime.trenchTeethClock - dt);
      runtime.trenchquakeClock = Math.max(0, runtime.trenchquakeClock - dt);
      runtime.tank.invulnerable = Math.max(
        0,
        runtime.tank.invulnerable - dt,
      );
      runtime.tank.turretRecoil = Math.max(
        0,
        runtime.tank.turretRecoil - dt * 5.5,
      );
      runtime.tank.coaxRecoil = Math.max(
        0,
        runtime.tank.coaxRecoil - dt * 11,
      );
      if (runtime.graftBloom) {
        runtime.graftBloom.age += dt;
        if (runtime.graftBloom.age >= runtime.graftBloom.life) {
          runtime.graftBloom = null;
        }
      }

      updateTraction(runtime, dt);
      soundEngineRef.current?.syncTreads({
        leftSpool: runtime.tank.leftSpool,
        rightSpool: runtime.tank.rightSpool,
        forwardVelocity: runtime.tank.forwardVelocity,
        yawVelocity: runtime.tank.yawVelocity,
        core: runtime.tank.core,
        leftTread: runtime.tank.leftTread,
        rightTread: runtime.tank.rightTread,
        suppression: runtime.formation.suppression,
      });
      reneeDirectorRef.current?.sync(
        {
          forwardVelocity: runtime.tank.forwardVelocity,
          core: runtime.tank.core,
          front: runtime.tank.armor.front,
          leftTread: runtime.tank.leftTread,
          rightTread: runtime.tank.rightTread,
          suppression: runtime.formation.suppression,
          formationState: runtime.formation.state,
        },
        runtime.elapsed,
      );
      updateCrushing(runtime);
      updateWeapons(runtime, dt);
      updateDefense(runtime, dt);
      updateArtillery(runtime, dt);
      updateProjectiles(runtime, dt);
      updateFormation(runtime, dt);
      updateAncestorRescue(runtime, dt);
      updateForeignExpression(runtime, dt);
      updateBattlefield(runtime, dt);
      queueNutritionGraft(runtime);

      for (let index = runtime.explosions.length - 1; index >= 0; index -= 1) {
        const explosion = runtime.explosions[index];
        if (explosion.kind === "toxic") {
          for (const defender of runtime.defenders) {
            if (!defender.alive) continue;
            const distance = Math.hypot(
              defender.x - explosion.x,
              defender.z - explosion.z,
            );
            const damage = toxicCloudDamage(distance, explosion.radius, dt);
            if (damage <= 0) continue;
            defender.hp -= damage;
            defender.flash = Math.max(defender.flash, 0.04);
            if (defender.hp <= 0) {
              runtime.toxicKills += 1;
              killDefender(runtime, defender, "bow", 2.8);
            }
          }
        }
        explosion.age += dt;
        if (explosion.age >= explosion.life) recycleExplosionAt(runtime, index);
      }
      for (let index = runtime.crushMarks.length - 1; index >= 0; index -= 1) {
        const mark = runtime.crushMarks[index];
        mark.age += dt;
        if (mark.age >= mark.life) recycleCrushMarkAt(runtime, index);
      }

      let learnedScar: ArmorFace = "front";
      let learnedScarCount = runtime.tank.scars.front;
      for (const face of ["left", "right", "rear"] as ArmorFace[]) {
        if (runtime.tank.scars[face] <= learnedScarCount) continue;
        learnedScar = face;
        learnedScarCount = runtime.tank.scars[face];
      }
      runtime.learnedScar = learnedScar;

      if (
        runtime.tank.core <= 0 ||
        runtime.tank.leftTread <= 0 ||
        runtime.tank.rightTread <= 0
      ) {
        loseRun(runtime.director, "hull_failure", runtime.elapsed);
        runtime.status = "dead";
        setCaption(runtime, "LANDSHIP SILENT — THE WAR PARTY LOSES ITS SPEAR", 5);
        soundEngineRef.current?.playDeath();
        reneeDirectorRef.current?.signal("hull-death", runtime.elapsed, true);
        setJudgmentCandidate(loadObservedLineage());
        setScreen("dead");
      } else if (
        runtime.formation.cohesion <= 0 ||
        runtime.formation.casualties >= 72
      ) {
        loseRun(runtime.director, "war_party_ruin", runtime.elapsed);
        runtime.status = "dead";
        setCaption(
          runtime,
          "FORMATION RUIN — THE SPEAR CROSSED WITHOUT A WAR PARTY",
          5,
        );
        soundEngineRef.current?.playDeath();
        reneeDirectorRef.current?.signal("party-death", runtime.elapsed, true);
        setJudgmentCandidate(loadObservedLineage());
        setScreen("dead");
      } else if (runtime.captionClock <= 0) {
        if (runtime.formation.state === "reconnecting") {
          setCaption(
            runtime,
            "RAM WAKE OPEN — THE WAR PARTY FIGHTS THROUGH",
            2.2,
          );
        } else if (runtime.formation.state === "overrun") {
          setCaption(
            runtime,
            "FIGHTING POCKET PINNED — KILL THE GUN OR RAM OPEN ANOTHER ROAD",
            2.6,
          );
        } else if (runtime.formation.state === "separated") {
          setCaption(
            runtime,
            "WAR PARTY HOLDS AND FIRES — OPEN THEM A ROAD",
            2.4,
          );
        }
      }
    };

    const camera = new THREE.PerspectiveCamera(58, 1, TERRAIN_CAMERA_NEAR, 1150);
    const worldPoint = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();

    const renderTerrain = (
      runtime: Runtime,
      cameraAngle: number,
      verticalFov: number,
      groundAt: (x: number, z: number) => number,
    ) => {
      const { tank } = runtime;
      const forwardX = Math.cos(cameraAngle);
      const forwardZ = Math.sin(cameraAngle);
      const rightX = -forwardZ;
      const rightZ = forwardX;
      const halfHorizontalTangent =
        Math.tan(THREE.MathUtils.degToRad(verticalFov) * 0.5) * camera.aspect;
      const firstChunkX = Math.floor((tank.x - TERRAIN_VIEW_RADIUS) / TERRAIN_CHUNK_SIZE);
      const lastChunkX = Math.floor((tank.x + TERRAIN_VIEW_RADIUS) / TERRAIN_CHUNK_SIZE);
      const firstChunkZ = Math.floor((tank.z - TERRAIN_VIEW_RADIUS) / TERRAIN_CHUNK_SIZE);
      const lastChunkZ = Math.floor((tank.z + TERRAIN_VIEW_RADIUS) / TERRAIN_CHUNK_SIZE);
      let visibleChunkCount = 0;
      let builtChunkCount = 0;
      let nearFieldChunkCount = 0;

      const candidates: Array<{
        chunkX: number;
        chunkZ: number;
        distance: number;
        nearField: boolean;
      }> = [];

      for (let chunkZ = firstChunkZ; chunkZ <= lastChunkZ; chunkZ += 1) {
        for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX += 1) {
          const centerX = (chunkX + 0.5) * TERRAIN_CHUNK_SIZE;
          const centerZ = (chunkZ + 0.5) * TERRAIN_CHUNK_SIZE;
          const offsetX = centerX - tank.x;
          const offsetZ = centerZ - tank.z;
          const depth = offsetX * forwardX + offsetZ * forwardZ;
          const lateral = offsetX * rightX + offsetZ * rightZ;
          const distance = Math.hypot(offsetX, offsetZ);
          const nearField = distance <= TERRAIN_NEAR_FIELD_RADIUS;
          const allowance =
            Math.max(210, Math.max(80, depth) * halfHorizontalTangent) +
            TERRAIN_CHUNK_SIZE * 0.9;
          if (
            !nearField &&
            (depth <= -TERRAIN_CHUNK_SIZE ||
              depth >= 1120 + TERRAIN_CHUNK_SIZE ||
              Math.abs(lateral) >= allowance)
          ) {
            continue;
          }
          candidates.push({ chunkX, chunkZ, distance, nearField });
        }
      }

      // Floor first, horizon second. The old nested scan could spend both
      // per-frame construction slots on distant side chunks while the cell
      // containing the camera remained absent.
      candidates.sort(
        (left, right) =>
          Number(right.nearField) - Number(left.nearField) ||
          left.distance - right.distance,
      );

      const candidateKeys = new Set(
        candidates.map(({ chunkX, chunkZ }) => `${chunkX}:${chunkZ}`),
      );
      for (const chunk of terrainChunks.values()) {
        chunk.mesh.visible = candidateKeys.has(chunk.key);
      }

      for (const candidate of candidates) {
        const { chunkX, chunkZ, nearField } = candidate;
        const key = `${chunkX}:${chunkZ}`;
        let chunk = terrainChunks.get(key);
        if (!chunk) {
          // Mesh construction is the expensive part of a new battlefield.
          // Admit only a couple of chunks per frame so the loading shell,
          // menu, input, and browser remain responsive on phones.
          if (!nearField && builtChunkCount >= TERRAIN_CHUNK_BUILD_BUDGET) continue;
          chunk = getTerrainChunk(
            chunkX,
            chunkZ,
            groundAt,
            runtime.worldSeed,
          );
          builtChunkCount += 1;
        } else if (
          chunk.worldSeed !== runtime.worldSeed ||
          terrainDirtyChunks.has(key)
        ) {
          if (!nearField && builtChunkCount >= TERRAIN_CHUNK_BUILD_BUDGET) {
            // Keep the last complete mesh on screen until its local repaint
            // slot arrives. Stale crater relief for one frame is preferable
            // to a transparent hole through the world.
            chunk.mesh.visible = true;
            visibleChunkCount += 1;
            continue;
          }
          chunk = getTerrainChunk(
            chunkX,
            chunkZ,
            groundAt,
            runtime.worldSeed,
          );
          builtChunkCount += 1;
        }
        chunk.mesh.visible = true;
        visibleChunkCount += 1;
        if (nearField) nearFieldChunkCount += 1;
      }

      for (const [key, chunk] of terrainChunks) {
        if (
          Math.abs(chunk.centerX - tank.x) <= TERRAIN_RECYCLE_RADIUS &&
          Math.abs(chunk.centerZ - tank.z) <= TERRAIN_RECYCLE_RADIUS
        ) {
          continue;
        }
        terrainScene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        terrainChunks.delete(key);
        terrainDirtyChunks.delete(key);
      }

      canvas.dataset.terrainRenderCells = String(
        visibleChunkCount * TERRAIN_CHUNK_SUBDIVISIONS ** 2,
      );
      canvas.dataset.terrainChunkCount = String(visibleChunkCount);
      canvas.dataset.terrainNearFieldChunks = String(nearFieldChunkCount);
      canvas.dataset.terrainChunksBuiltThisFrame = String(builtChunkCount);
      canvas.dataset.terrainChunkBuildBudget = String(TERRAIN_CHUNK_BUILD_BUDGET);
    };

    type Projection = {
      x: number;
      y: number;
      depth: number;
      scale: number;
    };

    const draw = (runtime: Runtime) => {
      const { width, height, tank, formation } = runtime;
      const qaView = new URLSearchParams(window.location.search).get("qaView");
      const cameraAngle =
        tank.angle +
        (qaView === "left"
          ? -Math.PI / 2
          : qaView === "right"
            ? Math.PI / 2
            : qaView === "back"
              ? Math.PI
              : qaView === "three-quarter"
                ? Math.PI / 4
                : 0);
      const motionScale = settingsRef.current.screenShake
        ? settingsRef.current.reducedMotion
          ? 0.28
          : 1
        : 0;
      const visualPitch = tank.pitch * motionScale;
      const visualRoll = tank.roll * motionScale;
      const turretOverlay = turretOverlayRef.current;
      if (turretOverlay) {
        const relativeYaw = clamp(angleDelta(cameraAngle, tank.turret), -0.56, 0.56);
        const traverse = relativeYaw / 0.56;
        turretOverlay.style.setProperty(
          "--turret-shift",
          `${traverse * Math.min(width * 0.12, 96)}px`,
        );
        turretOverlay.style.setProperty(
          "--turret-turn",
          `${traverse * 8}deg`,
        );
        turretOverlay.style.setProperty(
          "--turret-recoil",
          `${-tank.turretRecoil * Math.min(16, height * 0.05)}px`,
        );
        turretOverlay.style.setProperty(
          "--turret-fire",
          `${clamp(tank.turretRecoil * 1.8, 0, 1)}`,
        );
        turretOverlay.style.setProperty(
          "--coax-recoil",
          `${-tank.coaxRecoil * Math.min(7, height * 0.02)}px`,
        );
        turretOverlay.style.setProperty(
          "--coax-fire",
          `${clamp(tank.coaxRecoil * 1.9, 0, 1)}`,
        );
      }
      const groundAt = (x: number, z: number) =>
        terrainHeightAt(x, z, runtime.terrainCraters);
      const activeSurface = terrainSurfaceAt(tank.x, tank.z);
      const activeProfile = terrainSectorProfile(activeSurface.sector);
      context.setTransform(runtime.dpr, 0, 0, runtime.dpr, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, width, height);
      canvas.dataset.renderer = "three-world-canvas-screen-vfx";
      canvas.dataset.spriteAtlases = Object.values(atlases).some(
        (atlas) => atlas.failed,
      )
        ? "failed"
        : Object.values(atlases).every((atlas) => atlas.ready)
          ? "ready"
          : "loading";
      canvas.dataset.groundTexture = groundTextureState.failed
        ? "failed"
        : groundTextureState.ready
          ? "ready"
          : "loading";
      canvas.dataset.worldX = tank.x.toFixed(2);
      canvas.dataset.worldZ = tank.z.toFixed(2);
      canvas.dataset.heading = tank.angle.toFixed(3);
      canvas.dataset.leftTrackSpool = tank.leftSpool.toFixed(3);
      canvas.dataset.rightTrackSpool = tank.rightSpool.toFixed(3);
      canvas.dataset.formationZ = formation.z.toFixed(2);
      canvas.dataset.capturedGround = String(formation.capturedGround);
      canvas.dataset.enemyKills = String(runtime.enemyKills);
      canvas.dataset.crushedEnemies = String(runtime.crushedEnemies);
      canvas.dataset.mainShotsFired = String(runtime.mainShotsFired);
      canvas.dataset.apImpacts = String(runtime.apImpacts);
      canvas.dataset.heImpacts = String(runtime.heImpacts);
      canvas.dataset.activeProjectiles = String(runtime.projectiles.length);
      canvas.dataset.defenseShotsFired = String(
        runtime.combatTelemetry.defenseFired,
      );
      canvas.dataset.defenseShotsTerrain = String(runtime.combatTelemetry.terrain);
      canvas.dataset.defenseShotsFormation = String(
        runtime.combatTelemetry.formation,
      );
      canvas.dataset.defenseShotsHull = String(runtime.combatTelemetry.hull);
      canvas.dataset.defenseHeavyBounces = String(
        runtime.combatTelemetry.bounces,
      );
      canvas.dataset.defensePenetrations = String(
        runtime.combatTelemetry.penetrations,
      );
      canvas.dataset.defenseShotsExpired = String(runtime.combatTelemetry.expired);
      canvas.dataset.combatTelemetryPolicy =
        "every-defense-shot-one-terminal-outcome";
      canvas.dataset.friendlyShotsFired = String(formation.shotsFired);
      canvas.dataset.friendlyShotsTerrain = String(
        runtime.combatTelemetry.infantryTerrain,
      );
      canvas.dataset.friendlyNearMisses = String(
        runtime.combatTelemetry.infantryNearMisses,
      );
      canvas.dataset.friendlyHits = String(
        runtime.combatTelemetry.infantryHits,
      );
      canvas.dataset.friendlyKills = String(
        runtime.combatTelemetry.infantryKills,
      );
      canvas.dataset.friendlyMisses = String(
        runtime.combatTelemetry.infantryMisses,
      );
      canvas.dataset.friendlyShotTerminalPolicy =
        "terrain|near-miss-suppression|wound|kill|miss";
      canvas.dataset.friendlyTargetId = String(formation.targetId ?? "none");
      canvas.dataset.warPartyIntent = formation.intent;
      canvas.dataset.activeExplosions = String(runtime.explosions.length);
      canvas.dataset.activeToxicClouds = String(
        runtime.explosions.filter((explosion) => explosion.kind === "toxic").length,
      );
      canvas.dataset.arsenalMissilesFired = String(runtime.arsenalMissilesFired);
      canvas.dataset.arsenalDetonations = String(runtime.arsenalDetonations);
      canvas.dataset.arsenalPenetrations = String(runtime.arsenalPenetrations);
      canvas.dataset.toxicCloudsBorn = String(runtime.toxicCloudsBorn);
      canvas.dataset.toxicKills = String(runtime.toxicKills);
      let activeEnemyCount = 0;
      for (const defender of runtime.defenders) {
        if (defender.alive) activeEnemyCount += 1;
      }
      canvas.dataset.activeEnemies = String(activeEnemyCount);
      canvas.dataset.transientObjectPooling =
        "world-sprites|projectiles|impacts|crush-marks";
      canvas.dataset.projectilePool = `${projectilePool.length}/${MAX_POOLED_PROJECTILES}`;
      canvas.dataset.explosionPool = `${explosionPool.length}/${MAX_POOLED_EXPLOSIONS}`;
      canvas.dataset.crushMarkPool = `${crushMarkPool.length}/${MAX_POOLED_CRUSH_MARKS}`;
      canvas.dataset.vfxStyle = "authored-sprite-backbone-no-procedural-fragments";
      canvas.dataset.combatRenderDpr = String(runtime.dpr);
      canvas.dataset.effectFragmentPolicy = "none-without-atlas-body";
      canvas.dataset.frenzyPolicy = "dense-overlap-authored-sprites-bounded-pools";
      canvas.dataset.crownImpact = "authored-organ-rupture-sprite";
      canvas.dataset.outcome = runtime.status;
      canvas.dataset.macroPhase = runtime.director.phase;
      canvas.dataset.activeSector = String(runtime.director.activeAcre);
      canvas.dataset.sectorDepth = String(runtime.director.activeAcre);
      canvas.dataset.graftCount = String(runtime.totalGrafts);
      canvas.dataset.offerTokens = String(runtime.pendingGraftSource ? 1 : 0);
      canvas.dataset.nutrientXp = String(runtime.nutrientXp);
      canvas.dataset.nutrientTarget = String(
        nutrientTargetForLevel(runtime.nutrientLevel),
      );
      canvas.dataset.progressionCurve = "brutal-spendable-18-29-42-56-single-faucet";
      canvas.dataset.difficulty = "brutal-depth-lethality-threat-owned-attrition";
      canvas.dataset.combatReadability =
        "muzzle-projectile-impact-reaction-rupture-cause-chain";
      canvas.dataset.weaponSignatures =
        "ap|he|needle|crown|cyst|tooth|choir|trench|toxic";
      canvas.dataset.soundFoley =
        "browser-designed-noise-impulse-resonance-no-cloud-no-borrowed-clips";
      canvas.dataset.soundSignatures =
        "ap|he|needle|crown|cyst|tooth|choir|trench|toxic|artillery|scute|treads|graft";
      canvas.dataset.soundAccessibility =
        "caption-redundant|subtle-pan-mono-safe|mute-control";
      canvas.dataset.graftEcology = "exclusive-branches-escalate-verbs-crosses-birth";
      canvas.dataset.livingArsenal =
        "one-missile>three-needles>detonate>penetrate>toxic-ground";
      canvas.dataset.offspring = activeOffspring(runtime.grafts).join("|") || "none";
      canvas.dataset.barberedWireMaterial = "rooted-braided-hair";
      canvas.dataset.friendlyVisualLanguage = "organic-fleshpunk-war-party";
      canvas.dataset.martyrsWinchForeignExpression = runtime.broodRescue?.stage ?? "dormant";
      canvas.dataset.martyrsWinchForeignVessel = runtime.broodRescue
        ? MARTYRS_WINCH.foreignVesselId
        : "none";
      canvas.dataset.martyrsWinchAncestorItem = "absent";
      canvas.dataset.martyrsWinchGeneration = runtime.broodRescue
        ? runtime.broodRescue.mode === "correction"
          ? "3"
          : "2"
        : "none";
      canvas.dataset.martyrsWinchCanonical =
        runtime.broodRescue?.stage === "canonical" ? "true" : "false";
      canvas.dataset.martyrsWinchImmediateProfit =
        runtime.broodRescue?.mode === "correction" ? "captured-gun-denied" : "none";
      canvas.dataset.foregroundTurret = "top-edge-cannon-and-coax-owned-muzzles";
      canvas.dataset.enemyDisposition = "preseeded-trench-emplacements";
      canvas.dataset.visibleReinforcements = "none";
      canvas.dataset.capturePolicy = "clear-cross-take-advance";
      canvas.dataset.resolvedOffers = String(runtime.director.resolvedOffers);
      canvas.dataset.captureDistance = runtime.nextLineDistance.toFixed(1);
      canvas.dataset.captureBlockers = runtime.captureBlockers.join("|");
      canvas.dataset.nextSectorLive = String(runtime.director.nextSectorLive);
      canvas.dataset.artilleryState = runtime.artillery?.stage ?? "none";
      canvas.dataset.artilleryDoctrine =
        "register>bracket>fire-for-effect>lift>repeat-observed-or-map-fire";
      canvas.dataset.artilleryPressure = String(
        artilleryPressureAt(runtime.elapsed, formation.capturedGround),
      );
      canvas.dataset.artilleryMissions = String(runtime.artilleryMissions);
      canvas.dataset.artilleryBatteryPause = runtime.artilleryClock.toFixed(2);
      canvas.dataset.artilleryShells = String(
        runtime.combatTelemetry.artilleryShells,
      );
      canvas.dataset.artilleryHullContacts = String(
        runtime.combatTelemetry.artilleryHullContacts,
      );
      canvas.dataset.artilleryArmorDamage =
        runtime.combatTelemetry.artilleryArmorDamage.toFixed(2);
      canvas.dataset.artilleryOrganDamage =
        runtime.combatTelemetry.artilleryOrganDamage.toFixed(2);
      canvas.dataset.warPartyState = formation.state;
      canvas.dataset.rammingDoctrine =
        "ram>breach-wake>fight-through>reconnect>consolidate";
      canvas.dataset.breachWakeCount = String(runtime.breachWakes.length);
      canvas.dataset.routeContested = String(formation.routeContested);
      canvas.dataset.lossCause = runtime.director.lossCause ?? "none";
      canvas.dataset.battleInputs = "left_tread,right_tread";
      canvas.dataset.graftInputs =
        "upgrade_card_1,upgrade_card_2,upgrade_card_3";
      canvas.dataset.terminalVictory = "false";
      canvas.dataset.cannonProfile = "ap_96x26@0.72,he_graft_every_5th_132x148";
      canvas.dataset.mainMouthAmmo = "unlimited";
      canvas.dataset.heGraft = "innate-main-mouth-cycle";
      canvas.dataset.heCycle = String(runtime.heCycle);
      canvas.dataset.turretCursor =
        runtime.status === "playing" ? "visible" : "hidden";
      canvas.dataset.terrainState = tank.terrainState;
      canvas.dataset.terrainSeed = String(runtime.worldSeed);
      canvas.dataset.terrainRegion = activeSurface.region;
      canvas.dataset.terrainLandform = activeSurface.landform;
      canvas.dataset.terrainEncounter = activeSurface.encounter;
      canvas.dataset.terrainWetness = activeSurface.wetness.toFixed(3);
      canvas.dataset.terrainTraction = activeSurface.traction.toFixed(3);
      canvas.dataset.terrainGenerator = "civilian-geography>trench-graph>clustered-bombardment>wetness>defense";
      canvas.dataset.trenchGraph = "front|support|reserve|communication|sap|strongpoint|dugout";
      canvas.dataset.trenchEdges = String(activeProfile.edges.length);
      canvas.dataset.hullElevation = tank.elevation.toFixed(2);
      canvas.dataset.hullPitch = tank.pitch.toFixed(4);
      canvas.dataset.hullRoll = tank.roll.toFixed(4);
      canvas.dataset.obstaclePolicy = "crush-or-climb";
      canvas.dataset.sceneryPolicy = "sparse-footprint-seated-sightlines";
      canvas.dataset.crushedBarricades = String(runtime.crushedBarricades.size);
      canvas.dataset.terrainCraters = String(runtime.terrainCraters.length);
      canvas.dataset.treadContactSamples = String(TREAD_SAMPLE_BUDGET);
      canvas.dataset.groundSurface = "webgl-buffer-geometry-world-chunks";

      camera.aspect = width / Math.max(1, height);
      // Three.js defines PerspectiveCamera.fov vertically. Keeping 58 degrees
      // vertical in a phone-wide slit produces an extreme horizontal fish-eye,
      // so hold the landscape view near an 88 degree horizontal field instead.
      // Portrait retains the accepted 58 degree vertical composition.
      const verticalFov = camera.aspect >= 1
        ? clamp(
            THREE.MathUtils.radToDeg(
              2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(44)) / camera.aspect),
            ),
            34,
            58,
          )
        : 58;
      camera.fov = verticalFov;
      const forwardX = Math.cos(cameraAngle);
      const forwardZ = Math.sin(cameraAngle);
      const rightX = -forwardZ;
      const rightZ = forwardX;
      const cameraFloor = Math.max(
        groundAt(tank.x, tank.z),
        groundAt(tank.x + forwardX * 8, tank.z + forwardZ * 8),
        groundAt(tank.x - forwardX * 5, tank.z - forwardZ * 5),
        groundAt(tank.x + rightX * 7, tank.z + rightZ * 7),
        groundAt(tank.x - rightX * 7, tank.z - rightZ * 7),
      );
      const cameraEye = qaView === "top"
        ? tank.elevation + 250
        : Math.max(tank.elevation + 30, cameraFloor + 18);
      camera.position.set(tank.x, cameraEye, tank.z);
      canvas.dataset.cameraFloorClearance = (cameraEye - cameraFloor).toFixed(2);
      canvas.dataset.cameraFloorGuard =
        "near-field-first|single-cull-owner|terrain-clearance-clamp";
      camera.up.set(
        -Math.sin(cameraAngle) * Math.sin(visualRoll),
        Math.cos(visualRoll),
        Math.cos(cameraAngle) * Math.sin(visualRoll),
      );
      cameraForward.set(
        Math.cos(cameraAngle),
        qaView === "top" ? -1.25 : -0.07 + Math.sin(visualPitch),
        Math.sin(cameraAngle),
      );
      camera.lookAt(
        camera.position.x + cameraForward.x * 120,
        camera.position.y + cameraForward.y * 120,
        camera.position.z + cameraForward.z * 120,
      );
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      beginWorldSprites();

      const project = (x: number, elevation: number, z: number): Projection | null => {
        const offsetX = x - tank.x;
        const offsetZ = z - tank.z;
        const depth =
          offsetX * Math.cos(cameraAngle) + offsetZ * Math.sin(cameraAngle);
        if (depth < 2 || depth > 1120) return null;
        worldPoint.set(x, elevation, z).project(camera);
        if (
          worldPoint.z < -1 ||
          worldPoint.z > 1 ||
          Math.abs(worldPoint.x) > 2.2 ||
          Math.abs(worldPoint.y) > 2.2
        ) {
          return null;
        }
        // Sprite scale must use the same vertical focal length as the Three.js
        // projection. Width-based focal length made every billboard swell in
        // landscape while the collision ground kept the correct perspective.
        const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(verticalFov) / 2));
        return {
          x: (worldPoint.x * 0.5 + 0.5) * width,
          y: (-worldPoint.y * 0.5 + 0.5) * height,
          depth,
          scale: focal / depth,
        };
      };

      const drawTrenchBand = (
        sector: number,
        captured: boolean,
      ) => {
        // Four authored strongpoints imply a defended line without filling the
        // aiming band. Each is placed on a low-relief shoulder and seated from
        // its whole footprint; no center-point perch on the trench banks.
        for (const barricade of trenchBarricadesForSector(sector)) {
          const crushed = runtime.crushedBarricades.has(barricade.id);
          const seatHeight = scenerySeatHeight(
            `barricade:${barricade.id}:${crushed ? "crushed" : "standing"}`,
            barricade.x,
            barricade.z,
            crushed ? 34 : 27,
            10,
            0.65,
            runtime,
          );
          const point = project(
            barricade.x,
            seatHeight,
            barricade.z,
          );
          if (!point) continue;
          drawWorldAtlasCell(
            atlases.environment,
            captured ? 1 : 0,
            barricade.x,
            seatHeight,
            barricade.z,
            crushed ? 36 : 43,
            {
              alpha: clamp(1.12 - point.depth / 1320, 0.48, 1),
              flip: barricade.bankSide < 0,
              scaleX: crushed ? 1.5 : 1,
              scaleY: crushed ? 0.34 : 1,
            },
          );
        }
      };

      renderTerrain(runtime, cameraAngle, verticalFov, groundAt);

      // The horizon is an active front, not a two-color backdrop. Authored
      // smoke and low haze carry depth without turning the narrow slit to soup.
      for (const atmosphere of [
        { offsetX: -330, depth: 840, cell: 10, height: 118, alpha: 0.5 },
        { offsetX: 275, depth: 720, cell: 10, height: 92, alpha: 0.42 },
        { offsetX: -80, depth: 930, cell: 11, height: 130, alpha: 0.34 },
        { offsetX: 120, depth: 580, cell: 11, height: 92, alpha: 0.28 },
      ]) {
        const point = project(
          tank.x + atmosphere.offsetX,
          groundAt(tank.x + atmosphere.offsetX, tank.z + atmosphere.depth),
          tank.z + atmosphere.depth,
        );
        if (!point) continue;
        const atmosphereX = tank.x + atmosphere.offsetX;
        const atmosphereZ = tank.z + atmosphere.depth;
        drawWorldAtlasCell(
          atlases.environment,
          atmosphere.cell,
          atmosphereX,
          groundAt(atmosphereX, atmosphereZ) + 4,
          atmosphereZ,
          atmosphere.height,
          { alpha: atmosphere.alpha },
        );
      }

      const shakeX = (Math.random() - 0.5) * runtime.shake;
      const shakeY = (Math.random() - 0.5) * runtime.shake;
      context.save();
      context.translate(shakeX, shakeY);

      for (const feature of terrainFeaturesInRange(tank.z - 120, tank.z + 1180)) {
        // Rubble mounds already exist in the rendered heightfield. Wreckage
        // art remains for identity, but its broad base is embedded into the
        // climbable mound instead of balanced on the mound's center peak.
        if (feature.kind !== "wreckage") continue;
        const seatHeight = scenerySeatHeight(
          `wreckage:${feature.x}:${feature.z}`,
          feature.x,
          feature.z,
          46,
          20,
          1,
          runtime,
        );
        const point = project(
          feature.x,
          seatHeight,
          feature.z,
        );
        if (!point) continue;
        drawWorldAtlasCell(
          atlases.environment,
          9,
          feature.x,
          seatHeight,
          feature.z,
          74,
          {
            alpha: clamp(1.1 - point.depth / 1320, 0.48, 1),
            flip: feature.x < 0,
          },
        );
      }
      const terrainDecorations = terrainDecorationsInRange(
        tank.z - 120,
        tank.z + 1180,
      );
      canvas.dataset.activeTerrainDecorations = String(terrainDecorations.length);
      for (const decoration of terrainDecorations) {
        const seatHeight = scenerySeatHeight(
          `terrain:${decoration.id}`,
          decoration.x,
          decoration.z,
          decoration.kind.includes("crater") ? decoration.radius * 0.72 : decoration.radius,
          decoration.kind.includes("crater") ? decoration.radius * 0.36 : 12,
          decoration.kind.includes("crater") ? 0.18 : 0.6,
          runtime,
        );
        const point = project(decoration.x, seatHeight, decoration.z);
        if (!point) continue;
        if (decoration.kind === "shell-crater" || decoration.kind === "flooded-crater") {
          drawWorldAtlasCell(
            atlases.environment,
            decoration.kind === "flooded-crater" ? 5 : 4,
            decoration.x,
            seatHeight + 0.35,
            decoration.z,
            decoration.radius * 1.72,
            {
              alpha: clamp(1.08 - point.depth / 1450, 0.48, 0.9),
              flip: decoration.cluster % 2 === 0,
              rotation: (decoration.cluster - 1) * 0.06,
              scaleX: 1.18,
              scaleY: 0.28,
            },
          );
        } else {
          const visual = terrainDecorationVisual(decoration.kind);
          drawWorldAtlasCell(
            atlases.environment,
            visual.cell,
            decoration.x,
            seatHeight,
            decoration.z,
            visual.height,
            {
              alpha: clamp(1.08 - point.depth / 1380, 0.46, 0.94),
              flip: decoration.x < 0,
              scaleX: decoration.kind === "shattered-copse" ? 0.72 : 1,
            },
          );
        }
      }
      const firstVisibleSector = Math.max(
        0,
        Math.floor((tank.z - FIRST_SECTOR_Z - 300) / SECTOR_LENGTH),
      );
      const lastVisibleSector = Math.ceil(
        (tank.z + 1180 - FIRST_SECTOR_Z - 300) / SECTOR_LENGTH,
      );
      for (
        let sector = firstVisibleSector;
        sector <= lastVisibleSector;
        sector += 1
      ) {
        const node = runtime.captureNodes.find(
          (candidate) => candidate.sector === sector,
        );
        drawTrenchBand(
          sector,
          node?.captured ?? false,
        );
      }

      if (runtime.artillery) {
        const strike = runtime.artillery;
        const point = project(strike.x, groundAt(strike.x, strike.z) + 1, strike.z);
        if (point) {
          const cell =
            strike.stage === "flare" ? 4 : strike.stage === "ranging" ? 5 : 6;
          const pulse = strike.stage === "incoming"
            ? 1 + Math.sin(runtime.elapsed * 16) * 0.12
            : 1;
          drawWorldAtlasCell(
            atlases.vfx,
            cell,
            strike.x,
            groundAt(strike.x, strike.z) + 1,
            strike.z,
            84 * pulse,
            { alpha: 0.94 },
          );
        }
      }

      for (const wire of runtime.wires) {
        const z = wire.z;
        for (let x = -FIELD_HALF_WIDTH; x < FIELD_HALF_WIDTH; x += 48) {
          const segmentCenter = x + 24;
          const insideGap =
            Math.abs(segmentCenter - wire.gapCenter) < wire.gapWidth * 0.5;
          if (insideGap) continue;
          const seatHeight = scenerySeatHeight(
            `wire:${segmentCenter}:${z}`,
            segmentCenter,
            z,
            22,
            7,
            0.35,
            runtime,
          );
          const point = project(segmentCenter, seatHeight, z);
          if (!point) continue;
          drawWorldAtlasCell(
            atlases.environment,
            wire.torn ? 3 : 2,
            segmentCenter,
            seatHeight,
            z,
            wire.torn ? 34 : 52,
            {
              alpha: clamp(1.12 - point.depth / 1320, 0.48, 1),
              flip: segmentCenter < wire.gapCenter,
              scaleX: wire.torn ? 1.28 : 1.12,
            },
          );
        }
      }

      for (const defender of runtime.defenders) {
        if (!defender.alive && defender.flash <= 0) continue;
        const defenderGround = groundAt(defender.x, defender.z);
        const feet = project(defender.x, defenderGround, defender.z);
        const head = project(
          defender.x,
          defenderGround +
          (isHumanScaleDefender(defender.kind) ? 30 : 40),
          defender.z,
        );
        if (!feet || !head) continue;
        const bodyPixels = clamp(feet.y - head.y, 5, 62);
        const heavy = !isHumanScaleDefender(defender.kind);
        const bodyWorldHeight = heavy ? 40 : 30;
        const spriteWorldHeight = bodyWorldHeight * (heavy ? 1.75 : 1.8);
        const spriteHeight = bodyPixels * (heavy ? 1.75 : 1.8);
        const relativeView = angleDelta(
          -Math.PI / 2,
          Math.atan2(tank.z - defender.z, tank.x - defender.x),
        );
        const facing = Math.cos(relativeView);
        const directionCell =
          facing > 0.78 ? 0 : facing > 0.18 ? 1 : facing > -0.72 ? 2 : 3;
        const crushed = runtime.crushMarks.some(
          (mark) =>
            Math.abs(mark.x - defender.x) < 4 &&
            Math.abs(mark.z - defender.z) < 4,
        );
        const variantKind = ["observer", "satchel", "flanker", "carrier"].includes(
          defender.kind,
        );
        const useThreatAtlas =
          (defender.alive && variantKind) ||
          (!defender.alive && defender.kind === "carrier");
        const sideView = directionCell === 1 || directionCell === 2;
        const threatCell =
          defender.kind === "observer"
            ? defender.flash > 0
              ? 8
              : sideView
                ? 1
                : 0
            : defender.kind === "satchel"
              ? defender.intent > 0
                ? 9
                : sideView
                  ? 3
                  : 2
              : defender.kind === "flanker"
                ? defender.intent > 0
                  ? 10
                  : sideView
                    ? 5
                    : 4
                : defender.kind === "carrier"
                  ? defender.alive
                    ? sideView
                      ? 7
                      : 6
                    : 11
                  : 0;
        const baseCell = !defender.alive
          ? enemyCorpseCell(defender.id, crushed)
          : defender.kind === "machine-gun"
            ? 8 + (defender.flash > 0 ? 1 : 0)
            : heavy
              ? 10 + (defender.intent > 0 ? 1 : 0)
              : directionCell;
        const fogAlpha = clamp(1.08 - feet.depth / 1350, 0.42, 1);

        context.save();
        context.globalAlpha = fogAlpha * 0.42;
        context.fillStyle = "#070807";
        context.beginPath();
        context.ellipse(
          feet.x,
          feet.y + 1,
          spriteHeight * (heavy ? 0.27 : 0.18),
          Math.max(2, spriteHeight * 0.055),
          0,
          0,
          TAU,
        );
        context.fill();
        context.restore();
        drawWorldAtlasCell(
          useThreatAtlas ? atlases.threats : atlases.enemy,
          useThreatAtlas ? threatCell : baseCell,
          defender.x,
          defenderGround,
          defender.z,
          spriteWorldHeight,
          {
            alpha: fogAlpha,
            flip: Math.sin(relativeView) < 0,
          },
        );

      }

      if (runtime.status === "playing") {
        const target = runtime.defenders.find(
          (defender) =>
            defender.alive && defender.id === runtime.selectedTargetId,
        );
        const cursorDistance = target
          ? Math.hypot(target.x - tank.x, target.z - tank.z)
          : 520;
        const cursorPoint = project(
          tank.x + Math.cos(tank.turret) * cursorDistance,
          groundAt(
            tank.x + Math.cos(tank.turret) * cursorDistance,
            tank.z + Math.sin(tank.turret) * cursorDistance,
          ) + (isHumanScaleDefender(target?.kind) ? 21 : 29),
          tank.z + Math.sin(tank.turret) * cursorDistance,
        );
        if (cursorPoint) {
          const targetAngle = target
            ? Math.atan2(target.z - tank.z, target.x - tank.x)
            : tank.turret;
          const ready =
            !!target &&
            Math.abs(angleDelta(tank.turret, targetAngle)) < 0.08 &&
            Math.abs(angleDelta(tank.angle, targetAngle)) < 0.38;
          const cursorRadius = clamp(11 + 80 / cursorPoint.depth, 11, 18);
          context.save();
          context.strokeStyle = ready
            ? "rgba(255,235,166,.98)"
            : "rgba(226,167,70,.82)";
          context.lineWidth = ready ? 2.4 : 1.5;
          context.shadowColor = ready
            ? "rgba(255,189,81,.8)"
            : "rgba(0,0,0,.72)";
          context.shadowBlur = ready ? 8 : 4;
          context.beginPath();
          context.arc(cursorPoint.x, cursorPoint.y, cursorRadius, 0, TAU);
          context.moveTo(cursorPoint.x - cursorRadius - 8, cursorPoint.y);
          context.lineTo(cursorPoint.x - 3, cursorPoint.y);
          context.moveTo(cursorPoint.x + 3, cursorPoint.y);
          context.lineTo(cursorPoint.x + cursorRadius + 8, cursorPoint.y);
          context.moveTo(cursorPoint.x, cursorPoint.y - cursorRadius - 8);
          context.lineTo(cursorPoint.x, cursorPoint.y - 3);
          context.moveTo(cursorPoint.x, cursorPoint.y + 3);
          context.lineTo(cursorPoint.x, cursorPoint.y + cursorRadius + 8);
          context.stroke();
          const heInterval = heShotInterval(1);
          const heArmed = runtime.heCycle >= heInterval - 1;
          {
            const markRadius = cursorRadius + 16;
            for (let mark = 0; mark < 4; mark += 1) {
              const angle = -Math.PI / 2 + mark * (TAU / 4);
              const filled = mark < runtime.heCycle;
              context.fillStyle = heArmed
                ? `rgba(255,106,45,${0.78 + Math.sin(runtime.elapsed * 11) * 0.2})`
                : filled
                  ? "rgba(255,190,90,.94)"
                  : "rgba(66,50,31,.72)";
              context.beginPath();
              context.arc(
                cursorPoint.x + Math.cos(angle) * markRadius,
                cursorPoint.y + Math.sin(angle) * markRadius,
                heArmed ? 4.4 : 3.2,
                0,
                TAU,
              );
              context.fill();
            }
          }
          context.restore();
        }
      }

      for (const mark of runtime.crushMarks) {
        const point = project(mark.x, groundAt(mark.x, mark.z) + 1, mark.z);
        if (!point) continue;
        const fade = 1 - mark.age / mark.life;
        drawWorldAtlasCell(
          atlases.vfx,
          mark.side === "left" ? 8 : 9,
          mark.x,
          groundAt(mark.x, mark.z) + 1,
          mark.z,
          76,
          {
            alpha: 0.86 * fade,
            rotation: mark.side === "left" ? -0.14 : 0.14,
            scaleY: 0.32,
          },
        );
      }

      for (const explosion of runtime.explosions) {
        const point = project(
          explosion.x,
          groundAt(explosion.x, explosion.z) + 10,
          explosion.z,
        );
        if (!point) continue;
        const progress = clamp(explosion.age / explosion.life, 0, 1);
        const intensityScale = 1 + Math.min(0.6, (explosion.intensity - 1) * 0.08);
        const growth = explosion.kind === "toxic"
          ? 0.76 + Math.min(0.2, progress * 0.5)
          : 0.18 + progress * 0.82;
        const screenRadius = clamp(
          explosion.radius * point.scale * growth * intensityScale,
          8,
          tacticalExplosionRadiusCap(width, height, explosion.kind),
        );
        const burstAlpha = clamp(1 - progress, 0, 1);
        const variant = Math.floor(hash01(explosion.seed * 1.73 + 9) * 3);
        const effectAtlas =
          explosion.kind === "artillery" || explosion.kind === "crown" || explosion.kind === "toxic"
            ? atlases.vfx
            : atlases.effects;
        const effectCell =
          explosion.kind === "artillery"
            ? 6 + (variant % 2)
            : explosion.kind === "toxic"
              ? 10 + (variant % 2)
            : explosion.kind === "crown"
              ? 11
                : explosion.kind === "muzzle"
                  ? 0
                : explosion.kind === "dirt"
                  ? 9 + (variant % 2)
                : explosion.kind === "ap"
                  ? (Math.min(2, Math.floor(progress * 3)) + variant) % 3
                  : explosion.kind === "he" || explosion.kind === "cyst"
                    ? 4 + ((Math.min(2, Math.floor(progress * 3)) + variant) % 3)
                    : explosion.kind === "needle" || explosion.kind === "choir"
                      ? (Math.min(2, Math.floor(progress * 3)) + variant) % 3
                      : explosion.kind === "tooth" || explosion.kind === "trench"
                        ? 1 + (variant % 2)
                        : 9 + ((Math.min(1, Math.floor(progress * 2)) + variant) % 2);
        const effectHeight = snapEffectPixel(
          screenRadius *
            (explosion.kind === "dirt"
              ? 1.35
              : explosion.kind === "ap" ||
                  explosion.kind === "needle" ||
                  explosion.kind === "choir"
                ? 2.1
                : 2.55),
        );
        drawAtlasCell(
          effectAtlas,
          effectCell,
          snapEffectPixel(point.x),
          snapEffectPixel(point.y + effectHeight * 0.5),
          effectHeight,
          {
            alpha: explosion.kind === "toxic"
              ? (0.34 + Math.sin(runtime.elapsed * 2.4 + explosion.seed) * 0.07) *
                clamp((1 - progress) / 0.12, 0, 1)
              : clamp(1.15 - progress * 0.55, 0.5, 1),
          },
        );
        // One gameplay event can compose several authored sprite bodies. The
        // seeded arrangement gives HE, AP, artillery, ruptures, and toxic lungs
        // different silhouettes without creating unbounded particle debris.
        const baseLayerCount =
          explosion.kind === "artillery"
            ? 4
            : explosion.kind === "toxic"
              ? 3
              : explosion.kind === "rupture"
                ? 3
                : explosion.kind === "he" || explosion.kind === "cyst"
                  ? 2
                  : explosion.kind === "ap"
                    ? 1
                    : 0;
        const layerCount = Math.min(
          5,
          baseLayerCount + Math.max(0, Math.floor(explosion.intensity - 2.4)),
        );
        for (let layer = 0; layer < layerCount; layer += 1) {
          const layerAngle = hash01(explosion.seed + layer * 41) * TAU;
          const layerDistance =
            screenRadius *
            (explosion.kind === "toxic"
              ? 0.28 + layer * 0.19
              : 0.18 + layer * 0.13);
          const layerAtlas =
            explosion.kind === "artillery" && layer > 0
              ? atlases.effects
              : explosion.kind === "rupture" && layer === layerCount - 1
                ? atlases.vfx
                : effectAtlas;
          const layerCell =
            explosion.kind === "artillery" && layer > 0
              ? 4 + ((variant + layer) % 3)
              : explosion.kind === "toxic"
                ? 10 + ((variant + layer) % 2)
                : explosion.kind === "rupture" && layer === layerCount - 1
                  ? 11
                  : explosion.kind === "he" || explosion.kind === "cyst"
                    ? 4 + ((variant + layer) % 3)
                    : explosion.kind === "ap"
                      ? (variant + layer) % 3
                      : effectCell;
          const layerAlpha =
            explosion.kind === "toxic"
              ? (0.2 + Math.sin(runtime.elapsed * 2 + layer) * 0.05) *
                clamp((1 - progress) / 0.1, 0, 1)
              : burstAlpha * (0.7 - layer * 0.09);
          drawAtlasCell(
            layerAtlas,
            layerCell,
            snapEffectPixel(point.x + Math.cos(layerAngle) * layerDistance),
            snapEffectPixel(
              point.y + Math.sin(layerAngle) * layerDistance + effectHeight * 0.3,
            ),
            snapEffectPixel(effectHeight * (0.42 + layer * 0.055)),
            {
              alpha: layerAlpha,
              flip: (variant + layer) % 2 === 1,
              rotation: (hash01(explosion.seed + layer * 73) - 0.5) * 0.24,
            },
          );
        }
      }

      if (formation.cohesion > 0 && runtime.status === "playing") {
        const surviving =
          Math.max(
            5,
            Math.round(
              FRIENDLY_FORMATION_BODIES *
                (1 - formation.casualties / 100),
            ),
          ) +
          runtime.grafts["sapper-brood"] * 2;
        for (let index = 0; index < surviving; index += 1) {
          const side = index % 2 === 0 ? -1 : 1;
          const rank = Math.floor(index / 2);
          const lateral = side * (76 + Math.floor(rank / 4) * 35);
          const x =
            formation.x +
            Math.cos(tank.angle) * (rank * 10) -
            Math.sin(tank.angle) * lateral;
          const z =
            formation.z +
            Math.sin(tank.angle) * (rank * 10) +
            Math.cos(tank.angle) * lateral;
          const infantryGround = groundAt(x, z);
          const feet = project(x, infantryGround, z);
          const head = project(x, infantryGround + 18, z);
          if (!feet || !head) continue;
          const spriteHeight = clamp(feet.y - head.y, 4, 34) * 1.65;
          const cell =
            formation.volleyPulse > 0
              ? 6 + (index % 2)
              : formation.suppression > 58
              ? 8 + (index % 2)
              : Math.abs(tank.forwardVelocity) > 8
                ? index % 4
                : 4 + (index % 2);
          const fogAlpha = clamp(1.08 - feet.depth / 1350, 0.42, 1);
          context.save();
          context.globalAlpha = fogAlpha * 0.38;
          context.fillStyle = "#070807";
          context.beginPath();
          context.ellipse(
            feet.x,
            feet.y,
            spriteHeight * 0.17,
            Math.max(2, spriteHeight * 0.05),
            0,
            0,
            TAU,
          );
          context.fill();
          context.restore();
          drawWorldAtlasCell(
            atlases.friendly,
            cell,
            x,
            infantryGround,
            z,
            18 * 1.65,
            { alpha: fogAlpha, flip: side < 0 },
          );
        }

        for (const node of runtime.captureNodes) {
          if (!node.captured) continue;
          const trenchMouths = Math.min(4, runtime.grafts["trench-teeth"]);
          for (let guard = 0; guard < 2 + trenchMouths; guard += 1) {
            const guardX = node.x + (guard - (1 + trenchMouths) / 2) * 24;
            const guardZ = node.z + 8;
            const guardGround = groundAt(guardX, guardZ);
            const feet = project(guardX, guardGround, guardZ);
            const head = project(guardX, guardGround + 19, guardZ);
            if (!feet || !head) continue;
            drawWorldAtlasCell(
              atlases.friendly,
              guard < 2 ? 6 + (node.sector % 2) : 10 + ((guard + node.sector) % 2),
              guardX,
              guardGround,
              guardZ,
              19 * 1.65,
              {
                alpha: clamp(1.08 - feet.depth / 1350, 0.42, 1),
                flip: guard === 0,
              },
            );
          }
        }

        if (runtime.broodRescue) {
          const rescue = runtime.broodRescue;
          const cellByStage: Record<ForeignExpressionStage, number> = {
            dormant: 0,
            refusal: 0,
            rotate: rescue.age < 0.45 ? 0 : 1,
            brace: 2,
            contact: 3,
            strain:
              rescue.movedDistance < 18
                ? 4
                : rescue.movedDistance < 46
                  ? 5
                  : rescue.movedDistance < 72
                    ? 6
                    : 7,
            success: 7,
            overload: 8,
            severed: 9,
            casualty: 10,
            canonical: 11,
          };
          if (rescue.mode === "correction") {
            const deniedGround = groundAt(rescue.deniedTargetX, rescue.deniedTargetZ);
            drawWorldAtlasCell(
              atlases.environment,
              9,
              rescue.deniedTargetX,
              deniedGround,
              rescue.deniedTargetZ,
              62,
              { alpha: 0.82, flip: rescue.deniedTargetX < rescue.x },
            );
          }
          const rescueGround = groundAt(rescue.x, rescue.z);
          drawWorldAtlasCell(
            atlases.sapperBrood,
            cellByStage[rescue.stage],
            rescue.x,
            rescueGround,
            rescue.z,
            47,
            {
              alpha: clamp(1.12 - Math.hypot(rescue.x - tank.x, rescue.z - tank.z) / 1500, 0.5, 1),
              flip: rescue.destinationX < rescue.originX,
              scaleX: 1.08,
            },
          );
          if (rescue.stage === "contact" || rescue.stage === "strain") {
            drawWorldAtlasCell(
              atlases.vfx,
              rescue.stage === "contact" ? 8 : 9,
              rescue.originX,
              groundAt(rescue.originX, rescue.originZ),
              rescue.originZ,
              23 + Math.sin(runtime.elapsed * 9) * 2,
              { alpha: 0.54, centered: true },
            );
          }
        }
      }

      // One renderer, one camera, one depth buffer. Terrain can now occlude
      // feet and props correctly because the sprites are no longer painted on
      // an unrelated 2D layer after the 3D world has already rendered.
      terrainRenderer.render(terrainScene, camera);
      canvas.dataset.worldSpriteCount = String(worldSpriteCursor);

      for (const shot of runtime.projectiles) {
        const speed = Math.max(1, Math.hypot(shot.vx, shot.vz));
        const tail =
          shot.owner === "landship"
            ? shot.kind === "he"
              ? 104
              : shot.kind === "ap"
                ? 86
                : shot.kind === "rib-mortar"
                  ? 64
                  : shot.kind === "bow"
                    ? 48 + shot.intensity * 4
                    : shot.kind === "top"
                      ? 42 + shot.intensity * 3
                      : 30 + shot.intensity * 2
            : shot.kind === "rifle"
              ? 34 + shot.intensity * 3
              : 18;
        const start = project(
          shot.x - (shot.vx / speed) * tail,
          shot.elevation,
          shot.z - (shot.vz / speed) * tail,
        );
        const end = project(shot.x, shot.elevation, shot.z);
        if (!start || !end) continue;
        let visualEnd = end;
        let rotationStart = start;
        if (shot.visualMuzzle !== "world" && shot.age < 0.18) {
          const muzzleElement =
            shot.visualMuzzle === "top-cannon"
              ? turretBarrelRef.current
              : turretCoaxRef.current;
          const canvasRect = canvas.getBoundingClientRect();
          const muzzleRect = muzzleElement?.getBoundingClientRect();
          if (muzzleRect) {
            const muzzlePoint = {
              x: muzzleRect.left + muzzleRect.width * 0.5 - canvasRect.left,
              y: muzzleRect.bottom - canvasRect.top,
            };
            const emergence = clamp(shot.age / 0.18, 0, 1);
            visualEnd = {
              ...end,
              x: muzzlePoint.x + (end.x - muzzlePoint.x) * emergence,
              y: muzzlePoint.y + (end.y - muzzlePoint.y) * emergence,
            };
            rotationStart = { ...start, ...muzzlePoint };
          }
        }
        const heavyEnemy =
          shot.kind === "artillery" ||
          shot.kind === "flanker" ||
          shot.kind === "anti-armor" ||
          shot.kind === "carrier";
        const projectileCell =
          shot.kind === "he" || shot.kind === "rib-mortar"
            ? 1
            : shot.kind === "ap"
              ? 0
              : shot.owner === "landship" || shot.owner === "infantry"
                ? 2
            : heavyEnemy
              ? 3
              : 2;
        const projectileHeight =
          shot.kind === "he"
            ? 28
            : shot.kind === "ap"
              ? 20
              : shot.kind === "rib-mortar"
                ? 18 + Math.min(12, shot.intensity * 2)
                : shot.owner === "landship"
                  ? 10 + Math.min(8, shot.intensity)
                  : heavyEnemy
                    ? 14
                    : shot.kind === "rifle"
                      ? 8 + Math.min(5, shot.intensity)
                      : 8;
        const rotation = Math.atan2(
          visualEnd.y - rotationStart.y,
          visualEnd.x - rotationStart.x,
        );
        drawAtlasCell(
          atlases.vfx,
          projectileCell,
          snapEffectPixel(visualEnd.x),
          snapEffectPixel(visualEnd.y),
          snapEffectPixel(projectileHeight),
          { centered: true, rotation, alpha: 0.98 },
        );
        const trailBodies =
          shot.kind === "he" || shot.kind === "rib-mortar"
            ? 3
            : shot.kind === "ap" || shot.kind === "bow"
              ? 2
              : heavyEnemy
                ? 1
                : 0;
        for (let trail = 1; trail <= trailBodies; trail += 1) {
          const amount = trail / (trailBodies + 1);
          drawAtlasCell(
            atlases.vfx,
            projectileCell,
            snapEffectPixel(visualEnd.x + (rotationStart.x - visualEnd.x) * amount),
            snapEffectPixel(visualEnd.y + (rotationStart.y - visualEnd.y) * amount),
            snapEffectPixel(projectileHeight * (1 - amount * 0.48)),
            {
              centered: true,
              rotation,
              alpha: 0.62 - amount * 0.28,
              flip: trail % 2 === 0,
            },
          );
        }
      }

      context.restore();

      if (runtime.ancestorRescue) {
        const rescue = runtime.ancestorRescue;
        const fade = runtime.ancestorResolved
          ? clamp((9 - rescue.age) / 1.8, 0, 1)
          : 1;
        drawAtlasCell(
          atlases.martyrsWinch,
          rescue.stage,
          width * 0.22,
          height * 0.97,
          Math.min(width, height) * 0.56,
          {
            alpha: fade,
            cropBottom: 0.02,
          },
        );
      }

      const sternumLevel = runtime.grafts["battering-sternum"];
      if (sternumLevel > 0 && runtime.status === "playing") {
        const commitment = clamp(runtime.tank.forwardVelocity / 54, 0.22, 1);
        const ribHeight = Math.min(width, height) * (0.3 + sternumLevel * 0.025);
        for (const side of [-1, 1]) {
          drawAtlasCell(
            atlases.vfx,
            side < 0 ? 8 : 9,
            width * (side < 0 ? 0.34 : 0.66),
            height * 0.94,
            ribHeight,
            {
              centered: true,
              flip: side > 0,
              rotation: side * (0.08 + commitment * 0.05),
              alpha: 0.2 + commitment * 0.38,
              scaleY: 0.72,
            },
          );
        }
      }

      if (runtime.graftBloom) {
        const bloom = runtime.graftBloom;
        const progress = clamp(bloom.age / bloom.life, 0, 1);
        const attack = clamp(progress / 0.18, 0, 1);
        const release = clamp((1 - progress) / 0.42, 0, 1);
        const pulse = attack * release;
        const coreColor = bloom.tree.startsWith("WAR PARTY")
          ? "#a8d5c8"
          : "#d7bd91";
        const bloomRadius = Math.min(width, height) * (0.08 + progress * 0.54);
        drawAtlasCell(
          atlases.vfx,
          bloom.tree.startsWith("RAM") ? 8 : bloom.offspring ? 11 : 10,
          width / 2,
          height * 0.48,
          Math.max(54, bloomRadius * 1.9),
          {
            centered: true,
            flip: runtime.totalGrafts % 2 === 0,
            alpha: pulse * 0.88,
          },
        );
        context.save();
        context.globalAlpha = pulse;
        context.textAlign = "center";
        context.fillStyle = "#f5dfb3";
        context.font = `900 ${Math.max(16, Math.min(29, width * 0.035))}px "Arial Narrow", sans-serif`;
        context.fillText(
          `${bloom.title.toUpperCase()} · ${bloom.offspring ? "OFFSPRING BORN" : `BODY ${bloom.level}`}`,
          width / 2,
          height * 0.56,
        );
        context.fillStyle = coreColor;
        context.font = `800 ${Math.max(9, Math.min(12, width * 0.016))}px ui-monospace, monospace`;
        context.fillText(bloom.tree, width / 2, height * 0.56 + 20);
        context.restore();
      }

      const vignette = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.2,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72,
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(4,5,3,.62)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      if (runtime.impactFlash > 0 && !settingsRef.current.reducedFlashes) {
        const impactX =
          runtime.impactFace === "left"
            ? width * 0.18
            : runtime.impactFace === "right"
              ? width * 0.82
              : width * 0.5;
        const impactY = runtime.impactFace === "rear" ? height * 0.7 : height * 0.42;
        drawAtlasCell(
          atlases.vfx,
          runtime.impactFace === "rear" ? 11 : 10,
          impactX,
          impactY,
          Math.min(width, height) * 0.42,
          {
            centered: true,
            flip: runtime.impactFace === "right",
            alpha: clamp(runtime.impactFlash / 0.28, 0.28, 0.94),
          },
        );
      }

      if (Object.values(atlases).some((atlas) => atlas.failed)) {
        context.fillStyle = "rgba(8,9,6,.9)";
        context.fillRect(width * 0.24, height * 0.43, width * 0.52, 46);
        context.fillStyle = "#f0b04f";
        context.font = "700 12px ui-monospace, monospace";
        context.textAlign = "center";
        context.fillText(
          "SPRITE ORGAN FAILED TO LOAD — NO SUBSTITUTE BODY RENDERED",
          width / 2,
          height * 0.43 + 28,
        );
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, Math.max(0, (now - previous) / 1000));
      previous = now;
      const runtime = runtimeRef.current;
      if (!pausedRef.current) update(runtime, dt);
      draw(runtime);
      if (!pausedRef.current) hudClock -= dt;
      if (hudClock <= 0) {
        hudClock = 0.1;
        publishHud();
      }
      frame = requestAnimationFrame(loop);
    };

    draw(runtimeRef.current);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      terrainCanvas.removeEventListener("webglcontextlost", onContextLost);
      for (const chunk of terrainChunks.values()) chunk.mesh.geometry.dispose();
      for (const sprite of worldSpritePool) {
        terrainScene.remove(sprite);
        (sprite.material as ThreeTypes.SpriteMaterial).dispose();
      }
      for (const atlasCells of worldSpriteTextures.values()) {
        for (const texture of atlasCells.values()) texture.dispose();
      }
      terrainMaterial.dispose();
      toonGradient.dispose();
      if (terrainScene.background === skyboxTexture) {
        terrainScene.background = null;
      }
      skyboxTexture.dispose();
      groundColorTexture.dispose();
      terrainRenderer.dispose();
    };
  }, [engineState, publishHud]);

  const pointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      if (runtime.status !== "playing") return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const touchEdge = settingsRef.current.wideTouch ? 0.4 : 0.32;
      const track = x <= touchEdge ? "left" : x >= 1 - touchEdge ? "right" : null;
      if (!track || pointers.current[track]) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current[track] = {
        id: event.pointerId,
        originY: event.clientY,
      };
      if (track === "left") runtime.tank.leftDemand = 0;
      else runtime.tank.rightDemand = 0;
      event.preventDefault();
    },
    [],
  );

  const pointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      for (const track of ["left", "right"] as const) {
        const pointer = pointers.current[track];
        if (pointer?.id !== event.pointerId) continue;
        const value = clamp((pointer.originY - event.clientY) / 92, -1, 1);
        if (track === "left") runtime.tank.leftDemand = value;
        else runtime.tank.rightDemand = value;
        event.preventDefault();
        return;
      }
    },
    [],
  );

  const pointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      for (const track of ["left", "right"] as const) {
        if (pointers.current[track]?.id !== event.pointerId) continue;
        pointers.current[track] = null;
        if (track === "left") runtime.tank.leftDemand = 0;
        else runtime.tank.rightDemand = 0;
        event.preventDefault();
        return;
      }
    },
    [],
  );

  const keyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      const key = event.key.toLowerCase();
      runtimeRef.current?.keys.add(key);
    },
    [],
  );

  const keyUp = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      runtimeRef.current?.keys.delete(event.key.toLowerCase());
    },
    [],
  );

  const timeLabel = `${Math.floor(hud.time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(hud.time % 60)
    .toString()
    .padStart(2, "0")}`;
  const formationLabel: Record<FormationState, string> = {
    connected: "WAR PARTY CONNECTED",
    stretched: "FORMATION STRETCHED",
    separated: "FIGHTING POCKET",
    reconnecting: "FOLLOWING RAM WAKE",
    overrun: "FORMATION OVERRUN",
  };
  const supportLabel = hud.connected
    ? "SUPPORT FULL"
    : hud.formationState === "stretched"
      ? "SUPPORT WEAK"
      : "NO CAPTURE · NO REPAIR · NO SPOTTING";
  const foreignExpressionLabel: Record<ForeignExpressionStage, string> = {
    dormant: "",
    refusal: "COMMAND REFUSED · THE CASUALTY ROUTE TAKES PRIORITY",
    rotate: "THE BROOD LEAVES THE FIRING LINE",
    brace: "FOUR BODIES ANCHOR INTO THE BREACH",
    contact: "LIVING TENDONS TAKE THE FALLEN",
    strain: "FIRE WITHHELD · SHARED LOAD MOVING",
    success: "SECOND GENERATION WITNESSED · CORRECTION REQUIRED",
    overload: "OVERLOAD · EVIDENCE RETAINED · NO ADVANCEMENT",
    severed: "SEVERED · EVIDENCE RETAINED · NO ADVANCEMENT",
    casualty: "CASUALTY UNDER LOAD · EVIDENCE RETAINED",
    canonical: "THIRD GENERATION CORRECTED · THE ARMY LEARNED",
  };

  const settingsPanel = (
    <section className="menu-panel settings-panel" aria-labelledby="settings-title">
      <p className="eyebrow">HUMANE INSTRUMENT PANEL</p>
      <h2 id="settings-title">SETTINGS</h2>
      <p className="panel-intro">
        Keep the war legible. These choices are stored on this device and can be
        changed during a paused run.
      </p>
      <div className="settings-grid">
        {HUMANE_SETTING_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="setting-row"
            aria-pressed={settings[option.key]}
            onClick={() => updateSetting(option.key, !settings[option.key])}
          >
            <span>
              <strong>{option.label}</strong>
              <small>{option.detail}</small>
            </span>
            <b aria-hidden="true">{settings[option.key] ? "ON" : "OFF"}</b>
          </button>
        ))}
      </div>
      <div className="settings-audio" role="group" aria-label="Audio settings">
        <button
          type="button"
          aria-pressed={soundEnabled}
          onClick={toggleSound}
        >
          FOLEY {soundEnabled ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          aria-pressed={musicEnabled}
          onClick={toggleMusic}
        >
          OST {musicEnabled ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          aria-pressed={settings.reneeVoice}
          onClick={() => updateSetting("reneeVoice", !settings.reneeVoice)}
        >
          RENEE {settings.reneeVoice ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          aria-pressed={voiceEnabled}
          onClick={toggleVoice}
        >
          COMMAND {voiceEnabled ? "ON" : "OFF"}
        </button>
      </div>
      <button
        type="button"
        className="menu-back"
        onClick={() => setMenuPanel("main")}
      >
        {settingsOrigin === "pause" ? "BACK TO PAUSE" : "BACK TO MAIN MENU"}
      </button>
    </section>
  );

  const controlsPanel = (
    <section className="menu-panel controls-panel" aria-labelledby="controls-title">
      <p className="eyebrow">THE BODY HAS TWO COMMANDS</p>
      <h2 id="controls-title">HOW TO DRIVE</h2>
      <div className="control-ledger">
        <article>
          <strong>TOUCH</strong>
          <p>Drag upward or downward on the left and right edges to drive each living tread.</p>
        </article>
        <article>
          <strong>KEYBOARD</strong>
          <p>W / S drive the left tread. ↑ / ↓ drive the right. P or Escape pauses.</p>
        </article>
        <article>
          <strong>GUNNERY</strong>
          <p>The organs fire for themselves. Turn the whole body until a threat enters the slit.</p>
        </article>
        <article>
          <strong>WAR PARTY</strong>
          <p>Ram open roads, stay close enough to reconnect, and capture ground together.</p>
        </article>
        <article>
          <strong>TANK KATA</strong>
          <p>Institutional law: Never receive force you can redirect. Never redirect force you can evade. Never evade away from the objective.</p>
        </article>
      </div>
      <button type="button" className="menu-back" onClick={() => setMenuPanel("main")}>BACK</button>
    </section>
  );

  if (introStage === "checking") {
    return (
      <main className="intro-loading" aria-live="polite">
        <span>OPENING THE OBSERVATION PORT…</span>
      </main>
    );
  }

  if (introStage === "consent" || introStage === "playing") {
    return (
      <IntroExperience
        stage={introStage}
        mode={introMode}
        onChooseMode={chooseIntroMode}
        onRefuse={refuseIntro}
        onFinish={finishIntro}
      />
    );
  }

  return (
    <main
      className={`game-shell game-${screen}${paused ? " is-paused" : ""}${settings.reducedMotion ? " humane-reduced-motion" : ""}${settings.highContrast ? " humane-high-contrast" : ""}${settings.largeHud ? " humane-large-hud" : ""}`}
      data-paused={paused ? "true" : "false"}
    >
      <canvas
        ref={terrainCanvasRef}
        className="game-canvas terrain-canvas"
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="game-canvas sprite-canvas"
        aria-label="First-person battlefield through the landship vision slit"
        aria-hidden={screen === "menu" || screen === "care" || paused}
        tabIndex={screen === "playing" && !paused ? 0 : -1}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        data-ost-tracks={OST_POLICY.tracks}
        data-ost-shuffle={OST_POLICY.shuffle}
        data-ost-crossfade={OST_POLICY.crossfadeSeconds}
        data-ost-lifecycle={OST_POLICY.lifecycle}
        data-renee-cues={RENEE_POLICY.cueCount}
        data-renee-trigger-model={RENEE_POLICY.triggerModel}
        data-renee-casting={RENEE_POLICY.castingStatus}
        data-ferravine-care-cues={CARE_AUDIO_POLICY.bodyCueCount}
        data-renee-humming-loops={CARE_AUDIO_POLICY.hummingLoopCount}
        data-voice-cues={TANK_KATA_POLICY.cueCount}
        data-voice-tempo={TANK_KATA_POLICY.tempoBpm}
        data-voice-meter={TANK_KATA_POLICY.meter}
        data-voice-sync-delay={TANK_KATA_POLICY.maxSyncDelayMs}
        data-voice-speaker={TANK_KATA_POLICY.speaker}
        data-voice-role={TANK_KATA_POLICY.voiceRole}
        data-voice-sync={TANK_KATA_POLICY.routine}
        data-voice-warning-policy={TANK_KATA_POLICY.warnings}
      />
      <div className="sound-controls" role="group" aria-label="Audio controls">
        {screen === "playing" && !paused ? (
          <button
            type="button"
            className="sound-toggle pause-toggle"
            aria-label="Pause battle"
            onClick={pauseGame}
          >
            PAUSE
          </button>
        ) : null}
        <button
          type="button"
          className="sound-toggle"
          aria-label={soundEnabled ? "Mute designed Foley" : "Enable designed Foley"}
          aria-pressed={soundEnabled}
          onClick={toggleSound}
        >
          FOLEY {soundEnabled ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          className="sound-toggle music-toggle"
          aria-label={musicEnabled ? "Mute soundtrack" : "Enable soundtrack"}
          aria-pressed={musicEnabled}
          onClick={toggleMusic}
        >
          OST {musicEnabled ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          className="sound-toggle renee-toggle"
          aria-label={settings.reneeVoice ? "Mute Renee voice" : "Enable Renee voice"}
          aria-pressed={settings.reneeVoice}
          onClick={() => updateSetting("reneeVoice", !settings.reneeVoice)}
        >
          RENEE {settings.reneeVoice ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          className="sound-toggle voice-toggle"
          aria-label={voiceEnabled ? "Mute Regnet command voice" : "Enable Regnet command voice"}
          aria-pressed={voiceEnabled}
          onClick={toggleVoice}
        >
          COMMAND {voiceEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {rendererState === "failed" && (
        <section className="renderer-failure" role="alert">
          <p className="eyebrow">NO WEBGL</p>
          <h2>THE OBSERVATION PORT CANNOT OPEN</h2>
          <p>
            Through the Slit requires a working GPU terrain context. No flat
            substitute battlefield has been rendered.
          </p>
        </section>
      )}

      {screen !== "menu" && screen !== "care" ? (
        <section className="combat-hud" aria-live="polite" aria-hidden={paused}>
          <div className="hud-block">
            <span>LIVING CORE</span>
            <strong>{Math.ceil(hud.core)}</strong>
            <i>
              <b style={{ width: `${hud.core}%` }} />
            </i>
          </div>
          <div className="hud-center">
            <strong>{timeLabel}</strong>
            <span>
              {hud.phase.toUpperCase()} · ACRE {hud.capturedGround + 1} ·{" "}
              {Math.floor(hud.distance)}m
            </span>
          </div>
          <div className="hud-block hud-level">
            <span>WAR PARTY</span>
            <strong>{Math.ceil(hud.cohesion)}%</strong>
            <i>
              <b style={{ width: `${hud.cohesion}%` }} />
            </i>
          </div>
        </section>
      ) : null}

      {screen !== "menu" && screen !== "care" && (
        <>
          <div className="armor-readout" aria-label="Directional armor condition">
            <span>SCUTES</span>
            <b>F {Math.ceil(hud.front)}</b>
            <b>L {Math.ceil(hud.left)}</b>
            <b>R {Math.ceil(hud.right)}</b>
            <b>B {Math.ceil(hud.rear)}</b>
          </div>
          <div
            className={`corridor-readout ${hud.formationState}`}
            aria-label="War party corridor state"
          >
            <strong>{formationLabel[hud.formationState]}</strong>
            <span>
              FORMATION {Math.ceil(hud.formationWidth)}m · BREACH{" "}
              {Math.ceil(hud.corridorWidth)}m · GROUND {hud.capturedGround} ·
              GRAFTS {hud.totalGrafts} · SUPPRESSION{" "}
              {Math.ceil(hud.suppression)} · LOSSES {Math.ceil(hud.casualties)} ·
              {" "}{supportLabel}
              {hud.breachWakeSeconds > 0
                ? ` · WAKE ${Math.ceil(hud.breachWakeSeconds)}s`
                : ""}
            </span>
          </div>
          <p className="caption-line" aria-live="assertive">
            {hud.caption}
          </p>
          {hud.foreignExpressionState !== "dormant" ? (
            <aside
              className={`lineage-field-signal ${hud.foreignExpressionState}`}
              role="status"
              aria-live="polite"
              aria-label={`Martyr's Winch foreign expression: ${foreignExpressionLabel[hud.foreignExpressionState]}. ${hud.lineageEventLog}`}
            >
              <strong>MARTYR&apos;S WINCH // FOREIGN VESSEL</strong>
              <span>{foreignExpressionLabel[hud.foreignExpressionState]}</span>
              <small>NO ANCESTOR ITEM · NO CANON · THE ARMY IS BEING TESTED</small>
            </aside>
          ) : null}
          <div className="director-readout" aria-live="polite">
            <strong>
              {hud.pendingOfferTokens > 0
                ? "ORGAN READY · FIRING LULL"
                : `NUTRIENT LEVEL ${hud.nutrientLevel} · XP ${hud.nutrientXp}/${hud.nextGraftTarget}`}
            </strong>
            <i className="nutrient-meter" aria-hidden="true">
              <b
                style={{
                  width: `${Math.min(100, (hud.nutrientXp / hud.nextGraftTarget) * 100)}%`,
                }}
              />
            </i>
            <span>
              NEXT LINE {Math.ceil(hud.nextLineDistance)}m ·{" "}
              {hud.captureBlockers.length > 0
                ? `BLOCKED BY ${hud.captureBlockers.slice(0, 3).join(" · ")}`
                : "ACRE READY TO OCCUPY"}
            </span>
            <small>{hud.defenseState}</small>
          </div>
          <div className="build-rack" aria-label="Living graft build">
            <strong>LIVING BUILD</strong>
            {GRAFT_KEYS.filter((key) => hud.graftLevels[key] > 0).length ===
            0 ? (
              <span>NO GRAFTS YET</span>
            ) : (
              GRAFT_KEYS.filter((key) => hud.graftLevels[key] > 0).map(
                (key) => (
                  <span key={key}>
                    {GRAFT_TITLES[key]} {hud.graftLevels[key]}
                  </span>
                ),
              )
            )}
            {hud.offspring.map((name) => (
              <span key={name} className="offspring-graft">
                OFFSPRING · {name}
              </span>
            ))}
          </div>
        </>
      )}

      {screen === "playing" && (
        <>
          <div ref={turretOverlayRef} className="top-turret" aria-hidden="true">
            <span className="turret-cupola">
              <i className="turret-eye" />
              <b ref={turretBarrelRef} className="turret-barrel" />
              <i ref={turretCoaxRef} className="turret-coax" />
            </span>
          </div>
          <div className="track-control track-left" aria-hidden="true">
            <span>LEFT LIVING TREAD</span>
            <i>
              <b style={{ top: `${50 - hud.leftSpool * 38}%` }} />
            </i>
            <small>{Math.ceil(hud.leftTread)}% ORGAN</small>
          </div>
          <div className="track-control track-right" aria-hidden="true">
            <span>RIGHT LIVING TREAD</span>
            <i>
              <b style={{ top: `${50 - hud.rightSpool * 38}%` }} />
            </i>
            <small>{Math.ceil(hud.rightTread)}% ORGAN</small>
          </div>
          <div
            className={`organ-readout ${hud.targetReady ? "ready" : ""}`}
            aria-live="polite"
          >
            <span>
              MAIN MOUTH · ROUNDS ∞ · HE {Math.min(4, hud.heCycle)}/4 · RIBS {hud.graftLevels["rib-mortar-brood"]} · CRUSHED{" "}
              {hud.crushedEnemies}
            </span>
            <strong>{hud.targetLabel}</strong>
            <small>
              {hud.targetReady ? "BODY AGREES · FIRING" : "STEER THREAT INTO THE SLIT"}
            </small>
          </div>
        </>
      )}

      {screen === "care" && (
        <section className="care-screen" aria-labelledby="care-title">
          <div className="care-port" data-care-step={CARE_SEQUENCE[careStepIndex].id} aria-hidden="true">
            <span className="care-intake">
              <i style={{ width: `${CARE_SEQUENCE[careStepIndex].fuel}%` }} />
            </span>
            <span className="care-hand left" />
            <span className="care-hand right" />
          </div>
          <div className="care-panel">
            <p className="eyebrow">PARKED // INTAKE AND SCUTE CARE</p>
            <h2 id="care-title">{careCompleted ? "FED, SEALED, AND ANSWERING" : CARE_SEQUENCE[careStepIndex].title}</h2>
            <p>{careCompleted ? "Renee's hands are clear. Ferravine is ready for the road." : CARE_SEQUENCE[careStepIndex].instruction}</p>
            <div className="care-fuel-meter" aria-label={`Fuel ${CARE_SEQUENCE[careStepIndex].fuel} percent`}>
              <span>FUEL CARE</span>
              <i><b style={{ width: `${CARE_SEQUENCE[careStepIndex].fuel}%` }} /></i>
              <strong>{CARE_SEQUENCE[careStepIndex].fuel}%</strong>
            </div>
            <div className="care-captions">
              <p aria-live="assertive"><strong>RENEE</strong>{careReneeCaption || "Renee waits with her hands visible."}</p>
              <p aria-live="polite"><strong>FERRAVINE</strong>{careBodyCaption || "Ferravine holds the intake closed and listens."}</p>
              {careHumCaption ? <small>♪ {careHumCaption}</small> : null}
            </div>
            <nav className="care-actions" aria-label="Ferravine care actions">
              {careCompleted ? (
                <button type="button" onClick={leaveCare}>RETURN TO THE ROAD</button>
              ) : (
                <button type="button" onClick={performCareAction} disabled={careBusy}>
                  {careBusy ? "LISTENING…" : CARE_SEQUENCE[careStepIndex].action}
                </button>
              )}
              <button type="button" onClick={leaveCare}>BACK TO MAIN MENU</button>
            </nav>
            <small>
              29 RENEE CUES · 12 FERRAVINE RESPONSES · 3 QUARANTINED HUM LOOPS · TWO-TAP MOTIF
            </small>
          </div>
        </section>
      )}

      {screen === "menu" && (
        <section className="briefing">
          {menuPanel === "settings" ? settingsPanel : menuPanel === "controls" ? controlsPanel : (
            <div className="menu-panel main-menu" aria-labelledby="game-title">
              <figure className="mendels-procession-hero">
                <img
                  src="/mendels-procession-hero.webp"
                  alt="A living Great War landship on twin tendon rails, its root-feet gripping crater mud."
                />
                <figcaption>
                  MENDEL&apos;S PROCESSION // TANK KATA MADE ANATOMY
                </figcaption>
              </figure>
              <div className="menu-copy">
                <p className="eyebrow">SPEARHEAD DEFENSE // GREAT WAR</p>
                <h1 id="game-title">
                  THROUGH
                  <br />
                  THE SLIT
                </h1>
                <p>
                  The guns are organs, not buttons. Steer threats into their living arcs,
                  keep the war party connected, and feed a cumulative body from captured ground.
                </p>
                <nav className="menu-actions" aria-label="Main menu">
                  <button type="button" onClick={() => void beginCare()} disabled={engineState === "building"}>
                    {engineState === "building" ? "PREPARING THE INTAKE…" : "TEND FERRAVINE"}
                  </button>
                  <button
                    onClick={resumeFromMainMenu}
                    disabled={engineState === "building"}
                    autoFocus
                  >
                    {engineState === "building"
                      ? "WAKING THE BATTLEFIELD…"
                      : engineState === "failed"
                        ? "TRY THE FIRST BREACH AGAIN"
                        : hasActiveRun
                          ? "RETURN TO THE BREACH"
                          : "ENTER THE FIRST BREACH"}
                  </button>
                  {hasActiveRun ? (
                    <button onClick={startGame} disabled={engineState === "building"}>
                      BEGIN A NEW BREACH
                    </button>
                  ) : null}
                  <button type="button" onClick={() => openSettings("menu")}>HUMANE SETTINGS</button>
                  <button type="button" onClick={() => setMenuPanel("controls")}>HOW TO DRIVE</button>
                  <button
                    type="button"
                    onClick={() => {
                      setIntroMode("safe");
                      setIntroStage("consent");
                    }}
                  >
                    VIEW 29-SECOND INTRO &amp; CONTENT WARNINGS
                  </button>
                </nav>
                {engineState === "failed" ? (
                  <strong className="engine-start-failure" role="alert">
                    THE BATTLEFIELD FAILED BEFORE FIRST CONTACT. THE PORT REMAINS OPEN FOR RETRY.
                  </strong>
                ) : null}
                <small>
                  FRONT SEED {coldSeed} · ONLY THE TWIN TREADS DURING BATTLE · AUTO-FIRING ORGANS · P / ESC PAUSES
                </small>
              </div>
            </div>
          )}
        </section>
      )}

      {paused && screen === "playing" && (
        <section className="pause-screen" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          {menuPanel === "settings" ? settingsPanel : menuPanel === "controls" ? controlsPanel : (
            <div className="menu-panel pause-menu">
              <p className="eyebrow">THE BATTLEFIELD HOLDS ITS BREATH</p>
              <h2 id="pause-title">PAUSED</h2>
              <p className="panel-intro">Simulation is frozen. The soundtrack keeps its place in the procession.</p>
              <nav className="menu-actions" aria-label="Pause menu">
                <button type="button" onClick={resumeGame} autoFocus>RETURN TO THE SLIT</button>
                <button type="button" onClick={() => openSettings("pause")}>HUMANE SETTINGS</button>
                <button type="button" onClick={() => setMenuPanel("controls")}>HOW TO DRIVE</button>
                <button type="button" onClick={returnToMainMenu}>MAIN MENU</button>
              </nav>
            </div>
          )}
        </section>
      )}

      {screen === "graft" && (
        <Suspense fallback={<section className="upgrade-screen"><h2>THE ORGAN WAKES</h2></section>}>
          <GraftCatalog offerKeys={offerGraftKeys} onChoose={chooseGraft} />
        </Suspense>
      )}

      {canonizationOpen && (
        <Suspense fallback={null}>
          <CanonizationPlate
            onClose={() => {
              setCanonizationOpen(false);
              requestAnimationFrame(() => canvasRef.current?.focus());
            }}
          />
        </Suspense>
      )}
      {screen === "dead" && (
        <section className="briefing death">
          <p className="eyebrow">YOUR DEFENSE ENDED</p>
          <h2>THE DEFENSE DID NOT</h2>
          <p>
            Loss:{" "}
            {hud.lossCause === "hull_failure"
              ? "LANDSHIP SILENT"
              : "WAR PARTY RUIN"}
            .{" "}
            Ground held: {hud.capturedGround}. Defensive organs destroyed:{" "}
            {hud.enemyKills}. Infantry losses: {Math.ceil(hud.casualties)}%.
            The next war party is already entering the slit.
          </p>
          <div className="death-actions">
            {judgmentCandidate ? (
              <button type="button" onClick={() => setJudgmentOpen(true)}>
                PRESENT THE OBSERVATION TO MENDEL
              </button>
            ) : null}
            <button onClick={startGame}>TURN THE ORGANS AGAIN</button>
          </div>
        </section>
      )}

      {judgmentOpen && judgmentCandidate ? (
        <MendelJudgment
          candidate={judgmentCandidate}
          onClose={() => {
            setJudgmentOpen(false);
            setJudgmentCandidate(loadObservedLineage());
          }}
        />
      ) : null}
    </main>
  );
}
