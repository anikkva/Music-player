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

// Being petted sets him off whether or not the radio is on, and faster than
// the radio alone does, so the reaction reads even mid-song.
const PET_MS = 4200;
const PET_SPEED = 1.9;

// Height of his back above the cushion — where a hand lands.
const BACK_HEIGHT = 0.235;

// The ball the raycaster sees. Bigger than it needs to be: he is small, low,
// and half behind the seat divider, and a target nobody can hit may as well
// not exist.
const HIT_RADIUS = 0.24;

export function createCat() {
  const group = new THREE.Group();
  let mixer = null;
  let action = null;
  let speed = 0;
  let pettedUntil = 0;

  // Parented to the group rather than moved each frame like the passenger's
  // knee: this group is unscaled, so a sphere hung off it comes out the size
  // it was asked for. He bobs a little as he spins, by less than the ball.
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(HIT_RADIUS, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.userData.control = 'cat';
  hit.position.y = TARGET_HEIGHT / 2;
  group.add(hit);

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

  /** A hand landed on him. He is delighted, in the only way he knows. */
  function pet() {
    pettedUntil = performance.now() + PET_MS;
  }

  /**
   * @param dt seconds since the last frame
   * @param playing whether the radio is on; he spins to it
   */
  function update(dt, playing) {
    if (!mixer) return;
    const petted = performance.now() < pettedUntil;
    const target = petted ? PET_SPEED : (playing ? 1 : 0);
    speed += (target - speed) * SPIN_LERP;
    if (speed < 0.001) return; // parked: leave him on the frame he stopped at
    mixer.update(dt * speed);
  }

  return {
    group,
    hit,
    ready,
    update,
    pet,
    /** World centre of him, for a hand to aim at. */
    worldPosition: () => hit.getWorldPosition(new THREE.Vector3()),
    /**
     * Where a hand should land: the top of his back, not his middle. Aimed at
     * the middle the arm simply drove through him — the target was inside the
     * animal. Petting comes down from above, which is also how anyone pets a
     * cat.
     */
    petPoint: () => group.localToWorld(new THREE.Vector3(0, BACK_HEIGHT, 0.02)),
  };
}
