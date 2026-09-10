import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AttributeKey } from '../types';
import { type ClassId, getClassDef } from '../lib/classes';
import { capeJoint, STRIDE, walkPose } from '../lib/walk';
import { type CosmeticSlot, getEquippedBySlot } from '../lib/gear';

/**
 * Every class shares one rig and one walk cycle; what changes is the palette
 * and the kit hung off the hands, head and shoulders. Kit is organised into
 * cosmetic slots so a purchased piece can replace the class default without
 * either side knowing about the other.
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

/**
 * Palette still keys off an attribute rather than a class: colour carries the
 * *meaning* here — Strength is blood red, Intelligence is mana blue — and two
 * Charisma classes should read as the same kind of character. Silhouette is
 * what separates a Bard from a Warlock, not hue.
 */
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
    gold: new THREE.MeshStandardMaterial({ color: 0xe8b552, roughness: 0.34, metalness: 0.3 }),
    palette: p,
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

/**
 * A standalone additive material, so one mote can fade without the rest.
 * Additive rather than lit: an unlit emissive quad over a near-black card just
 * reads as a dull smudge, where additive actually glows.
 */
function glowMat(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Hip -> thigh -> knee -> shin. Boots hang off the knee as a cosmetic slot. */
function buildLeg(m: Materials, side: -1 | 1) {
  const hip = pivot(side * 0.15, 0.84, 0);
  hip.add(box(0.22, 0.36, 0.24, m.garment, 0, -0.18, 0));

  const knee = pivot(0, -0.34, 0);
  knee.add(box(0.19, 0.32, 0.2, m.leather, 0, -0.16, 0));
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
const BLADE_HOLD: ArmHold = { shoulderX: -0.38, shoulderZ: 0.34, elbowX: -1.3 };
const SHIELD_HOLD: ArmHold = { shoulderX: -0.3, shoulderZ: -0.44, elbowX: -1.3 };
const TOME_HOLD: ArmHold = { shoulderX: -0.34, shoulderZ: 0.3, elbowX: -1.45 };
// A staff and a bow are carried, not brandished — the arm stays low, but it
// still has to stop swinging, or the shaft scythes around like a metronome.
const SHAFT_HOLD: ArmHold = { shoulderX: -0.14, shoulderZ: 0.26, elbowX: -0.22 };
const BOW_HOLD: ArmHold = { shoulderX: -0.18, shoulderZ: 0.58, elbowX: -0.26 };

const KIT_HOLDS: Partial<Record<ClassId, { right?: ArmHold; left?: ArmHold }>> = {
  barbarian: { right: BLADE_HOLD },
  fighter: { right: BLADE_HOLD, left: SHIELD_HOLD },
  paladin: { right: BLADE_HOLD, left: SHIELD_HOLD },
  rogue: { right: BLADE_HOLD, left: BLADE_HOLD },
  cleric: { right: TOME_HOLD },
  warlock: { right: TOME_HOLD },
  wizard: { right: SHAFT_HOLD },
  monk: { right: SHAFT_HOLD },
  druid: { right: SHAFT_HOLD },
  ranger: { right: BOW_HOLD },
  sorcerer: { right: { shoulderX: -0.5, shoulderZ: 0.3, elbowX: -1.1 } },
};

/**
 * A child of the hand whose orientation cancels everything the shoulder and
 * elbow did, so kit can be aimed in the character's own frame — +Y up, +Z the
 * way they face — instead of in whatever frame the elbow happened to leave
 * behind.
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

/** Everything a slot builder is allowed to attach itself to. */
interface SlotCtx {
  m: Materials;
  head: THREE.Group;
  torso: THREE.Group;
  grips: { left: THREE.Group; right: THREE.Group };
  knees: { left: THREE.Group; right: THREE.Group };
  capeRoot: THREE.Group;
  /** Panels the cloak builder registers, so the walk can trail them. */
  capeJoints: THREE.Group[];
  /** Auras live here so the walk bob doesn't drag them around. */
  auraRoot: THREE.Group;
  onTick: (fn: (t: number) => void) => void;
}

type SlotBuilder = (ctx: SlotCtx) => void;

// ---------------------------------------------------------------------------
// Shared slot pieces
// ---------------------------------------------------------------------------

function cloakPanels(ctx: SlotCtx, widths: number[], mats: THREE.Material[], height = 0.28) {
  let parent: THREE.Group = ctx.capeRoot;
  widths.forEach((w, i) => {
    const joint = pivot(0, i === 0 ? 0 : -(height - 0.02), 0);
    joint.add(box(w, height, 0.04, mats[Math.min(i, mats.length - 1)], 0, -height / 2, 0));
    parent.add(joint);
    ctx.capeJoints.push(joint);
    parent = joint;
  });
}

const defaultCloak: SlotBuilder = (ctx) =>
  cloakPanels(ctx, [0.52, 0.48, 0.4], [ctx.m.trim, ctx.m.garment]);

const defaultBoots: SlotBuilder = (ctx) => {
  for (const knee of [ctx.knees.left, ctx.knees.right]) {
    knee.add(box(0.24, 0.16, 0.3, ctx.m.dark, 0, -0.38, 0.03));
  }
};

function hood(mat: THREE.Material, coneR = 0.36, coneH = 0.42) {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(coneR, coneH, 10), mat);
  cone.position.set(0, 0.58, -0.07);
  cone.rotation.x = 0.18;
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 10), mat);
  cowl.position.set(0, 0.36, -0.05);
  group.add(cone, cowl);
  return group;
}

