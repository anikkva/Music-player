// The passenger in the right-hand seat, and the driver's own legs.
//
// Reference: the character models in GTA San Andreas (docs/reference/). What
// makes those read as people at low polygon counts is not more geometry — it is
// a continuous silhouette and a painted face. So the torso, skirt and hair are
// lathed profiles rather than stacked cylinders, and the face is a texture on a
// curved patch that hugs the skull.
//
// Local origin is the hip point, +y up and -z forward, so the group can be
// dropped onto a seat and turned.

import * as THREE from 'three';

const SKIN = 0x9d7454;
const SKIN_SHADE = 0x825c40;
const DRESS = 0x2e2e39;
const HAIR = 0x1a1310;
const SHOE = 0x0a0a0c;

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const skinMat = () => new THREE.MeshStandardMaterial({
  color: SKIN, roughness: 0.88, metalness: 0.0,
});
const dressMat = () => new THREE.MeshStandardMaterial({
  color: DRESS, roughness: 0.44, metalness: 0.0, side: THREE.DoubleSide,
});
const hairMat = () => new THREE.MeshStandardMaterial({
  color: HAIR, roughness: 0.58, metalness: 0.0, side: THREE.DoubleSide,
});

/** A lathed body section. `profile` is [radius, height] from bottom to top. */
function lathe(profile, material, segments = 28, flatten = 1) {
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(points, segments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.z = flatten;
  return mesh;
}

/** Tapered limb between two points, with smooth ends. */
function limb(group, mat, rTop, rBottom, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, dir.length(), 16, 1),
    mat,
  );
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  group.add(mesh);
  return mesh;
}

function joint(group, mat, r, at, scale = V(1, 1, 1)) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  mesh.position.copy(at);
  mesh.scale.copy(scale);
  group.add(mesh);
  return mesh;
}

/**
 * Face art, drawn onto a transparent canvas and wrapped onto a patch of the
 * skull. Painting the features beats modelling them at this scale — modelled
 * eyes and lips read as beads stuck to a ball.
 */
