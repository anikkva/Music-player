// The car itself: a Chevrolet Impala, loaded from glTF.
//
// This replaces the cabin that used to be modelled by hand in interior.js. The
// hand-built one was boxes standing in for a dashboard; this is the real shape,
// with a bench seat, a column shift, pedals and a dash that photographs like a
// dash. It is also cheaper — about 14 000 triangles for the whole car.
//
// Two things have to be undone on the way in.
//
// The model's materials are written with KHR_materials_pbrSpecularGlossiness,
// a retired glTF extension that GLTFLoader no longer reads. Left alone, every
// surface comes through as white metal with no colour map and the interior
// looks like grey clay, so the extension is unpacked by hand below.
//
// And the car is built nose toward +z, in centimetres, with its origin on the
// road under the middle of the car. The scene wants metres, the windshield at
// -z, and the origin at the driver's eyes — so it is turned, scaled, and shifted
// by the driver's eye position, which was measured by casting rays inside the
// cabin until the roof, seat back, door glass and windshield all came back at
// the distances a person sitting there would see.

import * as THREE from 'three';

const MODEL = 'assets/models/cabin/impala.glb';

const CM = 0.01;

// The driver's eye point, in the model's own centimetres. Cast rays from here
// and the roof is 37 cm up, the seat back 18 cm behind, the driver's door glass
// 42 cm to the left and the windshield 98 cm ahead.
const EYE = new THREE.Vector3(48, 112, 15);

// The steering wheel's bone, in the same space. The wheel geometry is baked
// into the body mesh, so this is only ever used to park the hands.
const WHEEL_BONE = new THREE.Vector3(48.6, 97.6, 71.3);
const WHEEL_RADIUS = 0.205;
const WHEEL_TILT = -0.62; // radians from vertical, a period column angle

/** Model centimetres -> scene metres, with the car turned to face -z. */
function toScene(v) {
  return new THREE.Vector3(-(v.x - EYE.x) * CM, (v.y - EYE.y) * CM, -(v.z - EYE.z) * CM);
}

/**
 * Unpacks the retired spec-gloss extension into the standard material the
 * renderer understands: diffuse texture as the colour map, no metalness, and
 * roughness as the complement of glossiness.
 */
async function restoreMaterials(gltf) {
  const { parser } = gltf;
  const defs = parser.json.materials ?? [];
  const seen = new Set();

  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });

  for (const mesh of meshes) {
    const material = mesh.material;
    if (seen.has(material)) continue;
    seen.add(material);

    const assoc = parser.associations.get(material);
    const def = assoc && defs[assoc.materials];
    const sg = def?.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (!sg) continue;

    if (sg.diffuseTexture) {
      const map = await parser.getDependency('texture', sg.diffuseTexture.index);
      map.colorSpace = THREE.SRGBColorSpace;
      map.flipY = false;
      material.map = map;
    }

    const [r, g, b, a] = sg.diffuseFactor ?? [1, 1, 1, 1];
    material.color.setRGB(r, g, b);
    material.metalness = 0;
    material.roughness = 1 - (sg.glossinessFactor ?? 0.5);

    if (def.alphaMode === 'BLEND') {
      material.transparent = true;
      material.opacity = Math.max(0.05, a);
      material.depthWrite = false; // the world outside has to show through
    }

    material.needsUpdate = true;
  }
}

/**
 * The cabin. The group is empty until the car arrives; `ready` resolves once
 * it is in place. `wheel` is an empty standing in for the steering wheel — the
 * rim is baked into the body mesh, so it cannot be turned, but the hands need
 * something at the right place and angle to rest on.
 */
export function createCabin() {
  const group = new THREE.Group();

  const wheel = new THREE.Group();
  wheel.position.copy(toScene(WHEEL_BONE));
  wheel.rotation.x = WHEEL_TILT;
  wheel.userData.rimRadius = WHEEL_RADIUS;
  group.add(wheel);

  const ready = (async () => {
    const { GLTFLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    await restoreMaterials(gltf);

    const car = gltf.scene;
    car.scale.setScalar(CM);
    car.rotation.y = Math.PI;
    car.position.set(EYE.x * CM, -EYE.y * CM, EYE.z * CM);
    group.add(car);

    return group;
  })();

  return { group, wheel, ready };
}
