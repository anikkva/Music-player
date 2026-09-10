// Pure camera limits. The camera turns the driver's head, it does not orbit,
// so yaw and pitch are hard-limited and zoom lives on a fixed range.

export const YAW_LIMIT = (100 * Math.PI) / 180;
// 62 degrees, not 45. A driver's knees sit about 60 degrees below the
// horizon; at 45 the neck simply refuses to look at them, and the body we put
// in the seat is invisible from the one angle anyone would check it from.
export const PITCH_LIMIT = (62 * Math.PI) / 180;
export const ZOOM_MIN = 0.32; // close-up: the radio nearly fills the frame
export const ZOOM_MAX = 1.0;  // wide: steering wheel, windshield, passenger seat

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clampYaw = (yaw) => clamp(yaw, -YAW_LIMIT, YAW_LIMIT);
export const clampPitch = (pitch) => clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
export const clampZoom = (z) => clamp(z, ZOOM_MIN, ZOOM_MAX);
