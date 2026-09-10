// The driver's hands: both on the wheel, and the right one leaving it to work
// the radio.
//
// These live in world space rather than inside the radio's group. The old rig
// was parented to the faceplate, which made every target a faceplate-local
// point — fine while the only thing a hand ever touched was a button on that
// plate, and useless the moment it also has to rest on the steering wheel.
//
// Resting and reaching are two different meshes rather than one mesh that
// changes pose. The resting hands are children of the wheel, so they follow
// the steering for free; the reaching hand is a child of the scene, so its
// travel is a straight world-space interpolation. Swapping which is visible
// reads as the hand coming off the rim, and neither mesh has to do the other's
// job.

import * as THREE from 'three';

const SKIN = 0x9c7050;
const SLEEVE = 0x2e2a24;

const REACH_MS = 400;   // spec: hand enters frame in ~0.4s
const RETURN_MS = 340;
const TOUCH_GAP = 0.004; // how close the fingertip parks to the control
const HOLD_GAP = 0.030;  // and how far back it sits while gripping a knob

// Where the hands sit on the rim, in wheel-local space: ten o'clock and two
// o'clock, a little proud of the rim plane so the fingers are on the driver's
// side of it.
const RIM_RADIUS = 0.185;
const RIM_ANGLES = { left: (150 * Math.PI) / 180, right: (30 * Math.PI) / 180 };
const RIM_LIFT = 0.026;

// Where the driver's shoulders are, in world space. A resting hand is aimed
// at its own shoulder rather than straight out of the wheel's plane: the
// wheel faces the driver's eyes, so an arm along its normal runs directly at
// the camera and fills the frame with forearm.
const SHOULDERS = { left: [-0.64, -0.36, 0.24], right: [-0.20, -0.36, 0.24] };

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;

/**
 * One hand. `grip` curls the index finger in with the others and turns the
 * palm down over the rim; without it the index stays out to press with, and
 * its tip sits at the group origin so placing the group at a control puts the
 * fingertip exactly on it.
 */
function buildHandMesh({ grip = false } = {}) {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.92, metalness: 0.0 });
  const sleeve = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.95 });

  if (!grip) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10), skin);
    root.add(tip);

    const index = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.052, 4, 10), skin);
    index.rotation.x = Math.PI / 2;
    index.position.z = 0.033;
    root.add(index);
  } else {
    // Curled index, wrapping the rim with the rest.
    const index = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.024, 4, 8), skin);
    index.position.set(0.014, -0.022, 0.066);
    index.rotation.set(Math.PI / 2.2, 0, 0.18);
    root.add(index);
  }

  // Knuckle bulge where the fingers meet the hand.
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), skin);
  knuckle.position.z = 0.064;
  root.add(knuckle);

  // Palm, angled back and slightly down from the fingers.
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.028, 0.078), skin);
  palm.position.set(0.018, -0.012, 0.104);
  palm.rotation.set(0.10, -0.20, 0.06);
  root.add(palm);

  // Curled middle, ring and little fingers tucked under the palm.
  for (let i = 0; i < 3; i += 1) {
    const curled = new THREE.Mesh(new THREE.CapsuleGeometry(0.0078, 0.020, 4, 8), skin);
    curled.position.set(0.028 + i * 0.014, -0.024, 0.082 + i * 0.006);
    curled.rotation.set(Math.PI / 2.3, 0, 0.2);
    root.add(curled);
  }

  // Thumb, laid along the near side.
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.030, 4, 10), skin);
  thumb.position.set(-0.012, -0.016, 0.094);
  thumb.rotation.set(Math.PI / 2.6, 0.2, 0.5);
  root.add(thumb);

  // Wrist and forearm running off out of frame.
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.05, 12), skin);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0.026, -0.016, 0.163);
  root.add(wrist);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.038, 0.42, 12), sleeve);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0.042, -0.024, 0.40);
  root.add(arm);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.026, 12), sleeve);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0.030, -0.018, 0.196);
  root.add(cuff);

  root.scale.setScalar(0.85);
  return root;
}

