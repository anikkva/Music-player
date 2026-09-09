// The passenger in the right-hand seat, and the driver's own legs.
//
// Built from primitives like the rest of the cabin, but with enough joints —
// waist, knees, elbows, ankles — that it reads as a seated person rather than
// a stack of boxes. Local origin is the hip point, +y up and -z forward, so
// the group can be dropped onto a seat and turned.

import * as THREE from 'three';

// Values, not swatches: the cabin is lit brightly enough that a literal skin
// tone blows out to white, and a matte black dress disappears into the seat.
const DRESS = 0x2e2e39;
const SKIN = 0x8a6446;
const HAIR = 0x171110;
const SHOE = 0x08080a;

const dressMat = () => new THREE.MeshStandardMaterial({
  color: DRESS, roughness: 0.44, metalness: 0.0, // satin sheen, no env map to reflect
});
const skinMat = () => new THREE.MeshStandardMaterial({
  color: SKIN, roughness: 0.92, metalness: 0.0,
});
const hairMat = () => new THREE.MeshStandardMaterial({
  color: HAIR, roughness: 0.65, metalness: 0.05,
});

function limb(group, mat, radiusTop, radiusBottom, length, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, dir.length(), 14),
    mat,
  );
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  group.add(mesh);
  return mesh;
}

