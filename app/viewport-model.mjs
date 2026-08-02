/**
 * Mobile browsers may keep a wide layout viewport while system chrome exposes
 * a smaller visual viewport. Fixed positioning already follows the visible
 * origin, so applying visualViewport offsets displaces the game twice. Its
 * dimensions, however, are the authoritative clipping boundary.
 */
export const resolveGameViewport = ({
  innerWidth,
  innerHeight,
  visualViewport,
}) => {
  const valid = (value, fallback) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  const width = valid(innerWidth, 1);
  const height = valid(innerHeight, 1);
  return [
    Math.min(width, valid(visualViewport?.width, width)),
    Math.min(height, valid(visualViewport?.height, height)),
  ];
};
