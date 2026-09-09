// Renderer, lighting and the panorama sphere that stands in for the world
// outside the glass.

import * as THREE from 'three';
import { loadPanorama } from './textures.js';

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
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 0, 0);

  // Panorama sphere, seen through the windows.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(30, 64, 40),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false }),
  );
  scene.add(sky);

  loadPanorama('assets/textures/panorama.jpg').then((tex) => {
    sky.material.map = tex;
    sky.material.needsUpdate = true;
  });

  // Night cabin: almost no fill, a cold wash from the windshield, and a warm
  // pool of light thrown by the display itself.
  scene.add(new THREE.AmbientLight(0x3d4855, 1.15));

  const windshield = new THREE.DirectionalLight(0x9db6d0, 1.25);
  windshield.position.set(-0.4, 1.2, -3);
  scene.add(windshield);

  const streetlight = new THREE.DirectionalLight(0xffb768, 0.55);
  streetlight.position.set(2.5, 1.5, -1);
  scene.add(streetlight);

  // Fill from over the driver's shoulder. Without it the dashboard and the
  // faceplate face away from every other light and read as flat silhouettes.
  const cabinFill = new THREE.DirectionalLight(0x93a6bb, 0.95);
  cabinFill.position.set(0.8, 1.4, 2.2);
  scene.add(cabinFill);

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
