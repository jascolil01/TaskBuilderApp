import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AttributeKey } from '../types';
import { capeJoint, STRIDE, walkPose } from '../lib/walk';

/**
 * Every class shares one rig and one walk cycle; what changes is the palette
 * and the kit hung off the hands, head and shoulders. Keeping the silhouette
 * work in geometry (rather than textures) means the whole thing stays a few
 * dozen cheap primitives and needs no art assets.
 */

interface Palette {
  /** The dominant attribute colour — the garment you read the class by. */
  garment: number;
  /** Accent for trim, sashes and cloth edges. */
  trim: number;
  skin: number;
  leather: number;
  metal: number;
  /** Boots, hair, and anything that needs to sit back in shadow. */
  dark: number;
  /** Emissive colour for glowing kit (orbs, staff tips, halos). */
  glow: number;
}

const PALETTES: Record<AttributeKey, Palette> = {
  STR: { garment: 0xb3372c, trim: 0xe8b45a, skin: 0xd9a279, leather: 0x6b4630, metal: 0x9fa8b4, dark: 0x2c2530, glow: 0xff8a5c },
  DEX: { garment: 0x4a9d5f, trim: 0xd6c48a, skin: 0xd9a279, leather: 0x6b4630, metal: 0x9fa8b4, dark: 0x24302a, glow: 0x4fd98a },
  CON: { garment: 0xc9922b, trim: 0xf0dca4, skin: 0xd9a279, leather: 0x5c3f2a, metal: 0x8f98a6, dark: 0x33291c, glow: 0xffd98a },
  INT: { garment: 0x3f8fd6, trim: 0xa9d6ff, skin: 0xd9a279, leather: 0x5a4a6b, metal: 0x9fa8b4, dark: 0x1f2a3d, glow: 0x4fb8ff },
  WIS: { garment: 0x9b7fd4, trim: 0xe6dcff, skin: 0xd9a279, leather: 0x584a72, metal: 0xc9c2dd, dark: 0x2a2440, glow: 0xb89aff },
  CHA: { garment: 0xe07bb0, trim: 0xffd9ec, skin: 0xd9a279, leather: 0x7a4b5e, metal: 0xd9b06a, dark: 0x3a2233, glow: 0xff7ec0 },
};

/** One material per palette slot, shared across every mesh that uses it. */
function buildMaterials(p: Palette) {
  return {
    garment: new THREE.MeshStandardMaterial({ color: p.garment, roughness: 0.62, metalness: 0.05 }),
    trim: new THREE.MeshStandardMaterial({ color: p.trim, roughness: 0.5, metalness: 0.12 }),
    skin: new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.78, metalness: 0 }),
    leather: new THREE.MeshStandardMaterial({ color: p.leather, roughness: 0.85, metalness: 0.02 }),
    metal: new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.28, metalness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.8, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({
      color: p.glow,
      emissive: p.glow,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    }),
  };
}

type Materials = ReturnType<typeof buildMaterials>;

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function pivot(x: number, y: number, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

/** Hip -> thigh -> knee -> shin -> boot. The knee group is what bends. */
function buildLeg(m: Materials, side: -1 | 1) {
  const hip = pivot(side * 0.15, 0.84, 0);
  hip.add(box(0.22, 0.36, 0.24, m.garment, 0, -0.18, 0));

  const knee = pivot(0, -0.34, 0);
  knee.add(box(0.19, 0.32, 0.2, m.leather, 0, -0.16, 0));
  const boot = box(0.24, 0.16, 0.3, m.dark, 0, -0.38, 0.03);
  knee.add(boot);
  hip.add(knee);

  return { hip, knee };
}

/** Shoulder -> upper arm -> elbow -> forearm -> hand. Kit hangs off the hand. */
function buildArm(m: Materials, side: -1 | 1) {
  const shoulder = pivot(side * 0.35, 1.44, 0);
  shoulder.add(box(0.18, 0.3, 0.18, m.garment, 0, -0.15, 0));

  const elbow = pivot(0, -0.3, 0);
  elbow.add(box(0.165, 0.28, 0.165, m.leather, 0, -0.14, 0));
  const hand = pivot(0, -0.3, 0);
  hand.add(box(0.15, 0.14, 0.16, m.skin));
  elbow.add(hand);
  shoulder.add(elbow);

  return { shoulder, elbow, hand };
}

/** A short chain of panels so the cloak can trail a beat behind the walk. */
function buildCape(m: Materials) {
  const root = pivot(0, 0.66, -0.19);
  let parent: THREE.Group = root;
  const joints: THREE.Group[] = [];
  const widths = [0.52, 0.48, 0.4];
  for (let i = 0; i < widths.length; i++) {
    const joint = pivot(0, i === 0 ? 0 : -0.26, 0);
    joint.add(box(widths[i], 0.28, 0.04, i === 0 ? m.trim : m.garment, 0, -0.14, 0));
    parent.add(joint);
    joints.push(joint);
    parent = joint;
  }
  return { root, joints };
}

/** Sits over the crown and back of the head rather than through it. */
function buildHood(mat: THREE.Material) {
  const hood = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.42, 10), mat);
  cone.position.set(0, 0.58, -0.07);
  cone.rotation.x = 0.18;
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 10), mat);
  cowl.position.set(0, 0.36, -0.05);
  hood.add(cone, cowl);
  return hood;
}

