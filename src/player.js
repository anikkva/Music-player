// Live radio playback. Knows nothing about 3D — it just exposes commands and
// reports back through callbacks.
//
// A stream is not a file: it never ends, it cannot be seeked, and it can drop
// out mid-listen. So there is no "track finished" handling, and buffering is a
// state the display has to show.

import { nextIndex, prevIndex } from './playlist.js';

export const STATUS = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  TUNING: 'TUNING',
  NO_SIGNAL: 'NO SIGNAL',
  DEAD_AIR: 'DEAD AIR',
};

export function createPlayer({ stations, onStationChange, onStatus, onVolumeChange }) {
  const audio = new Audio();
  // Nothing touches the network until the listener works a control.
  audio.preload = 'none';
  audio.volume = 0.7;

  let index = 0;
  // Guards against spinning forever through a list of dead streams: one full
  // lap of consecutive failures stops the radio instead.
  let consecutiveFailures = 0;
  let wantsToPlay = false;
  let skipTimer = null;

  const emitStatus = (status) => onStatus?.(status);

  function tuneTo(i, { autoplay }) {
    clearTimeout(skipTimer);
    index = i;
    wantsToPlay = autoplay;
    audio.src = stations[index].url;
    onStationChange?.(stations[index], index);

    if (!autoplay) {
      emitStatus(STATUS.READY);
      return;
    }
    emitStatus(STATUS.TUNING);
    audio.play().catch(() => { /* awaiting a user gesture */ });
  }

  audio.addEventListener('playing', () => {
    consecutiveFailures = 0;
    emitStatus(STATUS.PLAYING);
  });

  audio.addEventListener('waiting', () => {
    if (wantsToPlay) emitStatus(STATUS.TUNING);
  });

  audio.addEventListener('pause', () => emitStatus(STATUS.PAUSED));

  audio.addEventListener('error', () => {
    if (!audio.src) return;
    consecutiveFailures += 1;
    emitStatus(STATUS.NO_SIGNAL);
    if (consecutiveFailures >= stations.length) {
      wantsToPlay = false;
      emitStatus(STATUS.DEAD_AIR);
      return;
    }
    // Give the display a beat to show NO SIGNAL before hunting on.
    skipTimer = setTimeout(
      () => tuneTo(nextIndex(index, stations.length), { autoplay: wantsToPlay }),
      900,
    );
  });

  return {
    /**
     * Selects the first station without opening the stream. Nothing is heard,
     * and no bytes are fetched, until the listener presses a control.
     */
    arm() {
      onStationChange?.(stations[index], index);
      emitStatus(STATUS.READY);
    },
    play() {
      wantsToPlay = true;
      if (!audio.src) {
        tuneTo(index, { autoplay: true });
        return;
      }
      emitStatus(STATUS.TUNING);
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
      tuneTo(nextIndex(index, stations.length), { autoplay: wantsToPlay || !audio.paused });
    },
    prev() {
      consecutiveFailures = 0;
      tuneTo(prevIndex(index, stations.length), { autoplay: wantsToPlay || !audio.paused });
    },
    setVolume(v) {
      audio.volume = Math.min(1, Math.max(0, v));
      onVolumeChange?.(audio.volume);
    },
    getVolume: () => audio.volume,
    getStation: () => stations[index],
    getIndex: () => index,
    isPlaying: () => !audio.paused,
  };
}
