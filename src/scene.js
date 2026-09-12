// Renderer, lighting and the panorama sphere that stands in for the world
// outside the glass.

import * as THREE from 'three';
import { proceduralPanorama, loadPanorama } from './textures.js';

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext
      && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // The camera sits at the driver's eyes and never moves — turning it is
  // turning a head, and zoom is a focal-length change, not a dolly.
  // Kept close. It was once pushed out to 0.34 to hide the driver's own chest,
  // which the camera sat inside; that shredded him at the wide end of the zoom,
  // because clipping runs on depth along the view axis and his thighs measured
  // barely 0.3 m of depth from 65 degrees off-centre. There is no driver model
  // at all now, so nothing needs hiding and the plane can stay where it belongs.
  const NEAR = 0.05;
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, NEAR, 100);
  camera.position.set(0, 0, 0);

  // Panorama sphere, seen through the windows.
  // A photographed 360 of a wet street at dusk. The drawn one it replaces read
  // as a cartoon the moment anything photoreal sat in front of it. It starts
  // on the procedural sky so the first frame is never empty, then swaps.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(30, 64, 40),
    new THREE.MeshBasicMaterial({
      map: proceduralPanorama(), side: THREE.BackSide, toneMapped: false,
    }),
  );
  scene.add(sky);

  loadPanorama('assets/textures/panorama.jpg').then((tex) => {
    sky.material.map = tex;
    sky.material.needsUpdate = true;
  });

  // Night cabin. It still reads as night, but every surface gets enough light
  // to show its shape — a cabin lit only by the display was unreadable.
  scene.add(new THREE.AmbientLight(0x4a5a72, 1.6));

  // Cold wash coming in through the windshield.
  const windshield = new THREE.DirectionalLight(0xa8c2dc, 1.6);
  windshield.position.set(-0.4, 1.2, -3);
  scene.add(windshield);

  // Sodium street lighting sweeping in from the right.
  const streetlight = new THREE.DirectionalLight(0xffb768, 0.9);
  streetlight.position.set(2.5, 1.5, -1);
  scene.add(streetlight);

  // Fill from over the driver's shoulder. Without it the dashboard and the
  // faceplate face away from every other light and read as flat silhouettes.
  const cabinFill = new THREE.DirectionalLight(0x9fb3c8, 1.35);
  cabinFill.position.set(0.8, 1.4, 2.2);
  scene.add(cabinFill);

  // Soft dome light under the headliner: catches the seats, the door cards and
  // the top of the dashboard, which no directional light reaches well.
  const dome = new THREE.PointLight(0xcdd8e6, 0.55, 4.5, 2);
  dome.position.set(0, 0.45, -0.05);
  scene.add(dome);

  // A cool bounce off the floor, so nothing bottoms out to pure black.
  const bounce = new THREE.HemisphereLight(0x6b7f99, 0x1a1815, 0.65);
  scene.add(bounce);

  // The LCD's own glow. Point lights fall off with the square of distance and
  // this one sits ~13 cm off the panel, so its intensity is small by design.
  const lcdGlow = new THREE.PointLight(0xffc21a, 0.05, 1.2, 2);
  lcdGlow.position.set(0.34, -0.30, -0.60);
  scene.add(lcdGlow);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { scene, camera, renderer, lcdGlow, render: () => renderer.render(scene, camera) };
}
