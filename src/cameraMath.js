// Pure camera limits. The camera turns the driver's head, it does not orbit,
// so yaw and pitch are hard-limited and zoom lives on a fixed range.

export const YAW_LIMIT = (100 * Math.PI) / 180;
export const PITCH_LIMIT = (45 * Math.PI) / 180;
export const ZOOM_MIN = 0.32; // close-up: the radio nearly fills the frame
export const ZOOM_MAX = 1.0;  // wide: steering wheel, windshield, passenger seat

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clampYaw = (yaw) => clamp(yaw, -YAW_LIMIT, YAW_LIMIT);
export const clampPitch = (pitch) => clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
export const clampZoom = (z) => clamp(z, ZOOM_MIN, ZOOM_MAX);
