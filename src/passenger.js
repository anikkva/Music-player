// The passenger in the right-hand seat.
//
// A rigged Mixamo character, folded into the bench and given something to do
// with her time: she breathes, settles the way anyone does in a moving car,
// and looks over when the driver touches her knee.
//
// She replaces a Character Creator FBX that fought every step of the way — it
// shipped eight copies of its own skeleton, so half its bone names resolved to
// duplicates that drove no geometry at all, and it took thirteen seconds to
// parse. Converted to Draco-compressed glTF with its 4K maps taken down to 1K,
// this one is 0.9 MB against 14, loads in a third of a second, and has exactly
// one bone per name.
//
// Nothing here is a hand-written pose. Where she sits, how her legs fold, what
// her hands rest on and how far her head has to turn are all solved against
// the cabin — see pose.js for why that is not fussiness.

import * as THREE from 'three';
import { WORLD_X, WORLD_Y, rotateWorld, sitDown, solveChain, curlFingers } from './pose.js';

const MODEL = 'assets/models/passenger2/passenger.glb';
const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/libs/draco/';

// Mixamo prefixes every bone, and not always with the same string: this
// character's are `mixamorigHips` where the driver's are `mixamorig5Hips` —
// the number appears when a rig is re-exported. The prefix is read off the
// skeleton at load rather than written down here.
let B = 'mixamorig';

// Bone names without the prefix; it is added at lookup time.
const limbs = (s) => ({
  shoulder: `${s}Shoulder`,
  upperArm: `${s}Arm`,
  foreArm: `${s}ForeArm`,
  hand: `${s}Hand`,
  upperLeg: `${s}UpLeg`,
  lowerLeg: `${s}Leg`,
  foot: `${s}Foot`,
});

const LEFT = limbs('Left');
const RIGHT = limbs('Right');
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// Materials drawn as alpha cutouts rather than solid surfaces.
const CUTOUT = /hair|lash/i;

// She is 1.76 m out of the box, a little tall for this cabin's headroom.
const TARGET_HEIGHT = 1.70;

// The bench and the footwell, measured out of the Impala. She sits above the
// cushion rather than on it: the hip bone is inside the pelvis, so putting the
// bone on the cushion pushes her shorts through the upholstery.
const CUSHION_Y = -0.65;
const SEAT_CLEARANCE = 0.06;
const HIP_AT = new THREE.Vector3(0.90, CUSHION_Y + SEAT_CLEARANCE, -0.06);
const FLOOR_Y = -0.96;
const FACING = -0.20; // turned a little toward the driver even at rest

// A neck turns about 65 degrees and no further; past that a person brings
// their shoulders round.
const NECK_MAX = 1.15;
const CHEST_MAX = 0.45;

const LOOK_TILT = 0.10; // a slight cock of the head, which is what asks it
const LOOK_MS = 520;