function faceTexture() {
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const cx = w / 2;

  // Soft contour shading: temples and jaw darker than the centre of the face.
  const shade = ctx.createRadialGradient(cx, h * 0.5, w * 0.10, cx, h * 0.5, w * 0.52);
  shade.addColorStop(0, 'rgba(190, 150, 118, 0.30)');
  shade.addColorStop(1, 'rgba(120, 84, 58, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  const eyeY = h * 0.44;
  const eyeDX = w * 0.145;

  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDX;

    // Eye socket shadow.
    const socket = ctx.createRadialGradient(ex, eyeY, 2, ex, eyeY, 52);
    socket.addColorStop(0, 'rgba(96, 64, 44, 0.42)');
    socket.addColorStop(1, 'rgba(96, 64, 44, 0)');
    ctx.fillStyle = socket;
    ctx.beginPath();
    ctx.arc(ex, eyeY, 52, 0, Math.PI * 2);
    ctx.fill();

    // Almond eye opening.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 34, 17, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#efe9e0';
    ctx.fillRect(ex - 40, eyeY - 24, 80, 48);
    ctx.fillStyle = '#3b2a1c';
    ctx.beginPath();
    ctx.arc(ex + side * 2, eyeY + 2, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d0906';
    ctx.beginPath();
    ctx.arc(ex + side * 2, eyeY + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex + side * 2 - 5, eyeY - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Lash line and lid crease.
    ctx.strokeStyle = '#140d09';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 34, 17, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90, 60, 42, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY - 9, 30, 14, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Brow.
    ctx.strokeStyle = '#1c1310';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - side * 36, eyeY - 44);
    ctx.quadraticCurveTo(ex, eyeY - 60, ex + side * 32, eyeY - 40);
    ctx.stroke();
  }

  // Nose: a shadow down one side and a soft tip.
  ctx.strokeStyle = 'rgba(112, 76, 52, 0.42)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 12, eyeY - 6);
  ctx.quadraticCurveTo(cx - 20, h * 0.55, cx - 12, h * 0.585);
  ctx.stroke();
  ctx.fillStyle = 'rgba(112, 76, 52, 0.35)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 15, h * 0.594, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth.
  const lipY = h * 0.685;
  ctx.fillStyle = '#7c2f33';
  ctx.beginPath();
  ctx.moveTo(cx - 40, lipY);
  ctx.quadraticCurveTo(cx - 20, lipY - 15, cx, lipY - 6);
  ctx.quadraticCurveTo(cx + 20, lipY - 15, cx + 40, lipY);
  ctx.quadraticCurveTo(cx, lipY + 26, cx - 40, lipY);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 14, 16, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 40, lipY);
  ctx.quadraticCurveTo(cx, lipY + 6, cx + 40, lipY);
  ctx.stroke();

  // Blush over the cheekbones.
  for (const side of [-1, 1]) {
    const g = ctx.createRadialGradient(cx + side * 105, h * 0.58, 4, cx + side * 105, h * 0.58, 62);
    g.addColorStop(0, 'rgba(168, 92, 82, 0.22)');
    g.addColorStop(1, 'rgba(168, 92, 82, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx + side * 105, h * 0.58, 62, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // sphere patches run v from the top down
  tex.anisotropy = 8;
  return tex;
}

function buildHead(group) {
  const skin = skinMat();
  const hair = hairMat();
  const R = 0.093;

  // Skull, slightly egg-shaped.
  const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 22), skin);
  skull.scale.set(0.90, 1.10, 0.98);
  skull.position.set(0, 0.695, -0.012);
  group.add(skull);

  // Jaw and chin, tapering forward from the skull.
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(R * 0.80, 22, 16), skin);
  jaw.scale.set(0.92, 0.80, 1.0);
  jaw.position.set(0, 0.646, -0.030);
  group.add(jaw);

  const chin = new THREE.Mesh(new THREE.SphereGeometry(R * 0.42, 16, 12), skin);
  chin.scale.set(1.0, 0.82, 0.9);
  chin.position.set(0, 0.622, -0.056);
  group.add(chin);

  // Ears.
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(R * 0.30, 12, 10), skin);
    ear.scale.set(0.35, 1.0, 0.65);
    ear.position.set(side * R * 0.86, 0.688, 0.002);
    group.add(ear);
  }

  // Painted face on a patch of the skull, facing -z.
  const phiLength = 1.55;
  const thetaLength = 1.55;
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(
      R * 1.008, 40, 32,
      (3 * Math.PI) / 2 - phiLength / 2, phiLength,
      Math.PI / 2 - thetaLength / 2, thetaLength,
    ),
    new THREE.MeshStandardMaterial({
      map: faceTexture(), transparent: true, roughness: 0.88,
      color: SKIN, side: THREE.FrontSide,
    }),
  );
  face.scale.copy(skull.scale);
  face.position.copy(skull.position);
  group.add(face);

  // Hair: a cap over the skull plus a lathed fall down the back.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.07, 30, 22, 0, Math.PI * 2, 0, Math.PI * 0.66), hair);
  cap.scale.set(0.98, 1.06, 1.04);
  cap.position.set(0, 0.694, 0.002);
  cap.rotation.x = -0.10;
  group.add(cap);

  const fall = lathe([
    [0.012, -0.26], [0.040, -0.23], [0.058, -0.16],
    [0.068, -0.08], [0.072, -0.01], [0.066, 0.035],
  ], hair, 24, 0.52);
  fall.position.set(0, 0.700, 0.048);
  group.add(fall);

  // Locks in front of the ears: flat planes hugging the cheek, not free-
  // standing cylinders — a rounded strand reads as a spike from the side.
  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.PlaneGeometry(0.040, 0.185, 1, 4), hair);
    lock.position.set(side * 0.081, 0.618, -0.018);
    lock.rotation.set(0.04, side * (Math.PI / 2 - 0.42), 0);
    group.add(lock);
  }
}

