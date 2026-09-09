// First-person head rig. The camera never translates: dragging turns the head
// and the wheel changes focal length, so the panorama stays parallax-correct.

import { clampYaw, clampPitch, clampZoom, ZOOM_MIN, ZOOM_MAX } from './cameraMath.js';

// Framing is defined horizontally — the faceplate is a wide object, and a
// vertical fov alone crops it on portrait viewports.
const HFOV_NEAR = 26;  // close-up: the faceplate fills the frame
const HFOV_FAR = 100;  // wide: steering wheel, windshield, passenger seat
const DRAG_THRESHOLD = 5; // px — beyond this a gesture is a look, not a click

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

export function zoomToFov(z, aspect) {
  const t = (z - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
  const hfov = HFOV_NEAR + t * (HFOV_FAR - HFOV_NEAR);
  return deg(2 * Math.atan(Math.tan(rad(hfov) / 2) / Math.max(aspect, 0.2)));
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

  function update() {
    // Inertial coast after the pointer is released.
    if (!pointerDown) {
      velocity.yaw *= 0.90;
      velocity.pitch *= 0.90;
      if (Math.abs(velocity.yaw) > 1e-5 || Math.abs(velocity.pitch) > 1e-5) {
        state.yaw = clampYaw(state.yaw + velocity.yaw);
        state.pitch = clampPitch(state.pitch + velocity.pitch);
      }
    }
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;

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
