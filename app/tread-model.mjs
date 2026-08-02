// @ts-check

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const TREAD_RESPONSE_MULTIPLIER = 1.2;

/**
 * @typedef {{
 *   x: number;
 *   z: number;
 *   angle: number;
 *   leftSpool: number;
 *   rightSpool: number;
 *   forwardVelocity: number;
 *   yawVelocity: number;
 * }} TreadState
 */

/**
 * The live game and the causality harness use this exact locomotion law.
 * @param {TreadState} state
 * @param {{
 *   leftDemand: number;
 *   rightDemand: number;
 *   leftHealth: number;
 *   rightHealth: number;
 *   dt: number;
 *   fieldHalfWidth?: number;
 *   traction?: number;
 * }} input
 */
export function stepTreads(state, input) {
  const leftHealth = clamp(input.leftHealth, 0.12, 1);
  const rightHealth = clamp(input.rightHealth, 0.12, 1);
  // Only the two living tread demands and their organ health own locomotion.
  // Terrain support is resolved after movement for hull pose; no scenery value
  // can enter this function and quietly become a steering veto again.
  const leftTarget = clamp(input.leftDemand, -1, 1) * leftHealth;
  const rightTarget = clamp(input.rightDemand, -1, 1) * rightHealth;
  const engageRate = 1.65;
  const releaseRate = 0.82;
  const leftRate =
    Math.abs(leftTarget) > Math.abs(state.leftSpool)
      ? engageRate
      : releaseRate;
  const rightRate =
    Math.abs(rightTarget) > Math.abs(state.rightSpool)
      ? engageRate
      : releaseRate;

  state.leftSpool +=
    (leftTarget - state.leftSpool) * Math.min(1, input.dt * leftRate);
  state.rightSpool +=
    (rightTarget - state.rightSpool) * Math.min(1, input.dt * rightRate);

  const average = (state.leftSpool + state.rightSpool) * 0.5;
  const differential = state.leftSpool - state.rightSpool;
  // Mud can tax acceleration and top speed, but it never changes the
  // differential between the two player-owned treads. Ground pressure is not
  // a steering veto.
  const traction = clamp(input.traction ?? 1, 0.68, 1);
  const targetVelocity = average * 118 * (0.78 + traction * 0.22);
  const targetYaw = differential * 0.56;
  const accelerating =
    Math.abs(targetVelocity) > Math.abs(state.forwardVelocity);
  const velocityRate =
    (accelerating ? 0.72 * traction : 0.38) * TREAD_RESPONSE_MULTIPLIER;
  state.forwardVelocity +=
    (targetVelocity - state.forwardVelocity) *
    Math.min(1, input.dt * velocityRate);
  state.yawVelocity +=
    (targetYaw - state.yawVelocity) *
    Math.min(1, input.dt * 1.45 * TREAD_RESPONSE_MULTIPLIER);

  if (
    Math.abs(input.leftDemand) < 0.0001 &&
    Math.abs(input.rightDemand) < 0.0001
  ) {
    state.forwardVelocity *= Math.pow(0.79, input.dt);
    state.yawVelocity *= Math.pow(0.42, input.dt);
  }

  const previousAngle = state.angle;
  state.angle += state.yawVelocity * input.dt;
  state.x = clamp(
    state.x + Math.cos(state.angle) * state.forwardVelocity * input.dt,
    -(input.fieldHalfWidth ?? 430),
    input.fieldHalfWidth ?? 430,
  );
  state.z = Math.max(
    -240,
    state.z + Math.sin(state.angle) * state.forwardVelocity * input.dt,
  );

  return {
    angleDelta: state.angle - previousAngle,
    x: state.x,
    z: state.z,
    heading: state.angle,
    forwardVelocity: state.forwardVelocity,
  };
}
