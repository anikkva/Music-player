// The driver — the body the camera is sitting in.
//
// A rigged Mixamo character, folded into the driver's seat with his own hands
// on the wheel, so looking down shows a body rather than a void. His head is
// collapsed rather than hidden: the camera sits inside it, and a skinned mesh
// cannot have part of itself switched off, but scaling the head bone to
// nothing takes the whole head with it and leaves the neck.
//
// He replaces a scan that cost 26 passes of inverse kinematics per frame
// against a sixty-bone skeleton every time the radio was touched. That is
// where the stutter came from, and most of the fix is in how the reach is
// solved rather than in the model.
//
// Arms are solved, not keyframed — see pose.js. The same descent that parks a
// hand on the rim carries it to a button, and the same finger curl that closes
// his grip closes hers.

import * as THREE from 'three';
import { WORLD_X, rotateWorld, solveChain, sitDown, curlFingers } from './pose.js';

const MODEL = 'assets/models/driver/driver2.glb';
const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/libs/draco/';

// Materials drawn as alpha cutouts rather than solid surfaces.
const CUTOUT = /hair|lash/i;

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// How tall he ends up. His own units are not trusted — a glTF may carry a
// scale on its root node — so he is measured and fitted.
const TARGET_HEIGHT = 1.78;

// The bench, the footwell, and how far he may be lifted off the eye anchor to
// keep his lap out of the upholstery. A seated man puts his hip about 0.76 m
// below his eyes; this cabin puts its cushion 0.65 m below them, so anchored
// purely by the eye he sinks into the seat and his thighs — the thing you look
// down to see — end up inside it. Lifting him leaves the camera nearer his
// mouth than his eyes, which nobody can see, because his head is not drawn.
const CUSHION_Y = -0.65;
const SEAT_CLEARANCE = 0.06;
const FLOOR_Y = -0.96;
const MAX_LIFT = 0.18;

// He is anchored by the eye: the camera cannot move, so if his head lands
// anywhere but the origin the view ends up inside his chest. The offset runs
// from the head bone's pivot to the eyes — up the skull and forward, and he
// faces -z.
const HEAD_BONE_AT = new THREE.Vector3(0, -0.085, 0.085);

// A slight lean into the wheel. The scan stands bolt upright, and from that
// posture the rim is a few centimetres beyond his fingertips.
// Barely anything — just enough to take the parade-ground stiffness out of a
// scan that was captured standing up.
//
// It stays small on purpose. His head is pinned to the camera, so leaning the
// spine does not tip him toward the wheel: it swings his body back and brings
// his shoulders up into the frame instead. The rim is about 0.55 m from his
// shoulder and his arm is 0.6 m, so there is nothing to lean for.
const SPINE_LEAN = [['Spine', 0.07], ['Spine1', 0.05], ['Spine2', 0.03]];

// A rough first fold of the legs, only so the solver starts from something
// seated. How level the thighs sit and where the heels land are solved.
const LEG_FOLD = [
  ['LeftUpLeg', 1.10], ['RightUpLeg', 1.10],
  ['LeftLeg', -0.60], ['RightLeg', -0.60],
];

// Where his hands rest: on his thighs, not on the wheel.
//
// They were on the rim, and the rim is where they belong on a real driver —
// but the camera sits inside this man's own head, so his forearms cross the
// frame at arm's length and read as two pale slabs over the dashboard however
// well the hands are placed. The wheel is close enough to the camera that his
// arms fill more of the view than the road does.
//
// Resting them low costs nothing that matters: from the driver's eyes a real
// person mostly sees their own knees anyway, and the arm still comes up — into
// an otherwise clear frame, which makes the gesture read — whenever he reaches
// for the radio.
const LAP = { left: new THREE.Vector3(-0.17, -0.60, -0.30), right: new THREE.Vector3(0.17, -0.60, -0.30) };

const REACH_MS = 420;
const RETURN_MS = 360;
const TOUCH_GAP = 0.02;

// Passes of descent per frame while reaching. Modest on purpose: the goal
// moves only a little between frames and each solve starts from the last one,
// so ten passes track it as well as twenty-six did — and the solver now
// refreshes only the arm's own subtree rather than the whole figure, which is
// where the stutter came from.
const REACH_PASSES = 20;
const SETTLE_PASSES = 40; // once, when he first takes the wheel, so it can converge

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;

