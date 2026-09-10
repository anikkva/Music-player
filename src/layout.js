// Where the radio sits in the cabin.
//
// The Impala's dash has no slot for a modern head unit, so ours is mounted on
// the flat, driver-facing panel to the right of the column — the place the
// factory radio occupies on the real car. The numbers come from casting rays
// at that panel and reading back the hit point and its normal, which is also
// where the pitch comes from: the panel leans back about 0.2 radians.
//
// The scale is not vanity. The faceplate was modelled 37 cm wide so it would
// read at the framing distance; the panel it now lives on is about 16 cm of
// flat, so the unit is taken down to roughly period size and the camera's
// close zoom does the rest.

export const RADIO_POSITION = [0.39, -0.28, -0.855];
export const RADIO_YAW = 0.02;
export const RADIO_PITCH = -0.20;
export const RADIO_SCALE = 0.52;
