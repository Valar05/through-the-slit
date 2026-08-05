# Through the Slit — Project State

Updated: 2026-08-02
State owner: Adam
Authority: Drew Clarke
Authoritative home: https://github.com/Valar05/through-the-slit/blob/main/state.md

## Commission

Ship and preserve a public, forkable first-person Great War landship game viewed through an armored slit. Maintain the accepted battlefield while improving release integrity, accessibility, and durable distribution. Drew owns creative and perceptual acceptance; Adam advances source and release evidence through GitHub, ChatGPT Sites, and approved distribution lanes.

## Sealed decisions

- Release line: `v1.0.0-rc1`; accepted v85 battlefield remains frozen.
- RC changes are limited to crash, corruption, viewport, control, audio, legibility, accessibility, and deployment failures. Future mechanics belong in the v1.1 foster-care lane.
- Public and forkable.
- Accessibility is score-neutral and first-class; full nonvisual battlefield playability is not claimed.
- Difficulty is a genotype, not a ladder. The accepted v1.1 doctrine remains design-only and outside this RC.
- “Barbered wire” remains protected vocabulary where the project uses it.

## Production truth

- Public game: https://through-the-slit.dclarke1005.chatgpt.site
- Current production lineage: Sites version 100 at commit `5b3dc24872ff4b42beaa1f415ba6e5ad0b7ecdc1`; this includes the accepted intro successor, Tank Kata conductor, and Regnet command-voice candidate lineage.
- Public source: https://github.com/Valar05/through-the-slit
- The corrected intro source is published to GitHub main through audited Home Center file mutations. The cinematic was imported by successful workflow run `30765890586` at commit `9efda721de90c9d0cefaf20c4ea8405727d47926`; its Git blob `117e75894908753dd70f776516519972ab67152f` matches the local production asset and the import was SHA-256 gated to `cabbd4a795db9b3ba44e75b222ca5d4bafccf6c70bcce32661a5c837d593607b`.
- An itch.io release is requested but not yet implemented or deployed. `ITCH.md` records the current Butler finding and form packet.

## Sealed intro behavior

- A static, non-flashing notice appears before first exposure.
- Equal-authority choices: safer static presentation, full motion, or refuse and continue.
- Refusal is remembered on-device, never blocks play, and voluntary replay remains in the menu.
- Both playback modes retain pause, scrub, mute, captions, action notes, and immediate skip.
- Safer presentation suppresses motion while preserving soundtrack, timed captions, and visual-action descriptions.
- The warning names graphic violence, blood/death/corpses, fleshy war-machine anatomy/body horror, artillery/weapon impacts, abrupt brightness changes, and intense sound.
- The rejected four-minute presentation is superseded for first-run/replay by the 29-second title chorus from `01:02.000` through `01:30.920`.
- Captions are phrase-level with an outline-led presentation rather than stacked faux-dub blocks.

## Evidence

- The complete production build passed all 57 release guardrails after the 29-second correction.
- Browser QA verified warning duration, full-motion source offset, phrase-level captions, end-to-menu behavior, refusal persistence, voluntary replay, and motion suppression in safer-static mode.
- The corrected experience is deployed on Sites and was read back at the public URL.
- Human audiovisual acceptance remains Drew's; machine and browser evidence do not overrule his eyes or ears.

## Active gate

GitHub now contains a genuine standalone itch build and a manual Butler workflow. GitHub run `30767662743` proved the secret is present, rebuilt and validated the 77-file/80.5 MB HTML5 package, and reached itch.io. The only active blocker is the absent itch project slug: Butler returned `invalid game` for `valarsbeard/through-the-slit:html5`. Create that project as Draft, rerun `Deploy itch.io HTML5 build`, then verify the uploaded channel and playable page before calling itch linked.

## Working set

- Release procedure: `RELEASE.md`
- Itch/Butler packet: `ITCH.md`
- Game Bible: https://docs.google.com/document/d/1VGLFYGPNUClylzgMCyGEYrJoSNECg17ep_R82uQi4io/edit
- Difficulty doctrine: https://docs.google.com/document/d/1NSnTizgTHW4fHr-mAFBP-YuXfwPr51mHPZp4Umq_gRU/edit

## Regnet command voice — production candidate

