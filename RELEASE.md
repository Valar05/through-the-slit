# Through the Slit release procedure

## Frozen baseline

The v1.0.0 release candidate descends from accepted production v85. Gameplay,
terrain, infantry, enemy doctrine, graft ecology, inheritance, art, and audio are
frozen. Only crash, corruption, viewport, control, audio, legibility, or
deployment defects may change before v1.0.0.

## Required gates

1. Run `npm ci` on Node.js 22.13 or newer.
2. Run `npm run build`. This builds the browser engine and Sites artifact,
   validates the artifact, executes the Node regression suite, and runs all
   deterministic combat simulations.
3. Run `npm run lint`. Any accepted baseline exception must be named; no new
   finding may be hidden inside it.
4. Verify every file listed in `public/ost/README.md` and
   `public/sfx/PROVENANCE.md` against its SHA-256 record.
5. Exercise fresh load, landscape rotation, pause/resume, focus loss,
   death/restart, sustained combat, Foley/OST controls, and all three authored
   sector families on Pixel, the established low-end Android device, and a
   desktop browser.
6. Save and deploy the exact tested commit through the existing Sites project.
7. Verify the terminal production deployment record and compare its source
   commit to the tested source. A local build, GitHub tag, or URL alone is not
   deployment proof.

## Candidate promotion

Tag the preserved candidate `v1.0.0-rc1`. After the final device matrix passes,
promote the same commit to `v1.0.0`; do not rebuild from an uncommitted checkout.
Publish release notes, accepted gameplay evidence, accessibility boundaries,
asset provenance, and known limitations with the release.

## Recovery

Clone the tagged GitHub source, install with `npm ci`, and run `npm run build`.
Keep `.openai/hosting.json`, the lockfile, the vendored browser engine, and all
hashed production assets intact. Sites remains the sole production deployment
lane. If the GitHub mirror and Sites disagree, use the verified Sites version as
live truth and the tagged GitHub commit as preserved-source truth; never collapse
those states.