interface ArmHold {
  shoulderX: number;
  shoulderZ: number;
  elbowX: number;
}

/**
 * Arms that carry their kit in a fixed ready pose instead of swinging with the
 * walk. A sword hanging off a straight arm reads as luggage; brought up across
 * the body it reads as a warrior.
 */
const KIT_HOLDS: Partial<Record<AttributeKey, { right?: ArmHold; left?: ArmHold }>> = {
  STR: { right: { shoulderX: -0.38, shoulderZ: 0.34, elbowX: -1.3 } },
  CON: { left: { shoulderX: -0.3, shoulderZ: -0.44, elbowX: -1.3 } },
  WIS: { right: { shoulderX: -0.34, shoulderZ: 0.3, elbowX: -1.45 } },
  // A staff and a bow are carried, not brandished — the arm stays low, but it
  // still has to stop swinging, or the shaft scythes around like a metronome.
  INT: { right: { shoulderX: -0.14, shoulderZ: 0.26, elbowX: -0.22 } },
  DEX: { right: { shoulderX: -0.18, shoulderZ: 0.58, elbowX: -0.26 } },
};

/**
 * A child of the hand whose orientation cancels everything the shoulder and
 * elbow did, so kit can be aimed in the character's own frame — +Y up, +Z the
 * way they face — instead of in whatever frame the elbow happened to leave
 * behind. Without this, "point the blade forward" means a different local
 * rotation for every arm pose, which is how the sword ended up aimed backwards.
 */
function makeGrip(hand: THREE.Group, root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const grip = new THREE.Group();
  const q = new THREE.Quaternion();
  hand.getWorldQuaternion(q);
  grip.quaternion.copy(q.invert());
  hand.add(grip);
  return grip;
}

interface Kit {
  /** Called every frame with the elapsed time, for kit that glows or floats. */
  tick?: (t: number) => void;
}

/**
 * Per-class gear. Weapons go in the right hand and shields on the left
 * forearm, so they swing with the body instead of floating alongside it.
 */
