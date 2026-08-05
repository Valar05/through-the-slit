import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders a visible briefing before hydration", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']viewport["'])(?=[^>]*\bcontent=["'][^"']*width=device-width[^"']*initial-scale=1[^"']*["'])[^>]*>/i,
  );
  assert.match(html, /THROUGH(?:<!--.*?-->)?<br\s*\/?>(?:<!--.*?-->)?THE SLIT/i);
  assert.match(html, /LANDSHIP SYSTEMS/);
  assert.match(html, /Opening the observation port/);
});

test("ships the twin-tread survivor-like breach loop in a browser-only Three.js chunk", async () => {
  const clientAssets = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(clientAssets);
  const shellFile = files.find((file) => /^browser-shell-.*\.js$/.test(file));
  const gameFile = files.find((file) => /^game-client-.*\.js$/.test(file));
  const infantryFile = files.find((file) =>
    /^infantry-combat-model-.*\.js$/.test(file),
  );
  const defenseDepthFile = files.find((file) =>
    /^defense-depth-model-.*\.js$/.test(file),
  );
  assert.ok(shellFile, "client game shell is missing");
  assert.ok(gameFile, "browser-only game chunk is missing");
  assert.ok(infantryFile, "infantry combat kernel was not split from the game chunk");
  assert.ok(defenseDepthFile, "defense-depth kernel was not split from the game chunk");
  const shellSource = await readFile(new URL(shellFile, clientAssets), "utf8");
  const gameBundle = await readFile(new URL(gameFile, clientAssets), "utf8");
  assert.match(shellSource, /game-client-.*\.js/);
  assert.doesNotMatch(shellSource, /__THREE_MODULE__|three-engine-ready/);
  assert.match(gameBundle, /three(?:\.module)?-[A-Za-z0-9_-]+\.js/);
  assert.ok(
    Buffer.byteLength(gameBundle) < 155_000,
    "game logic regressed into a monolithic engine bundle",
  );
  const infantryBundle = await readFile(
    new URL(infantryFile, clientAssets),
    "utf8",
  );
  const defenseDepthBundle = await readFile(
    new URL(defenseDepthFile, clientAssets),
    "utf8",
  );
  assert.ok(
    Buffer.byteLength(infantryBundle) < 5_000,
    "infantry combat kernel exceeded its bounded mobile chunk",
  );
  assert.ok(
    Buffer.byteLength(defenseDepthBundle) < 8_000,
    "defense-depth kernel exceeded its bounded mobile chunk",
  );
  assert.match(gameBundle, /Bow Gunner/);
  assert.match(gameBundle, /Top Gunner/);
  assert.match(gameBundle, /Rib-Mortar Brood/);
  assert.match(gameBundle, /Whelping Shot/);
  assert.match(gameBundle, /Battering Sternum/);
  assert.match(gameBundle, /Trenchquake Bladders/);
  assert.match(gameBundle, /Rifle Choir/);
  assert.match(gameBundle, /Sapper Brood/);
  assert.match(gameBundle, /Trench Teeth/);
  assert.match(gameBundle, /BARBERED WIRE/);
  assert.match(gameBundle, /LEFT LIVING TREAD/);
  assert.match(gameBundle, /RIGHT LIVING TREAD/);
  assert.match(gameBundle, /leftSpool/);
  assert.match(gameBundle, /rightSpool/);
  assert.match(gameBundle, /WAR PARTY CONNECTED/);
  assert.match(gameBundle, /capturedGround/);
  assert.match(gameBundle, /FORWARD NERVE/);
  assert.match(gameBundle, /BODY AGREES/);
  assert.match(gameBundle, /ONLY THE TWIN TREADS DURING BATTLE/);
  assert.match(gameBundle, /MG BEATS THE SCUTES/);
  assert.match(gameBundle, /AP GUN TRAVERSES/);
  assert.match(gameBundle, /OBSERVER FLARE/);
  assert.match(gameBundle, /FIRE FOR EFFECT/);
  assert.match(gameBundle, /FIELD CONSOLIDATION CLOSES THE WORST WOUNDS/);
  assert.doesNotMatch(gameBundle, /ANSWERS WITH A COUNTERATTACK/);
  assert.match(gameBundle, /Needle Litter/);
  assert.match(gameBundle, /Rib Nursery/);
  assert.match(gameBundle, /War Convulsion/);
  assert.match(gameBundle, /Occupation Maw/);
  assert.match(gameBundle + defenseDepthBundle, /ASSAULT CARRIER/);
  assert.match(gameBundle + defenseDepthBundle, /SATCHEL PAIR/);
  assert.match(gameBundle, /THE DEFENSE DID NOT/);
  assert.doesNotMatch(
    gameBundle,
    /DESIGNATE|NO SOLUTION|CHAMBERED|>FIRE<|movementPointer|aimPointer/,
  );
  const gameSource = await readFile(
    new URL("../app/game-client.tsx", import.meta.url),
    "utf8",
  );
  const infantryCombatSource = await readFile(
    new URL("../app/infantry-combat-model.mjs", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const heroImage = await readFile(
    new URL("../public/mendels-procession-hero.webp", import.meta.url),
  );
  assert.equal(heroImage.subarray(0, 4).toString("ascii"), "RIFF");
  assert.ok(heroImage.byteLength < 120_000, "main-menu hero exceeded its mobile asset budget");
  assert.match(gameSource, /mendels-procession-hero\.webp/);
  assert.match(gameSource, /MENDEL&apos;S PROCESSION/);
  assert.match(gameSource, /TANK KATA MADE ANATOMY/);
  assert.match(gameSource, /root-feet gripping crater mud/);
  const skyboxTexture = await readFile(
    new URL(
      "../public/textures/western-front-skybox-v59.webp",
      import.meta.url,
    ),
  );
  assert.equal(skyboxTexture.subarray(0, 4).toString("ascii"), "RIFF");
  assert.match(gameSource, /const SKYBOX_URL = "\.\/textures\/western-front-skybox-v59\.webp"/);
  assert.match(gameSource, /THREE\.EquirectangularReflectionMapping/);
  assert.match(gameSource, /terrainScene\.background = texture/);
  assert.match(gameSource, /terrainCanvas\.dataset\.skybox = "equirectangular-ready"/);
  assert.match(cssSource, /western-front-skybox-v59\.webp/);
  assert.match(gameSource, /const traverseStep = 0\.92 \* dt/);
  assert.match(gameSource, /tank\.turret \+= tank\.angle - previous\.angle/);
  assert.match(gameSource, /runtime\.mainClock <= 0/);
  assert.match(gameSource, /runtime\.selectedTargetId = mainTarget\?\.id/);
  assert.match(gameSource, /runtime\.heCycle >= heInterval - 1/);
  assert.match(gameSource, /ammo === "he" \? 0 : runtime\.heCycle \+ 1/);
  assert.match(gameSource, /canvas\.dataset\.mainMouthAmmo = "unlimited"/);
  assert.match(gameSource, /MAIN MOUTH · ROUNDS ∞/);
  assert.match(gameSource, /data-ost-tracks=\{OST_POLICY\.tracks\}/);
  assert.match(gameSource, /data-ost-shuffle=\{OST_POLICY\.shuffle\}/);
  assert.match(gameSource, /data-ost-crossfade=\{OST_POLICY\.crossfadeSeconds\}/);
  assert.match(gameSource, /data-ost-lifecycle=\{OST_POLICY\.lifecycle\}/);
  assert.match(gameSource, /getOstPlayer\(\)/);
  assert.match(gameSource, /OST \{musicEnabled \? "ON" : "OFF"\}/);
  assert.match(gameSource, /HUMANE SETTINGS/);
  assert.match(gameSource, /THE BATTLEFIELD HOLDS ITS BREATH/);
  assert.match(gameSource, /if \(!pausedRef\.current\) update\(runtime, dt\)/);
  assert.match(gameSource, /document\.hidden\) muteForLostFocus\(\)/);
  assert.match(gameSource, /getOstPlayer\(\)\.surrenderAudioFocus\(\)/);
  assert.match(gameSource, /window\.addEventListener\("pagehide", onPageHide\)/);
  assert.match(gameSource, /through-the-slit\.humane-settings\.v1/);
  assert.match(gameSource, /through-the-slit\.intro-v4\.choice/);
  assert.match(gameSource, /VIEW 29-SECOND INTRO &amp; CONTENT WARNINGS/);
  assert.match(gameSource, /IntroExperience/);
  const introSource = await readFile(
    new URL("../app/intro-experience.tsx", import.meta.url),
    "utf8",
  );
  const introContent = await readFile(
    new URL("../app/intro-content.ts", import.meta.url),
    "utf8",
  );
  assert.match(introSource, /PLAY SAFER PRESENTATION/);
  assert.match(introSource, /PLAY FULL-MOTION CINEMATIC/);
  assert.match(introSource, /REFUSE INTRO · CONTINUE TO MENU/);
  assert.match(introSource, /SKIP INTRO/);
  assert.match(introSource, /kind="captions"/);
  assert.match(introContent, /INTRO_SOURCE_START_SECONDS = 62/);
  assert.match(introContent, /INTRO_SOURCE_END_SECONDS = 90\.92/);
  assert.match(introContent, /We drive the war through the slit\./);
  assert.match(introSource, /\/ 0:29/);
  assert.match(gameSource, /Pause when interrupted/);
  assert.match(gameSource, /Wide tread touch zones/);
  assert.match(gameSource, /PRESENT THE OBSERVATION TO MENDEL/);
  assert.match(gameSource, /loadObservedLineage\(\)/);
  const mendelSource = await readFile(
    new URL("../app/mendel-judgment.tsx", import.meta.url),
    "utf8",
  );
  assert.match(mendelSource, /SAINT MENDEL \/\/ FIRST GENERATION/);
  assert.match(mendelSource, /MARTYR&apos;S WINCH/);
  assert.match(mendelSource, /Six Mendel judgment rails/);
  assert.match(mendelSource, /EVIDENCED/);
  assert.match(mendelSource, /UNKNOWN/);
  assert.match(mendelSource, /CONTESTED/);
  assert.match(mendelSource, /PERFECT LANDSHIP REPRODUCTION REJECTED/);
  assert.match(mendelSource, /NO UNLOCK GRANTED/);
  assert.match(mendelSource, /SUBMIT CANDIDATE|confirming\.toUpperCase/);
  assert.match(mendelSource, /DEFER/);
  assert.match(mendelSource, /DESTROY/);
  assert.match(mendelSource, /aria-label="Candidate judgment"/);
  assert.match(gameSource, /sapper-brood-martyrs-winch-v81\.png/);
  assert.match(gameSource, /MARTYR&apos;S WINCH \/\/ FOREIGN VESSEL/);
  assert.match(gameSource, /NO ANCESTOR ITEM · NO CANON/);
  assert.match(gameSource, /updateForeignExpression\(runtime, dt\)/);
  assert.match(gameSource, /martyrsWinchForeignExpression/);
  assert.match(gameSource, /Foreign expression witnessed/);
  const sapperBroodAtlas = await readFile(
    new URL("../public/sprites/sapper-brood-martyrs-winch-v81.png", import.meta.url),
  );
  assert.equal(sapperBroodAtlas.subarray(1, 4).toString("ascii"), "PNG");
  const musicSource = await readFile(
    new URL("../app/music-engine.ts", import.meta.url),
    "utf8",
  );
  assert.match(musicSource, /CROSSFADE_SECONDS = 6/);
  assert.match(musicSource, /full-bag-no-immediate-repeat/);
  assert.match(musicSource, /session-persistent-across-runs-and-scenes/);
  assert.match(musicSource, /let sessionPlayer: OstPlayer \| null = null/);
  assert.match(musicSource, /surrenderAudioFocus\(\)/);
  assert.match(musicSource, /deck\.removeAttribute\("src"\)/);
  assert.match(musicSource, /navigator\.mediaSession\.metadata = null/);
  assert.match(musicSource, /setActionHandler\(action, null\)/);
  assert.match(musicSource, /reclaimAudioFocus\(\)/);
  const audioFocusSoundSource = await readFile(
    new URL("../app/sound-engine.ts", import.meta.url),
    "utf8",
  );
  assert.match(audioFocusSoundSource, /await context\.close\(\)/);
  assert.match(audioFocusSoundSource, /this\.noiseBuffers\.clear\(\)/);
  assert.match(audioFocusSoundSource, /this\.startInteriorBed\(\)/);
  assert.equal((musicSource.match(/\/ost\/[a-z-]+\.mp3/g) ?? []).length, 7);
  assert.doesNotMatch(gameSource, /apAmmo|STOMACH EMPTY|HOLD GROUND FOR SUPPLY/);
  assert.match(gameSource, /const heInterval = heShotInterval\(1\)/);
  assert.doesNotMatch(gameSource, /fireRequested|selectedAmmo|selectAmmo|requestFire/);
  assert.match(gameSource, /const seedOpeningDefense/);
  assert.match(
    gameSource,
    /placeDefender\(runtime, "observer", 148, trenchFrontZAt\(0, 148\) \+ 9, 0\.55\)/,
  );
  assert.match(gameSource, /artilleryMarkForTank\(runtime\.tank\)/);
  assert.match(gameSource, /resolveArtilleryImpact\(tank/);
  assert.match(gameSource, /strike\.salvoSize - strike\.shellsRemaining/);
  assert.match(gameSource, /artilleryMissionProfile\(/);
  assert.match(gameSource, /artilleryRangingPoint\(/);
  assert.match(gameSource, /const seedTrenchSector/);
  assert.match(gameSource, /const seedDefenseHorizon/);
  assert.match(gameSource, /DEFENSE_HORIZON_SECTORS = 5/);
  assert.match(gameSource, /const trenchInfantryPosition/);
  assert.doesNotMatch(gameSource, /spawnCounterattack|spawnDeadPhasePressure/);
  assert.match(gameSource, /HE DETONATION — THE TRENCH LINE COMES APART/);
  assert.match(gameSource, /TREAD TAKES THE BODY/);
  assert.match(gameSource, /const drawTrenchBand/);
  assert.match(gameSource, /lastVisibleSector/);
  assert.match(gameSource, /canvas\.dataset\.crushedEnemies/);
  assert.match(gameSource, /canvas\.dataset\.activeExplosions/);
  assert.match(
    gameSource,
    /transientObjectPooling =\s*"world-sprites\|projectiles\|impacts\|crush-marks"/,
  );
  assert.match(gameSource, /const projectilePoolRef = useRef<Projectile\[]>/);
  assert.match(gameSource, /const explosionPoolRef = useRef<Explosion\[]>/);
  assert.match(
    gameSource,
    /tacticalExplosionRadiusCap\(width, height, explosion\.kind\)/,
    "blast spectacle must be capped by the short viewport dimension, not landscape width alone",
  );
  assert.match(
    gameSource,
    /ORGAN READY · HELD FOR A FIRING LULL/,
    "a completed nutrient bar must announce the deferred choice before the full-screen graft catalog opens",
  );
  assert.match(
    gameSource,
    /canPresentGraftOffer\(runtime\)/,
    "graft presentation must wait for incoming artillery and bounded decisive blast readability",
  );
  assert.match(gameSource, /const crushMarkPoolRef = useRef<CrushMark\[]>/);
  assert.match(gameSource, /recycleProjectileAt\(runtime, shotIndex\)/);
  assert.match(gameSource, /recycleExplosionAt\(runtime, index\)/);
  assert.match(gameSource, /recycleCrushMarkAt\(runtime, index\)/);
  assert.doesNotMatch(gameSource, /\[\.\.\.runtime\.projectiles\]/);
  assert.doesNotMatch(
    gameSource,
    /runtime\.explosions\s*=\s*runtime\.explosions\.filter/,
  );
  assert.match(
    gameSource,
    /vfxStyle = "authored-sprite-backbone-no-procedural-fragments"/,
  );
  assert.match(gameSource, /const COMBAT_RENDER_DPR_CAP = 1/);
  assert.match(gameSource, /const TERRAIN_CAMERA_NEAR = 0\.35/);
  assert.match(
    gameSource,
    /runtime\.dpr = Math\.min\([\s\S]*?window\.devicePixelRatio \|\| 1,[\s\S]*?COMBAT_RENDER_DPR_CAP/,
  );
  assert.doesNotMatch(gameSource, /EFFECT_RENDER_SCALE|runtime\.dpr = 0\.5/);
  assert.match(gameSource, /mesh\.frustumCulled = false/);
  assert.match(gameSource, /TERRAIN_NEAR_FIELD_RADIUS/);
  assert.match(gameSource, /Number\(right\.nearField\) - Number\(left\.nearField\)/);
  assert.match(gameSource, /Math\.max\(tank\.elevation \+ 30, cameraFloor \+ 18\)/);
  assert.match(
    gameSource,
    /cameraFloorGuard =\s*"near-field-first\|single-cull-owner\|terrain-clearance-clamp"/,
  );
  assert.match(
    gameSource,
    /effectFragmentPolicy = "none-without-atlas-body"/,
  );
  assert.match(
    gameSource,
    /frenzyPolicy = "dense-overlap-authored-sprites-bounded-pools"/,
  );
  assert.doesNotMatch(
    gameSource,
    /const draw(?:Pixel|Doom)(?:Trail|Burst)|const drawKeratinBud/,
    "combat effects may not regress to procedural pixel-fragment renderers",
  );
  assert.match(
    gameSource,
    /if \(runtime\.graftBloom\)[\s\S]*?drawAtlasCell\(\s*atlases\.vfx/,
    "the post-choice organ-birth pulse must have an authored sprite backbone",
  );
  assert.match(gameSource, /crownImpact = "authored-organ-rupture-sprite"/);
  assert.match(gameSource, /visualMuzzle: "world" \| "top-cannon" \| "top-coax"/);
  assert.match(gameSource, /kind === "ap" \|\| kind === "he"[\s\S]*?"top-cannon"/);
  assert.match(gameSource, /kind === "top"[\s\S]*?"top-coax"/);
  assert.match(gameSource, /turretBarrelRef\.current/);
  assert.match(gameSource, /turretCoaxRef\.current/);
  assert.match(cssSource, /impact-effects-sheet\.png/);
  assert.match(cssSource, /\.turret-coax/);
  assert.doesNotMatch(gameSource, /#f6d76a/);
  assert.match(gameSource, /canvas\.dataset\.turretCursor/);
  assert.match(gameSource, /\/sprites\/v28\/enemy-threats-sheet\.png/);
  assert.match(gameSource, /\/sprites\/friendly-infantry-fleshpunk-v43\.png/);
  assert.match(gameSource, /FRIENDLY_ATLAS_VERTICAL_OVERLAP = 64/);
  assert.match(gameSource, /const woundedRow = isFriendlyAtlas && row === 2/);
  assert.match(gameSource, /const kneelingRow = isFriendlyAtlas && row === 1/);
  assert.match(
    gameSource,
    /row \* sourceHeight -[\s\S]*?woundedRow \? FRIENDLY_ATLAS_VERTICAL_OVERLAP : 0/,
  );
  assert.match(
    gameSource,
    /sourceHeight -[\s\S]*?kneelingRow \? FRIENDLY_ATLAS_VERTICAL_OVERLAP : 0/,
  );
  assert.match(gameSource, /\/sprites\/v28\/impact-effects-sheet\.png/);
  assert.match(
    gameSource,
    /\/sprites\/v43-environment-atlas-hyperbolic-hair\.png/,
  );
  assert.match(gameSource, /\/sprites\/v31\/threat-variants-atlas-v31\.png/);
  assert.match(gameSource, /\/sprites\/v31\/vfx-atlas-v31\.png/);
  assert.match(gameSource, /useThreatAtlas/);
  assert.match(gameSource, /wire\.torn \? 3 : 2/);
  assert.match(gameSource, /mark\.side === "left" \? 8 : 9/);
  assert.doesNotMatch(gameSource, /context\.strokeRect/);
  assert.doesNotMatch(gameSource, /const faceGradient/);
  assert.doesNotMatch(gameSource, /const glow = context\.createRadialGradient/);
  assert.match(gameSource, /const directionCell/);
  assert.match(gameSource, /cropBottom/);
  assert.match(gameSource, /drawAtlasCell/);
  assert.match(gameSource, /canvas\.dataset\.spriteAtlases/);
  assert.match(gameSource, /HE BROOD ERUPTS/);
  assert.match(gameSource, /context\.arc\(cursorPoint\.x, cursorPoint\.y, cursorRadius/);
  assert.match(gameSource, /const updateArtillery/);
  assert.match(gameSource, /shot\.kind === "machine-gun"/);
  assert.match(gameSource, /formation\.width/);
  assert.match(gameSource, /forwardVelocity/);
  assert.match(gameSource, /formation\.capturedGround/);
  assert.match(gameSource, /armorFaceForShot/);
  assert.match(gameSource, /owner: "landship" \| "infantry" \| "defense"/);
  assert.match(gameSource, /const SECTOR_LENGTH = 620/);
  assert.match(gameSource, /runtime\.captureNodes/);
  assert.match(gameSource, /owner !== "defense"/);
  assert.match(gameSource, /captureAcre\(/);
  assert.doesNotMatch(gameSource, /resolveOffer\(/);
  assert.match(gameSource, /awardNutrients\(/);
  assert.match(gameSource, /spendNutrientLevel\(/);
  assert.match(gameSource, /canvas\.dataset\.offerTokens/);
  assert.match(gameSource, /const nextOffers = chooseOffers\(runtime\)/);
  assert.match(gameSource, /setOfferGraftKeys\(nextOffers\)/);
  assert.match(gameSource, /seedDefenseHorizon\(runtime, DEFENSE_HORIZON_SECTORS\)/);
  assert.doesNotMatch(gameSource, /markNextSectorLive|finishReprisal|tickDeadPhase/);
  assert.doesNotMatch(gameSource, /defender\.wakeAt|FIRST_CAPTURE_READY_AT/);
  assert.match(gameSource, /enemyDisposition = "preseeded-trench-emplacements"/);
  assert.match(gameSource, /visibleReinforcements = "none"/);
  assert.doesNotMatch(gameSource, /FOUR ASSAULT CHILDREN HIT THE EARTH/);
  assert.match(gameSource, /capturePolicy = "clear-cross-take-advance"/);
  assert.match(gameSource, /formation\.width \+ BREACH_CLEARANCE/);
  assert.match(gameSource, /stepTreads\(/);
  assert.match(gameSource, /solveTreadSupport\(/);
  assert.match(gameSource, /terrainBlocksSegment\(/);
  assert.match(gameSource, /canvas\.dataset\.treadContactSamples/);
  assert.match(gameSource, /canvas\.dataset\.groundSurface = "webgl-buffer-geometry-world-chunks"/);
  assert.match(gameSource, /new THREE\.WebGLRenderer/);
  assert.match(gameSource, /new THREE\.BufferGeometry/);
  assert.match(gameSource, /new THREE\.MeshToonMaterial/);
  assert.match(gameSource, /terrainRenderer\.render\(terrainScene, camera\)/);
  assert.match(gameSource, /engine-toon-four-band-v61/);
  assert.match(gameSource, /world-locked-96-texel-canvas/);
  assert.match(gameSource, /none-authored-wet-decals-only/);
  assert.match(gameSource, /new THREE\.CanvasTexture/);
  assert.match(gameSource, /new THREE\.DataTexture/);
  assert.match(gameSource, /gradientMap: toonGradient/);
  assert.match(gameSource, /pixelGroundCanvas\.width = 96/);
  assert.doesNotMatch(gameSource, /new THREE\.ShaderMaterial/);
  assert.match(gameSource, /THREE\.NearestMipmapNearestFilter/);
  assert.match(gameSource, /THREE\.NearestFilter/);
  assert.doesNotMatch(gameSource, /groundReliefTexture|bumpMap:|roughnessMap:/);
  assert.match(gameSource, /terrainRenderer\.capabilities\.getMaxAnisotropy/);
  assert.match(gameSource, /const TERRAIN_CHUNK_SIZE = 240/);
  assert.match(gameSource, /TERRAIN_CHUNK_SIZE \/ TERRAIN_GRID_STEP/);
  assert.match(gameSource, /const TERRAIN_CHUNK_BUILD_BUDGET = 2/);
  assert.match(gameSource, /terrainChunksBuiltThisFrame/);
  assert.match(gameSource, /const terrainDirtyChunks = new Set<string>\(\)/);
  assert.match(gameSource, /const markCraterChunksDirty/);
  assert.match(gameSource, /markCraterChunksDirty\(crater\)/);
  assert.match(gameSource, /markCraterChunksDirty\(retiredCrater\)/);
  assert.match(gameSource, /terrainDirtyChunks\.has\(key\)/);
  assert.match(gameSource, /if \(terrainChunks\.has\(key\)\) terrainDirtyChunks\.add\(key\)/);
  assert.match(gameSource, /terrainChunks\.delete\(key\);\s*terrainDirtyChunks\.delete\(key\)/);
  assert.match(
    gameSource,
    /Stale crater relief for one frame is preferable[\s\S]*?chunk\.mesh\.visible = true/,
  );
  assert.doesNotMatch(
    gameSource,
    /for \(const chunk of terrainChunks\.values\(\)\) chunk\.mesh\.visible = false/,
  );
  assert.match(gameSource, /useRef<Runtime \| null>\(null\)/);
  assert.match(gameSource, /"idle" \| "building" \| "ready" \| "failed"/);
  assert.match(gameSource, /requestAnimationFrame\(\(\) => \{\s*requestAnimationFrame/);
  assert.doesNotMatch(gameSource, /use(?:Ref|State)<Runtime>\(initialRuntime/);
  assert.match(gameSource, /const getTerrainChunk/);
  assert.match(gameSource, /terrainChunks\.delete\(key\)/);
  assert.match(gameSource, /new THREE\.SpriteMaterial/);
  assert.match(gameSource, /depthTest: true/);
  assert.match(gameSource, /texture\.userData\.groundAnchor/);
  assert.match(gameSource, /sourceHeight - 1 - lastOpaqueRow/);
  assert.match(gameSource, /texture\.userData\.groundAnchor as number/);
  assert.match(gameSource, /canvas\.dataset\.worldSpriteCount/);
  assert.doesNotMatch(gameSource, /tank\.x \+ forwardX \* depth \+ rightX \* lateral/);
  assert.doesNotMatch(gameSource, /texturePattern\.setTransform/);
  assert.doesNotMatch(gameSource, /new DOMMatrix/);
  assert.match(gameSource, /const verticalFov = camera\.aspect >= 1/);
  assert.match(gameSource, /const focal = height \/ \(2 \* Math\.tan/);
  assert.doesNotMatch(gameSource, /const focal = width \/ \(2 \* Math\.tan/);
  assert.match(gameSource, /WRECKAGE UNDER BOTH TREADS — THE BODY CLIMBS/);
  assert.match(gameSource, /canvas\.dataset\.obstaclePolicy = "crush-or-climb"/);
  assert.match(
    gameSource,
    /canvas\.dataset\.sceneryPolicy = "sparse-footprint-seated-sightlines"/,
  );
  assert.match(gameSource, /const BARRICADE_OFFSETS = \[-0\.78, -0\.26, 0\.26, 0\.78\]/);
  assert.match(gameSource, /const BARRICADE_SITE_OFFSETS = \[76, 92, 108, 4, -76, -92, -108\]/);
  assert.match(gameSource, /const flatBarricadeSite/);
  assert.match(gameSource, /const trenchBarricadeCache = new Map/);
  assert.match(gameSource, /terrainFootprintReliefAt\(x, z, 27, 10\)/);
  assert.match(gameSource, /const scenerySeatHeight/);
  assert.match(gameSource, /const seatHeight = scenerySeatHeight\(/);
  assert.doesNotMatch(gameSource, /lineZ \+ bankSide \* 18 \+ bend/);
  assert.match(gameSource, /runtime\.crushedBarricades\.add\(barricade\.id\)/);
  assert.match(gameSource, /scaleX: crushed \? 1\.5 : 1/);
  assert.match(gameSource, /scaleY: crushed \? 0\.34 : 1/);
  assert.doesNotMatch(gameSource, /const drawStreamingGround/);
  assert.doesNotMatch(gameSource, /for \(let row = -1; row <= 1; row \+= 1\)/);
  assert.doesNotMatch(gameSource, /leftTraction:/);
  assert.doesNotMatch(gameSource, /rightTraction:/);
  assert.doesNotMatch(gameSource, /support\.blocked/);
  assert.doesNotMatch(gameSource, /tank\.x = previous\.x/);
  assert.doesNotMatch(gameSource, /tank\.forwardVelocity \*= Math\.pow\(0\.48/);
  assert.match(gameSource, /LEFT TREAD MOUNTS/);
  assert.match(gameSource, /FIRE FOR EFFECT/);
  assert.match(gameSource, /BATTERY LIFTS TO WORK THE GUNS/);
  assert.match(gameSource, /prefers-reduced-motion: reduce/);
  assert.match(gameSource, /captureBlockersFor\(/);
  assert.match(gameSource, /canvas\.dataset\.lossCause/);
  assert.match(gameSource, /resolveGameViewport\(window\)/);
  assert.doesNotMatch(gameSource, /visualViewport\?\.offset(?:Left|Top)/);
  assert.match(cssSource, /\.game-dead \.combat-hud[\s\S]*?display: none/);
  assert.doesNotMatch(
    cssSource,
    /@media \(orientation: landscape\) and \(max-height: 560px\)[\s\S]*?font-size: 6px/,
  );
  assert.match(gameSource, /canvas\.dataset\.resolvedOffers/);
  assert.match(gameSource, /nutrientTargetForLevel/);
  assert.match(gameSource, /nutrientValueForDefender/);
  assert.match(gameSource, /NUTRIENT LEVEL/);
  assert.match(gameSource, /className="nutrient-meter"/);
  assert.match(
    gameSource,
    /progressionCurve = "brutal-spendable-18-29-42-56-single-faucet"/,
  );
  assert.match(
    gameSource,
    /difficulty = "brutal-depth-lethality-threat-owned-attrition"/,
  );
  assert.match(
    gameSource,
    /rammingDoctrine =\s*"ram>breach-wake>fight-through>reconnect>consolidate"/,
  );
  assert.match(gameSource, /stampBreachWake/);
  assert.match(gameSource, /FOLLOWING RAM WAKE/);
  assert.match(gameSource, /NO CAPTURE · NO REPAIR · NO SPOTTING/);
  assert.match(gameSource, /formationStateFor/);
  assert.match(
    gameSource,
    /combatReadability =\s*"muzzle-projectile-impact-reaction-rupture-cause-chain"/,
  );
  assert.match(
    gameSource,
    /weaponSignatures =\s*"ap\|he\|needle\|crown\|cyst\|tooth\|choir\|trench\|toxic"/,
  );
  assert.match(gameSource, /canvas\.dataset\.soundFoley/);
  assert.match(gameSource, /caption-redundant\|subtle-pan-mono-safe\|mute-control/);
  assert.match(gameSource, /soundEngineRef\.current\?\.playFire/);
  assert.match(gameSource, /soundEngineRef\.current\?\.playImpact/);
  assert.match(gameSource, /soundEngineRef\.current\?\.playArmorImpact/);
  assert.match(gameSource, /soundEngineRef\.current\?\.artilleryCue/);
  assert.match(gameSource, /soundEngineRef\.current\?\.syncTreads/);
  assert.match(gameSource, /FOLEY \{soundEnabled \? "ON" : "OFF"\}/);
  const soundSource = await readFile(
    new URL("../app/sound-engine.ts", import.meta.url),
    "utf8",
  );
  assert.match(soundSource, /await context\.close\(\)/);
  assert.match(soundSource, /Hybrid recorded\/designed Foley/i);
  assert.match(soundSource, /organic-concussion-a\.ogg/);
  assert.match(soundSource, /artillery-organic-a\.ogg/);
  assert.match(soundSource, /graft-birth-a\.ogg/);
  assert.match(soundSource, /membrane-shot-a\.ogg/);
  assert.match(soundSource, /scute-impact-a\.ogg/);
  assert.match(soundSource, /artillery-incoming-a\.ogg/);
  assert.match(soundSource, /death-collapse-a\.ogg/);
  assert.doesNotMatch(soundSource, /createOscillator|OscillatorType|this\.tone/);
  assert.match(soundSource, /The procedural layer remains a complete fallback/);
  const processedFoley = [
    "organic-concussion-a.ogg",
    "organic-concussion-b.ogg",
    "organic-concussion-c.ogg",
    "rupture-wet-a.ogg",
    "artillery-organic-a.ogg",
    "graft-birth-a.ogg",
    "membrane-shot-a.ogg",
    "membrane-shot-b.ogg",
    "membrane-shot-c.ogg",
    "tendon-snap-a.ogg",
    "scute-impact-a.ogg",
    "rib-mortar-a.ogg",
    "toxic-exhale-a.ogg",
    "artillery-flare-a.ogg",
    "artillery-incoming-a.ogg",
    "ground-capture-a.ogg",
    "death-collapse-a.ogg",
    "wake-organ-a.ogg",
  ];
  for (const filename of processedFoley) {
    const bytes = await readFile(
      new URL(`../public/sfx/processed/${filename}`, import.meta.url),
    );
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "OggS");
    assert.ok(bytes.length > 6_000, `${filename} is empty or truncated`);
  }
  const provenance = await readFile(
    new URL("../public/sfx/PROVENANCE.md", import.meta.url),
    "utf8",
  );
  assert.match(provenance, /Creative Commons 0/);
  assert.match(provenance, /Public domain/);
  assert.match(provenance, /render-fleshpunk-sfx\.sh/);
  assert.match(soundSource, /playFire/);
  assert.match(soundSource, /playImpact/);
  assert.match(soundSource, /playArmorImpact/);
  assert.match(soundSource, /artilleryCue/);
  assert.match(soundSource, /playGraft/);
  assert.match(soundSource, /playCapture/);
  assert.match(soundSource, /playDeath/);
  assert.match(gameSource, /graftEcology = "exclusive-branches-escalate-verbs-crosses-birth"/);
  assert.match(
    gameSource,
    /livingArsenal =\s*"one-missile>three-needles>detonate>penetrate>toxic-ground"/,
  );
  assert.match(gameSource, /Needle Lattice/);
  assert.match(gameSource, /Rupture Bloom/);
  assert.match(gameSource, /Scute Borer/);
  assert.match(gameSource, /Funeral Lung/);
  assert.match(gameSource, /Bone Harpoon/);
  assert.match(gameSource, /Butcher's Reel/);
  assert.match(gameSource, /arsenalVolleyProfile/);
  assert.match(gameSource, /toxicCloudDamage/);
  assert.match(gameSource, /canvas\.dataset\.arsenalMissilesFired/);
  assert.match(gameSource, /canvas\.dataset\.arsenalDetonations/);
  assert.match(gameSource, /canvas\.dataset\.arsenalPenetrations/);
  assert.match(gameSource, /canvas\.dataset\.toxicCloudsBorn/);
  assert.match(gameSource, /canvas\.dataset\.toxicKills/);
  assert.match(gameSource, /bowOrganClocks/);
  assert.match(gameSource, /mortarOrganClocks/);
  assert.match(gameSource, /choirOrganClocks/);
  assert.match(gameSource, /friendlyShotsFired/);
  assert.match(gameSource, /activeFriendlyFireteams\(formation\)/);
  assert.match(gameSource, /chooseFriendlyRifleTarget\(/);
  assert.match(gameSource, /chooseFriendlySuppressionTarget\(/);
  assert.match(gameSource, /friendlyShotTerminalPolicy/);
  assert.match(infantryCombatSource, /FRIENDLY_FORMATION_BODIES = 18/);
  assert.match(infantryCombatSource, /friendlyRifleLaneClear/);
  assert.match(infantryCombatSource, /softTargetPinned/);
  assert.match(gameSource, /friendlyTargetId/);
  assert.match(gameSource, /warPartyIntent/);
  assert.match(gameSource, /shot\.verticalVelocity = target\s*\?/);
  assert.match(gameSource, /const shelterClosed =/);
  assert.match(gameSource, /runtime\.grafts\["common-shelter"\] > 0/);
  assert.match(
    gameSource,
    /const canFight =[\s\S]*?formation\.cohesion > 12[\s\S]*?!shelterClosed/,
  );
  assert.doesNotMatch(
    gameSource,
    /if \(formation\.connected\) \{\s*for \(let voice/,
  );
  assert.match(gameSource, /triggerTrenchquake/);
  assert.match(gameSource, /birthWhelps/);
  assert.match(gameSource, /barberedWireMaterial = "rooted-braided-hair"/);
  assert.match(
    gameSource,
    /friendlyVisualLanguage = "organic-fleshpunk-war-party"/,
  );
  assert.match(gameSource, /BARBERED WIRE RIPS/);
  assert.match(
    gameSource,
    /foregroundTurret = "top-edge-cannon-and-coax-owned-muzzles"/,
  );
  assert.match(gameSource, /ref=\{turretOverlayRef\} className="top-turret"/);
  assert.match(gameSource, /tank\.turretRecoil = 1/);
  assert.match(gameSource, /terminalVictory = "false"/);
  assert.match(gameSource, /battleInputs = "left_tread,right_tread"/);
  assert.match(
    gameSource,
    /graftInputs =\s*"upgrade_card_1,upgrade_card_2,upgrade_card_3"/,
  );
  assert.doesNotMatch(gameSource, /runtime\.offeredAt < 3/);
  assert.doesNotMatch(gameSource, /previousWidth < 100/);
  assert.doesNotMatch(gameSource, /\bEXIT_Z\b/);
  assert.doesNotMatch(gameSource, /\bCAPTURE_NODES\b/);
  assert.doesNotMatch(gameSource, /status = "won"|screen === "won"/);
  assert.match(gameSource, /window\.visualViewport/);
  assert.match(gameSource, /viewport-landscape-compact/);
  assert.match(gameBundle, /requestAnimationFrame/);
  assert.match(gameBundle, /First-person battlefield through the landship vision slit/);
  assert.match(gameBundle, /three-world-canvas-screen-vfx/);
  assert.match(gameBundle, /PerspectiveCamera/);
  assert.match(gameBundle, /WebGLRenderer/);
  assert.doesNotMatch(gameBundle, /Top-down tank survivor battlefield/);
  assert.doesNotMatch(gameBundle, /three-engine-ready|canvas-fallback/);
});

test("keeps browser-only game APIs out of the Worker module scope", async () => {
  const serverAssets = new URL("../dist/server/ssr/assets/", import.meta.url);
  const files = (await readdir(serverAssets)).filter((file) =>
    /^browser-shell-.*\.js$/.test(file),
  );
  assert.ok(files.length > 0, "browser-only shell is missing from the SSR build");
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, serverAssets), "utf8")),
  );
  const serverSource = sources.join("\n");
  assert.doesNotMatch(serverSource, /\bnew WebGLRenderer\b/);
  assert.doesNotMatch(serverSource, /\bnew AudioContext\b/);
});

test("ships all seven untouched OST masters", async () => {
  const ostDirectory = new URL("../dist/client/ost/", import.meta.url);
  const tracks = (await readdir(ostDirectory)).filter((file) => file.endsWith(".mp3"));
  assert.equal(tracks.length, 7);
  for (const track of tracks) {
    const bytes = await readFile(new URL(track, ostDirectory));
    assert.ok(bytes.length > 5_000_000, `${track} is unexpectedly truncated`);
    assert.ok(
      bytes.subarray(0, 3).toString("ascii") === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
      `${track} is not an MP3 stream`,
    );
  }
});

test("locks Android text scaling and gives short landscape its own composition", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /-webkit-text-size-adjust:\s*100%/);
  assert.match(css, /text-size-adjust:\s*100%/);
  assert.match(css, /\.sprite-canvas\s*{[^}]*image-rendering:\s*pixelated/s);
  assert.match(layout, /maximumScale:\s*1/);
  assert.match(layout, /userScalable:\s*false/);
  assert.match(
    css,
    /@media \(orientation: landscape\) and \(max-height: 560px\)/,
  );
  assert.match(
    css,
    /\.caption-line\s*{[^}]*width:\s*calc\(var\(--app-width\) \* 0\.56\)/s,
  );
  assert.match(
    css,
    /\.hud-block > span,[\s\S]*?\.hud-center span\s*{[^}]*font-size:\s*9px/s,
  );
  assert.match(
    css,
    /\.track-control\s*{[^}]*width:\s*calc\(var\(--app-width\) \* 0\.25\)/s,
  );
  assert.match(css, /\.track-control i\s*{[^}]*rgba\(21,24,16,\.2\)/s);
  assert.match(css, /\.track-control i b\s*{[^}]*opacity:\s*0\.78/s);
  assert.match(
    css,
    /\.director-readout,[\s\S]*?width:\s*min\(calc\(var\(--app-width\) \* 0\.28\), 320px\)/,
  );
});
