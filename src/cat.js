// The cat on the bench.
//
// He is the OIIA cat — the model carries one animation, which is his spin, and
// spinning is the only thing he is famous for. So he does it, but only while
// the radio is actually playing: a cat revolving over a dead station is just a
// glitch, and the same cat revolving to music is the joke.
//
// He rides between the driver and the passenger, which is where a cat sits in
// a car with a bench seat, and is also the one place in this cabin where
// nobody's legs are.

import * as THREE from 'three';

const MODEL = 'assets/models/cat/cat.glb';

// A sitting domestic cat is about a third of a metre to the top of the head.
// The model arrives in its own units, so it is measured and fitted rather than
// trusted.
const TARGET_HEIGHT = 0.34;

// On the bench between the two seats. The cushion is 0.65 m below the eye.
const SEAT_Y = -0.645;
const AT = new THREE.Vector3(0.44, SEAT_Y, -0.14);

// Turned a little toward the driver, so he is not staring at the glovebox.
const FACING = -0.55;

// How quickly he winds up and down when the music starts and stops. Snapping
// straight to full speed reads as a dropped frame.
const SPIN_LERP = 0.06;

export function createCat() {
  const group = new THREE.Group();
  let mixer = null;
  let action = null;
  let speed = 0;

  const ready = (async () => {
    const { GLTFLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const model = gltf.scene;

    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m) continue;
        // The cabin is lit for photographs; a flat meme texture reads as
        // plastic under it unless the shine is taken off.
        m.roughness = 0.85;
        m.metalness = 0;
        m.needsUpdate = true;
      }
    });

    // Fit him to a real cat, then stand him on the cushion. Measured before
    // scaling so the offset is in the scene's metres, not the model's units.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
    model.scale.setScalar(scale);

    model.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(model);
    const centre = scaled.getCenter(new THREE.Vector3());
    // Centre him left-to-right and front-to-back on his own bulk, and sit his
    // feet — not his origin — on the cushion.
    model.position.set(-centre.x, -scaled.min.y, -centre.z);

    group.add(model);
    group.position.copy(AT);
    group.rotation.y = FACING;

    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(gltf.animations[0]);
      action.play();
    }

    return group;
  })();

  /**
   * @param dt seconds since the last frame
   * @param playing whether the radio is on; he spins to it
   */
  function update(dt, playing) {
    if (!mixer) return;
    speed += ((playing ? 1 : 0) - speed) * SPIN_LERP;
    if (speed < 0.001) return; // parked: leave him on the frame he stopped at
    mixer.update(dt * speed);
  }

  return { group, ready, update };
}
