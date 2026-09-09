// Pure knob math: rotation angle <-> volume in 0..1.

// The TUNE knob sweeps roughly 250 degrees, centred on its neutral position.
export const MIN_ANGLE = (-125 * Math.PI) / 180;
export const MAX_ANGLE = (125 * Math.PI) / 180;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function angleToVolume(angle, minAngle = MIN_ANGLE, maxAngle = MAX_ANGLE) {
  return clamp01((angle - minAngle) / (maxAngle - minAngle));
}

export function volumeToAngle(volume, minAngle = MIN_ANGLE, maxAngle = MAX_ANGLE) {
  return minAngle + clamp01(volume) * (maxAngle - minAngle);
}
