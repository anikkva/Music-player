// The driver — the body the camera is sitting in.
//
// Until now the viewer was a floating eye with a pair of hand-built hands. This
// is a scanned, rigged man, folded into the driver's seat with his own hands on
// the wheel, so looking down shows a body rather than a void.
//
// His head is collapsed rather than hidden. The camera sits inside it, and a
// skinned mesh cannot have part of itself switched off — but scaling the head
// bone to nothing takes the whole head with it and leaves the neck intact.
//
// Arms are solved, not keyframed. Both hands are driven to a target by cyclic
// coordinate descent: point each bone in the chain a little more toward the
// goal, repeat. It needs no knowledge of how the rig's bind axes are laid out,
// which is the thing that makes hand-written euler poses so brittle, and the
// same solver that parks a hand on the rim also carries it to a button.

import * as THREE from 'three';
import { WORLD_X, rotateWorld, solveChain, sitDown, curlFingers } from './pose.js';

const MODEL = 'assets/models/driver/driver.glb';
const B = 'rp_nathan_animated_003_walking_';

const BONES = {
  hip: `${B}hip_02`,
  spine1: `${B}spine_01_03`,
  spine2: `${B}spine_02_04`,
  spine3: `${B}spine_03_05`,
  neck: `${B}neck_06`,
  head: `${B}head_07`,
  shoulderL: `${B}shoulder_l_023`,
  upperArmL: `${B}upperarm_l_024`,
  lowerArmL: `${B}lowerarm_l_025`,
  handL: `${B}hand_l_026`,
  shoulderR: `${B}shoulder_r_048`,
  upperArmR: `${B}upperarm_r_049`,
  lowerArmR: `${B}lowerarm_r_050`,
  handR: `${B}hand_r_051`,
  upperLegL: `${B}upperleg_l_074`,
  lowerLegL: `${B}lowerleg_l_075`,
  footL: `${B}foot_l_076`,
  upperLegR: `${B}upperleg_r_081`,
  lowerLegR: `${B}lowerleg_r_082`,
  footR: `${B}foot_r_083`,
};

// Finger chains, thumb first. Each is three joints plus the tip the solver
// aims: index_01 -> index_02 -> index_03, and index_end as the fingertip.


// How tall he ends up, in metres. His own units are not trusted: this glTF
// already carries a scale on its root node, so multiplying by a fixed
// centimetre factor made him four centimetres tall. Measure, then fit.
const TARGET_HEIGHT = 1.78;

// He is anchored by the eye, not the hip. The camera cannot move, so if his
// head lands anywhere but the origin the view ends up inside his chest. The
// offset is from the head bone's pivot to the eyes: up the skull and forward,
// and he faces -z.
const HEAD_BONE_AT = new THREE.Vector3(0, -0.085, 0.085);

// The bench's cushion, and how far he may be lifted off the eye anchor to
// keep his lap out of it.
//
// A 1.78 m man seated puts his hip about 0.76 m below his eyes; this cabin
// puts its cushion 0.65 m below them. Anchored purely by the eye he sinks
// eleven centimetres into the seat, and his thighs — the thing you look down
// to see — are inside the upholstery. Raising him closes that: the camera ends
// up nearer his mouth than his eyes, which nobody can see, because his head is
// not drawn.
const CUSHION_Y = -0.65;

// Bodies are not points. The hip bone sits inside the pelvis, so putting the
// bone exactly on the cushion leaves the seat of his jeans and the underside
// of his thighs inside the upholstery. Six centimetres of clearance is about
// the radius of a thigh and takes the intersection out of the picture.
const SEAT_CLEARANCE = 0.06;
const MAX_LIFT = 0.18;
const FLOOR_Y = -0.96;

// A slight lean into the wheel. His scan stands bolt upright, and from that
// posture the rim is a few centimetres beyond his fingertips — a driver leans
// in, and so does he.
const SPINE_LEAN = [['spine1', 0.10], ['spine2', 0.06], ['spine3', 0.04]];

// A rough first fold, only so the solver starts from something seated rather
// than from a man standing up through the roof. The angles that matter — how
// level the thighs are and where the heels land — are solved afterwards.
const LEG_FOLD = [
  ['upperLegL', 1.10], ['upperLegR', 1.10],
  ['lowerLegL', -0.60], ['lowerLegR', -0.60],
  ['footL', -0.40], ['footR', -0.40],
];

