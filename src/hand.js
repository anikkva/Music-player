// A low-poly hand that reaches into frame to work the radio.
//
// It lives inside the radio's own group, so all of its motion is expressed in
// faceplate-local coordinates and stays correct from any camera angle.
// The trade-off is stated in the spec: next to the panel it reads as simpler
// geometry, but a photoreal hand would need 3D assets we do not have.

import * as THREE from 'three';

const SKIN = 0x9c7050;
const SLEEVE = 0x2e2a24;

// The driver's own right hand, coming up from the gear lever: down and to the
// right of the plate, as in the wide reference frame. Approaching head-on
// would collapse the forearm into a blob under perspective, and approaching
// from the left would drag it across the display mid-press.
const APPROACH = new THREE.Vector3(0.52, -0.62, 0.78).normalize();

const REACH_MS = 400;   // spec: hand enters frame in ~0.4s
const RETURN_MS = 340;
const REST_DIST = 0.42; // how far back the hand parks, along APPROACH
const TOUCH_DIST = 0.004;
const HOLD_DIST = 0.030;

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;

function buildHandMesh() {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.92, metalness: 0.0 });
  const sleeve = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.95 });

  // Index finger: tip sits at the group origin, so positioning the group at a
  // control puts the fingertip exactly on it.
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10), skin);
  root.add(tip);

  const index = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.052, 4, 10), skin);
  index.rotation.x = Math.PI / 2;
  index.position.z = 0.033;
  root.add(index);

  // Knuckle bulge where the finger meets the hand.
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), skin);
  knuckle.position.z = 0.064;
  root.add(knuckle);

  // Palm, angled back and slightly down from the pointing finger.
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

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.044, 0.42, 12), sleeve);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0.042, -0.024, 0.40);
  root.add(arm);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.026, 12), sleeve);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0.030, -0.018, 0.196);
  root.add(cuff);

  return root;
}

export function createHand() {
  const group = new THREE.Group();
  const mesh = buildHandMesh();
  mesh.scale.setScalar(0.85);
  group.add(mesh);
  group.visible = false;

  let anim = null;   // active press animation
  let holding = null; // { position } while gripping a knob

  const place = (target, dist, spin = 0) => {
    group.position.copy(target).addScaledVector(APPROACH, dist);
    group.rotation.z = spin;
    group.visible = true;
  };

  /**
   * Reaches out and presses at `target` (faceplate-local). The promise
   * resolves at the moment of contact, which is when the caller should fire
   * the actual action — the spec is explicit that the action happens on touch.
   */
  function pressAt(target) {
    if (anim || holding) return Promise.resolve(false);
    return new Promise((resolve) => {
      anim = {
        target: target.clone(),
        startedAt: performance.now(),
        touched: false,
        resolve,
      };
    });
  }

  function grabAt(target) {
    if (anim) return false;
    holding = { target: target.clone(), spin: 0, enteredAt: performance.now() };
    return true;
  }

  function setGrabSpin(spin) {
    if (holding) holding.spin = spin;
  }

  function release() {
    if (!holding) return;
    // Retract using the press animation's return leg.
    anim = {
      target: holding.target,
      startedAt: performance.now() - REACH_MS,
      touched: true,
      resolve: null,
    };
    holding = null;
  }

  function update(now) {
    if (holding) {
      const t = Math.min(1, (now - holding.enteredAt) / REACH_MS);
      const dist = REST_DIST + (HOLD_DIST - REST_DIST) * easeOut(t);
      place(holding.target, dist, holding.spin);
      return;
    }

    if (!anim) {
      group.visible = false;
      return;
    }

    const elapsed = now - anim.startedAt;

    if (elapsed < REACH_MS) {
      const t = easeOut(elapsed / REACH_MS);
      place(anim.target, REST_DIST + (TOUCH_DIST - REST_DIST) * t);
      return;
    }

    if (!anim.touched) {
      anim.touched = true;
      place(anim.target, TOUCH_DIST);
      anim.resolve?.(true);
      return;
    }

    const t = (elapsed - REACH_MS) / RETURN_MS;
    if (t >= 1) {
      anim = null;
      group.visible = false;
      return;
    }
    place(anim.target, TOUCH_DIST + (REST_DIST - TOUCH_DIST) * easeIn(t));
  }

  return {
    group,
    pressAt,
    grabAt,
    setGrabSpin,
    release,
    update,
    /** While the hand is moving, further clicks are ignored. */
    isBusy: () => anim !== null,
    isHolding: () => holding !== null,
  };
}
