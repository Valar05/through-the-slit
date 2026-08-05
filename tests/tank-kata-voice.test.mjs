import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TANK_KATA_CUES, TANK_KATA_POLICY } from "../app/tank-kata-policy.mjs";

const voiceRoot = new URL("../public/voice/tank-kata/", import.meta.url);
const appRoot = new URL("../app/", import.meta.url);

test("six Regnet command candidates remain byte-exact and caption-matched", async () => {
  const expected = {
    "force-enters.wav": [153678, "f956042dcaa44ec685966782ad2cb70ab940ff509377a2d144088388b721c480"],
    "turn-it.wav": [92238, "2db6b67e0363ab20bab92a75e40ee4fb42917d0a62f9bed52bce9f6c06ee9f7f"],
    "take-the-acre.wav": [145998, "c8cb3b301b44226e11391ca209b389cd9ab9774ad62e5b3cd0dbb4fed7ed7273"],
    "never-evade.wav": [261198, "16f976bdccd45e6e4db792846bdee237f8e2039037ce3fa7c6f128f2cade39bc"],
    "body-pays.wav": [368718, "2a9c1095a3548795f7067f7d07223df2ffda69b67a5dd1d8ffbdda9ee039c9ec"],
    "spear-outrun.wav": [291918, "b841c0de3bc25c9dd8e9946d2d1d445198450e479b8ca6c86109c84e5fe57f86"],
  };

  assert.equal(TANK_KATA_POLICY.cueCount, 6);
  assert.equal(TANK_KATA_POLICY.speaker, "Regnet");
  assert.equal(TANK_KATA_POLICY.voiceRole, "command");
  assert.equal(TANK_KATA_POLICY.voiceSampleRate, 48_000);
  for (const [filename, [bytes, sha256]] of Object.entries(expected)) {
    const body = await readFile(new URL(filename, voiceRoot));
    assert.equal(body.byteLength, bytes, filename);
    assert.equal(createHash("sha256").update(body).digest("hex"), sha256, filename);
    assert.equal(body.readUInt32LE(24), TANK_KATA_POLICY.voiceSampleRate, filename);
  }

  for (const cue of Object.values(TANK_KATA_CUES)) {
    assert.equal(cue.caption.replaceAll(".", "").trim(), cue.words.toUpperCase().replaceAll(".", "").trim());
  }
  assert.equal(TANK_KATA_CUES["force-enters"].caption, "FORCE ENTERS");
});

test("six gameplay state changes own doctrine with cooldowns and severity priority", async () => {
  const game = await readFile(new URL("game-client.tsx", appRoot), "utf8");
  const bindings = {
    "force-enters": "run-entry",
    "turn-it": "opposed-tread-redirect",
    "body-pays": "armor-penetration-cost",
    "never-evade": "formation-separation",
    "spear-outrun": "formation-overrun",
    "take-the-acre": "acre-secured",
  };

  assert.deepEqual(
    Object.fromEntries(Object.entries(TANK_KATA_CUES).map(([key, cue]) => [key, cue.event])),
    bindings,
  );
  for (const key of Object.keys(bindings)) {
    assert.match(game, new RegExp(`trigger\\(\\"${key}\\"\\)`), key);
    assert.ok(TANK_KATA_CUES[key].cooldownMs >= 8_000, key);
  }
  assert.ok(TANK_KATA_CUES["body-pays"].priority > TANK_KATA_CUES["turn-it"].priority);
  assert.ok(TANK_KATA_CUES["spear-outrun"].priority > TANK_KATA_CUES["take-the-acre"].priority);
  assert.equal(TANK_KATA_CUES["body-pays"].urgent, true);
  assert.equal(TANK_KATA_CUES["never-evade"].urgent, true);
  assert.equal(TANK_KATA_CUES["spear-outrun"].urgent, true);
});

test("92 BPM pulse locks are bounded while voice ducks an untouched seven-master OST", async () => {
  const [music, voice, game] = await Promise.all([
    readFile(new URL("music-engine.ts", appRoot), "utf8"),
    readFile(new URL("tank-kata-voice.ts", appRoot), "utf8"),
    readFile(new URL("game-client.tsx", appRoot), "utf8"),
  ]);

  assert.equal(TANK_KATA_POLICY.tempoBpm, 92);
  assert.equal(TANK_KATA_POLICY.meter, "heavy-6/8");
  assert.equal(TANK_KATA_POLICY.maxSyncDelayMs, 360);
  assert.match(music, /const OST_TRACKS = \[/);
  assert.equal((music.match(/\/ost\/[^\"]+\.mp3/g) ?? []).length, 7);
  assert.match(music, /VOICE_DUCK_MULTIPLIER = 0\.34/);
  assert.match(voice, /cue\.definition\.urgent\s*\? 0/);
  assert.match(voice, /nextPulseDelayMs\(TANK_KATA_POLICY\.maxSyncDelayMs\)/);
  assert.match(voice, /duckForVoice/);
  assert.match(game, /COMMAND \{voiceEnabled \? "ON" : "OFF"\}/);
  assert.match(game, /data-voice-speaker=\{TANK_KATA_POLICY\.speaker\}/);
  assert.match(game, /data-voice-cues=\{TANK_KATA_POLICY\.cueCount\}/);
});
