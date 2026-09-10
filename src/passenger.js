// The passenger in the right-hand seat, and the driver's own legs.
//
// She is a rigged Character Creator 3 model rather than modelled geometry.
// The hand-built version could not be posed: what makes a person read as a
// person sitting in a car is the pose, and a lathed body has no joints to pose
// with. This one has 181 bones, so she can be folded into the seat and can
// turn her head when the driver touches her knee.
//
// The model is loaded lazily and the group starts empty. Parsing 14 MB of FBX
// takes seconds, and the radio — which is the actual point of the page — must
// not wait for it.
//
// Local origin is the model's own: the FBX is Z-up and in centimetres, so the
// wrapper turns and scales it, and then the whole thing is shifted so that her
// hip lands where the seat cushion is.

import * as THREE from 'three';
import { WORLD_X, WORLD_Y, rotateWorld, sitDown, solveChain, curlFingers } from './pose.js';

const MODEL = 'assets/models/passenger/passenger.fbx';
const TEX = 'assets/models/passenger/textures/';

// The model is 1.85 m tall; 0.0097 brings her to about 1.79 m, which is what
// fits between the Impala's bench and its floorpan without her heels going
// through the carpet.
const FBX_TO_SCENE = { scale: 0.0097, rotationX: -Math.PI / 2 };

// Materials that need a proper skin/refraction shader to look like anything.
// Left on, they read as glass beads and grey films over her face.
const HIDDEN_MESHES = ['CC_Base_TearLine', 'CC_Base_EyeOcclusion', 'CC_Base_Tongue', 'CC_Base_Teeth'];

// material name -> [colour map, alpha map]
const MAPS = {
  Std_Skin_Head: ['skin_head.jpg'],
  Std_Skin_Body: ['skin_body.jpg'],
  Std_Skin_Arm: ['skin_arm.jpg'],
  Std_Skin_Leg: ['skin_leg.jpg'],
  Std_Nails: ['nails.jpg'],
  Std_Eye_L: ['eye_l.jpg'],
  Std_Eye_R: ['eye_r.jpg'],
  Std_Eyelash: ['eyelash.jpg', 'eyelash_a.jpg'],
  Dress: ['dress.jpg'],
  Punk_Leather_jacket: ['jacket.jpg'],
  Low_rise_Shorts: ['shorts.jpg'],
  High_Heels: ['heels.jpg'],
  Hair: ['hair.jpg', 'hair_a.jpg'],
  Scalp: ['scalp.jpg', 'scalp_a.jpg'],
  Female_Angled: ['fa.jpg', 'fa_a.jpg'],
  Female_Angled_Base: ['fab.jpg', 'fab_a.jpg'],
};

// A rough first fold of the legs, about the world x axis, only so the solver
// in pose.js starts from something seated. How level her thighs sit and where
// her heels land are solved against the cabin afterwards.
// The knees ride high and the heels tuck back, because they have to: the
// Impala's cushion sits 0.50 m below the driver's eye and its floorpan only
// 0.31 m below that. Sitting with the shins vertical, as in a modern car, puts
// her heels through the carpet.
const LEG_POSE = [
  ['CC_Base_L_Thigh', -1.44],
  ['CC_Base_R_Thigh', -1.48],
  ['CC_Base_L_Calf', -0.90],
  ['CC_Base_R_Calf', -0.90],
  ['CC_Base_L_Foot', -0.55],
  ['CC_Base_R_Foot', -0.55],
];

// The arms and spine are gentler and read fine as local euler deltas on top
// of the bind T-pose: drop the arms to her sides, settle the back.
// Only the back and the shoulders are set by hand, and only enough to bring
// the arms down out of the bind T-pose. Where the hands actually go is solved
// — written-out arm angles put both of hers in the same spot behind her hip,
// which is the trouble with guessing at a rig you did not build.
const POSE = {
  CC_Base_L_Clavicle: [0, 0, -0.10],
  CC_Base_R_Clavicle: [0, 0, 0.10],
  CC_Base_L_Upperarm: [0, 0, -1.10],
  CC_Base_R_Upperarm: [0, 0, 1.10],

  CC_Base_Spine01: [0.06, 0, 0],
  CC_Base_Spine02: [0.04, 0, 0],
  CC_Base_NeckTwist01: [-0.06, 0, 0],
};

// The floor of the footwell, and how close to it her heels should settle.
// Her shins are straightened against this after the pose is applied, so she
// keeps her feet on the floor even if the cabin under her changes.
const FLOOR_Y = -0.96;

