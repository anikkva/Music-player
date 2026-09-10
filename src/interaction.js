// Raycasting layer: hover highlight, click-to-press, and knob dragging.
// It reports which control was touched and nothing more — it has no idea that
// a player exists.

import * as THREE from 'three';

const HOVER_EMISSIVE = 0x6a5a20;

export function createInteraction({
  camera, domElement, radio, cameraRig,
  onActivate, onKnobDelta, tooltipEl, labels,
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const targets = [];
  radio.group.traverse((o) => {
    if (o.isMesh && o.userData.control) targets.push(o);
  });

  const originalEmissive = new Map();
  let hovered = null;
  let knobDrag = null;
  let lastClientPos = { x: 0, y: 0 };

  const controlIdOf = (obj) => obj.userData.control;

  function setHighlight(controlId, on) {
    for (const mesh of targets) {
      if (controlIdOf(mesh) !== controlId) continue;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        if (!originalEmissive.has(m)) originalEmissive.set(m, m.emissive.getHex());
        m.emissive.setHex(on ? HOVER_EMISSIVE : originalEmissive.get(m));
      }
    }
  }

  function pick(clientX, clientY) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0] : null;
  }

  function setHovered(controlId) {
    if (hovered === controlId) return;
    if (hovered) setHighlight(hovered, false);
    hovered = controlId;
    if (hovered) setHighlight(hovered, true);

    domElement.classList.toggle('over-control', Boolean(hovered));
    if (tooltipEl) {
      if (hovered && labels[hovered]) {
        tooltipEl.hidden = false;
        tooltipEl.textContent = labels[hovered];
        tooltipEl.style.left = `${lastClientPos.x}px`;
        tooltipEl.style.top = `${lastClientPos.y}px`;
      } else {
        tooltipEl.hidden = true;
      }
    }
  }

  /** Screen-space angle from a knob's centre to the pointer. */
  function angleToPointer(controlId, clientX, clientY) {
    const centre = radio.worldPositionOf(controlId).clone().project(camera);
    const rect = domElement.getBoundingClientRect();
    const cx = rect.left + ((centre.x + 1) / 2) * rect.width;
    const cy = rect.top + ((1 - centre.y) / 2) * rect.height;
    return Math.atan2(clientY - cy, clientX - cx);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const hit = pick(e.clientX, e.clientY);
    if (!hit) return;
    const id = controlIdOf(hit.object);
    if (id !== 'tuneKnob') return;

    // A knob grab owns the gesture; the head must not turn with it.
    cameraRig.suppress();
    knobDrag = { id, lastAngle: angleToPointer(id, e.clientX, e.clientY) };
    onKnobDelta(id, 0, { grab: true });
  }

  function onPointerMove(e) {
    lastClientPos = { x: e.clientX, y: e.clientY };

    if (knobDrag) {
      const angle = angleToPointer(knobDrag.id, e.clientX, e.clientY);
      let delta = angle - knobDrag.lastAngle;
      // Keep the shortest way round, so crossing ±π does not jump.
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      knobDrag.lastAngle = angle;
      onKnobDelta(knobDrag.id, delta, {});
      return;
    }

    if (cameraRig.wasDragging()) {
      setHovered(null);
      return;
    }

    const hit = pick(e.clientX, e.clientY);
    setHovered(hit ? controlIdOf(hit.object) : null);
    if (tooltipEl && !tooltipEl.hidden) {
      tooltipEl.style.left = `${e.clientX}px`;
      tooltipEl.style.top = `${e.clientY}px`;
    }
  }

  function onPointerUp(e) {
    if (knobDrag) {
      onKnobDelta(knobDrag.id, 0, { release: true });
      knobDrag = null;
      cameraRig.clearDrag();
      return;
    }
    if (cameraRig.wasDragging()) {
      cameraRig.clearDrag();
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    if (hit) onActivate(controlIdOf(hit.object));
  }

  // Wheel over the TUNE knob is volume; anywhere else it is camera zoom.
  // Capture phase so this decision happens before the camera rig sees it.
  function onWheel(e) {
    const hit = pick(e.clientX, e.clientY);
    if (!hit || controlIdOf(hit.object) !== 'tuneKnob') return;
    e.preventDefault();
    e.stopPropagation();
    onKnobDelta('tuneKnob', -e.deltaY * 0.004, { wheel: true });
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { capture: true, passive: false });

  return {
    /**
     * Registers a hit target that is not part of the radio — the passenger's
     * knee arrives late, when her model finishes loading.
     */
    addTarget(mesh) {
      if (mesh && !targets.includes(mesh)) targets.push(mesh);
    },
    setBusy(busy) {
      domElement.classList.toggle('busy', busy);
      if (busy) setHovered(null);
    },
  };
}