// Hands on the rim: ten o'clock and four o'clock, matching where the radio is.
const RIM_ANGLES = { left: (150 * Math.PI) / 180, right: (-52 * Math.PI) / 180 };
const RIM_LIFT = 0.03;

const REACH_MS = 420;
const RETURN_MS = 360;
const TOUCH_GAP = 0.02;

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;

/**
 * Finds the finger chains for one hand.
 *
 * By pattern, not by arithmetic: the rig numbers its joints consecutively
 * almost everywhere, and then does not — the left middle finger's first joint
 * is `middle_01_l_00` where every neighbour would predict `_035`. Names are
 * the only thing that can be trusted.
 */
function handFingers(bones, side) {
  const s = side === 'left' ? 'l' : 'r';
  const names = [...bones.keys()];
  const pick = (finger, part) => {
    const re = new RegExp(`_${finger}_${part}_${s}_\\d+$`);
    return bones.get(names.find((n) => re.test(n)));
  };

  return ['thumb', 'index', 'middle', 'ring', 'pinky'].map((finger) => ({
    joints: ['01', '02', '03'].map((k) => pick(finger, k)),
    tip: pick(finger, 'end'),
    // The thumb closes across the rim rather than around it, so it curls less.
    curl: finger === 'thumb' ? 0.45 : 1,
  }));
}

/**
 * @param wheel the empty standing in for the steering wheel; its rim radius
 *   says where the hands go.
 */