// Where her hip sits, and how far she is turned toward the driver.
// Measured, not guessed: rays dropped onto the bench put its cushion at
// y = -0.65 over z = -0.35..0.05, with the backrest starting at z = 0.05.
//
// She sits six centimetres above it rather than on it. The hip bone is inside
// the pelvis, so placing the bone on the cushion pushes her shorts and the
// backs of her thighs through the upholstery.
const HIP_AT = new THREE.Vector3(0.90, -0.59, -0.06);
const FACING = -0.20;

// How long the turn takes, and how far the head may be asked to go. How far
// it actually goes is worked out at load from where the driver is sitting: a
// written-in angle was 35 degrees, which turned her head without ever pointing
// her eyes at anybody.
const LOOK_TILT = 0.10;   // a slight cock of the head, which is what asks it
const LOOK_MS = 520;
// A neck turns about 65 degrees and no further; past that a person brings
// their shoulders round. She is sitting 108 degrees off the driver, so both
// are needed, and the chest takes whatever the neck cannot.
const NECK_MAX = 1.15;
const CHEST_MAX = 0.45;

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

function surface(loader, [colour, alpha]) {
  const map = loader.load(TEX + colour);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;

  const material = new THREE.MeshStandardMaterial({
    map, roughness: 0.86, metalness: 0.0,
  });

  if (alpha) {
    const alphaMap = loader.load(TEX + alpha);
    alphaMap.flipY = false;
    material.alphaMap = alphaMap;
    material.transparent = true;
    material.alphaTest = 0.35; // hair cards need a cutout, not a blend
    material.side = THREE.DoubleSide;
    material.depthWrite = true;
  }
  return material;
}

/**
 * How far she has to turn to actually look at the driver, split between neck
 * and shoulders.
 *
 * Her gaze runs from the head bone out to the midpoint of her eyes; the driver
 * is at the origin, because that is where the camera is. The turn is found by
 * stepping — apply some, measure what is left, apply the correction — for the
 * same reason as everything else here: the relationship between an angle asked
 * for and the angle that results depends on the rig, and this one turns out
 * not to be one to one.
 *
 * The turn is applied about the world vertical. Her skull bone's local z is
 * not up, so writing a local euler moves her head somewhere, but not toward
 * anyone.
 */
function solveLookAngles(head, chest, bones, root) {
  const eyeL = bones.get('CC_Base_L_Eye');
  const eyeR = bones.get('CC_Base_R_Eye');
  if (!head || !eyeL || !eyeR) return { neck: 0, chest: 0 };

  const eyes = new THREE.Vector3();
  const skull = new THREE.Vector3();
  const gaze = new THREE.Vector3();
  const toDriver = new THREE.Vector3();
  const headBind = head.quaternion.clone();
  const chestBind = chest ? chest.quaternion.clone() : null;

  const offBy = () => {
    root.updateWorldMatrix(true, true);
    eyeL.getWorldPosition(eyes);
    eyeR.getWorldPosition(gaze);
    eyes.add(gaze).multiplyScalar(0.5);
    head.getWorldPosition(skull);

    gaze.copy(eyes).sub(skull);
    gaze.y = 0;
    toDriver.copy(eyes).negate();
    toDriver.y = 0;
    if (gaze.lengthSq() < 1e-10 || toDriver.lengthSq() < 1e-10) return 0;
    gaze.normalize();
    toDriver.normalize();
    return Math.atan2(gaze.x * toDriver.z - gaze.z * toDriver.x, gaze.dot(toDriver));
  };

  const apply = (neck, torso) => {
    if (chest && chestBind) {
      chest.quaternion.copy(chestBind);
      rotateWorld(chest, WORLD_Y, torso);
    }
    head.quaternion.copy(headBind);
    rotateWorld(head, WORLD_Y, neck);
  };

  let total = 0;
  for (let pass = 0; pass < 10; pass += 1) {
    apply(Math.max(-NECK_MAX, Math.min(NECK_MAX, total)), 0);
    const error = offBy();
    if (Math.abs(error) < 0.02) break;

    apply(Math.max(-NECK_MAX, Math.min(NECK_MAX, total + 0.15)), 0);
    const response = (offBy() - error) / 0.15;
    if (Math.abs(response) < 0.05) break;

    total -= error / response;
    if (Math.abs(total) > 4) break;
  }

  apply(0, 0);

  const neck = Math.max(-NECK_MAX, Math.min(NECK_MAX, total));
  const left = total - neck;
  return { neck, chest: Math.max(-CHEST_MAX, Math.min(CHEST_MAX, left)) };
}

