// Entry point: builds the scene and wires the physical controls to the player.

import * as THREE from 'three';
import { STATIONS } from './stations.js';
import { createPlayer, STATUS } from './player.js';
import { createScene, isWebGLAvailable } from './scene.js';
import { createCabin } from './cabin.js';
import { createDriving } from './driving.js';
import { createPassenger } from './passenger.js';
import { createCat } from './cat.js';
import { createRadio } from './radio.js';
import { createLcd } from './lcd.js';
import { createCameraRig } from './camera.js';
import { createInteraction } from './interaction.js';
import { angleToVolume, volumeToAngle, MIN_ANGLE, MAX_ANGLE } from './knob.js';
import { RADIO_POSITION, RADIO_YAW, RADIO_PITCH, RADIO_SCALE } from './layout.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const tooltipEl = document.getElementById('tooltip');

if (!isWebGLAvailable()) {
  document.getElementById('unsupported').hidden = false;
  overlay.hidden = true;
  canvas.hidden = true;
} else {
  boot();
}

function boot() {
  const { scene, camera, renderer, lcdGlow, render } = createScene(canvas);

  // The car. Its geometry loads in the background; the wheel proxy the hands
  // rest on exists from the start, so nothing waits on it.
  const cabin = createCabin();
  scene.add(cabin.group);

  // Everything that makes the car read as moving: lamps sweeping through the
  // cabin, scenery scrolling past the glass, the road under the windshield.
  const driving = createDriving();
  scene.add(driving.group);

  // Passenger in the right-hand seat. Her model loads in the background: the
  // radio is the point of the page and must not wait on 14 MB of FBX.
  const passenger = createPassenger();
  scene.add(passenger.group);
  scene.add(passenger.knee); // her hit target lives at scene scale, not bone scale

  // ---- radio, seated in the centre stack and turned toward the driver ----
  const radio = createRadio();
  radio.group.position.set(...RADIO_POSITION);
  // Turned toward the driver and tilted up a little. Set explicitly rather
  // than with lookAt, which would also roll the plate.
  radio.group.rotation.order = 'YXZ';
  radio.group.rotation.y = RADIO_YAW;
  radio.group.rotation.x = RADIO_PITCH;
  radio.group.scale.setScalar(RADIO_SCALE);
  scene.add(radio.group);

  const lcd = createLcd();
  radio.lcdMesh.material.map = lcd.texture;
  radio.lcdMesh.material.needsUpdate = true;

  // The cat rides the middle of the bench, and spins to the radio.
  const cat = createCat();
  scene.add(cat.group);
  cat.ready.catch((e) => console.error('cat failed to load', e));

  // There is no driver model. The camera sits where his eyes were, so his own
  // chest and shoulders were always between the lens and everything else, and
  // every attempt to hide them cut his geometry open somewhere: a near plane
  // sliced his thighs at the wide end of the zoom, a radius left the far side
  // of his shirt hanging in mid-air. You are the driver, and nothing is drawn
  // for you — which is what most first-person views do anyway.
  //
  // She works the radio now. See passenger.reachTo.

  // The faceplate's outward normal, which is the direction a fingertip
  // approaches a control from.
  const faceNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(radio.group.quaternion);

  // ---- radio ----
  const player = createPlayer({
    stations: STATIONS,
    onStationChange: (station) => lcd.setStation(station),
    onStatus: (status) => {
      if (status === STATUS.NO_SIGNAL) lcd.flashStatus('NO SIGNAL', 1600);
      if (status === STATUS.DEAD_AIR) lcd.flashStatus('DEAD AIR', 6000);
      if (status === STATUS.PAUSED) lcd.flashStatus('PAUSE', 900);
      if (status === STATUS.TUNING) lcd.flashStatus('TUNING', 1100);
    },
  });
  lcd.setStation(STATIONS[0]);

  // ---- camera, aimed at the radio for the opening frame ----
  const toRadio = radio.group.position.clone().normalize();
  const cameraRig = createCameraRig(camera, canvas, {
    yaw: Math.atan2(-toRadio.x, -toRadio.z),
    pitch: Math.asin(toRadio.y),
    zoom: 0.40,
  });

  // ---- volume lives on the TUNE knob ----
  let knobAngle = volumeToAngle(player.getVolume(), MIN_ANGLE, MAX_ANGLE);
  radio.setKnobVolume(player.getVolume());

  function applyKnobDelta(delta) {
    knobAngle = Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, knobAngle + delta));
    const volume = angleToVolume(knobAngle, MIN_ANGLE, MAX_ANGLE);
    player.setVolume(volume);
    radio.setKnobAngle('tuneKnob', -knobAngle);
    lcd.showVolume(volume);
  }

  // ---- control -> action mapping (see the spec's table) ----
  const ACTIONS = {
    seekPrev: () => player.prev(),
    seekNext: () => player.next(),
    slotPrev: () => player.prev(),
    slotNext: () => player.next(),
    volKnob: () => player.toggle(),
    // She looks over, holds it, and only then goes back to the window. The
    // hold is long on purpose: a glance that snaps straight back reads as a
    // twitch rather than as a question.
    knee: () => {
      passenger.lookAtDriver();
      clearTimeout(lookAwayTimer);
      lookAwayTimer = setTimeout(() => passenger.lookAway(), 5000);
    },
    // Decorative: they depress and light up, but nothing happens.
    am: null, fm: null, preset: null, eject: null, ejectArrow: null, cassette: null,
  };

  const LABELS = {
    seekPrev: '◀ ПРЕДЫДУЩАЯ СТАНЦИЯ', seekNext: 'СЛЕДУЮЩАЯ СТАНЦИЯ ▶',
    slotPrev: '◀ ПРЕДЫДУЩАЯ СТАНЦИЯ', slotNext: 'СЛЕДУЮЩАЯ СТАНЦИЯ ▶',
    volKnob: 'ВКЛ / ПАУЗА', tuneKnob: 'ГРОМКОСТЬ',
    am: 'AM', fm: 'FM', preset: 'PRESET', eject: 'EJECT',
    ejectArrow: 'EJECT', cassette: 'КАССЕТА',
    knee: 'ДОТРОНУТЬСЯ',
  };

  let lookAwayTimer = 0;

  // Half the thickness of her leg at the knee: the distance from the bone the
  // hit target hangs on out to the skin.
  const KNEE_SURFACE = 0.075;

  /** Where a control is, and which way it faces the driver. */
  function aimAt(controlId) {
    if (controlId === 'knee') {
      const at = passenger.kneeWorldPosition();
      // The driver's eyes are the origin, so the way out of her knee toward
      // him is simply the way back to the origin.
      const normal = at.clone().negate().normalize();
      // Her hit target is a ball centred on the leg bone, which is inside the
      // leg. Aiming at it put his hand a good five centimetres into her thigh
      // — the arm came to rest looking like it had gone through her. Step out
      // to roughly where the skin is before the reach adds its own gap.
      return [at.addScaledVector(normal, KNEE_SURFACE), normal];
    }
    return [radio.worldPositionOf(controlId), faceNormal];
  }

  async function activate(controlId) {
    if (controlId === 'tuneKnob') return; // handled by dragging, not clicking
    if (passenger.isBusy()) return;

    interaction.setBusy(true);
    if (controlId === 'knee') {
      // Nobody reaches for her knee any more: the hand that did belonged to
      // the driver. You are still there to touch it, you are simply not drawn.
      ACTIONS.knee();
    } else {
      const touched = await passenger.reachTo(...aimAt(controlId));
      if (touched) {
        // The action fires on contact, not on click.
        radio.pressButton(controlId);
        ACTIONS[controlId]?.();
      }
    }
    interaction.setBusy(false);
  }

  const interaction = createInteraction({
    camera,
    domElement: canvas,
    radio,
    cameraRig,
    tooltipEl,
    labels: LABELS,
    onActivate: activate,
    onKnobDelta: (id, delta, phase) => {
      if (id !== 'tuneKnob') return;
      // Dragging the knob does not send the hand out: it is a continuous
      // gesture, and an arm solving to a new target every frame reads as a
      // twitch rather than as turning a dial.
      if (phase.grab || phase.release) return;
      if (delta) applyKnobDelta(delta);
    },
  });

  // The knee only becomes clickable once there is a knee to click.
  passenger.ready
    .then(() => interaction.addTarget(passenger.knee))
    .catch((e) => console.error('passenger failed to load', e));

  // ---- start gesture ----
  // It only puts the user in the driver's seat: the tape is loaded but silent
  // until they press a control on the radio itself.
  startButton.addEventListener('click', () => {
    overlay.classList.add('hide');
    player.arm();
    lcd.flashStatus('PRESS VOL', 2200);
    setTimeout(() => { overlay.hidden = true; }, 800);
  });

  // The button is labelled [ENTER], so Enter has to work. Routed through the
  // button rather than duplicating the handler, so the browser still counts it
  // as the gesture that unblocks audio.
  window.addEventListener('keydown', (e) => {
    if (overlay.hidden || overlay.classList.contains('hide')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    startButton.click();
  });

  // Debug handle, handy when checking framing from the console.
  window.__player = { camera, radio, cameraRig, scene, player, renderer, render, lcd, passenger, cat, interaction };

  // ---- frame loop ----
  const clock = new THREE.Clock();
  function frame() {
    const now = performance.now();
    const dt = clock.getDelta();

    driving.update(dt);
    // The Impala's rim is baked into the body mesh and cannot turn, so only
    // the empty the hands are parked on takes the steering correction.
    cabin.wheel.rotation.z = driving.steer(now);
    cameraRig.update(now);
    radio.update(now);
    passenger.update(now);
    cat.update(dt, player.isPlaying());
    lcd.update(now);

    // The display's glow breathes a little while a track plays.
    lcdGlow.intensity = player.isPlaying()
      ? 0.05 + Math.sin(now / 420) * 0.008
      : 0.03;

    render();
    requestAnimationFrame(frame);
  }
  frame();
}