function buildKit(
  attribute: AttributeKey,
  m: Materials,
  head: THREE.Group,
  torso: THREE.Group,
  rightGrip: THREE.Group,
  leftGrip: THREE.Group,
): Kit {
  switch (attribute) {
    case 'STR': {
      // Broadsword, gripped point-up, plus pauldrons to widen the silhouette.
      const sword = pivot(0.02, 0.0, 0.06);
      // The blade's flat lies perpendicular to X so it faces the camera at the
      // three-quarter view; edge-on it just read as a grey pole. The crossguard
      // runs the other way, across the flat, as a real one does.
      sword.add(box(0.05, 0.72, 0.14, m.metal, 0, 0.49, 0));
      sword.add(box(0.055, 0.14, 0.12, m.metal, 0, 0.91, 0));
      sword.add(box(0.1, 0.075, 0.38, m.trim, 0, 0.14, 0));
      sword.add(box(0.08, 0.22, 0.085, m.leather, 0, 0.01, 0));
      sword.add(box(0.1, 0.08, 0.1, m.trim, 0, -0.13, 0));
      sword.rotation.x = 0.7;
      sword.rotation.z = -0.16;
      rightGrip.add(sword);
      const pauldron = (x: number) => {
        const p = box(0.3, 0.18, 0.32, m.metal, x, 0.64, 0);
        p.rotation.z = x > 0 ? -0.25 : 0.25;
        return p;
      };
      torso.add(pauldron(-0.38), pauldron(0.38));
      head.add(box(0.52, 0.15, 0.5, m.metal, 0, 0.45, 0));
      head.add(box(0.08, 0.19, 0.48, m.trim, 0, 0.57, 0));
      return {};
    }
    case 'DEX': {
      // Hood, quiver and a light blade — a scout, not a duelist.
      head.add(buildHood(m.garment));
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.44, 8), m.leather);
      quiver.position.set(-0.3, 0.66, -0.16);
      quiver.rotation.z = 0.42;
      torso.add(quiver);
      for (let i = -1; i <= 1; i++) {
        const fletch = box(0.025, 0.18, 0.025, m.trim, -0.4 + i * 0.05, 0.92, -0.16);
        fletch.rotation.z = 0.42;
        torso.add(fletch);
      }
      torso.add(box(0.09, 0.5, 0.09, m.leather, -0.05, 0.5, -0.2));

      // Two straight limbs and a string read as a bow at this scale; a smooth
      // torus just looked like a hoop hanging off the hand.
      const bow = pivot(0.19, 0.02, -0.1);
      const limb = (dir: 1 | -1) => {
        const l = box(0.06, 0.52, 0.06, m.leather, 0, dir * 0.28, -0.1);
        l.rotation.x = dir * -0.38;
        return l;
      };
      bow.add(limb(1), limb(-1));
      bow.add(box(0.08, 0.2, 0.1, m.trim));
      bow.rotation.x = -0.16;
      bow.add(box(0.016, 1.0, 0.016, m.trim, 0, 0, -0.205));
      rightGrip.add(bow);
      return {};
    }
    case 'CON': {
      // Tower shield on the off arm, helm with a crest.
      const shield = pivot(-0.04, 0.0, 0.16);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 8), m.metal);
      face.rotation.x = Math.PI / 2;
      shield.add(face);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 8), m.trim);
      shield.add(rim);
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 8), m.trim);
      boss.rotation.x = Math.PI / 2;
      boss.position.z = 0.05;
      shield.add(boss);
      shield.rotation.y = 0.12;
      leftGrip.add(shield);
      head.add(box(0.52, 0.16, 0.52, m.metal, 0, 0.4, 0));
      head.add(box(0.08, 0.2, 0.44, m.trim, 0, 0.54, 0));
      torso.add(box(0.64, 0.1, 0.4, m.metal, 0, 0.5, 0));
      return {};
    }
    case 'INT': {
      // Wide-brimmed pointed hat and a staff with a lit crystal.
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 14), m.garment);
      brim.position.y = 0.4;
      head.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.46, 14), m.garment);
      cone.position.set(0, 0.6, -0.02);
      cone.rotation.x = -0.16;
      head.add(cone);
      head.add(box(0.46, 0.07, 0.46, m.trim, 0, 0.43, 0));

      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.46, 0.46, 10), m.garment);
      robe.position.y = 0.1;
      robe.castShadow = true;
      torso.add(robe);

      const staff = pivot(0.21, 0.24, -0.05);
      staff.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.46, 8), m.leather));
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), m.glow);
      crystal.position.y = 0.8;
      staff.add(crystal);
      staff.rotation.z = 0.02;
      staff.rotation.x = -0.42;
      rightGrip.add(staff);
      return {
        tick: (t) => {
          crystal.rotation.y = t * 1.4;
          m.glow.emissiveIntensity = 0.45 + Math.sin(t * 2.6) * 0.2;
        },
      };
    }
    case 'WIS': {
      // Halo, hooded robe, prayer beads — everything reads calm and vertical.
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.038, 8, 26), m.glow);
      halo.position.y = 0.68;
      halo.rotation.x = Math.PI / 2;
      head.add(halo);
      head.add(buildHood(m.garment));

      const tome = pivot(0.0, 0.02, 0.14);
      tome.add(box(0.32, 0.38, 0.1, m.leather));
      tome.add(box(0.27, 0.34, 0.12, m.trim));
      tome.add(box(0.3, 0.05, 0.13, m.glow, 0, 0.02, 0));
      tome.rotation.set(-0.95, 0.25, 0.1);
      rightGrip.add(tome);
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 0.5, 10), m.garment);
      robe.position.y = 0.08;
      robe.castShadow = true;
      torso.add(robe);
      torso.add(box(0.5, 0.07, 0.36, m.trim, 0, 0.34, 0));
      return {
        tick: (t) => {
          halo.position.y = 0.68 + Math.sin(t * 2) * 0.04;
          halo.rotation.z = t * 0.8;
          m.glow.emissiveIntensity = 0.42 + Math.sin(t * 2) * 0.16;
        },
      };
    }
    case 'CHA': {
      // Feathered cap and a lute slung across the chest.
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.16, 10), m.garment);
      cap.position.y = 0.42;
      head.add(cap);
      const feather = box(0.03, 0.26, 0.09, m.trim, 0.24, 0.52, -0.06);
      feather.rotation.z = -1.0;
      head.add(feather);

      const lute = pivot(0.06, 0.34, 0.24);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), m.leather);
      bowl.scale.set(1.3, 1.4, 0.62);
      lute.add(bowl);
      lute.add(box(0.085, 0.62, 0.06, m.leather, 0, 0.44, 0));
      lute.add(box(0.14, 0.12, 0.085, m.trim, 0, 0.8, 0));
      lute.rotation.set(0.12, -0.3, 0.82);
      lute.position.set(0.02, 0.32, 0.28);
      torso.add(lute);

      const soundHole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), m.glow);
      soundHole.rotation.x = Math.PI / 2;
      soundHole.position.set(0, 0.02, 0.12);
      lute.add(soundHole);
      return {
        tick: (t) => {
          m.glow.emissiveIntensity = 0.5 + Math.sin(t * 4.2) * 0.2;
        },
      };
    }
  }
}

