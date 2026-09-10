// The illusion that the car is moving.
//
// At night the far world barely moves and the near world flies past. So the
// panorama sphere is left alone — it is the distant city and it is right for
// it to stand still — and only the near zone is animated: street lamps
// sweeping through the cabin, light smears scrolling past the side glass, and
// the road surface under the windshield.
//
// The camera shake that completes the effect lives in camera.js instead, since
// only there is it known where the head points after its limits are applied.
//
// Coordinates match interior.js: x right, y up, z back, driver's eyes at the
// origin, so the car travels toward -z and the world moves toward +z.

import * as THREE from 'three';
import { roadsideTexture, roadTexture } from './textures.js';

// One number for the mood of the drive: metres per second the world moves
// past. 11 m/s is about 40 km/h — fast enough to read as motion, slow enough
// that a lamp lingers on the passenger's face instead of strobing.
const SPEED = 11;

const LAMP_COUNT = 3;
const LAMP_SPACING = 13;          // metres between lamps along the street
// Nothing may be placed further out than the panorama sphere's 30 m radius:
// beyond it the sphere's own inner surface is nearer to the camera and hides
// whatever is out there, so a lamp would pop into being at the horizon.
const LAMP_AHEAD = -26;           // where a lamp fades in, ahead of the car
const LAMP_BEHIND = 13;           // and where it fades out, behind it
const LAMP_FADE = 8;              // metres of fade at each end
const LAMP_HEIGHT = 2.5;
const LAMP_SIDE = 3.6;            // how far out from the car the posts stand

const SODIUM = 0xffb768;

const CYCLE = LAMP_BEHIND - LAMP_AHEAD;

/** Fade a lamp in as it appears ahead and out as it drops behind. */
function lampEnvelope(z) {
  const fromStart = z - LAMP_AHEAD;
  const toEnd = LAMP_BEHIND - z;
  return Math.min(1, Math.max(0, Math.min(fromStart, toEnd) / LAMP_FADE));
}

export function createDriving() {
  const group = new THREE.Group();

  // ---- street lamps ----
  //
  // These are what actually sell the drive: a warm pool that crawls up the
  // dashboard, over the passenger and away behind the seats. Most of them are
  // on the right, matching the static streetlight the scene already has.

  const lamps = [];
  for (let i = 0; i < LAMP_COUNT; i += 1) {
    const side = i === LAMP_COUNT - 1 ? -1 : 1;

    const light = new THREE.PointLight(SODIUM, 0, 30, 2);
    group.add(light);

    // The lamp head itself, so something visibly passes the window rather
    // than an unexplained moving glow.
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }),
    );
    group.add(head);

    lamps.push({
      light,
      head,
      x: side * LAMP_SIDE,
      offset: i * LAMP_SPACING,
    });
  }

  // ---- roadside smears past the side windows ----

  const sides = [];
  for (const sx of [-1, 1]) {
    const tex = roadsideTexture();
    tex.repeat.set(2, 1);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 2.4),
      new THREE.MeshBasicMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    // Turned to face the car — note the sign: a plane looks along +z, and
    // turning it by +90° on the right-hand side would point it out at the
    // city instead of in at the driver.
    plane.rotation.y = -sx * (Math.PI / 2);
    // Kept short and well out to the side. A long plane reaches toward the
    // vanishing point and its far end drifts into the middle of the
    // windshield, where the smears read as dirt on the glass instead of as
    // scenery going by.
    plane.position.set(sx * 6.0, -0.45, -2);
    group.add(plane);
    sides.push(tex);
  }

  // ---- road surface ----

  const road = roadTexture();
  road.repeat.set(1, 6);
  const roadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 40),
    new THREE.MeshBasicMaterial({
      map: road,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(0, -1.42, -10);
  group.add(roadMesh);

  // How far the world has travelled, in metres. Kept as its own accumulator
  // rather than derived from the clock, so a tab that was backgrounded does
  // not resume with the scenery teleported.
  let travelled = 0;

  function update(dt) {
    travelled += SPEED * Math.min(dt, 0.1);

    for (const lamp of lamps) {
      const z = LAMP_AHEAD + ((travelled + lamp.offset) % CYCLE);
      const env = lampEnvelope(z);
      lamp.light.position.set(lamp.x, LAMP_HEIGHT, z);
      lamp.light.intensity = 140 * env;
      lamp.head.position.set(lamp.x, LAMP_HEIGHT, z);
      lamp.head.visible = env > 0.02;
      lamp.head.scale.setScalar(0.6 + env * 0.4);
    }

    // Texture offsets run the other way from the car, and are wrapped by hand
    // so the float never grows large enough to lose precision.
    for (const tex of sides) tex.offset.x = (travelled / 22) % 1;
    road.offset.y = (travelled / 10) % 1;
  }

  /**
   * Small steering correction, in radians. The driver is holding a lane, not
   * cornering — this is the wheel's share of the sway that camera.js applies
   * to the head.
   */
  function steer(now) {
    return Math.sin(now / 2300) * 0.07 + Math.sin(now / 811) * 0.018;
  }

  return { group, update, steer };
}