export function createDriver({ wheel }) {
  const group = new THREE.Group();
  const bones = new Map();
  const bone = (key) => bones.get(BONES[key]);

  let ready = null;
  let anim = null;      // an active reach, or null while both hands rest
  const restRight = new THREE.Vector3();
  const goal = new THREE.Vector3();

  // The posture he returns to. Every frame of a reach is solved from this
  // rather than from the frame before: descent applied on top of itself
  // accumulates, and he ends a press permanently hunched over the console with
  // his shoulder filling the frame.
  const restPose = new Map();
  const rememberRest = (chain) => {
    for (const [b] of chain) if (b && !restPose.has(b)) restPose.set(b, b.quaternion.clone());
  };
  const recallRest = (chain) => {
    for (const [b] of chain) { const q = restPose.get(b); if (q) b.quaternion.copy(q); }
  };

  /** The world point a hand rests at on the rim. */
  function rimPoint(side, into) {
    const a = RIM_ANGLES[side];
    const r = wheel.userData.rimRadius ?? 0.2;
    into.set(Math.cos(a) * r, Math.sin(a) * r, RIM_LIFT);
    wheel.updateWorldMatrix(true, false);
    return into.applyMatrix4(wheel.matrixWorld);
  }

  /** The arm alone — enough to park a hand on the rim. */
  function armChain(side) {
    return side === 'left'
      ? [[bone('lowerArmL'), 0.5], [bone('upperArmL'), 0.5], [bone('shoulderL'), 0.4]]
      : [[bone('lowerArmR'), 0.5], [bone('upperArmR'), 0.5], [bone('shoulderR'), 0.4]];
  }

  /**
   * The arm plus the back. The radio is about 0.9 m from his shoulder and his
   * arm is 0.6 m long, so without the spine he waves at it from a distance;
   * with it, he leans over the way anyone reaching across a car does.
   */
  function reachChain() {
    // Weighted so the elbow does the work. The shoulder and the upper arm are
    // the parts closest to the camera, and letting them swing sends a mass of
    // forearm across the middle of the frame just as the driver is trying to
    // watch what he is pressing. Descent still reaches the button — damping
    // changes how fast each joint gives, not where the hand can end up — it
    // just gets there by bending an elbow and leaning, which is what a person
    // does anyway.
    return [
      [bone('lowerArmR'), 0.70],
      [bone('upperArmR'), 0.30],
      [bone('shoulderR'), 0.06],
      [bone('spine3'), 0.12], [bone('spine2'), 0.10], [bone('spine1'), 0.08],
    ];
  }

  ready = (async () => {
    const { GLTFLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const model = gltf.scene;

    model.traverse((o) => {
      if (o.isBone) bones.set(o.name, o);
      if (o.isMesh) o.frustumCulled = false;
    });

    // The walk animation is never played: he is sitting down.
    const wrapper = new THREE.Group();
    const standing = new THREE.Box3().setFromObject(model);
    const height = standing.getSize(new THREE.Vector3()).y;
    wrapper.scale.setScalar(height > 0 ? TARGET_HEIGHT / height : 1);
    wrapper.add(model);
    group.add(wrapper);
    group.rotation.y = Math.PI; // scanned facing +z, the car looks at -z

    group.updateWorldMatrix(true, true);
    for (const [key, angle] of [...SPINE_LEAN, ...LEG_FOLD]) {
      const b = bone(key);
      if (!b) continue;
      b.updateWorldMatrix(true, false);
      rotateWorld(b, WORLD_X, angle);
    }

    // Put his eyes where the camera is.
    group.updateWorldMatrix(true, true);
    const head = bone('head');
    if (head) {
      group.position.add(HEAD_BONE_AT.clone().sub(head.getWorldPosition(new THREE.Vector3())));
    }

    // Lift him until his lap clears the cushion.
    group.updateWorldMatrix(true, true);
    const sunk = (CUSHION_Y + SEAT_CLEARANCE) - bone('hip').getWorldPosition(new THREE.Vector3()).y;
    if (sunk > 0) group.position.y += Math.min(sunk, MAX_LIFT);

    // Thighs level and heels down, measured against this cabin's seat.
    group.updateWorldMatrix(true, true);
    const hipAt = bone('hip').getWorldPosition(new THREE.Vector3());
    sitDown({
      legs: [
        { thigh: bone('upperLegL'), calf: bone('lowerLegL'),
          knee: bone('lowerLegL'), heel: bone('footL'), offset: -0.11 },
        { thigh: bone('upperLegR'), calf: bone('lowerLegR'),
          knee: bone('lowerLegR'), heel: bone('footR'), offset: 0.11 },
      ],
      hipAt,
      floorY: FLOOR_Y,
      root: group,
    });

    // The camera lives inside his skull, so the skull has to go. Collapsing
    // the bone takes the head with it and leaves the neck.
    if (head) head.scale.setScalar(0.001);

    rimPoint('left', goal);
    solveChain({ chain: armChain('left'), end: bone('handL'), target: goal, root: group, passes: 24 });
    rimPoint('right', restRight);
    solveChain({ chain: armChain('right'), end: bone('handR'), target: restRight, root: group, passes: 24 });

    // Close both hands around the rim. The arms put the palms there; this is
    // what makes it read as holding the wheel rather than touching it. The
    // fingers close toward a point just behind the rim, so the curl wraps it
    // instead of stopping short.
    const behind = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(wheel.getWorldQuaternion(new THREE.Quaternion()))
      .multiplyScalar(-0.05);
    for (const side of ['left', 'right']) {
      const toward = rimPoint(side, new THREE.Vector3()).add(behind);
      curlFingers({ fingers: handFingers(bones, side), toward, root: group });
    }

    rememberRest(reachChain());

    return group;
  })();

  /**
   * Sends the right hand to a world point and resolves at the moment it
   * arrives — the caller fires the action on contact, as the spec requires.
   */
  function reachTo(target, normal) {
    if (!bone('handR') || anim) return Promise.resolve(false);
    return new Promise((resolve) => {
      anim = {
        target: target.clone().addScaledVector(normal, TOUCH_GAP),
        startedAt: performance.now(),
        touched: false,
        resolve,
      };
    });
  }

  function update(now) {
    if (!anim || !bone('handR')) return;

    rimPoint('right', restRight);
    const elapsed = now - anim.startedAt;
    let t;

    if (elapsed < REACH_MS) {
      t = easeOut(elapsed / REACH_MS);
    } else if (!anim.touched) {
      anim.touched = true;
      t = 1;
      anim.resolve?.(true);
    } else {
      const back = (elapsed - REACH_MS) / RETURN_MS;
      if (back >= 1) {
        anim = null;
        recallRest(reachChain());
        return;
      }
      t = 1 - easeIn(back);
    }

    goal.lerpVectors(restRight, anim.target, t);
    const chain = reachChain();
    recallRest(chain);
    solveChain({ chain, end: bone('handR'), target: goal, root: group, passes: 26 });
  }

  return {
    group,
    ready,
    update,
    reachTo,
    isBusy: () => anim !== null,
  };
}
