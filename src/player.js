// Audio playback. Knows nothing about 3D — it just exposes commands and
// reports back through callbacks.

import { nextIndex, prevIndex } from './playlist.js';

export const STATUS = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LOADING: 'LOADING',
  NO_SIGNAL: 'NO SIGNAL',
  END: 'END OF TAPE',
};

export function createPlayer({ tracks, onTrackChange, onStatus, onVolumeChange }) {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0.7;

  let index = 0;
  // Guards against spinning forever through a playlist of broken files: one
  // full lap of consecutive load failures stops the player instead.
  let consecutiveFailures = 0;
  let wantsToPlay = false;

  const emitTrack = () => onTrackChange?.(tracks[index], index);
  const emitStatus = (status) => onStatus?.(status);

  function load(i, { autoplay }) {
    index = i;
    wantsToPlay = autoplay;
    audio.src = tracks[index].url;
    audio.load();
    emitTrack();
    emitStatus(autoplay ? STATUS.LOADING : STATUS.READY);
    if (autoplay) audio.play().catch(() => { /* awaiting a user gesture */ });
  }

  audio.addEventListener('canplay', () => {
    consecutiveFailures = 0;
    if (wantsToPlay && audio.paused) audio.play().catch(() => {});
  });

  audio.addEventListener('playing', () => emitStatus(STATUS.PLAYING));
  audio.addEventListener('pause', () => {
    if (!audio.ended) emitStatus(STATUS.PAUSED);
  });

  audio.addEventListener('ended', () => {
    load(nextIndex(index, tracks.length), { autoplay: true });
  });

  audio.addEventListener('error', () => {
    consecutiveFailures += 1;
    emitStatus(STATUS.NO_SIGNAL);
    if (consecutiveFailures >= tracks.length) {
      wantsToPlay = false;
      emitStatus(STATUS.END);
      return;
    }
    // Give the display a beat to show NO SIGNAL before skipping on.
    setTimeout(() => load(nextIndex(index, tracks.length), { autoplay: wantsToPlay }), 900);
  });

  return {
    /**
     * Loads the current track without playing it. Nothing makes a sound until
     * the user works a control on the radio.
     */
    arm() {
      load(index, { autoplay: false });
    },
    play() {
      wantsToPlay = true;
      audio.play().catch(() => {});
    },
    pause() {
      wantsToPlay = false;
      audio.pause();
    },
    toggle() {
      if (audio.paused) this.play();
      else this.pause();
    },
    next() {
      consecutiveFailures = 0;
      load(nextIndex(index, tracks.length), { autoplay: wantsToPlay || !audio.paused });
    },
    prev() {
      consecutiveFailures = 0;
      load(prevIndex(index, tracks.length), { autoplay: wantsToPlay || !audio.paused });
    },
    setVolume(v) {
      audio.volume = Math.min(1, Math.max(0, v));
      onVolumeChange?.(audio.volume);
    },
    getVolume: () => audio.volume,
    getTrack: () => tracks[index],
    getIndex: () => index,
    isPlaying: () => !audio.paused,
  };
}
