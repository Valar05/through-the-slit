# Through the Slit — itch.io and Butler release packet

Status: standalone build ready; Butler blocked only by missing itch project
Updated: 2026-08-02

## Current release truth

- GitHub secret `BUTLER_API_KEY` is present and reached the workflow without
  exposure.
- The dedicated static build succeeds in GitHub Actions: 77 files, 80,477,422
  extracted bytes, root `index.html`, relative asset paths, and the authorized
  cinematic SHA-256.
- Workflow run `30767662743` reached itch.io and stopped at
  `invalid game` for `valarsbeard/through-the-slit:html5`.
- No itch upload exists yet. Create the draft project with URL
  `through-the-slit`, then rerun `Deploy itch.io HTML5 build`.

## Finding

Butler is a valid durable release lane, but the current Sites artifact cannot be
pushed directly as an itch.io HTML game. The application is rendered by a
Cloudflare Worker and its browser asset directory has no standalone
`index.html`. itch.io requires an HTML upload with an `index.html` entry
point.

The implemented release is a dedicated static itch build that preserves the game,
29-second humane intro, local preferences, media, and accessibility controls
without depending on the Sites runtime. It builds from `itch/index.html` through
`vite.itch.config.ts` into `dist-itch` and is validated before Butler runs. A
thin itch page that embeds the live Sites URL remains unapproved.

## Butler contract

- Target: `valarsbeard/through-the-slit:html5`
- Secret: `BUTLER_API_KEY`, stored as a GitHub Actions repository secret
- Trigger: manual workflow dispatch first; tag/release automation only after a
  verified itch build exists
- Input: the exact standalone release directory, not the repository root or
  Sites server artifact
- Version: pass the repository release version with `--userversion`
- Safety: first new channel may use `--hidden` until page configuration and
  browser/mobile acceptance pass
- Verification: use `butler push-preview --changes-only` before the first
  public push, then verify the uploaded channel and playable page

Never paste the API key into chat, source, workflow YAML, an issue, or a build
log. A visible key is burned and must be revoked.

## Recommended game-page form

| Field | Value |
| --- | --- |
| Title | Through the Slit |
| Project URL | `through-the-slit` |
| Classification | Games |
| Kind of project | HTML |
| Release status | In development |
| Pricing | $0 or Donate |
| Visibility during setup | Draft |
| Embed | Click to launch in fullscreen |
| Mobile friendly | Yes |
| Orientation | Landscape |
| Language | English |

Suggested short description:

> Drive a living Great War landship through an armored vision slit. Work two
> treads independently, break a defense in depth, keep your infantry war party
> alive, consolidate each acre, and grow new organs from what the battlefield
> feeds you.

Suggested warning:

> Contains graphic war violence, blood, corpses and death, fleshy war-machine
> anatomy and body horror, artillery and weapon impacts, abrupt brightness
> changes, and intense sound. A static first-run notice offers safer-static,
> full-motion, or refusal-and-continue choices. Captions are on by default and
> the intro can always be skipped.

Suggested accessibility disclosure:

> Includes reduced motion, reduced flashes, optional camera movement, stronger
> contrast, larger field text, wide touch controls, auto-pause, independent
> Foley and music controls, captioned intro audio, visual-action descriptions,
> and a safer-static intro. The heavily visual battlefield is not claimed as
> fully screen-reader playable.

Suggested generative-AI disclosure:

> The game contains AI-assisted/generated visual and audio assets and
> AI-assisted code. Drew Clarke directed, performed, selected, edited, tested,
> and owns the work and its release decisions.

Suggested tags:

`First-Person`, `3D`, `War`, `Strategy`, `Experimental`, `Singleplayer`,
`Browser`, `Mobile`, `Accessibility`, `Body Horror`.

## Manual page checklist

1. Create the page at the exact project URL above and keep it Draft.
2. Add the short description, full description, warning, accessibility
   disclosure, and generative-AI disclosure.
3. Add a cover image and representative screenshots; avoid using a flashing or
   shock image as the cover.
4. Generate/retrieve the itch.io API key from account settings, then store it
   only as the GitHub repository secret `BUTLER_API_KEY`.
5. After the first Butler push, set the upload to HTML5 / Playable in browser
   and save the page.
6. Verify desktop and mobile launch, landscape sizing, audio start behavior,
   first-run consent, refusal persistence, safer-static mode, captions, skip,
   gameplay controls, pause, and restart.
7. Change visibility from Draft to Public only after that runtime check.

## Official references

- https://itch.io/docs/butler/pushing.html
- https://itch.io/docs/butler/login.html
- https://itch.io/docs/creators/html5
- https://itch.io/docs/creators/quality-guidelines
