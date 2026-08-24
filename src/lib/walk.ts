/**
 * The walk cycle, as pure maths.
 *
 * Sign convention, shared by every joint below: the character model faces +Z,
 * and every limb segment hangs down -Y from its pivot. Rotating a pivot about
 * X by a POSITIVE angle therefore carries its segment backwards (toward -Z),
 * and a negative angle carries it forwards (toward +Z).
 *
 * So knees fold POSITIVE — heel swinging back behind the thigh — and elbows
 * fold NEGATIVE, hand coming forward across the chest. Getting a knee sign
 * backwards gives the character bird legs, which is easy to miss in code and
 * impossible to miss on screen, so `walk.test` pins it.
 */

/** Radians of walk phase per second. */
export const STRIDE = 5.6;

/** How far behind the knee lags the hip that drives it. */
const KNEE_LAG = 1.0;

export interface WalkPose {
  leftHip: number;
  rightHip: number;
  leftKnee: number;
  rightKnee: number;
  leftShoulder: number;
  rightShoulder: number;
  leftElbow: number;
  rightElbow: number;
  /** Vertical rise of the hips, peaking twice per stride. */
  bob: number;
  torsoTwist: number;
  headTurn: number;
  headNod: number;
}

export function walkPose(phase: number): WalkPose {
  const swing = Math.sin(phase);

  return {
    leftHip: swing * 0.62,
    rightHip: -swing * 0.62,
    // Only the leg trailing behind folds, and only ever one way.
    leftKnee: Math.max(0, Math.sin(phase - KNEE_LAG)) * 1.0,
    rightKnee: Math.max(0, Math.sin(phase + Math.PI - KNEE_LAG)) * 1.0,
    // The weapon arm swings less so the kit doesn't windmill.
    leftShoulder: -swing * 0.5,
    rightShoulder: swing * 0.3,
    leftElbow: -0.25 - Math.max(0, -swing) * 0.5,
    rightElbow: -0.35 - Math.max(0, swing) * 0.3,
    bob: Math.abs(Math.sin(phase)) * 0.055,
    torsoTwist: swing * 0.13,
    headTurn: -swing * 0.1,
    headNod: Math.sin(phase * 2) * 0.04,
  };
}

/** Each cape panel lags a little further behind the one above it. */
export function capeJoint(phase: number, index: number): { x: number; z: number } {
  return {
    x: 0.12 + Math.sin(phase - index * 0.7) * (0.07 + index * 0.04),
    z: Math.sin(phase * 0.5 - index * 0.5) * 0.05,
  };
}