const joint = (group, mat, r, at) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat);
  mesh.position.copy(at);
  group.add(mesh);
  return mesh;
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createPassenger() {
  const group = new THREE.Group();
  const dress = dressMat();
  const skin = skinMat();
  const hair = hairMat();

  // ---- torso ----

  // Hips, under the skirt.
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.24), dress);
  hips.position.set(0, 0.02, 0.02);
  group.add(hips);

  // Waist tapering up to the ribcage.
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.20, 18), dress);
  waist.position.set(0, 0.19, 0.01);
  waist.rotation.x = -0.06;
  group.add(waist);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.115, 0.20, 18), dress);
  chest.position.set(0, 0.375, -0.005);
  chest.rotation.x = -0.06;
  group.add(chest);

  // Shoulders and the neckline of the dress.
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.30, 12), dress);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.set(0, 0.465, -0.01);
  group.add(shoulders);

  // Bare shoulders and collarbone above the dress.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 12), skin);
  collar.rotation.z = Math.PI / 2;
  collar.position.set(0, 0.487, -0.012);
  group.add(collar);

  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.10, 0.012), dress);
    strap.position.set(side * 0.088, 0.465, -0.052);
    strap.rotation.set(0.10, 0, side * 0.16);
    group.add(strap);
  }

  // ---- short skirt, flaring over the hips ----

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.150, 0.235, 0.26, 26, 1, true), dress);
  skirt.material.side = THREE.DoubleSide;
  skirt.position.set(0, 0.03, -0.03);
  skirt.rotation.x = 0.55; // seated, so it lies along the thighs
  group.add(skirt);

  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.233, 0.012, 8, 30), dress);
  hem.position.set(0, -0.035, -0.100);
  hem.rotation.x = Math.PI / 2 + 0.55;
  group.add(hem);

  // ---- head ----

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.049, 0.13, 12), skin);
  neck.position.set(0, 0.552, -0.005);
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.092, 22, 18), skin);
  head.position.set(0, 0.695, -0.015);
  head.scale.set(0.92, 1.12, 1.0);
  group.add(head);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), skin);
  jaw.position.set(0, 0.645, -0.045);
  jaw.scale.set(0.95, 0.85, 0.9);
  group.add(jaw);

  // Face. Small, but without it the head reads as a bare sphere.
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.4 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.35 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 10), eyeWhite);
    eye.position.set(side * 0.034, 0.708, -0.090);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 10, 8), iris);
    pupil.position.set(side * 0.036, 0.708, -0.100);
    group.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.005, 0.006), hair);
    brow.position.set(side * 0.035, 0.731, -0.093);
    brow.rotation.z = side * -0.10;
    group.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.030, 8), skin);
  nose.position.set(0, 0.683, -0.093);
  nose.rotation.x = -Math.PI / 2 + 0.35;
  group.add(nose);
  const lips = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a2f30, roughness: 0.42 }));
  lips.position.set(0, 0.653, -0.086);
  lips.scale.set(1.25, 0.5, 0.5);
  group.add(lips);

  // Hair: a cap over the skull, cut back off the forehead, plus length falling
  // behind the shoulders. A full hemisphere reads as a helmet.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.096, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  cap.position.set(0, 0.697, 0.002);
  cap.scale.set(1.02, 1.02, 1.06);
  cap.rotation.x = -0.09;
  group.add(cap);

  // Side sweep framing the face.
  for (const side of [-1, 1]) {
    const sweep = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.020, 0.16, 10), hair);
    sweep.position.set(side * 0.082, 0.665, -0.020);
    sweep.rotation.set(0.10, 0, side * 0.14);
    sweep.scale.set(1, 1, 0.7);
    group.add(sweep);
  }

  const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.062, 0.24, 16), hair);
  fall.position.set(0, 0.605, 0.062);
  fall.scale.set(1.0, 1.0, 0.55);
  group.add(fall);

  // A strand in front of the near shoulder.
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.19, 10), hair);
  strand.position.set(-0.072, 0.600, -0.052);
  strand.rotation.set(0.16, 0, 0.08);
  group.add(strand);

  // ---- legs: thighs forward, knees, shins down, angled toward the door ----

  for (const side of [-1, 1]) {
    const hip = V(side * 0.085, -0.02, -0.02);
    const knee = V(side * 0.105, -0.075, -0.36);
    const ankle = V(side * 0.128, -0.42, -0.44);

    limb(group, skin, 0.063, 0.048, 0, hip, knee);   // thigh
    joint(group, skin, 0.046, knee);
    limb(group, skin, 0.041, 0.028, 0, knee, ankle); // shin
    joint(group, skin, 0.028, ankle);

    // Foot in a heel.
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.036, 0.15), new THREE.MeshStandardMaterial({
      color: SHOE, roughness: 0.35, metalness: 0.15,
    }));
    foot.position.set(side * 0.130, -0.448, -0.505);
    foot.rotation.x = 0.22;
    group.add(foot);

    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.008, 0.075, 8), new THREE.MeshStandardMaterial({
      color: SHOE, roughness: 0.35, metalness: 0.15,
    }));
    heel.position.set(side * 0.130, -0.492, -0.448);
    group.add(heel);
  }

  // ---- arms, resting in the lap ----

  for (const side of [-1, 1]) {
    const shoulder = V(side * 0.148, 0.462, -0.012);
    const elbow = V(side * 0.170, 0.235, -0.045);
    const wrist = V(side * 0.130, 0.075, -0.175);

    joint(group, skin, 0.038, shoulder);
    limb(group, skin, 0.033, 0.026, 0, shoulder, elbow);
    joint(group, skin, 0.026, elbow);
    limb(group, skin, 0.025, 0.020, 0, elbow, wrist);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.024, 0.085), skin);
    hand.position.set(side * 0.120, 0.062, -0.215);
    hand.rotation.set(0.25, side * 0.12, 0);
    group.add(hand);
  }

  return { group };
}

/**
 * The driver's own knees, seen when looking down. Just enough to place the
 * viewer's body in the seat — the rest of the driver is behind the camera.
 */
export function createDriverLegs() {
  const group = new THREE.Group();
  const denim = new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.95 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.7 });

  for (const side of [-1, 1]) {
    const x = -0.42 + side * 0.145;
    const hip = V(x, -0.60, 0.16);
    const knee = V(x + side * 0.02, -0.66, -0.30);
    const ankle = V(x + side * 0.01, -0.99, -0.46);

    limb(group, denim, 0.098, 0.078, 0, hip, knee);
    joint(group, denim, 0.076, knee);
    limb(group, denim, 0.070, 0.052, 0, knee, ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.24), shoe);
    foot.position.set(x + side * 0.01, -1.00, -0.55);
    foot.rotation.x = 0.12;
    group.add(foot);
  }

  return { group };
}
