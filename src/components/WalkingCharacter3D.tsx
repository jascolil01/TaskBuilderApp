import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AttributeKey } from '../types';

const ATTRIBUTE_COLOR_HEX: Record<AttributeKey, number> = {
  STR: 0xb3372c,
  DEX: 0x4a9d5f,
  CON: 0xc9922b,
  INT: 0x3f8fd6,
  WIS: 0x9b7fd4,
  CHA: 0xe07bb0,
};

function buildAccessory(attribute: AttributeKey, color: number): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
  const group = new THREE.Group();

  switch (attribute) {
    case 'STR': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.03), mat);
      blade.position.set(0, 0.35, 0);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), mat);
      guard.position.set(0, 0.04, 0);
      group.add(blade, guard);
      group.position.set(0.36, -0.15, 0.1);
      break;
    }
    case 'DEX': {
      const dagger = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 4), mat);
      dagger.rotation.x = Math.PI;
      group.add(dagger);
      group.position.set(0.34, -0.55, 0.12);
      break;
    }
    case 'CON': {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 6), mat);
      shield.rotation.x = Math.PI / 2;
      group.add(shield);
      group.position.set(-0.02, 1.15, -0.24);
      break;
    }
    case 'INT': {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 12), mat);
      hat.position.set(0, 1.98, 0);
      group.add(hat);
      break;
    }
    case 'WIS': {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 24), mat);
      halo.position.set(0, 1.95, 0);
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      group.userData.float = true;
      group.userData.floatBaseY = 1.95;
      break;
    }
    case 'CHA': {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.3 }),
      );
      group.add(orb);
      group.position.set(0.4, 1.35, 0);
      group.userData.float = true;
      group.userData.floatBaseY = 1.35;
      break;
    }
  }
  return group;
}

function buildCharacter(attribute: AttributeKey) {
  const color = ATTRIBUTE_COLOR_HEX[attribute];
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08 });

  const character = new THREE.Group();

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), mat);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.34), mat);
  torso.position.set(0, 1.15, 0);
  torso.castShadow = true;

  const legHeight = 0.78;
  const leftHip = new THREE.Group();
  leftHip.position.set(-0.16, 0.78, 0);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, legHeight, 0.2), mat);
  leftLeg.position.set(0, -legHeight / 2, 0);
  leftLeg.castShadow = true;
  leftHip.add(leftLeg);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.16, 0.78, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, legHeight, 0.2), mat);
  rightLeg.position.set(0, -legHeight / 2, 0);
  rightLeg.castShadow = true;
  rightHip.add(rightLeg);

  const armHeight = 0.68;
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.4, 1.42, 0);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, armHeight, 0.17), mat);
  leftArm.position.set(0, -armHeight / 2, 0);
  leftArm.castShadow = true;
  leftShoulder.add(leftArm);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.4, 1.42, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, armHeight, 0.17), mat);
  rightArm.position.set(0, -armHeight / 2, 0);
  rightArm.castShadow = true;
  rightShoulder.add(rightArm);

  const accessory = buildAccessory(attribute, color);

  character.add(head, torso, leftHip, rightHip, leftShoulder, rightShoulder, accessory);

  return { character, leftHip, rightHip, leftShoulder, rightShoulder, accessory };
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
    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 2.15, 4.6);
    camera.lookAt(0, 0.95, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff2d9, 1.15);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 12;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fb8ff, 0.35);
    rim.position.set(-3, 2, -3);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.ShadowMaterial({ opacity: 0.4 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const { character, leftHip, rightHip, leftShoulder, rightShoulder, accessory } = buildCharacter(attribute);
    scene.add(character);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const clock = new THREE.Clock();
    const PATROL_RANGE = 1.5;
    let direction = 1;
    let targetRotationY = 0;
    let frameId = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      if (!reducedMotion) frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const swing = Math.sin(t * 5.2) * 0.55;
      leftHip.rotation.x = swing;
      rightHip.rotation.x = -swing;
      leftShoulder.rotation.x = -swing;
      rightShoulder.rotation.x = swing;

      character.position.y = Math.abs(Math.sin(t * 10.4)) * 0.05;

      character.position.x += direction * 0.012;
      if (character.position.x > PATROL_RANGE) {
        character.position.x = PATROL_RANGE;
        direction = -1;
        targetRotationY = Math.PI;
      } else if (character.position.x < -PATROL_RANGE) {
        character.position.x = -PATROL_RANGE;
        direction = 1;
        targetRotationY = 0;
      }
      character.rotation.y += (targetRotationY - character.rotation.y) * 0.08;

      if (accessory.userData.float) {
        accessory.position.y = accessory.userData.floatBaseY + Math.sin(t * 3) * 0.04;
      }

      renderer.render(scene, camera);
    };
    if (reducedMotion) {
      animate();
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
          materials.forEach((m) => m.dispose());
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
