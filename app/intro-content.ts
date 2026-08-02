export type IntroCue = {
  start: number;
  end: number;
  text: string;
};

// The source remains the complete V4 music video. First-run playback uses its
// title chorus as a bounded opening reel instead of making the full song the
// price of admission.
export const INTRO_SOURCE_START_SECONDS = 62;
export const INTRO_SOURCE_END_SECONDS = 90.92;
export const INTRO_DURATION_SECONDS =
  INTRO_SOURCE_END_SECONDS - INTRO_SOURCE_START_SECONDS;

export const INTRO_CAPTIONS: IntroCue[] = [
  { start: 0, end: 5.72, text: "Through the slit — where the whole war narrows." },
  { start: 5.8, end: 11.52, text: "Through the slit — smoke and shattered marrow." },
  { start: 11.6, end: 17.32, text: "Hold the nerve. Let the root-feet grip." },
  { start: 17.4, end: 20.25, text: "Turn the shell. Take the acre." },
  { start: 20.25, end: 23.12, text: "Feed the breach with what it gives." },
  { start: 23.2, end: 26.05, text: "The body breaks. The front persists." },
  { start: 26.05, end: 28.92, text: "We drive the war through the slit." },
];

export const INTRO_ACTIONS: IntroCue[] = [
  { start: 0, end: 7, text: "The view opens from inside the armored observation slit onto cratered ground." },
  { start: 7, end: 18, text: "The living landship advances with its war party through smoke and artillery fire." },
  { start: 18, end: 28.92, text: "The landship takes the breach as the front narrows back toward the slit." },
];

export function cueAt(cues: IntroCue[], time: number) {
  return cues.find((cue) => time >= cue.start && time < cue.end)?.text ?? "";
}