function swordMesh(m: Materials, bladeMat: THREE.Material, guardMat: THREE.Material, w: number, len: number) {
  const sword = pivot(0.02, 0.0, 0.06);
  // The blade's flat lies perpendicular to X so it faces the camera at the
  // three-quarter view; edge-on it just read as a grey pole.
  sword.add(box(0.05, len, w, bladeMat, 0, len / 2 + 0.13, 0));
  sword.add(box(0.055, 0.14, w * 0.85, bladeMat, 0, len + 0.19, 0));
  sword.add(box(0.1, 0.075, w * 2.7, guardMat, 0, 0.14, 0));
  sword.add(box(0.08, 0.22, 0.085, m.leather, 0, 0.01, 0));
  sword.add(box(0.1, 0.08, 0.1, guardMat, 0, -0.13, 0));
  sword.rotation.x = 0.7;
  sword.rotation.z = -0.16;
  return sword;
}

function bowMesh(m: Materials, limbMat: THREE.Material, span: number) {
  const bow = pivot(0.19, 0.02, -0.1);
  const limb = (dir: 1 | -1) => {
    const l = box(0.06, span, 0.06, limbMat, 0, dir * (span * 0.54), -0.1);
    l.rotation.x = dir * -0.38;
    return l;
  };
  bow.add(limb(1), limb(-1));
  bow.add(box(0.08, 0.2, 0.1, m.trim));
  bow.rotation.x = -0.16;
  bow.add(box(0.016, span * 1.92, 0.016, m.trim, 0, 0, -0.205));
  return bow;
}

function staffMesh(shaftMat: THREE.Material, focus: THREE.Mesh, len: number) {
  const staff = pivot(0.21, 0.24, -0.05);
  staff.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, len, 8), shaftMat));
  focus.position.y = len / 2 + 0.07;
  staff.add(focus);
  staff.rotation.z = 0.02;
  staff.rotation.x = -0.42;
  return staff;
}

function shieldMesh(m: Materials, faceMat: THREE.Material, radius: number) {
  const shield = pivot(-0.04, 0.0, 0.16);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.07, 8), faceMat);
  face.rotation.x = Math.PI / 2;
  shield.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.01, 0.035, 6, 8), m.trim);
  shield.add(rim);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 8), m.trim);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = 0.05;
  shield.add(boss);
  shield.rotation.y = 0.12;
  return shield;
}

function tomeMesh(m: Materials, coverMat: THREE.Material, edgeMat: THREE.Material) {
  const tome = pivot(0.0, 0.02, 0.14);
  tome.add(box(0.32, 0.38, 0.1, coverMat));
  tome.add(box(0.27, 0.34, 0.12, m.trim));
  tome.add(box(0.3, 0.05, 0.13, edgeMat, 0, 0.02, 0));
  tome.rotation.set(-0.95, 0.25, 0.1);
  return tome;
}

function luteMesh(m: Materials, bowlMat: THREE.Material, neckMat: THREE.Material, ctx: SlotCtx) {
  const lute = pivot(0.02, 0.32, 0.28);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), bowlMat);
  bowl.scale.set(1.3, 1.4, 0.62);
  lute.add(bowl);
  lute.add(box(0.085, 0.62, 0.06, neckMat, 0, 0.44, 0));
  lute.add(box(0.14, 0.12, 0.085, m.trim, 0, 0.8, 0));
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), m.glow);
  rose.rotation.x = Math.PI / 2;
  rose.position.set(0, 0.02, 0.12);
  lute.add(rose);
  lute.rotation.set(0.12, -0.3, 0.82);
  ctx.onTick((t) => {
    m.glow.emissiveIntensity = 0.5 + Math.sin(t * 4.2) * 0.2;
  });
  return lute;
}

// ---------------------------------------------------------------------------
// Class defaults
// ---------------------------------------------------------------------------