/**
 * Puts her hands on her knees and drapes the fingers over them.
 *
 * Solved rather than written for the same reason her legs are: a rig's arm
 * bones do not agree with anyone's intuition about which euler does what, and
 * the angles that looked plausible put both her hands in one spot behind her
 * hip. A target on the knee has one meaning, and it stays right if she is
 * moved to a different seat.
 */
function restHandsOnKnees(bones, root) {
  const at = new THREE.Vector3();
  const target = new THREE.Vector3();

  for (const side of ['L', 'R']) {
    const knee = bones.get(`CC_Base_${side}_Calf`);
    const hand = bones.get(`CC_Base_${side}_Hand`);
    if (!knee || !hand) continue;

    root.updateWorldMatrix(true, true);
    knee.getWorldPosition(at);

    // On top of the knee and a little back along the thigh, which is where a
    // hand actually rests — right on the kneecap slides off.
    target.copy(at).add(new THREE.Vector3(0, 0.055, 0.075));
    solveChain({
      chain: [
        [bones.get(`CC_Base_${side}_Forearm`), 0.5],
        [bones.get(`CC_Base_${side}_Upperarm`), 0.5],
        [bones.get(`CC_Base_${side}_Clavicle`), 0.18],
      ],
      end: hand,
      target,
      root,
      passes: 22,
    });

    // Fingers fall over the front of the knee — a light drape, not a fist.
    root.updateWorldMatrix(true, true);
    hand.getWorldPosition(at);
    curlFingers({
      fingers: ['Index', 'Mid', 'Ring', 'Pinky', 'Thumb'].map((finger) => {
        const joints = [1, 2, 3].map((k) => bones.get(`CC_Base_${side}_${finger}${k}`));
        return { joints, tip: joints[2], curl: finger === 'Thumb' ? 0.4 : 1 };
      }),
      toward: at.clone().add(new THREE.Vector3(0, -0.07, -0.07)),
      root,
      amounts: [0.30, 0.45, 0.35],
    });
  }
}

/**
 * The passenger. The returned group is empty until the model arrives; `ready`
 * resolves when it is in place, and every method is safe to call before then.
 */
