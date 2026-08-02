// Authored enemy sheets are pose collections, not seam-safe grids. These
// bounds isolate each intended opaque body before it becomes a GPU texture.
export const ENEMY_ATLAS_POSE_RECTS = Object.freeze({
  0: { x: 88, y: 19, width: 193, height: 372 },
  1: { x: 448, y: 19, width: 188, height: 372 },
  2: { x: 799, y: 24, width: 185, height: 367 },
  3: { x: 1154, y: 22, width: 183, height: 369 },
  4: { x: 37, y: 432, width: 275, height: 282 },
  5: { x: 370, y: 593, width: 309, height: 122 },
  6: { x: 740, y: 421, width: 318, height: 292 },
  7: { x: 1111, y: 618, width: 305, height: 95 },
  8: { x: 13, y: 801, width: 316, height: 232 },
  9: { x: 351, y: 802, width: 324, height: 232 },
  10: { x: 673, y: 824, width: 380, height: 213 },
  11: { x: 1031, y: 827, width: 415, height: 210 },
});

export const THREAT_ATLAS_POSE_RECTS = Object.freeze({
  0: { x: 130, y: 15, width: 130, height: 339 },
  1: { x: 439, y: 24, width: 171, height: 332 },
  2: { x: 797, y: 65, width: 159, height: 279 },
  3: { x: 1120, y: 77, width: 248, height: 270 },
  4: { x: 76, y: 408, width: 216, height: 278 },
  5: { x: 355, y: 416, width: 320, height: 270 },
  6: { x: 732, y: 453, width: 284, height: 207 },
  7: { x: 1068, y: 455, width: 335, height: 213 },
  8: { x: 101, y: 691, width: 158, height: 358 },
  9: { x: 388, y: 765, width: 251, height: 262 },
  10: { x: 720, y: 781, width: 328, height: 252 },
  11: { x: 1069, y: 839, width: 342, height: 184 },
});

const ENEMY_DEATH_CELLS = Object.freeze([4, 5]);
// Cell 6 is a tank-over-corpse tableau, not a crushed infantry pose.
const ENEMY_CRUSHED_CELLS = Object.freeze([5, 7]);

export function enemyCorpseCell(id, crushed) {
  const cells = crushed ? ENEMY_CRUSHED_CELLS : ENEMY_DEATH_CELLS;
  return cells[Math.abs(id) % cells.length];
}
