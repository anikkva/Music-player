// First-person head rig. The camera never translates: dragging turns the head
// and the wheel changes focal length, so the panorama stays parallax-correct.

import { clampYaw, clampPitch, clampZoom, ZOOM_MIN, ZOOM_MAX } from './cameraMath.js';

// Framing is solved for BOTH axes. A fov defined on one axis alone crops the
// radio on the other whenever the window is a shape we did not expect — tall,
// square, or very wide — and the opening shot is supposed to hold the whole
// unit.

const DRAG_THRESHOLD = 5; // px — beyond this a gesture is a look, not a click

// Road shake. Sums of incommensurable sines rather than random noise: noise
// jitters the whole frame and reads as a broken renderer, while layered sines
// read as a car. Amplitudes are in radians — a quarter of a degree of tremor
// on top of a slow sway.
const SHAKE = [
  { period: 118, yaw: 0.00042, pitch: 0.00075, roll: 0.00030 },  // engine
  { period: 313, yaw: 0.00090, pitch: 0.00140, roll: 0.00060 },  // surface
  { period: 1970, yaw: 0.00240, pitch: 0.00160, roll: 0.00180 }, // sway
];

function shakeAt(now) {
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  for (const layer of SHAKE) {
    const phase = now / layer.period;
    yaw += Math.sin(phase) * layer.yaw;
    pitch += Math.sin(phase * 1.37 + 1.1) * layer.pitch;
    roll += Math.sin(phase * 0.83 + 2.4) * layer.roll;
  }
  return { yaw, pitch, roll };
}

// Distance from the driver's eyes to the faceplate, and the half-extents of
// the framed region at each end of the zoom range. Near: the radio plus its
// bezel with a margin. Far: the whole cabin ahead of the driver.
const RADIO_DISTANCE = 0.980;
const NEAR_HALF = { w: 0.156, h: 0.095 };
const FAR_HALF = { w: 1.03, h: 0.60 };

const deg = (r) => (r * 180) / Math.PI;

/** Smallest vertical fov that fits `half` on both axes at this aspect. */
function fovFor(half, aspect) {
  const fromHeight = 2 * deg(Math.atan(half.h / RADIO_DISTANCE));
  const fromWidth = 2 * deg(Math.atan(half.w / Math.max(aspect, 0.2) / RADIO_DISTANCE));
  return Math.max(fromHeight, fromWidth);
}

export function zoomToFov(z, aspect) {
  const t = (z - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
  const near = fovFor(NEAR_HALF, aspect);
  const far = fovFor(FAR_HALF, aspect);
  return near + t * (far - near);
}

export function createCameraRig(camera, domElement, { yaw = 0, pitch = 0, zoom = 0.38 } = {}) {
  const state = { yaw: clampYaw(yaw), pitch: clampPitch(pitch), zoom: clampZoom(zoom) };
  const velocity = { yaw: 0, pitch: 0 };

  let pointerDown = false;
  let dragging = false;
  let downAt = { x: 0, y: 0 };
  let last = { x: 0, y: 0 };
  let suppressed = false; // another handler (a knob drag) owns this gesture

  camera.rotation.order = 'YXZ';

  function onPointerDown(e) {
    if (e.button !== 0) return;
    pointerDown = true;
    dragging = false;
    downAt = { x: e.clientX, y: e.clientY };
    last = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e) {
    if (!pointerDown || suppressed) return;
    const dx = e.clientX - downAt.x;
    const dy = e.clientY - downAt.y;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    if (!dragging) {
      dragging = true;
      domElement.classList.add('dragging');
    }

    // Turning speed scales with zoom: at long focal length a pixel is a
    // smaller angle, so close-up looking stays precise.
    const speed = 0.0022 * ((state.zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN) + 0.30);
    velocity.yaw = -(e.clientX - last.x) * speed;
    velocity.pitch = -(e.clientY - last.y) * speed;
    state.yaw = clampYaw(state.yaw + velocity.yaw);
    state.pitch = clampPitch(state.pitch + velocity.pitch);
    last = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp() {
    pointerDown = false;
    suppressed = false;
    domElement.classList.remove('dragging');
    // `dragging` is read by the click handler that fires right after, then
    // cleared on the next frame.
  }

  function onWheel(e) {
    e.preventDefault();
    state.zoom = clampZoom(state.zoom + e.deltaY * 0.0009);
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  function update(now = performance.now()) {
    // Inertial coast after the pointer is released.
    if (!pointerDown) {
      velocity.yaw *= 0.90;
      velocity.pitch *= 0.90;
      if (Math.abs(velocity.yaw) > 1e-5 || Math.abs(velocity.pitch) > 1e-5) {
        state.yaw = clampYaw(state.yaw + velocity.yaw);
        state.pitch = clampPitch(state.pitch + velocity.pitch);
      }
    }
    // Road shake goes on after the limits, not before: it is the car moving
    // under the driver, not the driver looking further than they can.
    const shake = shakeAt(now);
    camera.rotation.y = state.yaw + shake.yaw;
    camera.rotation.x = state.pitch + shake.pitch;
    camera.rotation.z = shake.roll;

    const fov = zoomToFov(state.zoom, camera.aspect);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * 0.18;
      camera.updateProjectionMatrix();
    }
  }

  return {
    update,
    /** True when the gesture that just ended was a look, not a click. */
    wasDragging: () => dragging,
    clearDrag() { dragging = false; },
    /** Hands the current gesture to another handler (knob dragging). */
    suppress() { suppressed = true; dragging = false; },
    state,
  };
}
