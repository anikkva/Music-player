// Posing rigged bodies by measurement.
//
// Hand-written joint angles are the wrong tool for putting a person in a car.
// Every rig binds its limbs differently — Character Creator puts a half turn
// about the bone's own z on every limb, so the euler that folds a hip on one
// skeleton straightens a knee on another — and every cabin has its seat and
// floor somewhere else. Angles tuned against one pair of those are wrong for
// any other pair, silently.
//
// So nothing here is a pose. These are two solvers: turn joints until a target
// joint reaches a height, and turn a chain until its end reaches a point. Both
// take a handful of passes, both run once when a model loads, and both survive
// having the car changed underneath them.

import * as THREE from 'three';

export const WORLD_X = new THREE.Vector3(1, 0, 0);

const _parentQ = new THREE.Quaternion();
const _rot = new THREE.Quaternion();
const _inv = new THREE.Quaternion();

/**
 * Turns a bone about an axis in world space.
 *
 * Object3D.rotateOnWorldAxis cannot be used for this. It premultiplies the
 * local rotation, which is only correct when nothing above the object is
 * rotated — and every bone in a skeleton has a rotated parent, so that call
 * quietly does almost nothing. The symptom is a limb that will not bend no
 * matter what angle is asked for.
 *
 * The parent's world rotation has to be taken out and put back:
 *   local' = parentWorld⁻¹ · R · parentWorld · local
 */
export function rotateWorld(bone, axis, angle) {
  if (bone.parent) bone.parent.getWorldQuaternion(_parentQ);
  else _parentQ.identity();
  _rot.setFromAxisAngle(axis, angle);
  _inv.copy(_parentQ).invert().multiply(_rot).multiply(_parentQ);
  bone.quaternion.premultiply(_inv);
}

/**
 * Turns `joints` about the world x axis until `probe` sits at `targetY`.
 *
 * Which way to turn is measured, not assumed. One rig folds a hip on a
 * positive rotation and the next on a negative one, and a solver that guesses
 * wrong does not merely fail — it drives the leg further from the answer every
 * pass until the foot is through the floor. So it takes one small step first,
 * watches which way the joint actually moved, and works out the gain from
 * that. If the joint barely responds at all, there is nothing to solve and it
 * leaves the pose alone.
 */
export function solveHeight({ joints, probe, targetY, root, passes = 14, limit = 0.12 }) {
  if (!probe || joints.some((j) => !j)) return;

  const at = new THREE.Vector3();
  const measure = () => {
    root.updateWorldMatrix(true, true);
    probe.getWorldPosition(at);
    return at.y;
  };
  const turn = (angle) => {
    for (const joint of joints) {
      joint.updateWorldMatrix(true, false);
      rotateWorld(joint, WORLD_X, angle);
    }
  };

  // Metres of probe per radian of joint, including its sign.
  const PROBE_STEP = 0.05;
  const before = measure();
  turn(PROBE_STEP);
  const response = (measure() - before) / PROBE_STEP;
  turn(-PROBE_STEP);
  if (Math.abs(response) < 0.02) return;

  for (let pass = 0; pass < passes; pass += 1) {
    const gap = targetY - measure();
    if (Math.abs(gap) < 0.005) return;
    // Eight tenths of the step the response predicts: enough to converge in a
    // few passes, shy enough not to ring.
    turn(Math.max(-limit, Math.min(limit, (gap / response) * 0.8)));
  }
}

/**
 * Cyclic coordinate descent: walk a chain from its end back toward its root,
 * turning each joint so the end swings a little closer to the goal.
 *
 * `chain` is [bone, damping] pairs, end first. The damping is what keeps a
 * body believable — an elbow may swing freely, a spine barely at all, so
 * reaching for something far away leans the body toward it instead of folding
 * it in half.
 *
 * It needs no knowledge of how the rig's bind axes are laid out, which is
 * exactly what makes hand-written poses so brittle.
 */
