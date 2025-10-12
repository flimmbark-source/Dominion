// WorldScene.tsx — Tier 2 “Enchanted Realism” (No @react-three/postprocessing)
// Realistic palette, golden-hour light, clustered forests (merged for perf),
// meadows, procedural dirt paths, night fireflies, and custom Bloom.

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import * as SimplexModule from "simplex-noise";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer as ThreeEffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// ---------------------------------------------------------------------------
// 🔧 SimplexNoise Adapter
// ---------------------------------------------------------------------------
export interface SimplexLike {
  noise2D(x: number, y: number): number;
}
function makeSimplex(seed?: number): SimplexLike {
  const anyMod: any = SimplexModule as any;
  const MaybeCtor = anyMod.default ?? anyMod;
  try {
    const inst = new MaybeCtor(seed);
    if (inst && typeof inst.noise2D === "function") return inst as SimplexLike;
  } catch (_) {}
  if (typeof anyMod.createNoise2D === "function") {
    const rand =
      seed != null
        ? (() => {
            let s = (seed >>> 0) || 1;
            return () =>
              (s = (1664525 * s + 1013904223) >>> 0) / 0x100000000;
          })()
        : undefined;
    const fn = anyMod.createNoise2D(rand);
    return { noise2D: (x: number, y: number) => fn(x, y) } as SimplexLike;
  }
  throw new Error("Unsupported simplex-noise module shape");
}

