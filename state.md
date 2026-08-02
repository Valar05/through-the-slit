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
- Current production lineage: Sites version 96; functional intro correction commit `007514d31730acc843d111af4fce358be342aa17`, followed only by state checkpoints.
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