const DEFAULTS: Record<ClassId, Partial<Record<CosmeticSlot, SlotBuilder>>> = {
  barbarian: {
    head: ({ m, head }) => {
      head.add(box(0.52, 0.15, 0.5, m.metal, 0, 0.45, 0));
      head.add(box(0.08, 0.19, 0.48, m.trim, 0, 0.57, 0));
    },
    shoulders: ({ m, torso }) => {
      const pauldron = (x: number) => {
        const p = box(0.3, 0.18, 0.32, m.metal, x, 0.64, 0);
        p.rotation.z = x > 0 ? -0.25 : 0.25;
        return p;
      };
      torso.add(pauldron(-0.38), pauldron(0.38));
    },
    weapon: ({ m, grips }) => grips.right.add(swordMesh(m, m.metal, m.trim, 0.14, 0.72)),
  },
  ranger: {
    head: ({ m, head }) => head.add(hood(m.garment)),
    shoulders: ({ m, torso }) => {
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
    },
    weapon: ({ m, grips }) => grips.right.add(bowMesh(m, m.leather, 0.52)),
  },
  fighter: {
    head: ({ m, head }) => {
      head.add(box(0.52, 0.16, 0.52, m.metal, 0, 0.4, 0));
      head.add(box(0.08, 0.2, 0.44, m.trim, 0, 0.54, 0));
    },
    shoulders: ({ m, torso }) => torso.add(box(0.64, 0.1, 0.4, m.metal, 0, 0.5, 0)),
    weapon: ({ m, grips }) => grips.left.add(shieldMesh(m, m.metal, 0.36)),
  },
  wizard: {
    head: ({ m, head }) => {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 14), m.garment);
      brim.position.y = 0.4;
      head.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.46, 14), m.garment);
      cone.position.set(0, 0.6, -0.02);
      cone.rotation.x = -0.16;
      head.add(cone);
      head.add(box(0.46, 0.07, 0.46, m.trim, 0, 0.43, 0));
    },
    weapon: ({ m, grips, onTick }) => {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), m.glow);
      grips.right.add(staffMesh(m.leather, crystal, 1.46));
      onTick((t) => {
        crystal.rotation.y = t * 1.4;
        m.glow.emissiveIntensity = 0.45 + Math.sin(t * 2.6) * 0.2;
      });
    },
  },
  cleric: {
    head: ({ m, head, onTick }) => {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.038, 8, 26), m.glow);
      halo.position.y = 0.68;
      halo.rotation.x = Math.PI / 2;
      head.add(halo);
      head.add(hood(m.garment));
      onTick((t) => {
        halo.position.y = 0.68 + Math.sin(t * 2) * 0.04;
        halo.rotation.z = t * 0.8;
        m.glow.emissiveIntensity = 0.42 + Math.sin(t * 2) * 0.16;
      });
    },
    shoulders: ({ m, torso }) => torso.add(box(0.5, 0.07, 0.36, m.trim, 0, 0.34, 0)),
    weapon: ({ m, grips }) => grips.right.add(tomeMesh(m, m.leather, m.glow)),
  },
  bard: {
    head: ({ m, head }) => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.16, 10), m.garment);
      cap.position.y = 0.42;
      head.add(cap);
      const feather = box(0.03, 0.26, 0.09, m.trim, 0.24, 0.52, -0.06);
      feather.rotation.z = -1.0;
      head.add(feather);
    },
    weapon: (ctx) => ctx.torso.add(luteMesh(ctx.m, ctx.m.leather, ctx.m.leather, ctx)),
  },

  // The six classes added with the 2024 roster. Each is built from the same
  // primitives as the originals, so a new silhouette costs geometry and not
  // another mesh helper.
  rogue: {
    head: ({ m, head }) => {
      head.add(hood(m.garment, 0.33, 0.38));
      // A mask across the lower face, just proud of it so it reads at size.
      head.add(box(0.4, 0.14, 0.04, m.dark, 0, 0.16, 0.235));
    },
    shoulders: ({ m, torso }) => {
      const strap = box(0.5, 0.07, 0.3, m.leather, 0, 0.44, 0.04);
      strap.rotation.z = 0.38;
      torso.add(strap);
      for (let i = -1; i <= 1; i++) {
        torso.add(box(0.04, 0.14, 0.04, m.metal, i * 0.11 - 0.02, 0.5 + i * 0.07, 0.2));
      }
    },
    weapon: ({ m, grips }) => {
      grips.right.add(swordMesh(m, m.metal, m.dark, 0.1, 0.3));
      grips.left.add(swordMesh(m, m.metal, m.dark, 0.1, 0.3));
    },
  },
  monk: {
    head: ({ m, head }) => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 6, 18), m.metal);
      band.position.set(0, 0.38, 0);
      band.rotation.x = Math.PI / 2;
      head.add(band);
    },
    shoulders: ({ m, torso }) => {
      for (const x of [-0.32, 0.32]) {
        const wrap = box(0.16, 0.2, 0.28, m.trim, x, 0.6, 0);
        wrap.rotation.z = x > 0 ? -0.2 : 0.2;
        torso.add(wrap);
      }
    },
    weapon: ({ m, grips }) => {
      const plain = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m.leather);
      grips.right.add(staffMesh(m.leather, plain, 1.5));
    },
  },
  paladin: {
    head: ({ m, head }) => {
      head.add(box(0.52, 0.16, 0.52, m.metal, 0, 0.42, 0));
      // A short crown of points rather than a single crest.
      for (const x of [-0.16, 0, 0.16]) head.add(box(0.05, 0.13, 0.05, m.trim, x, 0.56, 0));
      head.add(box(0.44, 0.05, 0.04, m.trim, 0, 0.3, 0.24));
    },
    shoulders: ({ m, torso }) => {
      const pauldron = (x: number) => {
        const p = box(0.28, 0.2, 0.3, m.metal, x, 0.63, 0);
        p.rotation.z = x > 0 ? -0.22 : 0.22;
        return p;
      };
      torso.add(pauldron(-0.37), pauldron(0.37));
      torso.add(box(0.1, 0.1, 0.06, m.glow, 0.37, 0.72, 0.1));
    },
    weapon: ({ m, grips }) => {
      grips.right.add(swordMesh(m, m.metal, m.glow, 0.12, 0.66));
      grips.left.add(shieldMesh(m, m.metal, 0.34));
    },
  },
  druid: {
    head: ({ m, head }) => {
      // Antlers: two forked prongs rather than a modelled rack.
      for (const side of [-1, 1]) {
        const main = box(0.04, 0.3, 0.04, m.leather, side * 0.17, 0.55, -0.02);
        main.rotation.z = side * 0.34;
        head.add(main);
        const fork = box(0.035, 0.16, 0.035, m.leather, side * 0.29, 0.68, -0.02);
        fork.rotation.z = side * 0.9;
        head.add(fork);
      }
    },
    shoulders: ({ m, torso }) => {
      for (const x of [-0.3, 0.3]) torso.add(box(0.22, 0.12, 0.3, m.trim, x, 0.6, 0));
      torso.add(box(0.16, 0.08, 0.2, m.trim, 0, 0.66, 0.06));
    },
    weapon: ({ m, grips, onTick }) => {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1), m.glow);
      grips.right.add(staffMesh(m.leather, leaf, 1.42));
      onTick((t) => {
        leaf.rotation.z = Math.sin(t * 1.1) * 0.3;
      });
    },
  },
  sorcerer: {
    head: ({ m, head, onTick }) => {
      const diadem = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 6, 20), m.glow);
      diadem.position.y = 0.4;
      diadem.rotation.x = Math.PI / 2;
      head.add(diadem);
      onTick((t) => {
        m.glow.emissiveIntensity = 0.4 + Math.sin(t * 3.4) * 0.28;
      });
    },
    shoulders: ({ m, torso }) => {
      for (const x of [-0.34, 0.34]) {
        for (let i = 0; i < 3; i++) {
          const scale = box(0.2 - i * 0.03, 0.05, 0.24, m.metal, x, 0.66 - i * 0.06, 0);
          scale.rotation.z = x > 0 ? -0.3 : 0.3;
          torso.add(scale);
        }
      }
    },
    // No weapon: raw magic held in an open hand.
    weapon: ({ m, grips, onTick }) => {
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), m.glow);
      orb.position.set(0, 0.16, 0.06);
      grips.right.add(orb);
      onTick((t) => {
        orb.rotation.set(t * 0.9, t * 1.3, 0);
        orb.scale.setScalar(1 + Math.sin(t * 4) * 0.09);
      });
    },
  },
  warlock: {
    head: ({ m, head }) => {
      head.add(hood(m.garment, 0.37, 0.44));
      head.add(box(0.09, 0.09, 0.04, m.glow, 0.2, 0.34, 0.16));
    },
    shoulders: ({ m, torso }) => {
      // A clawed shape resting on one shoulder only — deliberately asymmetric.
      for (let i = 0; i < 3; i++) {
        const claw = box(0.045, 0.19, 0.045, m.dark, -0.3 + i * 0.09, 0.62, 0.02);
        claw.rotation.z = 0.3 - i * 0.3;
        torso.add(claw);
      }
      torso.add(box(0.26, 0.09, 0.26, m.dark, -0.3, 0.68, 0));
    },
    weapon: ({ m, grips, onTick }) => {
      const tome = tomeMesh(m, m.dark, m.glow);
      grips.right.add(tome);
      onTick((t) => {
        m.glow.emissiveIntensity = 0.3 + Math.sin(t * 1.7) * 0.22;
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Cosmetic gear
// ---------------------------------------------------------------------------

const GEAR_BUILDERS: Record<string, SlotBuilder> = {
  // --- Warrior
  'str-head': ({ m, head }) => {
    head.add(box(0.54, 0.26, 0.52, m.metal, 0, 0.44, 0));
    head.add(box(0.5, 0.1, 0.12, m.dark, 0, 0.36, 0.22));
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 6), m.trim);
      horn.position.set(side * 0.33, 0.5, 0.02);
      horn.rotation.z = side * 1.05;
      horn.rotation.x = -0.15;
      head.add(horn);
    }
  },
  'str-shoulders': ({ m, torso }) => {
    for (const side of [-1, 1]) {
      const p = box(0.34, 0.22, 0.36, m.metal, side * 0.4, 0.64, 0);
      p.rotation.z = side * -0.25;
      torso.add(p);
      for (let i = -1; i <= 1; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), m.trim);
        spike.position.set(side * 0.44, 0.78, i * 0.11);
        torso.add(spike);
      }
    }
  },
  'str-weapon': ({ m, grips }) => grips.right.add(swordMesh(m, m.gold, m.trim, 0.17, 0.84)),
  'str-cloak': (ctx) => cloakPanels(ctx, [0.62, 0.58, 0.5, 0.4], [ctx.m.dark, ctx.m.leather], 0.26),
  'str-boots': ({ m, knees }) => {
    for (const knee of [knees.left, knees.right]) {
      knee.add(box(0.26, 0.18, 0.32, m.metal, 0, -0.38, 0.03));
      knee.add(box(0.24, 0.08, 0.24, m.trim, 0, -0.26, 0));
    }
  },
  'str-aura': ({ auraRoot, m, onTick }) => {
    const embers = [...Array(7)].map(() => {
      const mat = glowMat(m.palette.glow);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), mat);
      auraRoot.add(mesh);
      return { mesh, mat, seed: Math.random() };
    });
    onTick((t) => {
      embers.forEach(({ mesh, mat, seed }, i) => {
        const life = (t * 0.6 + seed + i * 0.13) % 1;
        mesh.position.set(Math.sin(seed * 12 + i) * 0.32, life * 1.5, -0.1 - life * 0.55);
        mesh.rotation.set(t + i, t * 0.7, 0);
        const scale = 1 - life * 0.7;
        mesh.scale.setScalar(scale);
        mat.opacity = Math.max(0, 1 - life * 1.15);
      });
    });
  },

  // --- Rogue
  'dex-head': ({ m, head }) => {
    head.add(hood(m.dark, 0.4, 0.46));
    head.add(box(0.44, 0.16, 0.06, m.dark, 0, 0.3, 0.2));
  },
  'dex-shoulders': ({ m, torso }) => {
    for (const side of [-1, 1]) {
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.42, 8), m.leather);
      quiver.position.set(side * 0.28, 0.66, -0.18);
      quiver.rotation.z = side * -0.45;
      torso.add(quiver);
      for (let i = -1; i <= 1; i++) {
        const fletch = box(0.024, 0.17, 0.024, m.trim, side * 0.37 + i * 0.04, 0.9, -0.18);
        fletch.rotation.z = side * -0.45;
        torso.add(fletch);
      }
    }
  },
  'dex-weapon': ({ m, grips }) => grips.right.add(bowMesh(m, m.dark, 0.64)),
  'dex-cloak': (ctx) => cloakPanels(ctx, [0.56, 0.5, 0.44, 0.34], [ctx.m.garment, ctx.m.dark], 0.24),
  'dex-boots': ({ m, knees }) => {
    for (const knee of [knees.left, knees.right]) {
      knee.add(box(0.22, 0.14, 0.3, m.dark, 0, -0.38, 0.03));
      knee.add(box(0.21, 0.12, 0.21, m.leather, 0, -0.24, 0));
    }
  },
  'dex-aura': ({ auraRoot, m, onTick }) => {
    // Faded copies of the walker's mass, trailing a step behind.
    const ghosts = [...Array(3)].map((_, i) => {
      const mat = glowMat(m.palette.glow, 0.2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.42, 0.26), mat);
      mesh.position.y = 0.98;
      auraRoot.add(mesh);
      return { mesh, mat, i };
    });
    onTick((t) => {
      ghosts.forEach(({ mesh, mat, i }) => {
        const lag = (i + 1) * 0.2;
        mesh.position.z = -lag * 0.85;
        mesh.position.y = 0.98 + Math.sin((t - lag) * STRIDE) * 0.04;
        mat.opacity = (0.2 - i * 0.05) * (0.7 + Math.sin(t * 3 - lag) * 0.3);
      });
    });
  },

  // --- Guardian
  'con-head': ({ m, head }) => {
    head.add(box(0.53, 0.34, 0.51, m.metal, 0, 0.31, 0));
    head.add(box(0.42, 0.05, 0.08, m.dark, 0, 0.3, 0.24));
    head.add(box(0.09, 0.22, 0.3, m.garment, 0, 0.55, -0.04));
    head.add(box(0.06, 0.1, 0.44, m.trim, 0, 0.5, 0));
  },
  'con-shoulders': ({ m, torso }) => {
    torso.add(box(0.68, 0.12, 0.42, m.metal, 0, 0.5, 0));
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const p = box(0.3, 0.1, 0.34, m.metal, side * 0.4, 0.66 - i * 0.11, 0);
        p.rotation.z = side * -0.3;
        torso.add(p);
      }
    }
  },
  'con-weapon': ({ m, grips }) => {
    const shield = pivot(-0.04, -0.02, 0.16);
    shield.add(box(0.5, 0.62, 0.07, m.metal, 0, 0.06, 0));
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.32, 4), m.metal);
    point.rotation.x = Math.PI / 2;
    point.rotation.z = Math.PI / 4;
    point.position.set(0, -0.38, 0);
    shield.add(point);
    shield.add(box(0.12, 0.6, 0.09, m.trim, 0, 0.06, 0.02));
    shield.rotation.y = 0.12;
    grips.left.add(shield);
  },
  'con-cloak': (ctx) => cloakPanels(ctx, [0.52, 0.5, 0.46], [ctx.m.trim, ctx.m.garment], 0.28),
  'con-boots': ({ m, knees }) => {
    for (const knee of [knees.left, knees.right]) {
      knee.add(box(0.28, 0.2, 0.34, m.metal, 0, -0.38, 0.03));
      knee.add(box(0.26, 0.12, 0.26, m.metal, 0, -0.22, 0));
    }
  },
  'con-aura': ({ auraRoot, m, onTick }) => {
    const glyphs = [...Array(3)].map((_, i) => {
      const mat = glowMat(m.palette.glow, 0.75);
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 6), mat);
      mesh.material.side = THREE.DoubleSide;
      auraRoot.add(mesh);
      return { mesh, i };
    });
    onTick((t) => {
      glyphs.forEach(({ mesh, i }) => {
        const a = t * 0.7 + (i * Math.PI * 2) / 3;
        mesh.position.set(Math.cos(a) * 0.72, 1.35 + Math.sin(t * 1.6 + i) * 0.12, Math.sin(a) * 0.72);
        mesh.rotation.set(0, -a, t * 1.2);
      });
    });
  },

  // --- Wizard
  'int-head': ({ m, head }) => {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, 16), m.dark);
    brim.position.y = 0.4;
    head.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), m.dark);
    cone.position.set(0, 0.68, -0.03);
    cone.rotation.x = -0.2;
    head.add(cone);
    head.add(box(0.5, 0.07, 0.5, m.trim, 0, 0.43, 0));
    for (let i = 0; i < 5; i++) {
      const star = box(0.05, 0.05, 0.05, m.glow, Math.sin(i * 2.3) * 0.18, 0.55 + i * 0.07, 0.16 - i * 0.02);
      head.add(star);
    }
  },
  'int-shoulders': ({ m, torso, onTick }) => {
    const runes = [-1, 1].map((side) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.12, 6), glowMat(m.palette.glow, 0.85));
      r.material.side = THREE.DoubleSide;
      r.position.set(side * 0.42, 0.7, 0);
      torso.add(r);
      return r;
    });
    onTick((t) => runes.forEach((r, i) => {
      r.rotation.z = t * (i ? 1 : -1) * 1.1;
      r.position.y = 0.7 + Math.sin(t * 2 + i) * 0.04;
    }));
  },
  'int-weapon': ({ m, grips, onTick }) => {
    const focus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17), m.glow);
    const staff = staffMesh(m.dark, focus, 1.6);
    for (let i = 0; i < 3; i++) staff.add(box(0.07, 0.07, 0.07, m.trim, 0, -0.2 + i * 0.22, 0.05));
    grips.right.add(staff);
    onTick((t) => {
      focus.rotation.set(t * 0.9, t * 1.3, 0);
      m.glow.emissiveIntensity = 0.5 + Math.sin(t * 2.6) * 0.22;
    });
  },
  'int-cloak': (ctx) => {
    cloakPanels(ctx, [0.58, 0.54, 0.48, 0.38], [ctx.m.dark, ctx.m.dark], 0.26);
    ctx.capeJoints.forEach((joint, i) => {
      for (let s = 0; s < 2; s++) {
        joint.add(box(0.04, 0.04, 0.02, ctx.m.glow, (s ? 1 : -1) * 0.14, -0.1 - i * 0.03, 0.03));
      }
    });
  },
  'int-boots': ({ m, knees }) => {
    for (const knee of [knees.left, knees.right]) {
      knee.add(box(0.22, 0.12, 0.3, m.garment, 0, -0.37, 0.03));
      knee.add(box(0.2, 0.05, 0.22, m.glow, 0, -0.44, 0.02));
    }
  },
  'int-aura': ({ auraRoot, m, onTick }) => {
    const book = new THREE.Group();
    book.add(box(0.36, 0.42, 0.06, m.dark));
    const left = box(0.32, 0.38, 0.04, m.trim, -0.16, 0, 0.06);
    const right = box(0.32, 0.38, 0.04, m.trim, 0.16, 0, 0.06);
    left.rotation.y = 0.4;
    right.rotation.y = -0.4;
    book.add(left, right);
    auraRoot.add(book);
    onTick((t) => {
      const a = t * 0.8;
      book.position.set(Math.cos(a) * 0.7, 1.45 + Math.sin(t * 1.4) * 0.1, Math.sin(a) * 0.7);
      book.rotation.set(0.2, -a + Math.PI / 2, 0);
      left.rotation.y = 0.4 + Math.sin(t * 3) * 0.25;
      right.rotation.y = -0.4 - Math.sin(t * 3) * 0.25;
    });
  },

  // --- Cleric
  'wis-head': ({ m, head, onTick }) => {
    head.add(hood(m.garment));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 12), m.gold);
    crown.position.y = 0.44;
    head.add(crown);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      head.add(box(0.05, 0.13, 0.05, m.gold, Math.cos(a) * 0.25, 0.53, Math.sin(a) * 0.25));
    }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.034, 8, 26), m.glow);
    halo.position.y = 0.74;
    halo.rotation.x = Math.PI / 2;
    head.add(halo);
    onTick((t) => {
      halo.rotation.z = t * 0.7;
      m.glow.emissiveIntensity = 0.42 + Math.sin(t * 2) * 0.16;
    });
  },
  'wis-shoulders': ({ m, torso }) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), m.trim);
      bead.position.set(Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.1, 0.2 + Math.abs(Math.sin(a)) * 0.06);
      torso.add(bead);
    }
    torso.add(box(0.52, 0.07, 0.38, m.gold, 0, 0.34, 0));
  },
  'wis-weapon': ({ m, grips }) => grips.right.add(tomeMesh(m, m.gold, m.glow)),
  'wis-cloak': (ctx) => cloakPanels(ctx, [0.5, 0.48, 0.44, 0.36], [ctx.m.trim, ctx.m.garment], 0.26),
  'wis-boots': ({ m, knees }) => {
    for (const knee of [knees.left, knees.right]) {
      knee.add(box(0.22, 0.08, 0.3, m.leather, 0, -0.42, 0.03));
      for (let i = 0; i < 2; i++) knee.add(box(0.2, 0.04, 0.06, m.trim, 0, -0.3 + i * 0.08, 0.02));
    }
  },
  'wis-aura': ({ auraRoot, m, onTick }) => {
    const rings = [0.4, 0.29, 0.19].map((r, i) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 8, 24), glowMat(m.palette.glow, 0.85));
      mesh.position.y = 2.24 + i * 0.06;
      auraRoot.add(mesh);
      return { mesh, i };
    });
    onTick((t) => {
      rings.forEach(({ mesh, i }) => {
        const dir = i % 2 ? -1 : 1;
        mesh.rotation.set(Math.PI / 2 + Math.sin(t * 0.6 + i) * 0.12, t * 0.5 * dir, 0);
        mesh.position.y = 2.24 + i * 0.06 + Math.sin(t * 1.4 + i) * 0.035;
      });
    });
  },

  // --- Bard
  'cha-head': ({ m, head }) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.17, 3), m.leather);
    cap.position.y = 0.42;
    cap.rotation.y = 0.4;
    head.add(cap);
    head.add(box(0.4, 0.06, 0.4, m.trim, 0, 0.51, 0));
    const plume = box(0.04, 0.38, 0.12, m.trim, 0.26, 0.54, -0.04);
    plume.rotation.z = -1.15;
    head.add(plume);
  },
  'cha-shoulders': ({ m, torso }) => {
    for (const side of [-1, 1]) {
      torso.add(box(0.26, 0.09, 0.3, m.gold, side * 0.36, 0.64, 0));
      for (let i = -1; i <= 1; i++) {
        torso.add(box(0.03, 0.16, 0.03, m.trim, side * 0.42, 0.54, i * 0.09));
      }
    }
  },
  'cha-weapon': (ctx) => ctx.torso.add(luteMesh(ctx.m, ctx.m.gold, ctx.m.dark, ctx)),
  'cha-cloak': (ctx) => cloakPanels(ctx, [0.58, 0.56, 0.5, 0.42], [ctx.m.trim, ctx.m.garment], 0.26),
  'cha-boots': ({ m, knees }) => {
    for (const knee of [knees.left, knees.right]) {
      knee.add(box(0.24, 0.14, 0.32, m.leather, 0, -0.38, 0.03));
      knee.add(box(0.26, 0.1, 0.26, m.trim, 0, -0.25, 0));
      knee.add(box(0.1, 0.09, 0.1, m.dark, 0, -0.46, -0.09));
    }
  },
  'cha-aura': ({ auraRoot, m, onTick }) => {
    const motes = [...Array(6)].map((_, i) => {
      const mat = glowMat(m.palette.glow);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat));
      g.add(box(0.02, 0.16, 0.02, mat, 0.05, 0.08, 0));
      auraRoot.add(g);
      return { g, mat, seed: i / 6 };
    });
    onTick((t) => {
      motes.forEach(({ g, mat, seed }) => {
        const life = (t * 0.35 + seed) % 1;
        const a = seed * Math.PI * 2 + t * 0.5;
        g.position.set(Math.cos(a) * 0.55, 0.85 + life * 1.15, Math.sin(a) * 0.55);
        g.rotation.z = Math.sin(t * 2 + seed * 6) * 0.4;
        mat.opacity = Math.max(0, Math.sin(life * Math.PI));
      });
    });
  },
};