/** A hand parked on the rim, aimed back at its own shoulder. */
function buildRestingHand(side, wheel) {
  const holder = new THREE.Group();
  const angle = RIM_ANGLES[side];
  holder.position.set(Math.cos(angle) * RIM_RADIUS, Math.sin(angle) * RIM_RADIUS, RIM_LIFT);
  holder.add(buildHandMesh({ grip: true }));
  wheel.add(holder);

  // lookAt works in world space, so the wheel has to know where it is first.
  wheel.updateWorldMatrix(true, false);
  holder.lookAt(new THREE.Vector3(...SHOULDERS[side]));
  return holder;
}

/**
 * @param wheel the steering wheel group; the resting hands become its children
 *   so that steering carries them.
 * @param scene the group the reaching hand is added to, in world space.
 */
export function createHands({ wheel, scene }) {
  buildRestingHand('left', wheel);
  const right = buildRestingHand('right', wheel);

  const reach = buildHandMesh({ grip: false });
  reach.visible = false;
  scene.add(reach);

  let anim = null;    // active press
  let holding = null; // gripping a knob

  const restWorld = new THREE.Vector3();
  const restQuat = new THREE.Quaternion();

  /** Where the right hand currently rests, in world space. */
  function readRest() {
    right.getWorldPosition(restWorld);
    right.getWorldQuaternion(restQuat);
  }

  /** Orientation that points the index finger along -normal. */
  function facingQuat(normal) {
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }

  /** Puts the reaching hand between its rim rest and the control. */
  function place(target, normal, t, gap) {
    const to = target.clone().addScaledVector(normal, gap);
    reach.position.lerpVectors(restWorld, to, t);
    reach.quaternion.slerpQuaternions(restQuat, facingQuat(normal), Math.min(1, t * 1.4));
    reach.visible = true;
    right.visible = false;
  }

  function backOnWheel() {
    reach.visible = false;
    right.visible = true;
  }

  /**
   * Reaches out and presses at `target` (world), whose surface faces
   * `normal`. Resolves at the moment of contact, which is when the caller
   * fires the action — the spec is explicit that it happens on touch.
   */
  function pressAt(target, normal) {
    if (anim || holding) return Promise.resolve(false);
    readRest();
    return new Promise((resolve) => {
      anim = {
        target: target.clone(),
        normal: normal.clone().normalize(),
        startedAt: performance.now(),
        touched: false,
        resolve,
      };
    });
  }

  function grabAt(target, normal) {
    if (anim) return false;
    readRest();
    holding = {
      target: target.clone(),
      normal: normal.clone().normalize(),
      spin: 0,
      enteredAt: performance.now(),
    };
    return true;
  }

  function setGrabSpin(spin) {
    if (holding) holding.spin = spin;
  }

  function release() {
    if (!holding) return;
    // Retract along the press animation's return leg.
    anim = {
      target: holding.target,
      normal: holding.normal,
      startedAt: performance.now() - REACH_MS,
      touched: true,
      resolve: null,
    };
    holding = null;
  }

  function update(now) {
    if (holding) {
      const t = easeOut(Math.min(1, (now - holding.enteredAt) / REACH_MS));
      place(holding.target, holding.normal, t, HOLD_GAP);
      reach.rotateZ(holding.spin);
      return;
    }

    if (!anim) {
      backOnWheel();
      return;
    }

    const elapsed = now - anim.startedAt;

    if (elapsed < REACH_MS) {
      place(anim.target, anim.normal, easeOut(elapsed / REACH_MS), TOUCH_GAP);
      return;
    }

    if (!anim.touched) {
      anim.touched = true;
      place(anim.target, anim.normal, 1, TOUCH_GAP);
      anim.resolve?.(true);
      return;
    }

    const t = (elapsed - REACH_MS) / RETURN_MS;
    if (t >= 1) {
      anim = null;
      backOnWheel();
      return;
    }
    place(anim.target, anim.normal, 1 - easeIn(t), TOUCH_GAP);
  }

  return {
    pressAt,
    grabAt,
    setGrabSpin,
    release,
    update,
    /** While a hand is moving, further clicks are ignored. */
    isBusy: () => anim !== null,
    isHolding: () => holding !== null,
  };
}
