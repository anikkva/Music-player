// The LCD is a live CanvasTexture: a backlit amber field with segment-style
// lettering, redrawn every frame so the marquee can move.

import * as THREE from 'three';
import { marqueeCycleOffset } from './marquee.js';

const W = 1024;
const H = 288;
const PAD = 34;
const VIEW = W - PAD * 2;

const NAME_FONT = '600 96px ui-monospace, "SF Mono", Menlo, monospace';
const GENRE_FONT = '600 52px ui-monospace, "SF Mono", Menlo, monospace';

export function createLcd() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  let name = '';
  let genre = '';
  let status = '';
  let statusUntil = 0;
  let volume = null;
  let volumeUntil = 0;
  let nameStart = 0;

  function background() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e0aa10');
    g.addColorStop(0.5, '#c9930a');
    g.addColorStop(1, '#a97806');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Backlight hot spot.
    const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.62);
    glow.addColorStop(0, 'rgba(255, 236, 150, 0.42)');
    glow.addColorStop(1, 'rgba(255, 236, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Dot-matrix grid, the thing that makes it read as a segment display.
    ctx.fillStyle = 'rgba(60, 40, 0, 0.16)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.4);
    for (let x = 0; x < W; x += 4) ctx.fillRect(x, 0, 1.2, H);
  }

  function segmentText(text, font, x, y, align = 'left') {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    // Dark relief under the glyphs, then the bright emissive face.
    ctx.fillStyle = 'rgba(70, 44, 0, 0.85)';
    ctx.fillText(text, x + 3, y + 3);
    ctx.fillStyle = '#fff3a0';
    ctx.shadowColor = 'rgba(255, 240, 140, 0.9)';
    ctx.shadowBlur = 18;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function drawVolumeBar() {
    const barW = 300;
    const barH = 22;
    const x = (W - barW) / 2;
    const y = H - 46;
    ctx.fillStyle = 'rgba(70, 44, 0, 0.55)';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#fff3a0';
    ctx.shadowColor = 'rgba(255, 240, 140, 0.9)';
    ctx.shadowBlur = 14;
    for (let i = 0; i < 15; i += 1) {
      if (i / 15 >= volume) break;
      ctx.fillRect(x + 4 + i * 20, y + 4, 14, barH - 8);
    }
    ctx.shadowBlur = 0;
  }

  function update(now) {
    background();

    if (status && now < statusUntil) {
      segmentText(status, NAME_FONT, W / 2, H / 2, 'center');
      texture.needsUpdate = true;
      return;
    }

    // Station name, scrolling when it overflows the display.
    ctx.font = NAME_FONT;
    const nameWidth = ctx.measureText(name).width;
    const offset = marqueeCycleOffset(nameWidth, VIEW, now - nameStart, 55, 1600);

    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD, 0, VIEW, H);
    ctx.clip();
    segmentText(name, NAME_FONT, PAD - offset, H * 0.36);
    ctx.restore();

    if (volume !== null && now < volumeUntil) {
      drawVolumeBar();
    } else {
      segmentText(genre, GENRE_FONT, PAD, H * 0.72);
    }

    texture.needsUpdate = true;
  }

  return {
    texture,
    setStation(station) {
      name = (station?.name ?? '').toUpperCase();
      genre = (station?.genre ?? '').toUpperCase();
      nameStart = performance.now();
    },
    /** Takes over the whole display for `ms` — used for NO SIGNAL etc. */
    flashStatus(text, ms = 1400) {
      status = text.toUpperCase();
      statusUntil = performance.now() + ms;
    },
    showVolume(v, ms = 1400) {
      volume = v;
      volumeUntil = performance.now() + ms;
    },
    update,
  };
}