export function createPassenger() {
  const group = new THREE.Group();
  const skin = skinMat();
  const dress = dressMat();

  // ---- torso: one continuous lathed silhouette ----

  const torso = lathe([
    [0.152, -0.02], [0.146, 0.04], [0.126, 0.10], [0.116, 0.15],
    [0.126, 0.22], [0.147, 0.29], [0.144, 0.35], [0.128, 0.41],
    [0.104, 0.45], [0.074, 0.475],
  ], dress, 30, 0.74);
  torso.position.set(0, 0.0, -0.005);
  group.add(torso);

  // Bare shoulders and collarbone above the neckline.
  const shoulderLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.030, 0.235, 16), skin);
  shoulderLine.rotation.z = Math.PI / 2;
  shoulderLine.position.set(0, 0.478, -0.012);
  group.add(shoulderLine);

  for (const side of [-1, 1]) {
    joint(group, skin, 0.044, V(side * 0.128, 0.472, -0.012), V(1, 0.95, 0.92));
    // Dress strap over the shoulder.
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.075, 0.014), dress);
    strap.position.set(side * 0.076, 0.462, -0.048);
    strap.rotation.set(0.12, 0, side * 0.18);
    group.add(strap);
  }

  // ---- short skirt over the hips, lying along the thighs ----

  const skirt = lathe([
    [0.150, 0.010], [0.176, -0.045], [0.208, -0.100], [0.224, -0.140],
  ], dress, 30, 0.90);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.224, 0.010, 8, 34), dress);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = -0.140;
  skirt.add(hem);
  skirt.position.set(0, 0.03, -0.02);
  skirt.rotation.x = 0.52;
  group.add(skirt);

  // ---- neck and head ----

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.050, 0.115, 16), skin);
  neck.position.set(0, 0.548, -0.008);
  neck.rotation.x = -0.05;
  group.add(neck);

  buildHead(group);

  // ---- legs ----

  for (const side of [-1, 1]) {
    const hip = V(side * 0.082, -0.015, -0.020);
    const knee = V(side * 0.100, -0.080, -0.355);
    const ankle = V(side * 0.126, -0.415, -0.440);

    joint(group, skin, 0.070, hip, V(1, 0.9, 1));
    limb(group, skin, 0.068, 0.049, hip, knee);          // thigh
    joint(group, skin, 0.048, knee, V(1, 0.9, 1));
    limb(group, skin, 0.046, 0.028, knee, ankle);        // calf
    joint(group, skin, 0.027, ankle);

    const shoeMat = new THREE.MeshStandardMaterial({
      color: SHOE, roughness: 0.32, metalness: 0.18,
    });
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.030, 0.150), shoeMat);
    foot.position.set(side * 0.128, -0.442, -0.500);
    foot.rotation.x = 0.20;
    group.add(foot);

    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.029, 12, 10), shoeMat);
    toe.scale.set(1.0, 0.55, 1.5);
    toe.position.set(side * 0.128, -0.448, -0.566);
    group.add(toe);

    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.072, 8), shoeMat);
    heel.position.set(side * 0.128, -0.485, -0.442);
    group.add(heel);
  }

  // ---- arms, resting in the lap ----

  for (const side of [-1, 1]) {
    const shoulder = V(side * 0.135, 0.455, -0.014);
    const elbow = V(side * 0.158, 0.225, -0.050);
    const wrist = V(side * 0.122, 0.070, -0.185);

    limb(group, skin, 0.038, 0.028, shoulder, elbow);
    joint(group, skin, 0.028, elbow);
    limb(group, skin, 0.027, 0.021, elbow, wrist);
    joint(group, skin, 0.021, wrist);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.030, 14, 12), skin);
    hand.scale.set(0.62, 0.42, 1.35);
    hand.position.set(side * 0.114, 0.058, -0.222);
    hand.rotation.set(0.28, side * 0.14, 0);
    group.add(hand);
  }

  // Every surface is smooth-shaded; faceted limbs were what made the first
  // pass read as a mannequin.
  group.traverse((o) => {
    if (o.isMesh && o.geometry.computeVertexNormals) o.geometry.computeVertexNormals();
  });

  return { group };
}

/**
 * The driver's own knees, seen when looking down. Just enough to place the
 * viewer's body in the seat — the rest of the driver is behind the camera.
 */
export function createDriverLegs() {
  const group = new THREE.Group();
  const denim = new THREE.MeshStandardMaterial({ color: 0x262932, roughness: 0.95 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.7 });

  for (const side of [-1, 1]) {
    const x = -0.42 + side * 0.145;
    const hip = V(x, -0.60, 0.16);
    const knee = V(x + side * 0.02, -0.66, -0.30);
    const ankle = V(x + side * 0.01, -0.99, -0.46);

    limb(group, denim, 0.098, 0.078, hip, knee);
    joint(group, denim, 0.078, knee, V(1, 0.85, 1.05));
    limb(group, denim, 0.072, 0.054, knee, ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.055, 0.22), shoe);
    foot.position.set(x + side * 0.01, -1.00, -0.55);
    foot.rotation.x = 0.12;
    group.add(foot);

    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), shoe);
    toe.scale.set(0.96, 0.52, 1.15);
    toe.position.set(x + side * 0.01, -1.005, -0.652);
    group.add(toe);
  }

  return { group };
}
