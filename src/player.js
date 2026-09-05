// Thin wrapper around a single <audio> element driving a playlist:
// play/pause, next/prev, seek, volume.

/** Pure: seconds -> "m:ss" for the time readouts. */
export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Pure: picks a random index in [0, count) that isn't `currentIndex`
 * (when count > 1), using `rand` (defaults to Math.random, injectable
 * for tests). Used for shuffle-mode "next".
 */
export function pickShuffleIndex(count, currentIndex, rand = Math.random) {
  if (count <= 1) return 0;
  let next = currentIndex;
  while (next === currentIndex) {
    next = Math.floor(rand() * count);
  }
  return next;
}

export class Player {
  constructor(tracks) {
    this.tracks = tracks;
    this.index = 0;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this._loadCurrent();
  }

  get current() {
    return this.tracks[this.index];
  }

  _loadCurrent() {
    this.audio.src = this.current.url;
  }

  play() {
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  get isPaused() {
    return this.audio.paused;
  }

  next() {
    this.index = (this.index + 1) % this.tracks.length;
    this._loadCurrent();
  }

  prev() {
    this.index = (this.index - 1 + this.tracks.length) % this.tracks.length;
    this._loadCurrent();
  }

  goTo(index) {
    this.index = ((index % this.tracks.length) + this.tracks.length) % this.tracks.length;
    this._loadCurrent();
  }

  seekTo(seconds) {
    this.audio.currentTime = seconds;
  }

  setVolume(value) {
    this.audio.volume = Math.min(1, Math.max(0, value));
  }
}
