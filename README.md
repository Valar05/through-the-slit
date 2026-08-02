# Through the Slit

Through the Slit is a first-person Great War landship game seen through an
armored observation port. Drive two living treads independently, break a
defense in depth, keep the infantry war party connected, and grow the machine
from what the battlefield feeds it.

Play the current production deployment:
[through-the-slit.dclarke1005.chatgpt.site](https://through-the-slit.dclarke1005.chatgpt.site)

Release state: **v1.0.0-rc1**. The accepted v85 battlefield is frozen; release
candidate changes are limited to crash, corruption, viewport, control, audio,
legibility, and deployment failures. Future mechanics belong in the v1.1
foster-care ledger.

## The run

The landship advances through seeded Western Front acres made from rolling
ground, crater fields, trench systems, communication cuts, wire, strongpoints,
and reserve lines. The game alternates between four macro phases:

1. **Breach** the prepared position and open a route through the wire.
2. **Cross** with the war party close enough to remain a formation.
3. **Consolidate** the acre after its screen, main, support, and reserve
   echelons are broken.
4. **Graft** one new organ when the nutrient bar is full, then return to the
   battle. Acre capture does not mint a second upgrade offer.

The organs fire for themselves. The player's direct combat verbs are steering
the two treads, choosing the body presented to enemy fire, ramming open usable
roads, and keeping threats inside living weapon arcs. A run ends when the
landship's core fails or the war party is ruined.

## Controls

| Surface | Contract |
| --- | --- |
| Touch | Drag up or down on the left and right edges to drive each tread. Wide touch zones are enabled by default. |
| Keyboard | `W` / `S` drive the left tread. `↑` / `↓` drive the right tread. |
| Gunnery | Weapons fire automatically when a valid threat enters their arc. Turn the whole body to aim. |
| Pause | Press `P` or `Escape`, or use the on-screen pause control. |
| Formation | Ram open roads, reconnect separated infantry through the breach wake, and occupy ground together. |

## Current source truth

The release-candidate source implements:

- a seeded, chunked terrain model shared by rendering, grounding, collision,
  trenches, craters, and line-of-sight checks;
- directional scute armor, living core and tread damage, ramming, HE and
  anti-armor fire, artillery missions, and persistent battlefield damage;
- prepared defense echelons with infantry, machine guns, flankers, observers,
  satchel teams, carriers, and anti-armor positions;
- an eighteen-body allied formation with visible fireteams, terrain-aware
  rifle fire, suppression, casualties, reconnection, and capture duties;
- nineteen run-local grafts across **Living Arsenal**, **Breach Body**, and
  **War Party**, including mutually exclusive branches and cross-organ
  offspring;
- the first inheritance proof lineage:
  **Martyr's Winch → Sapper Brood → corrected successor expression**;
- designed Foley and a seven-track session-persistent OST with shuffle,
  crossfade, and no restart on death or scene changes.

Run-local grafts and inheritance are deliberately different systems. A graft
belongs to the current build and dies with it. Inheritance records a witnessed
responsibility, releases it from the player's custody, tests it in an unlike
vessel, and requires correction before canonization. The current repository
proves that loop for Martyr's Winch; it does not claim that every graft already
has a finished hereditary lineage.

## Humane settings and accessibility

The in-game Humane Instrument Panel stores device-local preferences for:

- reduced motion;
- reduced flashes;
- optional camera movement;
- stronger contrast;
- larger field text;
- wider touch zones;
- automatic pause when focus or screen state changes;
- independent Foley and OST controls.

The combat canvas exposes a descriptive label, status changes use live regions,
menus and settings use native buttons and focus states, and the simulation can
freeze while the pause menu is open. These affordances are part of the game
contract. They do not make the heavily visual battlefield fully nonvisual; any
claim of screen-reader playability requires its own end-to-end acceptance pass.

## Repository and deployment identity

This checkout is the source lineage bound by `.openai/hosting.json` to the
Through the Slit Sites project. The public GitHub repository is a recovered
mirror and may lag the Sites source.

Treat the states separately:

- a source commit proves that code exists;
- a passing build proves that the artifact and automated contracts passed;
- a successful Sites deployment proves that a saved version reached the
  production runtime;
- browser play and human review prove the user-visible game.

Do not use a merge, a local build, or the existence of the production URL as
proof that a particular revision is live. Verify the exact Sites deployment
before making a deployment claim.

## Architecture

| Area | Source |
| --- | --- |
| Browser game and presentation | `app/game-client.tsx`, `app/globals.css` |
| Terrain and tread contact | `app/terrain-model.mjs`, `app/tread-model.mjs` |
| Combat and difficulty | `app/combat-model.mjs`, `app/difficulty-model.mjs` |
| Allied infantry | `app/infantry-combat-model.mjs` |
| Acre and nutrient progression | `app/acre-director.mjs`, `app/progression-model.mjs` |
| Grafts | `app/graft-model.mjs`, `app/graft-catalog.tsx` |
| Inheritance and Mendel judgment | `app/inheritance-model.mjs`, `app/mendel-judgment.tsx`, `app/correction-runtime.mjs` |
| Audio | `app/sound-engine.ts`, `app/music-engine.ts`, `public/sfx/`, `public/ost/` |
| Browser/Worker boundary | `scripts/build-three-browser.mjs`, `public/vendor/three/engine-v10.js` |

The application uses React, Vinext, and Three.js. The production build emits a
self-contained browser engine so Three.js and WebGL do not leak into the
Cloudflare Worker module scope.

## Acceptance and headless simulation

Put a regression at the boundary it protects:

| Evidence | Home |
| --- | --- |
| Combat, terrain, tread, difficulty, artillery, infantry, capture, and nutrient invariants | `tests/director-endurance.test.mjs` |
| Inheritance state transitions, Mendel rails, foreign expression, and correction | `tests/inheritance-model.test.mjs` |
| Rendered shell, browser/Worker split, asset contracts, UI copy, audio policy, and accessibility hooks | `tests/rendered-html.test.mjs` |
| Deterministic armor, projectile, and artillery raycasts | `scripts/combat-raycast-sim.mjs` |
| Infantry-only, tank-only, mixed-force, and passive-player balance guardrails | `scripts/infantry-combat-sim.mjs` |

`npm run build` is the release gate. It builds the browser engine and Vinext
artifact, validates the Sites output, runs all Node tests, then runs both
deterministic combat simulations. `npm test` repeats the build gate before the
test suite. Use `npm run simulate:combat` when iterating specifically on the
headless combat models.

The headless simulations are release evidence for deterministic rules and
balance guardrails. They are not evidence that terrain reads clearly, effects
land with enough spectacle, the controls feel good on a phone, or the deployed
game matches the source. Those remain browser and human acceptance work.

## Development

Prerequisites:

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

Useful commands:

```bash
npm run install:ci
npm run dev
npm run build
npm run lint
npm run simulate:combat
```

The install and build wrappers are intentionally bounded and non-retrying.
Preserve `.openai/hosting.json`, the existing lockfile, the Vinext/Sites build
scripts, and the browser-engine boundary when changing infrastructure.

## Release and recovery

`RELEASE.md` is the resurrection path: exact gates, provenance checks, device
acceptance, Sites deployment identity, and promotion rules. `KNOWN_LIMITATIONS.md`
records honest boundaries. A GitHub tag proves preserved source; the production
URL is live only after the matching Sites deployment is verified separately.
