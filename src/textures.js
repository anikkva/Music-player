// Textures. Every one of these has a procedural Canvas implementation so the
// scene keeps working when an image file is missing (spec: "Текстура не
// загрузилась — фолбэк на процедурную Canvas-текстуру").

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic value noise, so the panel looks the same on every reload.
function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grain(ctx, w, h, seed, amount, alpha) {
  const rand = mulberry32(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  if (alpha) ctx.globalAlpha = 1;
}

// Rust streaks and grime, like the weathered faceplate in the reference frames.
function weather(ctx, w, h, seed) {
  const rand = mulberry32(seed);
  for (let i = 0; i < 90; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 8 + rand() * h * 0.5;
    const wid = 1 + rand() * 7;
    const warm = rand() > 0.55;
    ctx.globalAlpha = 0.03 + rand() * 0.10;
    ctx.fillStyle = warm ? '#6b4a26' : '#0a0a0b';
    ctx.beginPath();
    ctx.ellipse(x, y + len / 2, wid, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Dark, scratched metal for the radio faceplate and its surrounding bezel. */
export function panelTexture() {
  const w = 1024;
  const h = 512;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3a3d3f');
  g.addColorStop(0.45, '#2a2d2f');
  g.addColorStop(1, '#1c1e20');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  grain(ctx, w, h, 12345, 34);
  weather(ctx, w, h, 777);

  // Fine horizontal brushing.
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#c9ccce';
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Cracked, dusty vinyl for the dashboard. */
export function dashTexture() {
  const w = 1024;
  const h = 512;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#22201d';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 909, 26);
  weather(ctx, w, h, 4242);

  // Hairline cracks in the vinyl.
  const rand = mulberry32(31337);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 40; i += 1) {
    ctx.lineWidth = 0.6 + rand() * 1.2;
    ctx.beginPath();
    let x = rand() * w;
    let y = rand() * h;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Worn leather-ish upholstery for seats and door cards. */
export function upholsteryTexture() {
  const w = 512;
  const h = 512;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#2c2622';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 5150, 30);

  const rand = mulberry32(88);
  for (let i = 0; i < 400; i += 1) {
    ctx.globalAlpha = 0.05 + rand() * 0.08;
    ctx.fillStyle = rand() > 0.5 ? '#463c34' : '#1a1613';
    const r = 4 + rand() * 26;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Procedural equirectangular night-city panorama for what is visible through
 * the glass: a dusk sky gradient, a skyline and scattered lit windows.
 */
export function proceduralPanorama() {
  const w = 4096;
  const h = 2048;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0.0, '#05060d');
  sky.addColorStop(0.30, '#12132a');
  sky.addColorStop(0.44, '#2b2140');
  sky.addColorStop(0.50, '#4a2c3c');
  sky.addColorStop(0.56, '#20222e');
  sky.addColorStop(1.0, '#090a0c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const rand = mulberry32(2026);
  const horizon = h * 0.52;

  // Two skyline layers: hazy far towers, then darker near blocks.
  const layers = [
    { count: 90, minH: 60, maxH: 300, color: '#171a2b', alpha: 0.85, lit: 0.15 },
    { count: 60, minH: 100, maxH: 460, color: '#0c0e16', alpha: 1, lit: 0.30 },
  ];

  for (const layer of layers) {
    ctx.globalAlpha = layer.alpha;
    for (let i = 0; i < layer.count; i += 1) {
      const bw = 40 + rand() * 130;
      const bh = layer.minH + rand() * (layer.maxH - layer.minH);
      const x = rand() * w;
      ctx.fillStyle = layer.color;
      ctx.fillRect(x, horizon - bh, bw, bh);

      // Lit windows.
      for (let wy = horizon - bh + 12; wy < horizon - 10; wy += 16) {
        for (let wx = x + 8; wx < x + bw - 8; wx += 14) {
          if (rand() > layer.lit) continue;
          ctx.fillStyle = rand() > 0.7 ? 'rgba(255,205,120,0.75)' : 'rgba(150,190,225,0.5)';
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
  }
  ctx.globalAlpha = 1;

  // Wet asphalt below the horizon.
  const road = ctx.createLinearGradient(0, horizon, 0, h);
  road.addColorStop(0, '#14161c');
  road.addColorStop(1, '#050506');
  ctx.fillStyle = road;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Streetlight smears reflected on the road.
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * w;
    const y = horizon + rand() * (h - horizon) * 0.45;
    const r = 20 + rand() * 90;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, 'rgba(255,190,110,0.22)');
    glow.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Amber-backlit gauge face: ticks, numerals and a red line. */
export function gaugeTexture(label, maxValue, step) {
  const size = 512;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#12100c';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.40;

  // Sweep from 220 degrees round to -40 degrees.
  const START = (220 * Math.PI) / 180;
  const END = (-40 * Math.PI) / 180;
  const steps = Math.round(maxValue / step);

  ctx.strokeStyle = 'rgba(255, 186, 90, 0.85)';
  ctx.fillStyle = 'rgba(255, 200, 120, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = START + (END - START) * t;
    const major = i % 2 === 0;
    const redline = t > 0.78;
    ctx.strokeStyle = redline ? 'rgba(230, 70, 50, 0.9)' : 'rgba(255, 186, 90, 0.85)';
    ctx.lineWidth = major ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r - (major ? 34 : 20)), cy - Math.sin(a) * (r - (major ? 34 : 20)));
    ctx.stroke();

    if (major) {
      ctx.font = '600 34px ui-sans-serif, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = redline ? 'rgba(235, 110, 90, 0.95)' : 'rgba(255, 200, 120, 0.9)';
      ctx.fillText(String(i * step), cx + Math.cos(a) * (r - 66), cy - Math.sin(a) * (r - 66));
    }
  }

  ctx.font = '600 30px ui-sans-serif, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 200, 120, 0.7)';
  ctx.fillText(label, cx, cy + r * 0.52);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Perforated speaker grille for the door cards. */
export function grilleTexture() {
  const size = 256;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1815';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#080807';
  for (let y = 8; y < size; y += 14) {
    for (let x = 8 + ((y / 14) % 2) * 7; x < size; x += 14) {
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