/** Robes are the class's body shape, not a cosmetic — gear never replaces them. */
function robe(m: Materials, torso: THREE.Group, top: number, bottom: number, height: number, y: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 10), m.garment);
  mesh.position.y = y;
  mesh.castShadow = true;
  torso.add(mesh);
}

const CLASS_BODY: Partial<Record<ClassId, (m: Materials, torso: THREE.Group) => void>> = {
  wizard: (m, torso) => robe(m, torso, 0.31, 0.46, 0.46, 0.1),
  cleric: (m, torso) => robe(m, torso, 0.3, 0.46, 0.5, 0.08),
  druid: (m, torso) => robe(m, torso, 0.32, 0.44, 0.44, 0.1),
  sorcerer: (m, torso) => robe(m, torso, 0.29, 0.44, 0.48, 0.09),
  warlock: (m, torso) => robe(m, torso, 0.3, 0.42, 0.52, 0.06),
  monk: (m, torso) => {
    // A sash rather than a robe: the Monk's silhouette is the bare frame.
    const sash = box(0.12, 0.42, 0.14, m.trim, 0.24, 0.12, 0.04);
    sash.rotation.z = 0.22;
    torso.add(sash);
  },
  barbarian: (m, torso) => {
    // Bare arms and a heavier chest: the d12 made visible.
    torso.add(box(0.66, 0.24, 0.4, m.leather, 0, 0.5, 0));
  },
  paladin: (m, torso) => {
    // A tabard hanging past the belt, front and back.
    torso.add(box(0.3, 0.5, 0.02, m.trim, 0, 0.06, 0.19));
    torso.add(box(0.3, 0.5, 0.02, m.trim, 0, 0.06, -0.19));
  },
};

