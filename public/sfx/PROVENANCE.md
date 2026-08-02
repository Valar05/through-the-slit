# Through the Slit — recorded Foley provenance

Captured for the layered-organic-concussion candidate on 2026-08-01. The
downloaded donor bytes are preserved unchanged in `sources/`; derived game
assets are in `processed/`. The reproducible processing recipe is
`scripts/render-fleshpunk-sfx.sh`.

## Donor recordings

| Local donor | Title and author | Source | Rights | SHA-256 |
| --- | --- | --- | --- | --- |
| `cc0-skin-impact-235335-hq.mp3` | “skin impact SFX 44100 1.wav” by apocBot | https://freesound.org/people/apocBot/sounds/235335/ | Creative Commons 0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/ | `6104fede7015740389a0380cb77c5271827186df46978f32515e6764eb87b079` |
| `cc0-gore-splat-414296-hq.mp3` | “goreSplat.wav” by TheFitzyG | https://freesound.org/people/TheFitzyG/sounds/414296/ | Creative Commons 0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/ | `2c934ef0194de334b653e95a9fabc670ba67db8c5490080c78fae5a653f093e3` |
| `cc0-cartoon-splat-445117-hq.mp3` | “Cartoon Splat” by Breviceps | https://freesound.org/people/Breviceps/sounds/445117/ | Creative Commons 0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/ | `239b2d2b7afaf7c47f4cef5d36dccdab51feec7b8aadadb43372c95fb1243120` |
| `public-domain-explosion-LS100155.ogg` | “Explosion-LS100155.ogg” by Fg2; recorded at the Toshogu Spring Festival in Nikko | https://commons.wikimedia.org/wiki/File:Explosion-LS100155.ogg | Public domain release by the copyright holder | `d61096c83e7d63867e9f26f8d1a5e029bdda00e60a333d07b0fd1ca2093dc71e` |

The Freesound files are the public high-quality preview encodes supplied by the
source pages, not relabeled original WAV/AIFF downloads. They remain valid CC0
donor recordings and are identified precisely here to avoid source-format
laundering.

## Derived assets

| Asset | Function | Donor transformation | SHA-256 |
| --- | --- | --- | --- |
| `organic-concussion-a.ogg` | heavy contact variant A | skin event at 17.02 s + pitched gore deformation + pitched wet splat + low-passed field explosion pressure | `bcd84982323bcfb6aff592294b804b0df5f12a0c37699e402b53d6f984a43be3` |
| `organic-concussion-b.ogg` | heavy contact variant B | skin event at 24.34 s + alternate pitch relationships + field explosion pressure | `fdad339f5af108aedf04073d9b54820bfed8a631509ba0f626b07738e217584f` |
| `organic-concussion-c.ogg` | heavy contact variant C | skin event at 37.10 s + alternate pitch relationships + field explosion pressure | `938f2891c2e483476c61816de2bf220f4965ac761c563316b30bf609678ae3a9` |
| `rupture-wet-a.ogg` | crush, cyst, trench, and rupture body | pitched gore deformation + wet splat | `106c3cba05af5589b619c7ce8896006478be079721542cdc9a576d63bb6c8fbb` |
| `artillery-organic-a.ogg` | artillery body | field explosion anchor + delayed low-pitched gore afterbody | `14a789b00dbd55f0850f561bf6d0f8ce50940a81c8bfae0f695d608f5e7d380a` |
| `graft-birth-a.ogg` | graft and offspring birth | reversed, pitched gore draw + delayed wet release | `5f290e7c504e1dfff9c35d5009a102ac07112849b64a969afe18b704c0c5e650` |

The following unified-material assets remove the exposed oscillator language
from the complete game. They use only the same admitted donors above, with
pitch carried by resonant recorded material rather than naked electronic
tones. The hashes below identify the bytes shipped in this candidate; Ogg
container serialization can change on a later recipe rerender even when the
decoded audio is equivalent.

| Asset | Function | Donor transformation | Shipped SHA-256 |
| --- | --- | --- | --- |
| `membrane-shot-a.ogg` | small-arms body A | skin contact grain + pitched wet chamber body | `2c4681075f196fc08d3d7db3dc34764ffd9d6772fe770b6dee872b3dc9028791` |
| `membrane-shot-b.ogg` | small-arms body B | alternate skin contact + pitched wet chamber body | `d831bb9ceac028a129e56a4a956ecfcb4d5f83d0310d60b9a73b8b1e9a0ebe49` |
| `membrane-shot-c.ogg` | small-arms body C | alternate skin contact + low wet chamber body | `8b1bfb4d5d71d6a5c1b4bc4b845c5311e2e2a03b20ec224d15b6ed73c8d93595` |
| `tendon-snap-a.ogg` | bow, tooth, and severance transient | skin snap + reversed pitched wet tendon | `96163e57012a84841a499bd8bec9c7a4619d3ab8f9b2ddd6bac81155953891ef` |
| `scute-impact-a.ogg` | armor chatter, ricochet, and crown impact | skin collision + low-pitched gore plate body | `aee0aa6b3fd2a33ee322afb7f6f5a5e8abaa920a9a2ab46609580fd2437de54d` |
| `rib-mortar-a.ogg` | rib mortar launch | skin contact + low field pressure + gore chamber | `4c80c436c4f306765a42257616bc903e113374b897f7cc8bfbded0f912959247` |
| `toxic-exhale-a.ogg` | toxic discharge | reversed, slowed gore and wet breath | `d3750008ff0f0eb4e53c0d48dbf2f238bab4ac750e35da38252de18ee040354b` |
| `artillery-flare-a.ogg` | flare warning | reversed high skin friction + wet membrane rise | `61fd9226013022e51e0c506cee1d48f6e8ef8189afadab929875b503671abb64` |
| `artillery-incoming-a.ogg` | ranging and incoming warning | reversed field pressure + high gore tissue wake | `1ceb5ba09a8bb1d7ee5c1aa7a67cf052e2173f09465efd0f1e48d8023e922f81` |
| `ground-capture-a.ogg` | captured-acre response | reversed low gore draw + delayed pressure closure | `f4a87a84b831da059dd6cf64689d5b0bcd7a75134435ee3bad1179a037b4aad6` |
| `death-collapse-a.ogg` | landship death | slowed gore collapse + field-pressure failure + wet afterbody | `15815dd8665c60661898d8ff8997af36741ce59cdb2bc0bb2bbf1b217dc1b4bc` |
| `wake-organ-a.ogg` | audio-system wake | reversed low gore inhale + pressure pulse | `708dbc36b00dd35c77f031052b0b000d06019cbd25f1a0f34e790ab679b72319` |

All derived assets are stereo, 48 kHz Ogg Vorbis. Browser synthesis remains as
the complete fallback when a donor asset is unavailable or cannot decode.

## Acceptance state

Mechanically verified for decode, routing, peak control, family balance, and
absence of exposed oscillator cues. Native audition is unavailable in the
authoring runtime, so Drew Clarke owns final audible acceptance in the deployed
game.
