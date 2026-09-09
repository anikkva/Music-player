// The car interior around the radio.
//
// The panorama sphere carries everything beyond the glass; the cabin itself is
// real geometry so the radio sits in an actual dashboard and stays aligned from
// every camera angle. Phase 2's mood-driven passengers slot in here.
//
// Coordinates: x right, y up, z back. The driver's eyes are the origin, so the
// car's windshield is at negative z.

import * as THREE from 'three';
import { dashTexture, upholsteryTexture } from './textures.js';
import { RADIO_POSITION, RADIO_YAW, RADIO_PITCH } from './layout.js';

const dark = (color, roughness = 0.9, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createInterior() {
  const group = new THREE.Group();
  const dash = dashTexture();
  dash.repeat.set(3, 1);
  const cloth = upholsteryTexture();
  cloth.repeat.set(2, 2);

  const dashMat = new THREE.MeshStandardMaterial({ map: dash, color: 0x6a6a6a, roughness: 0.95 });
  const clothMat = new THREE.MeshStandardMaterial({ map: cloth, color: 0x8a8a8a, roughness: 1 });
  const trimMat = dark(0x141414, 0.85);
  const plasticMat = dark(0x1c1a18, 0.8);

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

  // Gauge cluster face.
  const cluster = add(new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.20), dark(0x0a0a0b, 1)),
    -0.44, -0.30, -0.70, 0.22);
  for (const gx of [-0.12, 0.12]) {
    const dial = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.055, 32),
      new THREE.MeshBasicMaterial({ color: 0x2a2419, side: THREE.DoubleSide }),
    );
    dial.position.set(gx, 0, 0.002);
    cluster.add(dial);
  }

  // Dashboard front wall below the pad.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.05), dashMat),
    0, -0.46, -0.79);

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
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 1.5), clothMat),
      sx * 0.98, -0.45, -0.25);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.5), glassMat),
      sx * 0.98, 0.16, -0.25);
    // Door pull.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.26), dark(0x141414, 0.8)),
      sx * 0.92, -0.28, -0.30);
  }

  // Rear bulkhead and back seat, so turning around does not show a void.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.08), clothMat), 0, 0.05, 0.95);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.24), clothMat), 0, -0.42, 0.80, 0.14);

  // Passenger seat (phase 2 puts someone here).
  const seat = new THREE.Group();
  seat.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), clothMat));
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.13), clothMat);
  back.position.set(0, 0.40, 0.24);
  back.rotation.x = -0.16;
  seat.add(back);
  add(seat, 0.72, -0.78, -0.02);

  // Driver's own seat back, visible when looking over the shoulder.
  const own = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.13), clothMat);
  add(own, -0.42, -0.38, 0.30, -0.16);

  // Floor.
  add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 2.4), dark(0x0a0a0a, 1)), 0, -1.05, -0.2);

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