- Drew commissioned high-quality Rene voice clips and made Regnet the voice of command.
- Source identity: Drew-accepted Regnet Cartesia voice ID `5c3c89e5-535f-43ef-b14d-f8ffe148c1f0`; `sonic-3.5`; native pitch and speed.
- Six 48 kHz mono WAV candidates replace only the six command performances. Trigger states, words, captions, priorities, cooldowns, 92 BPM synchronization, warning immediacy, and seven accepted OST masters remain unchanged.
- Production provenance and exact Drive identities live in `public/voice/tank-kata/regnet-command-v2.json`.
- Candidate audio is generated, durably read back, transferred byte-exactly, and auditioned by Adam. Drew's audible verdict remains the acceptance gate.

## Renee and Ferravine tending slice — review candidate

- Draft PR `#1` on `agent/renee-audio-director-rc1` contains a playable nine-action parked care scene: approach, intake preparation, fuel care, contamination rejection, satisfaction, damage inspection, repair, sealing, and departure.
- Renee speaks only from authored Ferravine and battle state changes. The director uses priorities, cooldowns, and recent-history suppression; no random chatter timer exists.
- The candidate bank contains 29 Renee clips (24 systemic and five intimate care phrases), 12 Ferravine body responses, three quarantined humming loops, five care-Foley families, and the recurring two-tap motif.
- `ReneeVoice`, Ferravine body/Foley, music, command voice, and critical cues retain independent controls and ducking behavior. Every meaningful care sound has a semantic caption.
- The combined Renee, Ferravine, Regnet, and Tank Kata lineage passes the production build, all 66 automated tests, deterministic combat simulations, and lint with zero errors. Browser preview verified the care scene, independent audio controls, first paired exchange, responsive caption spacing, and no application console errors.
- Renee's rendered voice identity is unresolved: the requested provider voice ID was catalogued as Lila while every synthesis receipt reported Katie. These files and all three hums remain unheard and unaccepted in this runtime. Drew's casting and listening verdict is required before merge or deployment.
- Production Sites version 100 remains unchanged. The candidate is code-complete on the draft review branch only.

## Completion reconciliation — 2026-08-05

- PR #1, `audio: let Renee answer Ferravine's body`, is merged into GitHub `main`. Earlier prose describing it as a draft branch is retained as lineage and no longer describes repository state.
- GitHub `main` at `f6fd3e867469ff8d3cb61c107299a3c9b4a0b3b6` contains the complete nine-action Renee/Ferravine tending slice and the combined Tank Kata / Regnet production lineage.
- Adam rebuilt the exact merged tree and reran all 66 automated tests plus the deterministic combat simulations successfully on 2026-08-05.
- Sites version 101 is saved from the byte-equivalent Sites source tree at commit `7f1668beace426ca3d5aca5b2ed4b00b80833249`. Production remains version 100 until the public deployment gate is explicitly cleared.
- Renee's temporary voice remains a human casting gate. The requested provider ID is catalogued as Lila while synthesis receipts report Katie. The files are technically verified, but Drew has not supplied an auditory acceptance verdict.
- The protected tokens `adanks` and `jmodel` remain unresolved. They do not silently rename a mechanic, model, artifact, or canon concept.

### Remaining completion gate

Drew listens to the bounded Renee audition set, accepts or rejects the voice identity, and explicitly authorizes publication to the already-public Through the Slit site. Until both decisions exist, Adam may prepare and verify the release but may not represent Renee's casting as accepted or deploy version 101 publicly.

## Renee casting acceptance — 2026-08-05

Drew replied “accepteed” after the bounded Renee audition. Adam interprets the clear ordinary typo as “accepted.” Renee's rendered voice identity is now accepted by Drew for the merged tending and gameplay system. The Lila/Katie provider-name mismatch remains preserved as provenance; it no longer blocks casting.

Capability transition: voice candidate → human-accepted casting. This acceptance does not itself deploy Sites version 101 or authorize publication to the already-public production surface.

## Public production deployment — Sites version 102 — 2026-08-05

Drew replied “publish public,ly.” Adam interprets the clear ordinary comma typo as “publish publicly,” explicitly clearing the existing public-site deployment gate.

Delivered production:
- URL: https://through-the-slit.dclarke1005.chatgpt.site
- Sites version: 102
- Saved source commit: `d7fd0c5afa26600e434add3257906d6c7f78ef56`
- Deployment status: succeeded
- Access mode: public
- Live HTTP readback: 200 at the canonical URL with the Through the Slit title present

Version 102 contains Drew-accepted Renee casting, the merged nine-action Renee/Ferravine tending slice, the combined Tank Kata / Regnet lineage, humane independent audio controls, semantic captions, and the previously verified 66-test release gate. Publication proves delivery of the saved build; Drew retains final perceptual authority over live play.