function buildCharacter(attribute: AttributeKey) {
  const m = buildMaterials(PALETTES[attribute]);
  const root = new THREE.Group();
  /** Everything below the root, so the walk bob never fights the patrol path. */
  const body = new THREE.Group();
  root.add(body);

  const legs = { left: buildLeg(m, -1), right: buildLeg(m, 1) };
  body.add(legs.left.hip, legs.right.hip);

  // The torso pivots at the waist so it can counter-twist against the arms.
  const torso = pivot(0, 0.84, 0);
  torso.add(box(0.6, 0.7, 0.36, m.garment, 0, 0.35, 0));
  torso.add(box(0.62, 0.09, 0.38, m.leather, 0, 0.06, 0));
  torso.add(box(0.14, 0.11, 0.42, m.trim, 0, 0.06, 0));
  body.add(torso);

  const arms = { left: buildArm(m, -1), right: buildArm(m, 1) };
  torso.add(arms.left.shoulder, arms.right.shoulder);
  arms.left.shoulder.position.y -= 0.84;
  arms.right.shoulder.position.y -= 0.84;
  arms.left.shoulder.rotation.z = -0.13;
  arms.right.shoulder.rotation.z = 0.13;

  // Lock any carrying arm into its ready pose BEFORE the grips are measured,
  // so each grip cancels the pose its own arm actually ended up in.
  const holds = KIT_HOLDS[attribute] ?? {};
  const held = { left: !!holds.left, right: !!holds.right };
  for (const side of ['left', 'right'] as const) {
    const hold = holds[side];
    if (!hold) continue;
    arms[side].shoulder.rotation.x = hold.shoulderX;
    arms[side].shoulder.rotation.z = hold.shoulderZ;
    arms[side].elbow.rotation.x = hold.elbowX;
  }

  torso.add(box(0.2, 0.12, 0.2, m.skin, 0, 0.72, 0));

  const head = pivot(0, 0.76, 0);
  head.add(box(0.48, 0.48, 0.46, m.skin, 0, 0.24, 0));
  // A thin cap of hair that any headgear can sit cleanly on top of.
  head.add(box(0.46, 0.13, 0.44, m.dark, 0, 0.43, -0.01));
  // Eyes sit just proud of the face so they stay readable at thumbnail size.
  head.add(box(0.07, 0.09, 0.02, m.dark, -0.11, 0.26, 0.235));
  head.add(box(0.07, 0.09, 0.02, m.dark, 0.11, 0.26, 0.235));
  torso.add(head);

  const cape = buildCape(m);
  torso.add(cape.root);

  const grips = { right: makeGrip(arms.right.hand, root), left: makeGrip(arms.left.hand, root) };
  const kit = buildKit(attribute, m, head, torso, grips.right, grips.left);

  return { root, body, legs, arms, torso, head, cape, kit, held, materials: m };
}

