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
import { WORLD_X, rotateWorld, sitDown, curlFinger } from './pose.js';

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
const POSE = {
  CC_Base_L_Clavicle: [0, 0, -0.10],
  CC_Base_R_Clavicle: [0, 0, 0.10],
  CC_Base_L_Upperarm: [0.20, 0.10, -1.24],
  CC_Base_R_Upperarm: [0.20, -0.10, 1.24],
  CC_Base_L_Forearm: [0, -0.55, -0.30],
  CC_Base_R_Forearm: [0, 0.55, 0.30],
  CC_Base_L_Hand: [0, 0, -0.18],
  CC_Base_R_Hand: [0, 0, 0.18],

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
const HIP_AT = new THREE.Vector3(0.90, -0.61, -0.06);
const FACING = -0.20;

// How far the head turns to look at the driver, how long the turn takes, and
// how long she holds it. The hold is deliberately long: a glance that snaps
// back reads as a twitch, a look that lingers reads as a question.
const LOOK_YAW = 0.62;
const LOOK_TILT = 0.10;   // a slight cock of the head, which is what asks it
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
 * The passenger. The returned group is empty until the model arrives; `ready`
 * resolves when it is in place, and every method is safe to call before then.
 */
export function createPassenger() {
  const group = new THREE.Group();
  const bones = new Map();

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
    new THREE.SphereGeometry(0.15, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  knee.userData.control = 'knee';

  let head = null;
  let kneeBone = null;
  let chest = null;
  let headBindZ = 0;
  let headBindX = 0;
  let chestBindX = 0;
  let lookStartedAt = 0;
  let lookTarget = 0;   // 0 = out of the window, 1 = at the driver
  let lookFrom = 0;

  const ready = (async () => {
    const { FBXLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/FBXLoader.js');
    const model = await new FBXLoader().loadAsync(MODEL);

    const loader = new THREE.TextureLoader();
    const materials = new Map();

    model.traverse((o) => {
      if (o.isBone) bones.set(o.name, o);
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
    if (head) {
      headBindZ = head.rotation.z;
      headBindX = head.rotation.x;
    }
    chest = bones.get('CC_Base_Spine02') ?? bones.get('CC_Base_Spine01') ?? null;
    if (chest) chestBindX = chest.rotation.x;

    kneeBone = bones.get('CC_Base_L_Calf') ?? null;

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

    // Her hands come out of the scan flat. Curling the fingers loosely is
    // most of what makes a hand resting in a lap look like a hand rather than
    // a glove laid on a knee.
    for (const side of ['L', 'R']) {
      const hand = bones.get(`CC_Base_${side}_Hand`);
      if (!hand) continue;
      const palm = hand.getWorldPosition(new THREE.Vector3());
      const inward = new THREE.Vector3(0, -0.055, -0.02).applyQuaternion(group.quaternion);
      for (const finger of ['Index', 'Mid', 'Ring', 'Pinky', 'Thumb']) {
        curlFinger({
          joints: [1, 2, 3].map((k) => bones.get(`CC_Base_${side}_${finger}${k}`)),
          tip: bones.get(`CC_Base_${side}_${finger}3`),
          target: palm.clone().add(finger === 'Thumb' ? inward.clone().multiplyScalar(0.5) : inward),
          root: group,
          passes: 6,
        });
      }
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

  function update(now) {
    if (!head) return;

    // The target sits in the scene, so the bone's world position is its
    // position — no basis change, nothing to get subtly wrong.
    if (kneeBone) knee.position.copy(kneeBone.getWorldPosition(worldKnee));

    const t = Math.min(1, (now - lookStartedAt) / LOOK_MS);
    const amount = lookFrom + (lookTarget - lookFrom) * easeInOut(t);

    // Breathing, and the slow settle of someone sitting in a moving car.
    if (chest) {
      chest.rotation.x = chestBindX
        + Math.sin(now / IDLE.breathPeriod) * IDLE.breath
        + Math.sin(now / IDLE.swayPeriod + 1.3) * IDLE.sway;
    }

    // Added to the bind rotation, not assigned over it: the CC rig's head is
    // not bound at zero, and assigning would snap her chin to her chest.
    // The drift keeps her looking out of the window rather than at a fixed
    // point on the glass; the tilt only comes in when she is looking over.
    head.rotation.z = headBindZ + amount * LOOK_YAW
      + Math.sin(now / IDLE.headDriftPeriod) * IDLE.headDrift * (1 - amount);
    head.rotation.x = headBindX + amount * LOOK_TILT;
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