export function solveChain({ chain, end, target, root, passes = 10 }) {
  if (!end || chain.some(([b]) => !b)) return;

  const jointAt = new THREE.Vector3();
  const toEnd = new THREE.Vector3();
  const toGoal = new THREE.Vector3();
  const axis = new THREE.Vector3();

  for (let pass = 0; pass < passes; pass += 1) {
    for (const [bone, damping] of chain) {
      root.updateWorldMatrix(true, true);
      bone.getWorldPosition(jointAt);
      end.getWorldPosition(toEnd).sub(jointAt);
      toGoal.copy(target).sub(jointAt);
      if (toEnd.lengthSq() < 1e-8 || toGoal.lengthSq() < 1e-8) continue;

      toEnd.normalize();
      toGoal.normalize();
      axis.crossVectors(toEnd, toGoal);
      if (axis.lengthSq() < 1e-10) continue;

      const angle = Math.acos(Math.min(1, Math.max(-1, toEnd.dot(toGoal))));
      bone.updateWorldMatrix(true, false);
      rotateWorld(bone, axis.normalize(), angle * damping);
    }
  }
}

/**
 * Sits a rigged figure down: thighs forward and level, shins down to the floor.
 *
 * Each joint is sent to a point rather than to a height. Asking only for
 * height is ambiguous — a thigh raises its knee just as well by swinging
 * backwards as forwards, and a solver with no opinion about which will
 * cheerfully fold a passenger's legs into the back seat. A point has one
 * answer.
 */
export function sitDown({ legs, hipAt, floorY, root, kneeForward = 0.42, thighDrop = 0.03, ankleHeight = 0.07 }) {
  const kneeTarget = new THREE.Vector3();

  for (const leg of legs) {
    if (!leg.thigh || !leg.calf || !leg.knee || !leg.heel) continue;

    kneeTarget.set(hipAt.x + (leg.offset ?? 0), hipAt.y - thighDrop, hipAt.z - kneeForward);
    solveChain({ chain: [[leg.thigh, 0.6]], end: leg.knee, target: kneeTarget, root, passes: 14 });

    // The shin is solved for height, not for a point. Its knee is already
    // pinned, so it has only one way to swing and no ambiguity to resolve —
    // and a point picked out of the air is usually one the shin cannot reach,
    // which leaves the foot hanging wherever descent gave up.
    // The target is the ankle, not the sole. The foot bone sits at the ankle
    // and the shoe hangs below it, so aiming the bone at the carpet buries the
    // shoe in it — which is exactly what it looked like.
    solveHeight({ joints: [leg.calf], probe: leg.heel, targetY: floorY + (leg.ankleHeight ?? ankleHeight), root });
  }
}

/**
 * Curls a finger around something by sending its tip to a point.
 *
 * A relaxed scan holds its hands flat, which on a steering wheel reads as
 * pressing a palm against the rim rather than holding it. Rather than invent
 * joint angles per rig, each finger is a three-link chain solved to a target
 * behind the rim — the same descent that drives the arms, at a smaller scale.
 * The damping rises along the finger so the tip curls more than the knuckle,
 * which is what a hand actually does.
 */
export function curlFinger({ joints, tip, target, root, passes = 8 }) {
  if (!tip || joints.some((j) => !j)) return;
  solveChain({
    chain: [
      [joints[2], 0.45],
      [joints[1], 0.32],
      [joints[0], 0.20],
    ],
    end: tip,
    target,
    root,
    passes,
  });
}

/**
 * Wraps a whole hand around a rim.
 *
 * `grip` is the point the palm sits at, `through` the direction the fingers
 * close in — for a steering wheel, back through the rim and away from the
 * driver. Each finger gets its own target, spread a little along the rim so
 * they do not all converge on one spot.
 */
export function gripAround({ fingers, at, through, spread, root, reach = 0.055 }) {
  const target = new THREE.Vector3();
  const n = fingers.length;

  fingers.forEach((finger, i) => {
    const along = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
    target.copy(at)
      .addScaledVector(through, finger.reach ?? reach)
      .addScaledVector(spread, along * 0.035);
    curlFinger({ joints: finger.joints, tip: finger.tip, target, root });
  });
}
