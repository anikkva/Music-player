import { TRACKS } from './tracks.js';
import { Player, formatTime, pickShuffleIndex } from './player.js';

const vinyl = document.getElementById('vinyl');
const label = document.getElementById('label');
const labelGlyph = document.getElementById('labelGlyph');
const tonearm = document.getElementById('tonearm');
const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const likeBtn = document.getElementById('like');
const timeCurrentEl = document.getElementById('timeCurrent');
const timeDurationEl = document.getElementById('timeDuration');
const seekTrack = document.getElementById('seekTrack');
const seekFill = document.getElementById('seekFill');
const seekDot = document.getElementById('seekDot');
const playPauseBtn = document.getElementById('playPause');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle');
const listToggleBtn = document.getElementById('listToggle');
const trackListEl = document.getElementById('trackList');
const volumeInput = document.getElementById('volume');

const player = new Player(TRACKS);
player.setVolume(Number(volumeInput.value) / 100);

const likedIds = new Set();
let shuffleOn = false;

function renderTrack() {
  const track = player.current;
  titleEl.textContent = track.title;
  artistEl.textContent = track.artist;
  label.style.setProperty('--art-a', track.art[0]);
  label.style.setProperty('--art-b', track.art[1]);
  labelGlyph.textContent = track.title.charAt(0).toUpperCase();
  timeCurrentEl.textContent = '0:00';
  timeDurationEl.textContent = '0:00';
  setSeekRatio(0);
  renderLike();
  renderTrackListActive();
}

function renderLike() {
  const isLiked = likedIds.has(player.current.id);
  likeBtn.textContent = isLiked ? '♥' : '♡';
  likeBtn.classList.toggle('liked', isLiked);
  likeBtn.setAttribute('aria-pressed', String(isLiked));
}

function renderTrackListActive() {
  trackListEl.querySelectorAll('.track-row').forEach((row, i) => {
    row.classList.toggle('active', i === player.index);
    row.querySelector('.row-playing').textContent = i === player.index && !player.isPaused ? '♪' : '';
  });
}

function renderTrackList() {
  trackListEl.innerHTML = '';
  TRACKS.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'track-row';
    li.innerHTML = `
      <span class="swatch" style="background:linear-gradient(135deg, ${track.art[0]}, ${track.art[1]})"></span>
      <span class="info">
        <span class="row-title">${track.title}</span><br>
        <span class="row-artist">${track.artist}</span>
      </span>
      <span class="row-playing"></span>
    `;
    li.addEventListener('click', () => {
      const wasPlaying = !player.isPaused;
      player.goTo(i);
      renderTrack();
      if (wasPlaying) player.play();
    });
    trackListEl.appendChild(li);
  });
  renderTrackListActive();
}

function setSeekRatio(ratio) {
  const pct = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
  seekFill.style.width = pct;
  seekDot.style.left = pct;
}

function setPlayingVisual(isPlaying) {
  vinyl.classList.toggle('playing', isPlaying);
  tonearm.classList.toggle('playing', isPlaying);
  playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
  playPauseBtn.setAttribute('aria-label', isPlaying ? 'Пауза' : 'Играть');
}

async function togglePlay() {
  try {
    if (player.isPaused) {
      await player.play();
      setPlayingVisual(true);
    } else {
      player.pause();
      setPlayingVisual(false);
    }
  } catch (err) {
    console.error('Playback failed:', err);
  }
}

function goNext() {
  const wasPlaying = !player.isPaused;
  if (shuffleOn) {
    player.goTo(pickShuffleIndex(player.tracks.length, player.index));
  } else {
    player.next();
  }
  renderTrack();
  if (wasPlaying) player.play();
}

function goPrev() {
  const wasPlaying = !player.isPaused;
  player.prev();
  renderTrack();
  if (wasPlaying) player.play();
}

player.audio.addEventListener('loadedmetadata', () => {
  timeDurationEl.textContent = formatTime(player.audio.duration);
});
player.audio.addEventListener('timeupdate', () => {
  timeCurrentEl.textContent = formatTime(player.audio.currentTime);
  const ratio = player.audio.duration ? player.audio.currentTime / player.audio.duration : 0;
  setSeekRatio(ratio);
});
player.audio.addEventListener('ended', goNext);
player.audio.addEventListener('play', renderTrackListActive);
player.audio.addEventListener('pause', renderTrackListActive);

function seekFromEvent(e) {
  const rect = seekTrack.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  if (player.audio.duration) player.seekTo(ratio * player.audio.duration);
  setSeekRatio(ratio);
}

let seeking = false;
seekTrack.addEventListener('pointerdown', (e) => {
  seeking = true;
  seekTrack.setPointerCapture(e.pointerId);
  seekFromEvent(e);
});
seekTrack.addEventListener('pointermove', (e) => {
  if (seeking) seekFromEvent(e);
});
seekTrack.addEventListener('pointerup', () => {
  seeking = false;
});

playPauseBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);
volumeInput.addEventListener('input', () => {
  player.setVolume(Number(volumeInput.value) / 100);
});

likeBtn.addEventListener('click', () => {
  const id = player.current.id;
  if (likedIds.has(id)) {
    likedIds.delete(id);
  } else {
    likedIds.add(id);
  }
  renderLike();
});

shuffleBtn.addEventListener('click', () => {
  shuffleOn = !shuffleOn;
  shuffleBtn.classList.toggle('active', shuffleOn);
  shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
});

listToggleBtn.addEventListener('click', () => {
  const isOpen = trackListEl.hasAttribute('hidden');
  if (isOpen) {
    trackListEl.removeAttribute('hidden');
  } else {
    trackListEl.setAttribute('hidden', '');
  }
  listToggleBtn.classList.toggle('active', isOpen);
  listToggleBtn.setAttribute('aria-pressed', String(isOpen));
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  }
  if (e.key === 'ArrowRight') goNext();
  if (e.key === 'ArrowLeft') goPrev();
});

renderTrackList();
renderTrack();
