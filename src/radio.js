// The radio as real geometry: a recessed faceplate, buttons that sink when
// pressed, knobs that turn, a cassette slot. Layout traced from the reference
// frames in docs/reference/radio-closeup.jpg.
//
// Exposes named control meshes and nothing else — it knows nothing about audio
// or about who is clicking it.

import * as THREE from 'three';
import { panelTexture } from './textures.js';
import { volumeToAngle, MIN_ANGLE, MAX_ANGLE } from './knob.js';

// Faceplate size in metres, and the pixel canvas the layout was traced on.
export const FACE_W = 0.30;
export const FACE_H = 0.156;
const PX_W = 1000;
const PX_H = 520;
const S = FACE_W / PX_W;

// px -> local face coordinates (origin at the centre of the faceplate)
const px = (x, y) => [(x - PX_W / 2) * S, (PX_H / 2 - y) * S];
const sz = (w, h) => [w * S, h * S];

const LCD_RECT = { x: 285, y: 150, w: 425, h: 140 };

const LAYOUT = {
  am:        { c: [145, 175], s: [62, 44],  label: 'AM' },
  fm:        { c: [232, 175], s: [62, 44],  label: 'FM' },
  preset:    { c: [232, 232], s: [62, 40],  label: '' },
  volKnob:   { c: [195, 352], r: 54,        label: 'VOL', labelAt: [195, 268] },
  slotPrev:  { c: [315, 365], s: [48, 48],  label: '◀' },
  slotNext:  { c: [683, 365], s: [48, 48],  label: '▶' },
  ejectArrow:{ c: [768, 172], s: [62, 42],  label: '▲' },
  eject:     { c: [856, 172], s: [92, 42],  label: 'EJECT' },
  seekPrev:  { c: [750, 236], s: [56, 48],  label: '◀' },
  seekNext:  { c: [894, 236], s: [56, 48],  label: '▶' },
  tuneKnob:  { c: [822, 352], r: 54,        label: 'TUNE', labelAt: [822, 268] },
};

const BUTTONS = ['am', 'fm', 'preset', 'slotPrev', 'slotNext', 'ejectArrow', 'eject', 'seekPrev', 'seekNext'];

