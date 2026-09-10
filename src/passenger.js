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

// The seated pose. Two tables, because the two halves of the rig need
// different treatment.
//
// The legs are folded with rotations about the WORLD x axis. Character
// Creator binds limb bones with a half turn about their own z, so which local
// euler bends a knee forward is not something to reason about — it is
// something to measure. In world terms it is simply "swing the thigh forward,
// drop the shin": one axis, signs found by watching where the joint lands.
// Order matters, and the world matrix has to be refreshed between links.
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

const WORLD_X = new THREE.Vector3(1, 0, 0);

/**
 * Straightens or folds the shins until her heels rest on the floor.
 *
 * Hard-coding a knee angle only works for one cabin. This one is solved:
 * measure where the foot actually ended up, bend the knee by roughly the angle
 * that closes the gap, and repeat. It converges in a handful of passes and
 * costs nothing, since it runs once when the model loads.
 */
function standHeelsOnFloor(bones, group) {
  const calves = ['CC_Base_L_Calf', 'CC_Base_R_Calf'].map((n) => bones.get(n));
  const foot = bones.get('CC_Base_L_Foot');
  if (!foot || calves.some((c) => !c)) return;

  const target = FLOOR_Y + HEEL_CLEARANCE;
  const at = new THREE.Vector3();

  for (let pass = 0; pass < 12; pass += 1) {
    group.updateWorldMatrix(true, true);
    foot.getWorldPosition(at);
    const gap = target - at.y;
    if (Math.abs(gap) < 0.005) break;

    // ~3 radians of knee per metre of heel, measured off the rig, and never
    // more than a tenth of a radian at a time so it cannot overshoot.
    const step = Math.max(-0.1, Math.min(0.1, gap * 3));
    for (const calf of calves) {
      calf.updateWorldMatrix(true, false);
      calf.rotateOnWorldAxis(WORLD_X, step);
    }
  }
}

// The floor of the footwell, and how close to it her heels should settle.
// Her shins are straightened against this after the pose is applied, so she
// keeps her feet on the floor even if the cabin under her changes.
const FLOOR_Y = -0.81;
const HEEL_CLEARANCE = 0.02;

// Where her hip sits, and how far she is turned toward the driver.
// Measured, not guessed: rays dropped onto the bench put its cushion at
// y = -0.50 over z = -0.35..0.05, with the backrest starting at z = 0.05.
const HIP_AT = new THREE.Vector3(0.90, -0.46, -0.06);
const FACING = -0.20;

// How far the head turns to look at the driver, and how long it takes.
const LOOK_YAW = 0.62;
const LOOK_MS = 420;

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
  let headBindZ = 0;
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
    if (head) headBindZ = head.rotation.z;

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
      bone.rotateOnWorldAxis(WORLD_X, angle);
    }

    // Sit her down by measuring rather than by guessing: put the hip bone
    // exactly on the cushion, whatever the pose did to the rest of her.
    group.updateWorldMatrix(true, true);
    const hip = bones.get('CC_Base_Hip');
    if (hip) {
      const at = hip.getWorldPosition(new THREE.Vector3());
      group.position.add(HIP_AT.clone().sub(at));
    }

    standHeelsOnFloor(bones, group);

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
    // Added to the bind rotation, not assigned over it: the CC rig's head is
    // not bound at zero, and assigning would snap her chin to her chest.
    head.rotation.z = headBindZ + amount * LOOK_YAW;
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