// She is never quite still. Breathing is the slow one; the rest is the small
// constant settling anyone does in a moving car. Amplitudes are radians.
const IDLE = {
  breathPeriod: 4200,
  breath: 0.016,
  swayPeriod: 9700,
  sway: 0.020,
  headDriftPeriod: 7300,
  headDrift: 0.035,
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** A bone by its unprefixed name. */
const pick = (bones, name) => bones.get(B + name);

/**
 * The direction she is facing, read off her own hips.
 *
 * This rig has no eye bones, so there is no gaze to measure directly — but the
 * line between the tops of her legs is her left-right axis whatever the rig
 * calls things, and forward is that crossed with up.
 */
function facingOf(bones, into) {
  const left = pick(bones, LEFT.upperLeg);
  const right = pick(bones, RIGHT.upperLeg);
  if (!left || !right) return into.set(0, 0, -1);

  const a = left.getWorldPosition(new THREE.Vector3());
  const across = right.getWorldPosition(new THREE.Vector3()).sub(a);
  across.y = 0;
  if (across.lengthSq() < 1e-10) return into.set(0, 0, -1);
  return into.crossVectors(WORLD_Y, across.normalize()).normalize();
}

/**
 * How far she has to turn to look at the driver, split between neck and
 * shoulders.
 *
 * The driver is at the origin, because that is where the camera is. One
 * measurement is enough: the turn is applied about the world vertical, so a
 * radian asked for is a radian delivered.
 */
function lookAngles(bones, head) {
  if (!head) return { neck: 0, chest: 0 };

  const forward = facingOf(bones, new THREE.Vector3());
  const toDriver = head.getWorldPosition(new THREE.Vector3()).negate();
  toDriver.y = 0;
  if (toDriver.lengthSq() < 1e-10) return { neck: 0, chest: 0 };
  toDriver.normalize();

  const total = Math.atan2(
    forward.x * toDriver.z - forward.z * toDriver.x,
    forward.dot(toDriver),
  );

  // Negated: the signed angle runs from her facing toward the driver, and the
  // rotation that closes it goes the other way round the vertical. Getting
  // this backwards turns the back of her head to the camera, which is a very
  // clear way to find out you had it backwards.
  const wanted = -total;
  const neck = Math.max(-NECK_MAX, Math.min(NECK_MAX, wanted));
  const rest = wanted - neck;
  return { neck, chest: Math.max(-CHEST_MAX, Math.min(CHEST_MAX, rest)) };
}

/** Puts her hands on her knees and drapes the fingers over them. */
function restHandsOnKnees(bones, root) {
  const at = new THREE.Vector3();
  const target = new THREE.Vector3();

  for (const limb of [LEFT, RIGHT]) {
    const knee = pick(bones, limb.lowerLeg);
    const hand = pick(bones, limb.hand);
    if (!knee || !hand) continue;

    root.updateWorldMatrix(true, true);
    knee.getWorldPosition(at);

    // On top of the knee and a little back along the thigh, which is where a
    // hand actually rests — right on the kneecap slides off.
    target.copy(at).add(new THREE.Vector3(0, 0.06, 0.08));
    solveChain({
      chain: [
        [pick(bones, limb.foreArm), 0.5],
        [pick(bones, limb.upperArm), 0.5],
        [pick(bones, limb.shoulder), 0.18],
      ],
      end: hand,
      target,
      root,
      passes: 22,
    });

    // Fingers fall loosely over the front of the knee — a drape, not a fist.
    root.updateWorldMatrix(true, true);
    hand.getWorldPosition(at);
    curlFingers({
      fingers: FINGERS.map((finger) => ({
        joints: [1, 2, 3].map((k) => pick(bones, `${limb.hand}${finger}${k}`)),
        tip: pick(bones, `${limb.hand}${finger}4`),
        curl: finger === 'Thumb' ? 0.4 : 1,
      })),
      toward: at.clone().add(new THREE.Vector3(0, -0.07, -0.07)),
      root,
      amounts: [0.30, 0.45, 0.35],
    });
  }
}

/**
 * The passenger. The group is empty until the model arrives; `ready` resolves
 * when she is in place, and every method is safe to call before then.
 */
export function createPassenger() {
  const group = new THREE.Group();
  const bones = new Map();

  // A ball on her thigh for the raycaster, deliberately not parented to a
  // bone: a bone chain carries the model's scale, and a sphere hung off one
  // comes out a fraction of its asked-for size. It lives in the scene at scene
  // scale — the caller adds it — and is moved onto the leg each frame.
  const knee = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  knee.userData.control = 'knee';

  let head = null;
  let chest = null;
  let kneeBone = null;
  let hipBone = null;
  let headBindQ = null;
  let chestBindQ = null;
  let lookNeck = 0;
  let lookChest = 0;

  let lookStartedAt = 0;
  let lookTarget = 0; // 0 = out of the window, 1 = at the driver
  let lookFrom = 0;

  const ready = (async () => {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js'),
      import('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/DRACOLoader.js'),
    ]);
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const gltf = await loader.loadAsync(MODEL);
    const model = gltf.scene;

    model.traverse((o) => {
      if (o.isBone) bones.set(o.name, o);
      if (!o.isMesh) return;

      o.frustumCulled = false; // wrong skinned bounds pop her out of frame

      // Her hair and eyelashes are alpha cutouts painted on flat cards. The
      // FBX-to-glTF conversion drops the transparency setting — it says so on
      // the way past — which leaves the cards rendering as solid sheets and
      // the character looking shaved. The alpha is still in the texture, so
      // all that is needed is to tell the material to use it.
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!material?.map) continue;
        if (!CUTOUT.test(material.name ?? '')) continue;
        // The opacity reset is the load-bearing line. The converter dropped
        // the transparency texture and left the material's alpha factor at
        // zero, so every fragment came out fully transparent and the cutout
        // removed the whole head of hair. Alpha has to come from the texture
        // and nothing else.
        material.opacity = 1;
        material.alphaTest = 0.5;
        material.transparent = false; // a cutout, not a blend — no sort order to get wrong
        material.side = THREE.DoubleSide;
        material.depthWrite = true;
        material.needsUpdate = true;
      }
    });

    const hips = [...bones.keys()].find((n) => n.endsWith('Hips'));
    if (hips) B = hips.slice(0, -'Hips'.length);

    const wrapper = new THREE.Group();
    const standing = new THREE.Box3().setFromObject(model);
    const height = standing.getSize(new THREE.Vector3()).y;
    wrapper.scale.setScalar(height > 0 ? TARGET_HEIGHT / height : 1);
    wrapper.add(model);
    group.add(wrapper);
    group.rotation.y = Math.PI + FACING; // built facing +z; the car looks at -z

    head = pick(bones, 'Head') ?? null;
    chest = pick(bones, 'Spine1') ?? pick(bones, 'Spine') ?? null;
    kneeBone = pick(bones, LEFT.lowerLeg) ?? null;
    hipBone = pick(bones, 'Hips') ?? null;

    // Sit her down: hip on the cushion, thighs level, heels on the floor.
    group.updateWorldMatrix(true, true);
    if (hipBone) {
      group.position.add(HIP_AT.clone().sub(hipBone.getWorldPosition(new THREE.Vector3())));
    }

    group.updateWorldMatrix(true, true);
    sitDown({
      legs: [
        {
          thigh: pick(bones, LEFT.upperLeg), calf: pick(bones, LEFT.lowerLeg),
          knee: pick(bones, LEFT.lowerLeg), heel: pick(bones, LEFT.foot), offset: -0.09,
        },
        {
          thigh: pick(bones, RIGHT.upperLeg), calf: pick(bones, RIGHT.lowerLeg),
          knee: pick(bones, RIGHT.lowerLeg), heel: pick(bones, RIGHT.foot), offset: 0.09,
        },
      ],
      hipAt: HIP_AT,
      floorY: FLOOR_Y,
      root: group,
    });

    restHandsOnKnees(bones, group);

    if (head) headBindQ = head.quaternion.clone();
    if (chest) chestBindQ = chest.quaternion.clone();
    ({ neck: lookNeck, chest: lookChest } = lookAngles(bones, head));

    return group;
  })();

  /** Turn her head toward the driver, or back to the window. */
  function look(at) {
    if (lookTarget === at) return;
    lookFrom = lookTarget;
    lookTarget = at;
    lookStartedAt = performance.now();
  }

  const worldKnee = new THREE.Vector3();
  const worldHip = new THREE.Vector3();

  function update(now) {
    if (!head) return;

    // Halfway up the thigh rather than on the kneecap: the knee itself is half
    // behind the console from the driver's seat, and a target nobody can point
    // at may as well not exist.
    if (kneeBone && hipBone) {
      kneeBone.getWorldPosition(worldKnee);
      hipBone.getWorldPosition(worldHip);
      knee.position.lerpVectors(worldHip, worldKnee, 0.62);
    }

    const t = Math.min(1, (now - lookStartedAt) / LOOK_MS);
    const amount = lookFrom + (lookTarget - lookFrom) * easeInOut(t);

    // Breathing, the slow settle of someone sitting in a moving car, and the
    // shoulders coming round when she looks over.
    if (chest && chestBindQ) {
      chest.quaternion.copy(chestBindQ);
      rotateWorld(chest, WORLD_X,
        Math.sin(now / IDLE.breathPeriod) * IDLE.breath
        + Math.sin(now / IDLE.swayPeriod + 1.3) * IDLE.sway);
      rotateWorld(chest, WORLD_Y, amount * lookChest);
    }

    // Rebuilt from the bind pose each frame and turned about the world axes,
    // never by writing local eulers. The drift keeps her scanning the street
    // rather than staring at one point on the glass; the tilt only arrives
    // when she looks over, and it is what makes the look a question.
    if (headBindQ) {
      head.quaternion.copy(headBindQ);
      const drift = Math.sin(now / IDLE.headDriftPeriod) * IDLE.headDrift * (1 - amount);
      rotateWorld(head, WORLD_Y, amount * lookNeck + drift);
      rotateWorld(head, WORLD_X, amount * LOOK_TILT);
    }
  }

  return {
    group,
    ready,
    knee,
    update,
    lookAtDriver: () => look(1),
    lookAway: () => look(0),
    kneeWorldPosition: () => knee.getWorldPosition(new THREE.Vector3()),
    isLoaded: () => head !== null,
  };
}
