// The car interior around the radio.
//
// The panorama sphere carries everything beyond the glass; the cabin itself is
// real geometry so the radio sits in an actual dashboard and stays aligned from
// every camera angle. Phase 2's mood-driven passengers slot in here.
//
// Coordinates: x right, y up, z back. The driver's eyes are the origin, so the
// car's windshield is at negative z.

import * as THREE from 'three';
import { dashTexture, upholsteryTexture, gaugeTexture, grilleTexture } from './textures.js';
import { RADIO_POSITION, RADIO_YAW, RADIO_PITCH } from './layout.js';

const dark = (color, roughness = 0.9, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createInterior() {
  const group = new THREE.Group();
  const dash = dashTexture();
  dash.repeat.set(3, 1);
  const cloth = upholsteryTexture();
  cloth.repeat.set(2, 2);

  const dashMat = new THREE.MeshStandardMaterial({ map: dash, color: 0x8a8a8a, roughness: 0.95 });
  const clothMat = new THREE.MeshStandardMaterial({ map: cloth, color: 0x7c7c7c, roughness: 1 });
  const trimMat = dark(0x141414, 0.85);
  const plasticMat = dark(0x2b2825, 0.8);

  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
    return mesh;
  };

  // ---- dashboard ----

  // Top pad, raked away from the driver toward the windshield.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.5), dashMat),
    0, -0.24, -1.02, -0.13);

  // Instrument binnacle hood over the gauges.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.30), dashMat),
    -0.44, -0.20, -0.72, -0.30);

  // Gauge cluster: the second lit thing in the cabin after the display, and
  // the main reason the driver's side is readable at all.
  const cluster = add(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.21), dark(0x08080a, 1)),
    -0.44, -0.30, -0.70, 0.22);

  const dials = [
    { x: -0.115, tex: gaugeTexture('RPM', 8, 1), needle: 0.28 },
    { x: 0.115, tex: gaugeTexture('MPH', 160, 20), needle: 0.0 },
  ];
  for (const d of dials) {
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.072, 40),
      new THREE.MeshBasicMaterial({ map: d.tex, toneMapped: false }),
    );
    face.position.set(d.x, 0.005, 0.004);
    cluster.add(face);

    // Needle, parked just past the pin.
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.062, 0.002),
      new THREE.MeshBasicMaterial({ color: 0xe4553a, toneMapped: false }),
    );
    needle.position.set(d.x, 0.005, 0.006);
    needle.geometry.translate(0, 0.026, 0);
    needle.rotation.z = (220 * Math.PI) / 180 - Math.PI / 2 - d.needle;
    cluster.add(needle);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.072, 0.080, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6, side: THREE.DoubleSide }),
    );
    rim.position.set(d.x, 0.005, 0.005);
    cluster.add(rim);
  }

  // Small warning lamps between the dials.
  for (let i = 0; i < 3; i += 1) {
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.006, 12),
      new THREE.MeshBasicMaterial({
        color: [0xe4553a, 0x7ad07a, 0xffb347][i], toneMapped: false,
      }),
    );
    lamp.position.set(-0.014 + i * 0.014, -0.052, 0.005);
    cluster.add(lamp);
  }

  // The cluster's own backlight, so it pools onto the wheel and the driver's
  // side of the dash.
  const clusterGlow = new THREE.PointLight(0xffb15e, 0.055, 1.1, 2);
  clusterGlow.position.set(-0.44, -0.28, -0.60);
  group.add(clusterGlow);

  // Dashboard front wall below the pad, split around the centre stack. A
  // single full-width panel passes straight through the turned radio and eats
  // its left-hand side.
  add(new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.42, 0.05), dashMat),
    -0.45, -0.46, -0.79);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), dashMat),
    0.79, -0.46, -0.79);

  // ---- centre stack ----
  //
  // Built in the radio's own rotated frame: the head unit is turned toward the
  // driver, and a flat, axis-aligned console front would cut straight through
  // its far side.

  const stack = new THREE.Group();
  stack.position.set(...RADIO_POSITION);
  stack.rotation.order = 'YXZ';
  stack.rotation.y = RADIO_YAW;
  stack.rotation.x = RADIO_PITCH;
  group.add(stack);

  const stackAdd = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    stack.add(mesh);
    return mesh;
  };

  // Console face the radio is recessed into. Sits behind the faceplate in the
  // same plane, so the two never intersect.
  stackAdd(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.06), plasticMat),
    0, -0.02, -0.055);

  // Air vents above the radio.
  const vents = stackAdd(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.09, 0.04), dark(0x101010, 0.95)),
    0, 0.155, -0.030);
  for (let i = 0; i < 7; i += 1) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.006, 0.012),
      dark(0x2c2c2c, 0.7, 0.3),
    );
    fin.position.set(0, -0.036 + i * 0.012, 0.022);
    vents.add(fin);
  }

  // HVAC knobs below the radio.
  for (const kx of [-0.12, 0, 0.12]) {
    const knob = stackAdd(new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.020, 0.024, 12), dark(0x141414, 0.7, 0.3),
    ), kx, -0.155, -0.014, Math.PI / 2);
    knob.rotation.z = kx;
  }

  // Console running down to the gear lever.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.55), plasticMat),
    0.34, -0.70, -0.42, 0.25);
  const lever = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.20, 10), dark(0x0e0e0e, 0.6)),
    0.34, -0.62, -0.30, -0.22);
  const knobTop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), dark(0x241a12, 0.55, 0.2));
  knobTop.position.y = 0.11;
  lever.add(knobTop);

  // ---- steering wheel ----

  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.018, 12, 40), dark(0x141210, 0.95)));
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.17, 0.014), dark(0x1a1917, 0.85, 0.25));
    spoke.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20), dark(0x111010, 0.9));
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  add(wheel, -0.42, -0.40, -0.44, -0.42);

  // Steering column.
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.28, 12), dark(0x0d0d0d, 0.95)),
    -0.42, -0.50, -0.58, Math.PI / 2 - 0.42);

  // ---- cabin shell ----

  // Windshield glass, raked. Nearly transparent: the panorama shows through it.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fb4c4, transparent: true, opacity: 0.06,
    roughness: 0.08, metalness: 0, side: THREE.DoubleSide,
  });
  add(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), glassMat), 0, 0.10, -1.28, 0.46);

  // Roof and headliner.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 2.2), clothMat), 0, 0.60, -0.20);

  // Windshield header.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.13, 0.08), clothMat), 0, 0.51, -1.24, 0.42);

  // A-pillars.
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.95, 0.09), clothMat),
      sx * 0.94, 0.13, -1.06, 0.46, 0, sx * 0.10);
  }

  // Door cards with a window aperture above them.
  const grille = grilleTexture();
  const grilleMat = new THREE.MeshStandardMaterial({ map: grille, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 1.5), clothMat),
      sx * 0.98, -0.45, -0.25);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.5), glassMat),
      sx * 0.98, 0.16, -0.25);

    // Window sill / belt line.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.045, 1.5), dark(0x191714, 0.85)),
      sx * 0.96, -0.13, -0.25);

    // Armrest with a moulded grab pull.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.44), dark(0x1c1a17, 0.85)),
      sx * 0.92, -0.30, -0.28);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), dark(0x121110, 0.8)),
      sx * 0.87, -0.31, -0.34);

    // Speaker grille low on the card.
    const speaker = add(new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), grilleMat),
      sx * 0.935, -0.60, -0.42, 0, sx * -Math.PI / 2);
    speaker.material.side = THREE.DoubleSide;

    // Window switches and the door handle.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.10), dark(0x25231f, 0.7, 0.2)),
      sx * 0.91, -0.255, -0.16);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.13), dark(0x6d6a60, 0.45, 0.75)),
      sx * 0.91, -0.24, -0.55);

    // Grab handle above the window line.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.20), dark(0x201d19, 0.9)),
      sx * 0.93, 0.40, -0.10);

    // Sun visor, folded up against the headliner.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.016, 0.19), clothMat),
      sx * 0.40, 0.545, -1.05, 0.34);
  }

  // Rear bulkhead and back seat, so turning around does not show a void.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.08), clothMat), 0, 0.05, 0.95);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.24), clothMat), 0, -0.42, 0.80, 0.14);

  // Seats. Bolsters and a headrest read as a seat from the corner of the eye;
  // a bare slab does not. Phase 2 puts a passenger in the right-hand one.
  const buildSeat = () => {
    const seat = new THREE.Group();
    seat.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.48), clothMat));
    for (const bx of [-0.245, 0.245]) {
      const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.46), clothMat);
      bolster.position.set(bx, 0.02, 0);
      seat.add(bolster);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.66, 0.12), clothMat);
    back.position.set(0, 0.36, 0.23);
    back.rotation.x = -0.16;
    seat.add(back);
    for (const bx of [-0.245, 0.245]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.17), clothMat);
      wing.position.set(bx, 0.35, 0.20);
      wing.rotation.x = -0.16;
      seat.add(wing);
    }
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.11), clothMat);
    headrest.position.set(0, 0.76, 0.16);
    headrest.rotation.x = -0.16;
    seat.add(headrest);
    return seat;
  };

  add(buildSeat(), 0.72, -0.80, -0.02);
  add(buildSeat(), -0.52, -0.80, 0.06);

  // Seatbelt webbing running down the B-pillar side of the driver's seat.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.62, 0.05), dark(0x141210, 1)),
    -0.80, -0.20, 0.10, -0.10, 0, 0.12);

  // Handbrake, cup holders and the glovebox seam — small things, but an empty
  // console reads as an unfinished model.
  const brake = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.020, 0.22, 10), dark(0x1b1a18, 0.7)),
    0.34, -0.60, -0.06, -0.75);
  const brakeGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), dark(0x0f0e0d, 0.85));
  brakeGrip.position.y = 0.09;
  brake.add(brakeGrip);

  for (const cz of [0.10, 0.22]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16), dark(0x0b0b0b, 1)),
      0.34, -0.63, cz);
  }

  // Glovebox lid on the passenger side.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.20, 0.03), dashMat),
    0.84, -0.44, -0.775);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), dark(0x6d6a60, 0.45, 0.75)),
    0.84, -0.36, -0.76);

  // Floor and a mat under the pedals.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 2.4), dark(0x0a0a0a, 1)), 0, -1.05, -0.2);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.55), clothMat), -0.42, -1.01, -0.72);

  // ---- rear-view mirror with the dice ----

  const mirror = add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.075, 0.03), dark(0x1a1a1a, 0.7)),
    0.02, 0.42, -1.06, 0.10);
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.062),
    new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.12, metalness: 0.9 }),
  );
  mirrorGlass.position.z = 0.017;
  mirror.add(mirrorGlass);

  const diceMat = new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.7 });
  const pipMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const [dx, dz, drop] of [[-0.035, 0.01, 0.14], [0.035, -0.01, 0.17]]) {
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, drop, 6), dark(0x3a3020, 1),
    );
    string.position.set(0.02 + dx, 0.42 - drop / 2, -1.03 + dz);
    group.add(string);

    const die = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), diceMat);
    die.position.set(0.02 + dx, 0.42 - drop - 0.025, -1.03 + dz);
    die.rotation.set(0.4 + dx, 0.7, 0.25);
    for (const [px2, py2] of [[-0.014, 0.014], [0.014, -0.014], [0, 0]]) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), pipMat);
      pip.position.set(px2, py2, 0.0255);
      die.add(pip);
    }
    group.add(die);
  }

  return { group };
}