/** A soft radial blob that sits under the feet as a grounding aura. */
function buildAura(color: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({ map: texture, color, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

export function WalkingCharacter3D({ attribute }: { attribute: AttributeKey }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.62, 4.5);
    camera.lookAt(0, 1.17, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.32;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const key = new THREE.DirectionalLight(0xfff2d9, 2.5);
    key.position.set(2.6, 4.5, 5.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.002;
    scene.add(key);
    // A cool rim from behind separates the character from the dark card.
    const rim = new THREE.DirectionalLight(0x8ec5ff, 0.9);
    rim.position.set(-3.5, 2.5, -3.5);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd9b0, 0.6);
    fill.position.set(-2.5, 0.8, 3.5);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.ShadowMaterial({ opacity: 0.45 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const rig = buildCharacter(attribute);
    scene.add(rig.root);

    const aura = buildAura(PALETTES[attribute].garment);
    if (aura) scene.add(aura);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const clock = new THREE.Clock();
    const PATROL_RANGE = 1.28;
    // Three-quarter view: mostly facing the way they're walking, but angled
    // toward the viewer so you can still see the face and the kit.
    const FACING = (Math.PI / 2) * 0.62;
    let direction = 1;
    let targetRotationY = FACING;
    rig.root.rotation.y = FACING;
    let frameId = 0;
    let running = true;

    const pose = (t: number) => {
      const phase = t * STRIDE;
      const p = walkPose(phase);

      rig.legs.left.hip.rotation.x = p.leftHip;
      rig.legs.right.hip.rotation.x = p.rightHip;
      rig.legs.left.knee.rotation.x = p.leftKnee;
      rig.legs.right.knee.rotation.x = p.rightKnee;

      // An arm carrying kit holds its pose; only free arms swing.
      if (!rig.held.left) {
        rig.arms.left.shoulder.rotation.x = p.leftShoulder;
        rig.arms.left.elbow.rotation.x = p.leftElbow;
      }
      if (!rig.held.right) {
        rig.arms.right.shoulder.rotation.x = p.rightShoulder;
        rig.arms.right.elbow.rotation.x = p.rightElbow;
      }

      rig.body.position.y = p.bob;
      rig.torso.rotation.y = p.torsoTwist;
      rig.torso.rotation.x = 0.05;
      rig.head.rotation.y = p.headTurn;
      rig.head.rotation.x = p.headNod;

      rig.cape.joints.forEach((joint, i) => {
        const c = capeJoint(phase, i);
        joint.rotation.x = c.x;
        joint.rotation.z = c.z;
      });

      rig.kit.tick?.(t);
    };

    const animate = () => {
      if (!running) return;
      if (!reducedMotion) frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      pose(t);

      rig.root.position.x += direction * 0.011;
      if (rig.root.position.x > PATROL_RANGE) {
        rig.root.position.x = PATROL_RANGE;
        direction = -1;
        targetRotationY = -FACING;
      } else if (rig.root.position.x < -PATROL_RANGE) {
        rig.root.position.x = -PATROL_RANGE;
        direction = 1;
        targetRotationY = FACING;
      }
      rig.root.rotation.y += (targetRotationY - rig.root.rotation.y) * 0.07;
      // Lean into the turn, easing back out once they're facing forward again.
      rig.root.rotation.z = (targetRotationY - rig.root.rotation.y) * 0.12;

      if (aura) aura.position.x = rig.root.position.x;

      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      // Hold a mid-stride pose rather than standing to attention.
      pose(0.42);
      renderer.render(scene, camera);
    } else {
      frameId = requestAnimationFrame(animate);
    }

    const handleVisibility = () => {
      if (reducedMotion) return;
      running = document.visibilityState === 'visible';
      if (running) frameId = requestAnimationFrame(animate);
      else cancelAnimationFrame(frameId);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => {
            if ('map' in mat && mat.map instanceof THREE.Texture) mat.map.dispose();
            mat.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [attribute]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-950/50">
      <div ref={containerRef} className="h-40 w-full" />
    </div>
  );
}