// ---------------------------------------------------------------------------
// 🌅 Sky Dome
// ---------------------------------------------------------------------------
function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTopDay: { value: new THREE.Color("#8fb4d6") },
          uHorizonDay: { value: new THREE.Color("#f3c978") },
          uBottomDay: { value: new THREE.Color("#f6ead0") },
          uTopNight: { value: new THREE.Color("#1f2a3a") },
          uHorizonNight: { value: new THREE.Color("#40355a") },
          uBottomNight: { value: new THREE.Color("#141724") },
          uMix: { value: 0.7 },
        },
        vertexShader: `
          varying vec3 vWorld;
          void main(){
            vec4 w = modelMatrix * vec4(position,1.0);
            vWorld = normalize(w.xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: `
          varying vec3 vWorld;
          uniform vec3 uTopDay, uHorizonDay, uBottomDay;
          uniform vec3 uTopNight, uHorizonNight, uBottomNight;
          uniform float uMix;
          void main(){
            float h = clamp(vWorld.y*0.5+0.5,0.0,1.0);
            vec3 day = mix(uBottomDay, uTopDay, smoothstep(0.0,1.0,h));
            day = mix(day, uHorizonDay, exp(-pow((h-0.2)*8.0,2.0))*0.7);
            vec3 night = mix(uBottomNight, uTopNight, smoothstep(0.0,1.0,h));
            night = mix(night, uHorizonNight, exp(-pow((h-0.25)*8.0,2.0))*0.6);
            vec3 col = mix(night, day, uMix);
            gl_FragColor = vec4(col,1.0);
          }`,
      }),
    []
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    const day = THREE.MathUtils.clamp(0.65 + 0.35 * Math.sin(t), 0.15, 1.0);
    (material.uniforms.uMix as any).value = day;
  });
  return (
    <mesh>
      <sphereGeometry args={[1200, 40, 24]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 🪨 Terrain
// ---------------------------------------------------------------------------
function terrainHeight(
  noise: SimplexLike,
  x: number,
  z: number,
  scale = 1
) {
  const primary = noise.noise2D(x / 40, z / 40) * 7.5;
  const secondary = noise.noise2D(x / 120, z / 120) * 5.0;
  return (primary + secondary) * scale;
}

// ---------------------------------------------------------------------------
// 🏘️ Village layout & occlusion helpers
// ---------------------------------------------------------------------------
interface HouseDescriptor {
  id: string;
  basePosition: THREE.Vector3;
  bodySize: THREE.Vector3;
  roofHeight: number;
}

interface VillagerDescriptor {
  id: string;
  home: THREE.Vector3;
  roamRadius: number;
}

interface VillageLayout {
  houses: HouseDescriptor[];
  villagers: VillagerDescriptor[];
}

function createVillageLayout(noise: SimplexLike): VillageLayout {
  const clusters = [
    { center: new THREE.Vector2(-35, -10), rows: 2, cols: 3, spacing: 12 },
    { center: new THREE.Vector2(25, 25), rows: 2, cols: 2, spacing: 13 },
    { center: new THREE.Vector2(-5, 40), rows: 1, cols: 3, spacing: 11 },
  ];

  const houses: HouseDescriptor[] = [];
  const villagers: VillagerDescriptor[] = [];
  let houseIndex = 0;

  for (const [clusterIndex, cluster] of clusters.entries()) {
    const count = cluster.rows * cluster.cols;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cluster.cols);
      const col = i % cluster.cols;
      const jitterX = (Math.random() - 0.5) * 2.2;
      const jitterZ = (Math.random() - 0.5) * 2.2;
      const x =
        cluster.center.x +
        (col - (cluster.cols - 1) / 2) * cluster.spacing +
        jitterX;
      const z =
        cluster.center.y +
        (row - (cluster.rows - 1) / 2) * cluster.spacing +
        jitterZ;
      const ground = terrainHeight(noise, x, z, 1.0);
      const width = 7 + Math.random() * 2;
      const depth = 6.5 + Math.random() * 1.6;
      const height = 4.8 + Math.random() * 0.6;
      const roofHeight = 2.6 + Math.random() * 0.6;

      const basePosition = new THREE.Vector3(x, ground + 0.05, z);
      const bodySize = new THREE.Vector3(width, height, depth);
      const id = `house-${houseIndex++}`;
      houses.push({ id, basePosition, bodySize, roofHeight });

      const villagerHome = basePosition.clone();
      villagerHome.y = ground + 1.0;
      villagers.push({
        id: `villager-${clusterIndex}-${i}`,
        home: villagerHome,
        roamRadius: cluster.spacing * 0.55,
      });
    }
  }

  return { houses, villagers };
}

function createHouseBoxes(houses: HouseDescriptor[]): THREE.Box3[] {
  return houses.map((house) => {
    const half = house.bodySize.clone().multiplyScalar(0.5);
    const min = new THREE.Vector3(
      house.basePosition.x - half.x,
      house.basePosition.y,
      house.basePosition.z - half.z
    );
    const max = new THREE.Vector3(
      house.basePosition.x + half.x,
      house.basePosition.y + house.bodySize.y + house.roofHeight,
      house.basePosition.z + half.z
    );
    return new THREE.Box3(min, max);
  });
}

function createVisionConeGeometry(range: number, halfFov: number, segments = 18) {
  const vertices: number[] = [];
  const indices: number[] = [];
  vertices.push(0, 0, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -halfFov + t * halfFov * 2;
    const x = Math.sin(angle) * range;
    const z = Math.cos(angle) * range;
    vertices.push(x, 0, z);
    if (i > 0) {
      indices.push(0, i, i + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function isLineObstructed(
  origin: THREE.Vector3,
  target: THREE.Vector3,
  obstacles: THREE.Box3[],
  dir: THREE.Vector3,
  ray: THREE.Ray,
  hit: THREE.Vector3
) {
  if (obstacles.length === 0) return false;
  dir.subVectors(target, origin);
  const distance = dir.length();
  if (distance <= 0.001) return false;
  dir.normalize();
  ray.set(origin, dir);
  for (const box of obstacles) {
    const point = ray.intersectBox(box, hit);
    if (!point) continue;
    const hitDistance = point.distanceTo(origin);
    if (hitDistance > 0.05 && hitDistance < distance - 0.1) {
      return true;
    }
  }
  return false;
}

const Terrain = React.forwardRef(function Terrain(
  {
    width,
    height,
    scale,
    noise,
    onSurfaceClick,
  }: {
    width: number;
    height: number;
    scale: number;
    noise: SimplexLike;
    onSurfaceClick: (point: THREE.Vector3) => void;
  },
  ref: React.Ref<THREE.Mesh>
) {
  const meshRef = useRef<THREE.Mesh>(null!);
  React.useImperativeHandle(ref, () => meshRef.current);

  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(width, height, 199, 199);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = terrainHeight(noise, x, y, scale);
      pos.setZ(i, h);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [width, height, scale, noise]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: true,
        uniforms: {
          uGrassLow: { value: new THREE.Color("#3e7a44") },
          uGrassHigh: { value: new THREE.Color("#86a96f") },
          uSoil: { value: new THREE.Color("#7a5a38") },
          uRock: { value: new THREE.Color("#9aa3a6") },
          uMeadowBoost: { value: 0.35 },
          uLowH: { value: -8.0 },
          uHighH: { value: 12.0 },
          uPathWidth: { value: 0.04 },
          uPathIntensity: { value: 0.8 },
          uTime: { value: 0.0 },
        },
        vertexShader: `
          varying float vH; varying vec3 vN; varying vec2 vUv2;
          void main(){
            vH=position.z;
            vN=normalize(normalMatrix*normal);
            vUv2=uv;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          }`,
        fragmentShader: `
          varying float vH; varying vec3 vN; varying vec2 vUv2;
          uniform vec3 uGrassLow,uGrassHigh,uSoil,uRock;
          uniform float uLowH,uHighH,uMeadowBoost,uPathWidth,uPathIntensity,uTime;
          float pathMask(vec2 p){
            vec2 q=p*2.0-1.0;
            float c1=sin(q.x*2.2+0.8)*0.15+0.1*sin(q.y*2.8);
            float d1=abs(q.y-c1);
            float c2=0.25*sin(q.x*1.2+2.2)-0.2*cos(q.y*1.7);
            float d2=abs(q.y+c2);
            float d=min(d1,d2);
            float slope=1.0-clamp(vN.y,0.0,1.0);
            float width=uPathWidth+slope*0.02;
            float band=smoothstep(width,0.0,d);
            band*=0.9+0.1*sin(uTime*0.3+q.x*3.0);
            return clamp(band,0.0,1.0);
          }
          void main(){
            float hNorm=smoothstep(uLowH,uHighH,vH);
            vec3 grass=mix(uGrassLow,uGrassHigh,hNorm);
            float slope=1.0-clamp(vN.y,0.0,1.0);
            float rockT=smoothstep(0.35,0.9,slope);
            vec3 soilRock=mix(uSoil,uRock,rockT);
            float meadow=smoothstep(uLowH,uLowH+5.0,vH)*uMeadowBoost;
            grass+=vec3(0.12,0.18,0.10)*meadow;
            float path=pathMask(vUv2);
            vec3 col=mix(grass,soilRock,rockT);
            col=mix(col,uSoil,path*uPathIntensity);
            float rim=pow(1.0-max(dot(vN,vec3(0,1,0)),0.0),2.0);
            col+=vec3(0.08,0.06,0.02)*rim;
            gl_FragColor=vec4(col,1.0);
          }`,
      }),
    []
  );

  useFrame(({ clock }) => {
    (material.uniforms.uTime as any).value = clock.elapsedTime;
  });

  const { camera, gl } = useThree();
  useEffect(() => {
    function handleClick(ev: MouseEvent) {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hits = raycaster.intersectObject(meshRef.current);
      if (hits.length) onSurfaceClick(hits[0].point);
    }
    gl.domElement.addEventListener("pointerdown", handleClick);
    return () => gl.domElement.removeEventListener("pointerdown", handleClick);
  }, [camera, gl, onSurfaceClick]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    />
  );
});

// ---------------------------------------------------------------------------
// ☀️ Lighting
// ---------------------------------------------------------------------------
function HazeAndSun() {
  const dirRef = useRef<THREE.DirectionalLight>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    const day = THREE.MathUtils.clamp(0.6 + 0.4 * Math.sin(t), 0.15, 1.0);
    if (dirRef.current) {
      const sunHue = 0.1 + 0.06 * Math.sin(t);
      dirRef.current.color.setHSL(sunHue, 0.7, 0.6);
      dirRef.current.intensity = 0.85 + 0.3 * day;
      dirRef.current.position.set(Math.cos(t) * 80, 100, Math.sin(t) * 80);
    }
  });
  return (
    <>
      <ambientLight intensity={0.45} color={"#b7c49f"} />
      <directionalLight ref={dirRef} position={[50, 100, 20]} intensity={1.0} castShadow />
    </>
  );
}

// ---------------------------------------------------------------------------
// 🧍 Player Controller
// ---------------------------------------------------------------------------
function PlayerController({
  target,
  noise,
  playerRef,
  terrainRef,
}: {
  target: THREE.Vector3 | null;
  noise: SimplexLike;
  playerRef: React.MutableRefObject<THREE.Mesh>;
  terrainRef: React.MutableRefObject<THREE.Mesh>;
}) {
  const speed = 20;
  const lerpSpeed = 4;
  const getHeightAt = (x: number, z: number) => terrainHeight(noise, x, z);

  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);

  useFrame((_, delta) => {
    const mesh = playerRef.current;
    const terrain = terrainRef.current;
    if (!mesh || !terrain || !target) return;

    const pos = mesh.position;
    const dir = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
    const dist = dir.length();

    if (dist > 0.1) {
      dir.normalize();
      pos.x += dir.x * speed * delta;
      pos.z += dir.z * speed * delta;
    }

    raycaster.set(new THREE.Vector3(pos.x, 100, pos.z), down);
    const hits = raycaster.intersectObject(terrain, true);
    const groundY =
      hits.length > 0 ? hits[0].point.y : getHeightAt(pos.x, pos.z);
    pos.y = THREE.MathUtils.lerp(pos.y, groundY + 1.5, delta * 10);

    if (dist > 0.1) {
      const angle = Math.atan2(dir.x, dir.z);
      mesh.rotation.y = THREE.MathUtils.lerp(
        mesh.rotation.y,
        angle,
        delta * lerpSpeed
      );
    }
  });

  return (
    <mesh ref={playerRef} position={[0, 5, 0]}>
      <sphereGeometry args={[0.8, 16, 16]} />
      <meshStandardMaterial color="#ffe65b" emissive="#665500" />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 🎥 Camera Follow
// ---------------------------------------------------------------------------
function FollowCamera({
  playerRef,
}: {
  playerRef: React.MutableRefObject<THREE.Mesh>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    if (!playerRef.current) return;
    const p = new THREE.Vector3();
    playerRef.current.getWorldPosition(p);
    const desired = new THREE.Vector3(p.x + 40, p.y + 60, p.z + 40);
    camera.position.lerp(desired, 0.05);
    camera.lookAt(p);
  });
  return null;
}

// ---------------------------------------------------------------------------
// ❤️ Heartbeat feedback when fully detected
// ---------------------------------------------------------------------------
function useHeartbeat(active: boolean) {
  const intervalRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stop = () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!active) {
      stop();
      return;
    }

    const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!AudioCtor) return;

    if (!ctxRef.current) {
      ctxRef.current = new AudioCtor();
    }

    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => void 0);

    const beat = () => {
      if (!ctx) return;
      const now = ctx.currentTime;

      const createPulse = (offset: number) => {
        const gain = ctx.createGain();
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(70, now + offset);
        osc.frequency.exponentialRampToValueAtTime(45, now + offset + 0.3);

        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.45, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.4);
      };

      createPulse(0);
      createPulse(0.35);
    };

    beat();
    stop();
    intervalRef.current = window.setInterval(beat, 1200);

    return stop;
  }, [active]);

  useEffect(() => {
    return () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => void 0);
        ctxRef.current = null;
      }
    };
  }, []);
}

// ---------------------------------------------------------------------------
// 🌲 Forest (merged geometry)
// ---------------------------------------------------------------------------
function useForestLayout(noise: SimplexLike) {
  return useMemo(() => {
    const trees: { pos: THREE.Vector3; scale: number }[] = [];
    const clusters = Array.from({ length: 10 }, () => ({
      x: (Math.random() - 0.5) * 160,
      y: (Math.random() - 0.5) * 160,
      radius: 25 + Math.random() * 20,
    }));
    for (const c of clusters) {
      const count = 200 + Math.floor(Math.random() * 100);
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * c.radius;
        const x = c.x + Math.cos(ang) * rad;
        const y = c.y + Math.sin(ang) * rad;
        const h = noise.noise2D(x / 40, y / 40) * 8 + noise.noise2D(x / 120, y / 120) * 5;
        if (h < -4) continue;
        trees.push({ pos: new THREE.Vector3(x, h + Math.random() * 0.3, y), scale: 0.9 + Math.random() * 0.4 });
      }
    }
    return trees;
  }, [noise]);
}

const Trees = React.memo(({ trees }: { trees: { pos: THREE.Vector3; scale: number }[] }) => {
  const forestRef = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5);
    const canopyGeo = new THREE.ConeGeometry(1.3, 2.3, 6);
    const instances: THREE.BufferGeometry[] = [];

    for (const t of trees) {
      const mat = new THREE.Matrix4()
        .makeTranslation(t.pos.x, t.pos.y + 1.6, t.pos.z)
        .multiply(new THREE.Matrix4().makeScale(t.scale, t.scale, t.scale));
      const trunk = trunkGeo.clone();
      trunk.applyMatrix4(mat);
      const canopy = canopyGeo.clone();
      canopy.translate(0, 1.6, 0);
      canopy.applyMatrix4(mat);
      instances.push(trunk, canopy);
    }

    const merged = mergeGeometries(instances, false)!;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    forestRef.current.geometry.dispose();
    forestRef.current.geometry = merged;
    forestRef.current.frustumCulled = false;

    trunkGeo.dispose();
    canopyGeo.dispose();
    instances.forEach((g) => g.dispose());
  }, []); // only once

  return (
    <mesh ref={forestRef}>
      <meshStandardMaterial color="#3a5f2e" roughness={0.95} metalness={0.0} />
    </mesh>
  );
});

// ---------------------------------------------------------------------------
// 👁️ Scout enemy with line-of-sight detection
// ---------------------------------------------------------------------------
function Scout({
  id,
  patrolStart,
  patrolEnd,
  playerRef,
  noise,
  obstacles,
  onDetectionUpdate,
  onRemove,
  visionRange = 22,
  fov = 100,
  detectionSeconds = 3,
}: {
  id: string;
  patrolStart: THREE.Vector3;
  patrolEnd: THREE.Vector3;
  playerRef: React.MutableRefObject<THREE.Mesh>;
  noise: SimplexLike;
  obstacles: THREE.Box3[];
  onDetectionUpdate: (
    id: string,
    report: { value: number; inCone: boolean; detected: boolean }
  ) => void;
  onRemove: (id: string) => void;
  visionRange?: number;
  fov?: number;
  detectionSeconds?: number;
}) {
  const scoutRef = useRef<THREE.Group>(null!);
  const visionRef = useRef<THREE.Mesh>(null!);
  const detectionRef = useRef(0);
  const prevReportRef = useRef({ value: -1, inCone: false, detected: false });

  const viewRange = 15;
  const halfFov = THREE.MathUtils.degToRad(45);

  const visionGeometry = useMemo(() => {
    const segments = 24;
    const positions: number[] = [];
    for (let i = 0; i < segments; i++) {
      const t0 = -halfFov + (i / segments) * halfFov * 2;
      const t1 = -halfFov + ((i + 1) / segments) * halfFov * 2;
      positions.push(0, 0.02, 0);
      positions.push(Math.sin(t0) * viewRange, 0.02, Math.cos(t0) * viewRange);
      positions.push(Math.sin(t1) * viewRange, 0.02, Math.cos(t1) * viewRange);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [halfFov, viewRange]);

  useEffect(() => () => visionGeometry.dispose(), [visionGeometry]);

  const visionMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffb347",
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => () => visionMaterial.dispose(), [visionMaterial]);

  const patrolStart = useMemo(() => new THREE.Vector3(-45, 0, -35), []);
  const patrolEnd = useMemo(() => new THREE.Vector3(45, 0, 35), []);
  const nextPos = useMemo(() => new THREE.Vector3(), []);
  const prevPos = useMemo(() => new THREE.Vector3(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const toPlayer = useMemo(() => new THREE.Vector3(), []);
  const flatPlayer = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const scanQuat = useMemo(() => new THREE.Quaternion(), []);
  const eyePos = useMemo(() => new THREE.Vector3(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const lineDir = useMemo(() => new THREE.Vector3(), []);
  const playerWorld = useMemo(() => new THREE.Vector3(), []);

  const sampleHeight = useCallback(
    (x: number, z: number) => noise.noise2D(x / 40, z / 40) * 8 * 1.2,
    [noise]
  );

  const halfFov = THREE.MathUtils.degToRad(fov / 2);
  const visionGeometry = useMemo(
    () => createVisionConeGeometry(visionRange, halfFov, 24),
    [visionRange, halfFov]
  );

  useEffect(() => {
    return () => {
      visionGeometry.dispose();
    };
  }, [visionGeometry]);

  useEffect(() => () => onRemove(id), [id, onRemove]);

  useFrame(({ clock }, delta) => {
    const scout = scoutRef.current;
    const player = playerRef.current;
    if (!scout || !player) return;

    const t = clock.elapsedTime * 0.18;
    const alpha = (Math.sin(t) * 0.5 + 0.5) ** 1.2;
    tmpPos.copy(patrolStart).lerp(patrolEnd, alpha);
    const terrainY = sampleHeight(tmpPos.x, tmpPos.z);
    scout.position.set(tmpPos.x, terrainY + 1.6, tmpPos.z);

    const offset = 0.05;
    const alphaNext = (Math.sin((clock.elapsedTime + offset) * 0.18) * 0.5 + 0.5) ** 1.2;
    const alphaPrev = (Math.sin((clock.elapsedTime - offset) * 0.18) * 0.5 + 0.5) ** 1.2;
    nextPos.copy(patrolStart).lerp(patrolEnd, alphaNext);
    prevPos.copy(patrolStart).lerp(patrolEnd, alphaPrev);
    const baseDir = nextPos.clone().sub(prevPos).setY(0).normalize();
    if (baseDir.lengthSq() === 0) baseDir.set(0, 0, 1);

    quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), baseDir);
    const scanAngle = Math.sin(clock.elapsedTime * 0.8) * THREE.MathUtils.degToRad(35);
    scanQuat.setFromAxisAngle(up, scanAngle);
    quat.multiply(scanQuat);
    scout.quaternion.slerp(quat, 0.1);

    toPlayer.subVectors(player.position, scout.position);
    const distance = toPlayer.length();
    let inCone = false;

    if (distance <= visionRange) {
      flatPlayer.set(toPlayer.x, 0, toPlayer.z);
      if (flatPlayer.lengthSq() > 0.0001) {
        flatPlayer.normalize();
        forward.set(0, 0, 1).applyQuaternion(scout.quaternion).setY(0);
        if (forward.lengthSq() > 0.0001) {
          forward.normalize();
          const angle = forward.angleTo(flatPlayer);
          inCone = angle <= halfFov;
        }
      }
    }

    const dayFactor = THREE.MathUtils.clamp(
      0.6 + 0.4 * Math.sin(clock.elapsedTime * 0.05),
      0.0,
      1.0
    );
    const inDarkness = dayFactor < 0.35;
    const canSee = inCone && !inDarkness;

    if (visionRef.current) {
      const targetOpacity = canSee ? 0.28 : inDarkness ? 0.05 : 0.16;
      visionMaterial.opacity = THREE.MathUtils.lerp(
        visionMaterial.opacity,
        targetOpacity,
        0.12
      );
      visionRef.current.visible = true;
    }

    const detectionRate = 100 / 3; // reach 100 in 3 seconds
    const decayRate = 55; // drains quickly when hidden
    if (canSee) {
      detectionRef.current = Math.min(100, detectionRef.current + detectionRate * delta);
    } else {
      detectionRef.current = Math.max(0, detectionRef.current - decayRate * delta);
    }

    const detected = detectionRef.current >= 99.5;
    const needsReport =
      Math.abs(prevReportRef.current.value - detectionRef.current) > 0.05 ||
      prevReportRef.current.inCone !== canSee ||
      prevReportRef.current.detected !== detected;

    if (needsReport) {
      prevReportRef.current = {
        value: detectionRef.current,
        inCone: canSee,
        detected,
      };
      onDetectionUpdate(detectionRef.current, canSee, detected);
    }
  });

  return (
    <group ref={scoutRef}>
      <mesh
        ref={visionRef}
        geometry={visionGeometry}
        material={visionMaterial}
        position={[0, -1.6, 0]}
      />
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 2.8, 16]} />
        <meshStandardMaterial color="#ff4d4d" emissive="#5c0000" />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[1, 1.4, 16]} />
        <meshStandardMaterial color="#ffe8d6" emissive="#802121" />
      </mesh>
      <pointLight position={[0, 3.2, 0]} intensity={0.55} distance={18} color="#ff6655" />
    </group>
  );
}

// ---------------------------------------------------------------------------
// 🚶 Villagers wandering near their homes
// ---------------------------------------------------------------------------
function Villager({
  id,
  home,
  roamRadius,
  playerRef,
  noise,
  obstacles,
  onDetectionUpdate,
  onRemove,
}: {
  id: string;
  home: THREE.Vector3;
  roamRadius: number;
  playerRef: React.MutableRefObject<THREE.Mesh>;
  noise: SimplexLike;
  obstacles: THREE.Box3[];
  onDetectionUpdate: (
    id: string,
    report: { value: number; inCone: boolean; detected: boolean }
  ) => void;
  onRemove: (id: string) => void;
}) {
  const villagerRef = useRef<THREE.Group>(null!);
  const detectionRef = useRef(0);
  const prevReportRef = useRef({ value: -1, inCone: false, detected: false });
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const idleTimerRef = useRef(0.5 + Math.random());

  const moveDir = useMemo(() => new THREE.Vector3(), []);
  const toPlayer = useMemo(() => new THREE.Vector3(), []);
  const flatPlayer = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const eyePos = useMemo(() => new THREE.Vector3(), []);
  const playerWorld = useMemo(() => new THREE.Vector3(), []);
  const lineDir = useMemo(() => new THREE.Vector3(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Ray(), []);

  const sampleHeight = useCallback(
    (x: number, z: number) => terrainHeight(noise, x, z, 1.0),
    [noise]
  );

  const viewRange = 12;
  const halfFov = THREE.MathUtils.degToRad(45);
  const detectionRate = 100 / 5.5;
  const decayRate = 45;

  const visionGeometry = useMemo(
    () => createVisionConeGeometry(viewRange, halfFov, 20),
    [viewRange, halfFov]
  );

  useEffect(() => {
    return () => {
      visionGeometry.dispose();
    };
  }, [visionGeometry]);

  useEffect(() => () => onRemove(id), [id, onRemove]);

  useFrame((_, delta) => {
    const villager = villagerRef.current;
    const player = playerRef.current;
    if (!villager || !player) return;

    const pos = villager.position;

    if (!targetRef.current || pos.distanceTo(targetRef.current) < 0.35) {
      idleTimerRef.current -= delta;
      if (idleTimerRef.current <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const radius = roamRadius * (0.35 + Math.random() * 0.65);
        const tx = home.x + Math.cos(angle) * radius;
        const tz = home.z + Math.sin(angle) * radius;
        const ty = sampleHeight(tx, tz) + 1.0;
        if (!targetRef.current) targetRef.current = new THREE.Vector3();
        targetRef.current.set(tx, ty, tz);
        idleTimerRef.current = 1.3 + Math.random() * 1.7;
      }
    }

    if (targetRef.current) {
      moveDir.subVectors(targetRef.current, pos);
      const distance = moveDir.length();
      if (distance > 0.05) {
        moveDir.normalize();
        const speed = 7;
        pos.x += moveDir.x * speed * delta;
        pos.z += moveDir.z * speed * delta;
        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        villager.rotation.y = THREE.MathUtils.lerp(
          villager.rotation.y,
          targetAngle,
          delta * 2.5
        );
      } else {
        targetRef.current = null;
        idleTimerRef.current = 1 + Math.random() * 1.5;
      }
    }

    const ground = sampleHeight(pos.x, pos.z);
    pos.y = THREE.MathUtils.lerp(pos.y, ground + 1.0, 0.12);

    toPlayer.subVectors(player.position, villager.position);
    const distanceToPlayer = toPlayer.length();
    let inCone = false;

    if (distanceToPlayer <= viewRange) {
      flatPlayer.set(toPlayer.x, 0, toPlayer.z);
      if (flatPlayer.lengthSq() > 0.0001) {
        flatPlayer.normalize();
        forward.set(Math.sin(villager.rotation.y), 0, Math.cos(villager.rotation.y));
        if (forward.lengthSq() > 0.0001) {
          forward.normalize();
          const angle = forward.angleTo(flatPlayer);
          inCone = angle <= halfFov;
        }
      }
    }

    if (inCone) {
      eyePos.copy(villager.position);
      eyePos.y += 0.9;
      playerWorld.copy(player.position);
      if (isLineObstructed(eyePos, playerWorld, obstacles, lineDir, ray, hitPoint)) {
        inCone = false;
      }
    }

    if (inCone) {
      detectionRef.current = Math.min(
        100,
        detectionRef.current + detectionRate * delta
      );
    } else {
      detectionRef.current = Math.max(
        0,
        detectionRef.current - decayRate * delta
      );
    }

    const detected = detectionRef.current >= 98;
    const needsReport =
      Math.abs(prevReportRef.current.value - detectionRef.current) > 0.05 ||
      prevReportRef.current.inCone !== inCone ||
      prevReportRef.current.detected !== detected;

    if (needsReport) {
      prevReportRef.current = {
        value: detectionRef.current,
        inCone,
        detected,
      };
      onDetectionUpdate(id, {
        value: detectionRef.current,
        inCone,
        detected,
      });
    }
  });

  return (
    <group ref={villagerRef} position={[home.x, home.y, home.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <primitive object={visionGeometry} />
        <meshBasicMaterial
          color="#82c7ff"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh castShadow position={[0, 0.0, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 1.6, 12]} />
        <meshStandardMaterial color="#bba57a" emissive="#3b2b1a" />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#f7d6a0" emissive="#4c3b26" />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.75, 20]} />
        <meshStandardMaterial color="#473a28" opacity={0.35} transparent />
      </mesh>
    </group>
  );
}

const Houses = React.memo(({ houses }: { houses: HouseDescriptor[] }) => {
  return (
    <group>
      {houses.map((house) => {
        const halfDepth = house.bodySize.z / 2;
        return (
          <group
            key={house.id}
            position={[house.basePosition.x, house.basePosition.y, house.basePosition.z]}
          >
            <mesh
              castShadow
              receiveShadow
              position={[0, house.bodySize.y / 2, 0]}
            >
              <boxGeometry
                args={[house.bodySize.x, house.bodySize.y, house.bodySize.z]}
              />
              <meshStandardMaterial
                color="#74563a"
                roughness={0.8}
                metalness={0.1}
              />
            </mesh>
            <mesh
              castShadow
              position={[0, house.bodySize.y + house.roofHeight / 2 - 0.05, 0]}
            >
              <coneGeometry args={[house.bodySize.x * 0.75, house.roofHeight, 4]} />
              <meshStandardMaterial color="#4a2a1a" roughness={0.65} />
            </mesh>
            <mesh
              position={[0, house.bodySize.y * 0.35, halfDepth + 0.01]}
              rotation={[0, 0, 0]}
            >
              <planeGeometry
                args={[house.bodySize.x * 0.35, house.bodySize.y * 0.45]}
              />
              <meshStandardMaterial
                color="#2f1e12"
                emissive="#1a0f08"
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh
              position={[0, 0.02, halfDepth + 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[house.bodySize.x * 0.6, 4]} />
              <meshStandardMaterial color="#8b6a45" roughness={0.9} />
            </mesh>
            <mesh
              castShadow
              position={[house.bodySize.x * 0.25, house.bodySize.y * 0.9, 0]}
            >
              <boxGeometry args={[0.6, house.roofHeight * 0.8, 0.6]} />
              <meshStandardMaterial color="#3c2f24" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

// ---------------------------------------------------------------------------
// ✨ Fireflies
// ---------------------------------------------------------------------------
function Fireflies() {
  const pointsRef = useRef<THREE.Points>(null!);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const c = 120;
    const pos = new Float32Array(c * 3);
    for (let i = 0; i < c; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 180;
      pos[i * 3 + 1] = Math.random() * 6 + 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 180;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.7,
        color: "#ffd37a",
        transparent: true,
        opacity: 0.0,
      }),
    []
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    const night = 1.0 - THREE.MathUtils.clamp(0.6 + 0.4 * Math.sin(t), 0.0, 1.0);
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.6 * night, 0.1);
    if (pointsRef.current)
      pointsRef.current.rotation.y += Math.sin(clock.elapsedTime * 0.7) * 0.002;
  });
  return <points ref={pointsRef} geometry={geom} material={mat} />;
}

// ---------------------------------------------------------------------------
// 💡 Custom Bloom
// ---------------------------------------------------------------------------
function FXBloom({
  strength = 0.35,
  radius = 0.35,
  threshold = 0.6,
}: {
  strength?: number;
  radius?: number;
  threshold?: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<ThreeEffectComposer | null>(null);

  useEffect(() => {
    if (!gl || !scene || !camera) return;

    const composer = new ThreeEffectComposer(gl);
    composer.setSize(size.width, size.height);
    (composer as any).setPixelRatio?.(gl.getPixelRatio?.() ?? 1);

    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      strength,
      radius,
      threshold
    );

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera, size.width, size.height, strength, radius, threshold]);

  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size.width, size.height]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}

// ---------------------------------------------------------------------------
// 🌍 Main Scene
// ---------------------------------------------------------------------------
export default function WorldScene() {
  const [target, setTarget] = useState<THREE.Vector3 | null>(null);
  const playerRef = useRef<THREE.Mesh>(null!);
  const terrainRef = useRef<THREE.Mesh>(null!);
  const simplex = useMemo(() => makeSimplex(1337), []);
  const forestPositions = useForestLayout(simplex);
  const { houses, villagers } = useMemo(() => createVillageLayout(simplex), [simplex]);
  const houseBoxes = useMemo(() => createHouseBoxes(houses), [houses]);
  const scoutRoutes = useMemo(
    () => [
      {
        id: "scout-main-road",
        start: new THREE.Vector3(-60, 0, -25),
        end: new THREE.Vector3(60, 0, 25),
        visionRange: 24,
        fov: 105,
        detectionSeconds: 2.4,
      },
      {
        id: "scout-ridge",
        start: new THREE.Vector3(-30, 0, 58),
        end: new THREE.Vector3(40, 0, 45),
        visionRange: 20,
        fov: 95,
        detectionSeconds: 2.8,
      },
    ],
    []
  );

  const [detectionValue, setDetectionValue] = useState(0);
  const [isInCone, setIsInCone] = useState(false);
  const [isDetected, setIsDetected] = useState(false);
  const detectionSourcesRef = useRef(
    new Map<string, { value: number; inCone: boolean; detected: boolean }>()
  );

  const updateAggregate = useCallback(() => {
    let total = 0;
    let anyInCone = false;
    let anyDetected = false;
    detectionSourcesRef.current.forEach(({ value, inCone, detected }) => {
      total += value;
      if (inCone) anyInCone = true;
      if (detected) anyDetected = true;
    });
    setDetectionValue(Math.min(100, total));
    setIsInCone(anyInCone);
    setIsDetected(anyDetected);
  }, []);

  const handleNpcDetection = useCallback(
    (id: string, report: { value: number; inCone: boolean; detected: boolean }) => {
      detectionSourcesRef.current.set(id, report);
      updateAggregate();
    },
    [updateAggregate]
  );

  const handleNpcRemoval = useCallback(
    (id: string) => {
      detectionSourcesRef.current.delete(id);
      updateAggregate();
    },
    [updateAggregate]
  );

  useHeartbeat(isDetected);

  const detectionPercent = Math.max(0, Math.min(100, detectionValue));
  const detectionColor = isDetected
    ? "#ff2b3a"
    : isInCone
    ? "#ffb347"
    : "#35c9ff";
  const vignetteClasses = [
    "danger-vignette",
    isDetected ? "danger-vignette--active" : "",
    !isDetected && isInCone ? "danger-vignette--tracking" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="world-root">
      <Canvas
        orthographic
        camera={{ zoom: 40, position: [60, 80, 60] }}
        shadows
        style={{ width: "100%", height: "100%" }}
      >
        <SkyDome />
        <HazeAndSun />

        <Terrain
          ref={terrainRef}
          width={200}
          height={200}
          scale={1.0}
          noise={simplex}
          onSurfaceClick={(p) => setTarget(p)}
        />

        <Trees trees={forestPositions} />
        <Houses houses={houses} />

        <PlayerController
          target={target}
          noise={simplex}
          playerRef={playerRef}
          terrainRef={terrainRef}
        />
        <FollowCamera playerRef={playerRef} />

        {villagers.map((villager) => (
          <Villager
            key={villager.id}
            id={villager.id}
            home={villager.home}
            roamRadius={villager.roamRadius}
            playerRef={playerRef}
            noise={simplex}
            obstacles={houseBoxes}
            onDetectionUpdate={handleNpcDetection}
            onRemove={handleNpcRemoval}
          />
        ))}

        {scoutRoutes.map((route) => (
          <Scout
            key={route.id}
            id={route.id}
            patrolStart={route.start}
            patrolEnd={route.end}
            playerRef={playerRef}
            noise={simplex}
            obstacles={houseBoxes}
            onDetectionUpdate={handleNpcDetection}
            onRemove={handleNpcRemoval}
            visionRange={route.visionRange}
            fov={route.fov}
            detectionSeconds={route.detectionSeconds}
          />
        ))}

        <Fireflies />
        <FXBloom strength={0.35} radius={0.35} threshold={0.6} />

        <OrbitControls enableRotate={false} enableZoom />
      </Canvas>

      <div className="hud">
        <div className="hud__detection">
          <div className="detection-bar">
            <div className="detection-bar__track">
              <div
                className="detection-bar__fill"
                style={{ width: `${detectionPercent}%`, background: detectionColor }}
              />
            </div>
            <span className="detection-bar__label">
              Detection {Math.round(detectionPercent)}%
            </span>
          </div>
          {isDetected && <div className="detected-text">Detected!</div>}
        </div>
      </div>

      <div className={vignetteClasses} />
    </div>
  );
}