/** Flat art for the faceplate: worn metal, recesses, and crisp drawn labels. */
function faceCanvas() {
  const c = document.createElement('canvas');
  c.width = PX_W;
  c.height = PX_H;
  const ctx = c.getContext('2d');

  // Base metal comes from the shared procedural panel texture.
  ctx.drawImage(panelTexture().image, 0, 0, PX_W, PX_H);

  // Darken the whole plate a touch; the reference panel is nearly black.
  ctx.fillStyle = 'rgba(8, 9, 10, 0.42)';
  ctx.fillRect(0, 0, PX_W, PX_H);

  const recess = (x, y, w, h, r = 6) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fill();
    // top-left shadow / bottom-right highlight = a hole, not a bump
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190, 190, 190, 0.16)';
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.stroke();
    ctx.restore();
  };

  // LCD well
  recess(LCD_RECT.x - 16, LCD_RECT.y - 16, LCD_RECT.w + 32, LCD_RECT.h + 32, 8);

  // Button wells
  for (const key of BUTTONS) {
    const item = LAYOUT[key];
    recess(item.c[0] - item.s[0] / 2 - 5, item.c[1] - item.s[1] / 2 - 5, item.s[0] + 10, item.s[1] + 10, 5);
  }

  // Knob wells
  for (const key of ['volKnob', 'tuneKnob']) {
    const k = LAYOUT[key];
    ctx.beginPath();
    ctx.arc(k.c[0], k.c[1], k.r + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
  }

  // Cassette slot
  recess(360, 340, 280, 52, 4);

  // Knob labels, engraved into the plate.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 30px ui-sans-serif, "Segoe UI", Roboto, sans-serif';
  for (const key of ['volKnob', 'tuneKnob']) {
    const k = LAYOUT[key];
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(k.label, k.labelAt[0] + 2, k.labelAt[1] + 2);
    ctx.fillStyle = 'rgba(206, 203, 194, 0.82)';
    ctx.fillText(k.label, k.labelAt[0], k.labelAt[1]);
  }

  // "SEEK" sits between the two seek halves, like on the reference plate.
  ctx.font = '600 26px ui-sans-serif, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillText('SEEK', 824, 238);
  ctx.fillStyle = 'rgba(206, 203, 194, 0.8)';
  ctx.fillText('SEEK', 822, 236);
  // AM/FM band label above the preset button.
  ctx.font = '600 22px ui-sans-serif, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillText('BAND', 190, 134);
  ctx.fillStyle = 'rgba(206, 203, 194, 0.7)';
  ctx.fillText('BAND', 188, 132);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A small canvas holding one button's cap art, so labels stay crisp. */
function buttonCapTexture(label, wpx, hpx) {
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(wpx * 4));
  c.height = Math.max(48, Math.round(hpx * 4));
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#3c3f41');
  g.addColorStop(1, '#232527');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, 0, c.width, 4);

  if (label) {
    const size = Math.round(c.height * (label.length > 2 ? 0.42 : 0.5));
    ctx.font = `600 ${size}px ui-sans-serif, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillText(label, c.width / 2 + 2, c.height / 2 + 2);
    ctx.fillStyle = '#d6d2c8';
    ctx.fillText(label, c.width / 2, c.height / 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The faceted dark knob with a brass collar seen in the reference. */
function buildKnob(radius) {
  const group = new THREE.Group();

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, 0.008, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a6a24, roughness: 0.45, metalness: 0.85 }),
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.z = 0.005;
  group.add(collar);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.94, 0.014, 10),
    new THREE.MeshStandardMaterial({ color: 0x191a1c, roughness: 0.62, metalness: 0.35 }),
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.010;
  group.add(body);

  // Pointer notch so rotation is legible.
  const notch = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.18, radius * 0.9, 0.003),
    new THREE.MeshStandardMaterial({
      color: 0xd8c08a, roughness: 0.4, metalness: 0.7,
      emissive: 0x3a2f14, emissiveIntensity: 0.6,
    }),
  );
  notch.position.set(0, radius * 0.42, 0.017);
  group.add(notch);

  return group;
}

export function createRadio() {
  const group = new THREE.Group();
  const controls = {};
  const restZ = new Map();

  const bodyMat = new THREE.MeshStandardMaterial({
    map: panelTexture(), color: 0x8d8d8d, roughness: 0.78, metalness: 0.45,
  });

  // Chassis behind the faceplate.
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(FACE_W * 1.02, FACE_H * 1.02, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x101112, roughness: 0.9, metalness: 0.2 }),
  );
  chassis.position.z = -0.072;
  group.add(chassis);

  // Faceplate.
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(FACE_W, FACE_H, 0.012),
    [bodyMat, bodyMat, bodyMat, bodyMat,
     new THREE.MeshStandardMaterial({ map: faceCanvas(), roughness: 0.72, metalness: 0.4 }),
     bodyMat],
  );
  face.position.z = -0.006;
  group.add(face);

  // Heavy weathered bezel around the plate, as in the close-up frames.
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(FACE_W + 0.052, FACE_H + 0.05, 0.020),
    bodyMat,
  );
  bezel.position.z = -0.016;
  group.add(bezel);

  // ---- LCD ----
  const [lx, ly] = px(LCD_RECT.x + LCD_RECT.w / 2, LCD_RECT.y + LCD_RECT.h / 2);
  const [lw, lh] = sz(LCD_RECT.w, LCD_RECT.h);
  const lcdMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(lw, lh),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
  );
  lcdMesh.position.set(lx, ly, 0.0012);
  group.add(lcdMesh);

  // Glass over the display.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(lw + 0.006, lh + 0.006),
    new THREE.MeshPhysicalMaterial({
      transparent: true, opacity: 0.10, roughness: 0.06,
      metalness: 0, transmission: 0.6, color: 0xfff0c0,
    }),
  );
  glass.position.set(lx, ly, 0.004);
  group.add(glass);

  // ---- buttons ----
  for (const key of BUTTONS) {
    const item = LAYOUT[key];
    const [cx, cy] = px(item.c[0], item.c[1]);
    const [w, h] = sz(item.s[0], item.s[1]);
    const cap = buttonCapTexture(item.label, item.s[0], item.s[1]);
    const side = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.8 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.009),
      [side, side, side, side,
       new THREE.MeshStandardMaterial({ map: cap, roughness: 0.68, metalness: 0.25 }),
       side],
    );
    mesh.position.set(cx, cy, 0.0035);
    mesh.userData.control = key;
    restZ.set(key, mesh.position.z);
    controls[key] = mesh;
    group.add(mesh);
  }

  // ---- knobs ----
  for (const key of ['volKnob', 'tuneKnob']) {
    const item = LAYOUT[key];
    const [cx, cy] = px(item.c[0], item.c[1]);
    const knob = buildKnob(item.r * S);
    knob.position.set(cx, cy, 0.004);
    // The raycast target is the knob body, but userData lives on the group too
    // so a hit on any child resolves to the same control.
    knob.traverse((o) => { o.userData.control = key; });
    controls[key] = knob;
    group.add(knob);
  }

  // Cassette slot: a dark cavity plus the tape edge peeking out.
  const [sx, sy] = px(500, 366);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(...sz(280, 52), 0.03),
    new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1 }),
  );
  slot.position.set(sx, sy, -0.016);
  slot.userData.control = 'cassette';
  controls.cassette = slot;
  restZ.set('cassette', slot.position.z);
  group.add(slot);

  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(...sz(268, 34), 0.02),
    new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.85 }),
  );
  tape.position.set(sx, sy, -0.008);
  group.add(tape);

  // ---- behaviour ----

  const pressed = new Map();

  function pressButton(key) {
    const mesh = controls[key];
    if (!mesh || !restZ.has(key)) return;
    pressed.set(key, performance.now());
  }

  function setKnobVolume(volume) {
    controls.tuneKnob.rotation.z = -volumeToAngle(volume, MIN_ANGLE, MAX_ANGLE);
  }

  function setKnobAngle(key, angle) {
    controls[key].rotation.z = angle;
  }

  /** Animates button travel; call once per frame. */
  function update(now) {
    for (const [key, at] of pressed) {
      const t = (now - at) / 160;
      if (t >= 1) {
        controls[key].position.z = restZ.get(key);
        pressed.delete(key);
        continue;
      }
      // Down fast, back up slower.
      const depth = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      controls[key].position.z = restZ.get(key) - depth * 0.005;
    }
  }

  return {
    group,
    controls,
    lcdMesh,
    pressButton,
    setKnobVolume,
    setKnobAngle,
    update,
    /** World position of a control, for the hand to aim at. */
    worldPositionOf(key) {
      const v = new THREE.Vector3();
      controls[key].getWorldPosition(v);
      return v;
    },
  };
}

export { LAYOUT };