function buildCharacter(classId: ClassId, equipped: string[]) {
  // Colour comes from the class's primary ability, silhouette from the class.
  const m = buildMaterials(PALETTES[getClassDef(classId).primary[0]]);
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
  CLASS_BODY[classId]?.(m, torso);

  const arms = { left: buildArm(m, -1), right: buildArm(m, 1) };
  torso.add(arms.left.shoulder, arms.right.shoulder);
  arms.left.shoulder.position.y -= 0.84;
  arms.right.shoulder.position.y -= 0.84;
  arms.left.shoulder.rotation.z = -0.13;
  arms.right.shoulder.rotation.z = 0.13;

  // Lock any carrying arm into its ready pose BEFORE the grips are measured,
  // so each grip cancels the pose its own arm actually ended up in.
  const holds = KIT_HOLDS[classId] ?? {};
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

  const capeRoot = pivot(0, 0.66, -0.19);
  torso.add(capeRoot);

  const auraRoot = new THREE.Group();
  root.add(auraRoot);

  const grips = { right: makeGrip(arms.right.hand, root), left: makeGrip(arms.left.hand, root) };

  const ticks: ((t: number) => void)[] = [];
  const ctx: SlotCtx = {
    m,
    head,
    torso,
    grips,
    knees: { left: legs.left.knee, right: legs.right.knee },
    capeRoot,
    capeJoints: [],
    auraRoot,
    onTick: (fn) => ticks.push(fn),
  };

  // A purchased piece replaces the class default for its slot; anything with
  // no default and nothing equipped (auras) simply isn't built.
  const bySlot = getEquippedBySlot(equipped, classId);
  const SLOT_FALLBACKS: Partial<Record<CosmeticSlot, SlotBuilder>> = {
    cloak: defaultCloak,
    boots: defaultBoots,
  };
  for (const slot of ['head', 'shoulders', 'weapon', 'cloak', 'boots', 'aura'] as CosmeticSlot[]) {
    const equippedId = bySlot[slot];
    const classDefault = DEFAULTS[classId][slot] ?? SLOT_FALLBACKS[slot];
    // A piece with no bespoke geometry yet falls back to the class silhouette
    // rather than rendering an empty slot — the twelve new sets are owned,
    // named and equippable before every one of them is modelled.
    const builder = equippedId ? (GEAR_BUILDERS[equippedId] ?? classDefault) : classDefault;
    builder?.(ctx);
  }

  return { root, body, legs, arms, torso, head, capeJoints: ctx.capeJoints, ticks, held, materials: m };
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

export function WalkingCharacter3D({
  classId,
  equipped = [],
}: {
  classId: ClassId;
  equipped?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Rebuilding the rig is the only way to swap kit, so key the effect on the
  // loadout rather than the array identity, which changes on every render.
  const loadout = useMemo(() => [...equipped].sort().join(','), [equipped]);

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

    const rig = buildCharacter(classId, loadout ? loadout.split(',') : []);
    scene.add(rig.root);

    const aura = buildAura(PALETTES[getClassDef(classId).primary[0]].garment);
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

      rig.capeJoints.forEach((joint, i) => {
        const c = capeJoint(phase, i);
        joint.rotation.x = c.x;
        joint.rotation.z = c.z;
      });

      for (const tick of rig.ticks) tick(t);
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
  }, [classId, loadout]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-950/50">
      <div ref={containerRef} className="h-40 w-full" />
    </div>
  );
}
