// Pure marquee math for LCD text that does not fit the display width.
// Returns how many pixels the text should be shifted left at a given time.

export function marqueeOffset(textWidth, viewWidth, timeMs, speedPxPerSec, pauseMs) {
  const overflow = textWidth - viewWidth;
  if (overflow <= 0) return 0;
  const elapsed = timeMs - pauseMs;
  if (elapsed <= 0) return 0;
  return Math.min(overflow, (elapsed / 1000) * speedPxPerSec);
}

// Full cycle: pause at the start, scroll across, pause at the end, jump back.
export function marqueeCycleOffset(textWidth, viewWidth, timeMs, speedPxPerSec, pauseMs) {
  const overflow = textWidth - viewWidth;
  if (overflow <= 0) return 0;
  const scrollMs = (overflow / speedPxPerSec) * 1000;
  const cycle = pauseMs + scrollMs + pauseMs;
  return marqueeOffset(textWidth, viewWidth, timeMs % cycle, speedPxPerSec, pauseMs);
}