/**
 * @param wheel the empty standing in for the steering wheel; its rim radius
 *   says where the hands go.
 */
export function createDriver({ wheel }) {
  const group = new THREE.Group();
  const bones = new Map();

  // Mixamo prefixes every bone, but not always with the same string: this
  // character's are `mixamorig5Hips` where the passenger's are `mixamorigHips`
  // — the number appears when a rig is re-exported. It is read off the
  // skeleton rather than written down.
  let prefix = 'mixamorig';
  const bone = (name) => bones.get(prefix + name);

  let anim = null; // an active reach, or null while both hands rest
  const restRight = new THREE.Vector3();
  const goal = new THREE.Vector3();

  // The posture he returns to, and where the reach chain was when it started.
  const restPose = new Map();

  /** Where a hand rests, in world space. */
  const restPoint = (side, into) => into.copy(LAP[side]);

  // Arm only, deliberately. Both arms share a spine, so a chain that includes
  // it solves the right hand by dragging the left one off the rim it was just
  // placed on. The lean that brings the wheel into reach is set once, up
  // front, and then left alone.
  const armChain = (s) => [
    [bone(`${s}ForeArm`), 0.5], [bone(`${s}Arm`), 0.5], [bone(`${s}Shoulder`), 0.4],
  ];

  /**
   * The arm and nothing else, deliberately, and it does not quite reach.
   *
   * The radio sits about 0.85 m from his shoulder and his arm is 0.6 m long,
   * so touching it needs a quarter of a metre from somewhere else. Both places
   * that could supply it make the shot worse, and measurably so: bending the
   * spine swings his chest at the lens, and rolling the shoulder puts it
   * there directly — at maximum extension it filled the entire frame. The
   * camera sits about twenty centimetres from his own shoulder, so anything
   * that moves his upper body toward the dash moves it into the lens instead.
   *
   * So the arm goes out on its own and stops short. From the driver's seat it
   * reads as reaching for the radio, the button still depresses under it, and
   * nothing crosses the view. Getting the last quarter metre honestly would
   * mean either mounting the radio within arm's reach or letting the camera
   * travel with his head, and both are larger decisions than a damping value.
   */
  const reachChain = () => [
    [bone('RightForeArm'), 0.60],
    [bone('RightArm'), 0.50],
  ];

  const handFingers = (s) => FINGERS.map((finger) => ({
    joints: [1, 2, 3].map((k) => bone(`${s}Hand${finger}${k}`)),
    tip: bone(`${s}Hand${finger}4`),
    // The thumb closes across the rim rather than around it.
    curl: finger === 'Thumb' ? 0.45 : 1,
  }));

  const ready = (async () => {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js'),
      import('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/DRACOLoader.js'),
    ]);
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const model = (await loader.loadAsync(MODEL)).scene;

    model.traverse((o) => {
      if (o.isBone) bones.set(o.name, o);
      if (!o.isMesh) return;

      o.frustumCulled = false; // wrong skinned bounds pop him out of frame

      // Hair and eyelashes are alpha cutouts on flat cards. The FBX-to-glTF
      // conversion drops the transparency setting and leaves the material's
      // alpha factor at zero, which cuts the whole head of hair away. Alpha
      // has to come from the texture and nothing else.
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!material?.map || !CUTOUT.test(material.name ?? '')) continue;
        material.opacity = 1;
        material.alphaTest = 0.5;
        material.transparent = false; // a cutout, not a blend
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }
    });

    const hips = [...bones.keys()].find((n) => n.endsWith('Hips'));
    if (hips) prefix = hips.slice(0, -'Hips'.length);

    const wrapper = new THREE.Group();
    const standing = new THREE.Box3().setFromObject(model);
    const height = standing.getSize(new THREE.Vector3()).y;
    wrapper.scale.setScalar(height > 0 ? TARGET_HEIGHT / height : 1);
    wrapper.add(model);
    group.add(wrapper);
    group.rotation.y = Math.PI; // built facing +z; the car looks at -z

    group.updateWorldMatrix(true, true);
    for (const [name, angle] of [...SPINE_LEAN, ...LEG_FOLD]) {
      const b = bone(name);
      if (!b) continue;
      b.updateWorldMatrix(true, false);
      rotateWorld(b, WORLD_X, angle);
    }

    // Put his eyes where the camera is, then lift him until his lap clears
    // the cushion.
    group.updateWorldMatrix(true, true);
    const head = bone('Head');
    if (head) {
      group.position.add(HEAD_BONE_AT.clone().sub(head.getWorldPosition(new THREE.Vector3())));
    }

    group.updateWorldMatrix(true, true);
    const hipBone = bone('Hips');
    if (hipBone) {
      const sunk = (CUSHION_Y + SEAT_CLEARANCE)
        - hipBone.getWorldPosition(new THREE.Vector3()).y;
      if (sunk > 0) group.position.y += Math.min(sunk, MAX_LIFT);
    }

    group.updateWorldMatrix(true, true);
    sitDown({
      legs: [
        {
          thigh: bone('LeftUpLeg'), calf: bone('LeftLeg'),
          knee: bone('LeftLeg'), heel: bone('LeftFoot'), offset: -0.11,
        },
        {
          thigh: bone('RightUpLeg'), calf: bone('RightLeg'),
          knee: bone('RightLeg'), heel: bone('RightFoot'), offset: 0.11,
        },
      ],
      hipAt: hipBone
        ? hipBone.getWorldPosition(new THREE.Vector3())
        : new THREE.Vector3(0, CUSHION_Y, 0),
      floorY: FLOOR_Y,
      root: group,
    });

    // The camera lives inside his skull, so the skull has to go.
    if (head) head.scale.setScalar(0.001);

    // Both hands down onto his thighs, fingers loosely closed.
    for (const [key, s] of [['left', 'Left'], ['right', 'Right']]) {
      const at = restPoint(key, new THREE.Vector3());
      solveChain({
        chain: armChain(s), end: bone(`${s}Hand`), target: at, root: group, passes: SETTLE_PASSES,
      });
      curlFingers({
        fingers: handFingers(s),
        toward: at.clone().add(new THREE.Vector3(0, -0.06, -0.06)),
        root: group,
        amounts: [0.30, 0.45, 0.35],
      });
    }

    for (const [b] of reachChain()) if (b) restPose.set(b, b.quaternion.clone());
    restPoint('right', restRight);

    return group;
  })();

  /**
   * Sends the right hand to a world point and resolves at the moment it
   * arrives — the caller fires the action on contact, as the spec requires.
   */
  function reachTo(target, normal) {
    const hand = bone('RightHand');
    if (!hand || anim) return Promise.resolve(false);
    return new Promise((resolve) => {
      anim = {
        // From where the hand actually is, not from where it was meant to
        // rest. Descent leaves it wherever it converged, and interpolating
        // from an imagined start makes the first half of the reach a fight to
        // catch up with a goal that has already left.
        from: hand.getWorldPosition(new THREE.Vector3()),
        target: target.clone().addScaledVector(normal, TOUCH_GAP),
        startedAt: performance.now(),
        touched: false,
        resolve,
      };
    });
  }

  function update(now) {
    if (!anim || !bone('RightHand')) return;

    const elapsed = now - anim.startedAt;

    if (elapsed < REACH_MS) {
      goal.lerpVectors(anim.from, anim.target, easeOut(elapsed / REACH_MS));
    } else if (!anim.touched) {
      anim.touched = true;
      goal.copy(anim.target);
      anim.resolve?.(true);
    } else {
      const back = (elapsed - REACH_MS) / RETURN_MS;
      if (back >= 1) {
        // Snap the last of the way home. Solving back to the rim leaves a
        // little drift each time; the remembered posture does not.
        for (const [b, q] of restPose) b.quaternion.copy(q);
        anim = null;
        return;
      }
      goal.lerpVectors(anim.from, anim.target, 1 - easeIn(back));
    }

    // Solved from wherever the arm is, not from the rest pose: the goal moves
    // only slightly between frames, so a few passes track it, and there is no
    // full re-solve to pay for sixty times a second.
    solveChain({
      chain: reachChain(), end: bone('RightHand'), target: goal, root: group, passes: REACH_PASSES,
    });
  }

  return {
    group,
    ready,
    update,
    reachTo,
    isBusy: () => anim !== null,
  };
}