export function createPassenger() {
  const group = new THREE.Group();

  // Bones by name — but this model carries eight separate copies of its
  // skeleton, one per mesh, so 46 of its 101 names appear more than once. Left
  // to a plain last-one-wins map, `CC_Base_Head` resolved to a childless
  // duplicate that drives no geometry at all: her head turned, in the sense
  // that a number changed, and nothing on screen moved.
  //
  // `bones` holds the richest instance of each name — the one the rest of the
  // skeleton hangs off — and `copies` holds them all, so a pose can be echoed
  // to the duplicates that the hair and the clothes are bound to.
  const bones = new Map();
  const copies = new Map();

  // A small invisible ball on her knee, for the raycaster to hit.
  //
  // It is NOT parented to the knee bone, tempting as that is: the bone chain
  // carries the model's own scale, and an 8.5 cm sphere hung off it comes out
  // a fraction of a millimetre across, so the ray only ever finds it when the
  // knee is dead centre of the frame. It lives in the scene at scene scale
  // instead, and is moved onto the bone every frame — the caller adds it.
  const knee = new THREE.Mesh(
    // Generous: it stands in for a knee and the top of a thigh, and the head
    // it is being clicked from is never quite still.
    new THREE.SphereGeometry(0.20, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  knee.userData.control = 'knee';

  let head = null;
  let lookNeck = 0;    // both replaced by measured values once she is seated
  let lookChest = 0;
  let kneeBone = null;
  let hipBone = null;
  let chest = null;
  let headBindQ = null;
  let chestBindQ = null;
  let lookStartedAt = 0;
  let lookTarget = 0;   // 0 = out of the window, 1 = at the driver
  let lookFrom = 0;

  const ready = (async () => {
    const { FBXLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/FBXLoader.js');
    const model = await new FBXLoader().loadAsync(MODEL);

    const loader = new THREE.TextureLoader();
    const materials = new Map();

    const weight = (bone) => { let n = 0; bone.traverse(() => { n += 1; }); return n; };

    model.traverse((o) => {
      if (o.isBone) {
        if (!copies.has(o.name)) copies.set(o.name, []);
        copies.get(o.name).push(o);
        const held = bones.get(o.name);
        if (!held || weight(o) > weight(held)) bones.set(o.name, o);
      }
      if (!o.isMesh) return;

      o.visible = !HIDDEN_MESHES.includes(o.name);
      o.frustumCulled = false; // a skinned bounding box that is wrong pops her out of frame

      const swap = (m) => {
        if (!MAPS[m.name]) return m;
        if (!materials.has(m.name)) materials.set(m.name, surface(loader, MAPS[m.name]));
        return materials.get(m.name);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });

    for (const [name, [x, y, z]] of Object.entries(POSE)) {
      const bone = bones.get(name);
      if (bone) bone.rotation.set(bone.rotation.x + x, bone.rotation.y + y, bone.rotation.z + z);
    }

    head = bones.get('CC_Base_Head') ?? null;
    if (head) headBindQ = head.quaternion.clone();
    chest = bones.get('CC_Base_Spine02') ?? bones.get('CC_Base_Spine01') ?? null;
    if (chest) chestBindQ = chest.quaternion.clone();

    kneeBone = bones.get('CC_Base_L_Calf') ?? null;
    hipBone = bones.get('CC_Base_Hip') ?? null;

    const wrapper = new THREE.Group();
    wrapper.rotation.x = FBX_TO_SCENE.rotationX;
    wrapper.scale.setScalar(FBX_TO_SCENE.scale);
    wrapper.add(model);
    group.add(wrapper);
    group.rotation.y = Math.PI + FACING; // built facing +z; the car looks at -z

    // The legs are folded only now, after she has been turned to face the
    // windshield. World-axis rotations mean what the scene means by "forward",
    // so doing this while she still faced the other way would fold her
    // backwards.
    group.updateWorldMatrix(true, true);
    for (const [name, angle] of LEG_POSE) {
      const bone = bones.get(name);
      if (!bone) continue;
      bone.updateWorldMatrix(true, false);
      rotateWorld(bone, WORLD_X, angle);
    }

    // Sit her down by measuring rather than by guessing: put the hip bone
    // exactly on the cushion, whatever the pose did to the rest of her.
    group.updateWorldMatrix(true, true);
    const hip = bones.get('CC_Base_Hip');
    if (hip) {
      const at = hip.getWorldPosition(new THREE.Vector3());
      group.position.add(HIP_AT.clone().sub(at));
    }

    // Thighs level and heels down, measured against this cabin's bench.
    group.updateWorldMatrix(true, true);
    sitDown({
      legs: [
        { thigh: bones.get('CC_Base_L_Thigh'), calf: bones.get('CC_Base_L_Calf'),
          knee: bones.get('CC_Base_L_Calf'), heel: bones.get('CC_Base_L_Foot'), offset: -0.09 },
        { thigh: bones.get('CC_Base_R_Thigh'), calf: bones.get('CC_Base_R_Calf'),
          knee: bones.get('CC_Base_R_Calf'), heel: bones.get('CC_Base_R_Foot'), offset: 0.09 },
      ],
      hipAt: HIP_AT,
      floorY: FLOOR_Y,
      root: group,
    });

    restHandsOnKnees(bones, group);

    ({ neck: lookNeck, chest: lookChest } = solveLookAngles(head, chest, bones, group));
    echo();

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

  /** Copies each solved bone's rotation onto its duplicates. */
  function echo(names) {
    for (const [name, list] of copies) {
      if (list.length < 2) continue;
      if (names && !names.includes(name)) continue;
      const primary = bones.get(name);
      for (const copy of list) if (copy !== primary) copy.quaternion.copy(primary.quaternion);
    }
  }

  // The two the idle animation moves every frame.
  const LIVE = ['CC_Base_Head', 'CC_Base_Spine02', 'CC_Base_Spine01'];

  function update(now) {
    if (!head) return;

    // The target sits in the scene, so the bone's world position is its
    // position — no basis change, nothing to get subtly wrong.
    // Halfway up the thigh rather than on the kneecap. The knee itself is
    // half behind the console from the driver's seat, and a target nobody can
    // point at may as well not exist.
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
    // never by writing local eulers: her skull bone's own axes do not line up
    // with up and sideways, so a local rotation moves her head somewhere other
    // than where it was asked to go. The drift keeps her scanning the street
    // rather than staring at one point on the glass; the tilt only arrives
    // when she looks over, and it is what makes the look a question.
    if (headBindQ) {
      head.quaternion.copy(headBindQ);
      const drift = Math.sin(now / IDLE.headDriftPeriod) * IDLE.headDrift * (1 - amount);
      rotateWorld(head, WORLD_Y, amount * lookNeck + drift);
      rotateWorld(head, WORLD_X, amount * LOOK_TILT);
      echo(LIVE);
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
