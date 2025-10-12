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
// 🏘️ Village + Detection helpers
// ---------------------------------------------------------------------------

interface HouseData {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  size: { width: number; depth: number; height: number };
  roofHeight: number;
}

interface PathData {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  width: number;
  length: number;
  thickness: number;
}

interface DetectionReport {
  id: string;
  value: number;
  canSee: boolean;
  detected: boolean;
}

interface VillagerZone {
  id: string;
  center: THREE.Vector3;
  radius: number;
}

interface ScoutRoute {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  viewRange: number;
}

function isPointInsideHouseXZ(point: THREE.Vector3, house: HouseData) {
  const halfW = house.size.width / 2;
  const halfD = house.size.depth / 2;
  const local = point
    .clone()
    .sub(house.position)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -house.rotation);
  return (
    Math.abs(local.x) <= halfW &&
    Math.abs(local.z) <= halfD
  );
}

function segmentsIntersect2D(
  a1: THREE.Vector2,
  a2: THREE.Vector2,
  b1: THREE.Vector2,
  b2: THREE.Vector2
) {
  const det = (p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const d1 = det(a1, a2, b1);
  const d2 = det(a1, a2, b2);
  const d3 = det(b1, b2, a1);
  const d4 = det(b1, b2, a2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
    return true;

  const onSegment = (p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2) =>
    Math.min(p.x, r.x) - 1e-5 <= q.x &&
    q.x <= Math.max(p.x, r.x) + 1e-5 &&
    Math.min(p.y, r.y) - 1e-5 <= q.y &&
    q.y <= Math.max(p.y, r.y) + 1e-5;

  if (Math.abs(d1) < 1e-6 && onSegment(a1, b1, a2)) return true;
  if (Math.abs(d2) < 1e-6 && onSegment(a1, b2, a2)) return true;
  if (Math.abs(d3) < 1e-6 && onSegment(b1, a1, b2)) return true;
  if (Math.abs(d4) < 1e-6 && onSegment(b1, a2, b2)) return true;

  return false;
}

function lineIntersectsHouse(
  from: THREE.Vector3,
  to: THREE.Vector3,
  house: HouseData
) {
  if (isPointInsideHouseXZ(from, house) || isPointInsideHouseXZ(to, house)) {
    return false;
  }

  const halfW = house.size.width / 2;
  const halfD = house.size.depth / 2;

  const corners = [
    new THREE.Vector3(-halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, halfD),
  ].map((corner) =>
    corner
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), house.rotation)
      .add(house.position)
  );

  const lineA = new THREE.Vector2(from.x, from.z);
  const lineB = new THREE.Vector2(to.x, to.z);

  for (let i = 0; i < corners.length; i++) {
    const c1 = corners[i];
    const c2 = corners[(i + 1) % corners.length];
    const edgeA = new THREE.Vector2(c1.x, c1.z);
    const edgeB = new THREE.Vector2(c2.x, c2.z);
    if (segmentsIntersect2D(lineA, lineB, edgeA, edgeB)) {
      return true;
    }
  }

  return false;
}

function isLineBlocked(
  from: THREE.Vector3,
  to: THREE.Vector3,
  houses: HouseData[]
) {
  for (const house of houses) {
    if (lineIntersectsHouse(from, to, house)) {
      return true;
    }
  }
  return false;
}

function createVillageLayout(noise: SimplexLike) {
  const makeHouse = (
    id: string,
    x: number,
    z: number,
    rotation: number,
    width: number,
    depth: number,
    height: number,
    roofHeight: number
  ): HouseData => {
    const y = terrainHeight(noise, x, z);
    return {
      id,
      position: new THREE.Vector3(x, y + height / 2, z),
      rotation,
      size: { width, depth, height },
      roofHeight,
    };
  };

  const makePath = (
    id: string,
    x: number,
    z: number,
    rotation: number,
    width: number,
    length: number,
    thickness: number
  ): PathData => {
    const y = terrainHeight(noise, x, z) + 0.02;
    return {
      id,
      position: new THREE.Vector3(x, y, z),
      rotation,
      width,
      length,
      thickness,
    };
  };

  const houses: HouseData[] = [];
  const paths: PathData[] = [];
  const villagerZones: VillagerZone[] = [];

  const westOrigin = { x: -42, z: -18 };
  const eastOrigin = { x: 38, z: 12 };

  const westHouses = [
    makeHouse("house-west-1", westOrigin.x - 6, westOrigin.z - 4, 0, 6, 5, 3, 2.8),
    makeHouse("house-west-2", westOrigin.x + 2, westOrigin.z - 5, 0, 6.5, 5.5, 3.2, 3.1),
    makeHouse("house-west-3", westOrigin.x - 5.5, westOrigin.z + 4.5, Math.PI / 2, 5.6, 5, 3.1, 2.7),
    makeHouse("house-west-4", westOrigin.x + 3.5, westOrigin.z + 5, Math.PI / 2, 6.2, 5.2, 3.4, 3.0),
  ];
  houses.push(...westHouses);

  const eastHouses = [
    makeHouse("house-east-1", eastOrigin.x - 6, eastOrigin.z - 6, 0, 6.5, 5.5, 3.3, 3.0),
    makeHouse("house-east-2", eastOrigin.x + 1.8, eastOrigin.z - 5.5, 0, 6.0, 5.0, 3.2, 3.0),
    makeHouse("house-east-3", eastOrigin.x - 5, eastOrigin.z + 4.5, Math.PI / 2, 5.5, 5.2, 3.1, 2.6),
    makeHouse("house-east-4", eastOrigin.x + 2.5, eastOrigin.z + 4.2, Math.PI / 2, 6.4, 5.4, 3.5, 3.1),
    makeHouse("house-east-5", eastOrigin.x + 8, eastOrigin.z, Math.PI / 2, 5.8, 5.3, 3.3, 2.8),
  ];
  houses.push(...eastHouses);

  paths.push(
    makePath("path-west-main", westOrigin.x - 1.5, westOrigin.z, 0, 12, 5.5, 0.2),
    makePath("path-west-cross", westOrigin.x - 2, westOrigin.z, Math.PI / 2, 10, 5, 0.2),
    makePath("path-east-main", eastOrigin.x, eastOrigin.z, 0, 13, 5.5, 0.2),
    makePath("path-east-cross", eastOrigin.x - 1, eastOrigin.z, Math.PI / 2, 10, 5, 0.2),
    makePath("path-connector", -2, -3, Math.PI / 2, 8, 65, 0.15)
  );

  villagerZones.push(
    {
      id: "villagers-west-square",
      center: new THREE.Vector3(westOrigin.x - 1.5, terrainHeight(noise, westOrigin.x - 1.5, westOrigin.z), westOrigin.z),
      radius: 8,
    },
    {
      id: "villagers-west-garden",
      center: new THREE.Vector3(westOrigin.x + 6, terrainHeight(noise, westOrigin.x + 6, westOrigin.z + 4), westOrigin.z + 4),
      radius: 6,
    },
    {
      id: "villagers-east-square",
      center: new THREE.Vector3(eastOrigin.x, terrainHeight(noise, eastOrigin.x, eastOrigin.z), eastOrigin.z + 1),
      radius: 9,
    },
    {
      id: "villagers-east-porch",
      center: new THREE.Vector3(eastOrigin.x + 7, terrainHeight(noise, eastOrigin.x + 7, eastOrigin.z - 2), eastOrigin.z - 2),
      radius: 5.5,
    }
  );

  const scoutRoutes: ScoutRoute[] = [
    {
      id: "scout-road",
      start: new THREE.Vector3(-55, 0, -28),
      end: new THREE.Vector3(45, 0, 32),
      viewRange: 20,
    },
    {
      id: "scout-east-perimeter",
      start: new THREE.Vector3(52, 0, 8),
      end: new THREE.Vector3(30, 0, 28),
      viewRange: 18,
    },
  ];

  return { houses, paths, villagerZones, scoutRoutes };
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

const Houses = React.memo(({ houses }: { houses: HouseData[] }) => {
  return (
    <group>
      {houses.map((house) => (
        <group
          key={house.id}
          position={[house.position.x, house.position.y, house.position.z]}
          rotation={[0, house.rotation, 0]}
        >
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <boxGeometry
              args={[house.size.width, house.size.height, house.size.depth]}
            />
            <meshStandardMaterial color="#a17c4c" roughness={0.85} />
          </mesh>
          <mesh position={[0, house.size.height / 2 + house.roofHeight / 2, 0]} castShadow>
            <coneGeometry
              args={[Math.max(house.size.width, house.size.depth) * 0.75, house.roofHeight, 4]}
            />
            <meshStandardMaterial color="#5d2e1d" roughness={0.6} />
          </mesh>
          <mesh
            position={[0, -house.size.height / 2 + 1.1, house.size.depth / 2 + 0.01]}
          >
            <planeGeometry args={[1.8, 3]} />
            <meshStandardMaterial color="#3b2a1a" />
          </mesh>
          <mesh
            position={[-house.size.width / 2 + 0.6, house.size.height / 2 + 0.4, 0]}
          >
            <boxGeometry args={[0.4, 0.9, 0.4]} />
            <meshStandardMaterial color="#4d4d4d" />
          </mesh>
        </group>
      ))}
    </group>
  );
});

const VillagePaths = React.memo(({ paths }: { paths: PathData[] }) => {
  return (
    <group>
      {paths.map((path) => (
        <group
          key={path.id}
          position={[path.position.x, path.position.y, path.position.z]}
          rotation={[0, path.rotation, 0]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[path.length, path.width]} />
            <meshStandardMaterial
              color="#9a744c"
              roughness={0.95}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-path.thickness}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
});

function Villager({
  id,
  zone,
  playerRef,
  noise,
  houses,
  phase = 0,
  onDetectionUpdate,
}: {
  id: string;
  zone: VillagerZone;
  playerRef: React.MutableRefObject<THREE.Mesh>;
  noise: SimplexLike;
  houses: HouseData[];
  phase?: number;
  onDetectionUpdate: (report: DetectionReport) => void;
}) {
  const villagerRef = useRef<THREE.Group>(null!);
  const visionRef = useRef<THREE.Mesh>(null!);
  const detectionRef = useRef(0);
  const prevReportRef = useRef<DetectionReport>({
    id,
    value: -1,
    canSee: false,
    detected: false,
  });

  useEffect(() => {
    prevReportRef.current = { id, value: -1, canSee: false, detected: false };
  }, [id]);

  useEffect(() => {
    return () => {
      onDetectionUpdate({ id, value: 0, canSee: false, detected: false });
    };
  }, [id, onDetectionUpdate]);

  const speed = useMemo(() => 2.8 + Math.random() * 0.8, []);
  const waypoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + phase * Math.PI * 2;
      const radius = zone.radius * (0.45 + Math.random() * 0.35);
      const x = zone.center.x + Math.cos(angle) * radius;
      const z = zone.center.z + Math.sin(angle) * radius;
      const y = terrainHeight(noise, x, z) + 1.0;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [zone, noise, phase]);

  const segmentRef = useRef(Math.floor((phase % 1) * waypoints.length));
  const progressRef = useRef((phase % 1 + 1) % 1);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const nextVec = useMemo(() => new THREE.Vector3(), []);
  const dirVec = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const toPlayer = useMemo(() => new THREE.Vector3(), []);
  const flatPlayer = useMemo(() => new THREE.Vector3(), []);

  const viewRange = 10;
  const halfFov = THREE.MathUtils.degToRad(38);

  const visionGeometry = useMemo(() => {
    const segments = 18;
    const positions: number[] = [];
    for (let i = 0; i < segments; i++) {
      const t0 = -halfFov + (i / segments) * halfFov * 2;
      const t1 = -halfFov + ((i + 1) / segments) * halfFov * 2;
      positions.push(0, 0.01, 0);
      positions.push(Math.sin(t0) * viewRange, 0.01, Math.cos(t0) * viewRange);
      positions.push(Math.sin(t1) * viewRange, 0.01, Math.cos(t1) * viewRange);
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
        color: "#7fd3ff",
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => () => visionMaterial.dispose(), [visionMaterial]);

  const detectionRate = 100 / 5.5;
  const decayRate = 25;

  useFrame(({ clock }, delta) => {
    const villager = villagerRef.current;
    const player = playerRef.current;
    if (!villager || !player || waypoints.length === 0) return;

    const index = segmentRef.current;
    const nextIndex = (index + 1) % waypoints.length;
    const from = waypoints[index];
    const to = waypoints[nextIndex];

    dirVec.subVectors(to, from);
    const distance = dirVec.length();
    if (distance < 0.0001) {
      segmentRef.current = nextIndex;
    } else {
      const step = (speed * delta) / distance;
      progressRef.current += step;
      if (progressRef.current >= 1) {
        progressRef.current -= 1;
        segmentRef.current = nextIndex;
      }
    }

    const currentFrom = waypoints[segmentRef.current];
    const currentTo = waypoints[(segmentRef.current + 1) % waypoints.length];
    tmpVec.lerpVectors(currentFrom, currentTo, progressRef.current);
    const groundY = terrainHeight(noise, tmpVec.x, tmpVec.z);
    villager.position.set(tmpVec.x, groundY + 1.2, tmpVec.z);

    nextVec.copy(currentTo).sub(currentFrom).setY(0);
    if (nextVec.lengthSq() > 1e-4) {
      nextVec.normalize();
      const angle = Math.atan2(nextVec.x, nextVec.z);
      villager.rotation.y = THREE.MathUtils.lerp(
        villager.rotation.y,
        angle,
        0.1
      );
    }

    toPlayer.subVectors(player.position, villager.position);
    const distanceToPlayer = toPlayer.length();
    let canSee = false;
    if (distanceToPlayer <= viewRange) {
      flatPlayer.set(toPlayer.x, 0, toPlayer.z);
      if (flatPlayer.lengthSq() > 0.0001) {
        flatPlayer.normalize();
        forward.set(0, 0, 1).applyQuaternion(villager.quaternion).setY(0);
        if (forward.lengthSq() > 0.0001) {
          forward.normalize();
          const angle = forward.angleTo(flatPlayer);
          if (angle <= halfFov) {
            const dayFactor = THREE.MathUtils.clamp(
              0.6 + 0.4 * Math.sin(clock.elapsedTime * 0.05),
              0.0,
              1.0
            );
            const inDarkness = dayFactor < 0.2;
            const blocked = isLineBlocked(villager.position, player.position, houses);
            canSee = !inDarkness && !blocked;
          }
        }
      }
    }

    if (visionRef.current) {
      const targetOpacity = canSee ? 0.25 : 0.1;
      visionMaterial.opacity = THREE.MathUtils.lerp(
        visionMaterial.opacity,
        targetOpacity,
        0.08
      );
      visionRef.current.visible = true;
    }

    if (canSee) {
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

    const detected = detectionRef.current >= 99.5;
    const needsReport =
      Math.abs(prevReportRef.current.value - detectionRef.current) > 0.05 ||
      prevReportRef.current.canSee !== canSee ||
      prevReportRef.current.detected !== detected;

    if (needsReport) {
      const report: DetectionReport = {
        id,
        value: detectionRef.current,
        canSee,
        detected,
      };
      prevReportRef.current = report;
      onDetectionUpdate(report);
    }
  });

  return (
    <group ref={villagerRef}>
      <mesh ref={visionRef} geometry={visionGeometry} material={visionMaterial} position={[0, -1.2, 0]} />
      <mesh castShadow>
        <cylinderGeometry args={[0.6, 0.6, 2.2, 12]} />
        <meshStandardMaterial color="#d9c1a6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial color="#f2ddc0" />
      </mesh>
      <mesh position={[0, 1.4, 0.45]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshStandardMaterial color="#593d2e" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 👁️ Scout enemy with line-of-sight detection
// ---------------------------------------------------------------------------
function Scout({
  id,
  route,
  playerRef,
  noise,
  houses,
  onDetectionUpdate,
}: {
  id: string;
  route: ScoutRoute;
  playerRef: React.MutableRefObject<THREE.Mesh>;
  noise: SimplexLike;
  houses: HouseData[];
  onDetectionUpdate: (report: DetectionReport) => void;
}) {
  const scoutRef = useRef<THREE.Group>(null!);
  const visionRef = useRef<THREE.Mesh>(null!);
  const detectionRef = useRef(0);
  const prevReportRef = useRef<DetectionReport>({
    id,
    value: -1,
    canSee: false,
    detected: false,
  });

  useEffect(() => {
    prevReportRef.current = { id, value: -1, canSee: false, detected: false };
  }, [id]);

  useEffect(() => {
    return () => {
      onDetectionUpdate({ id, value: 0, canSee: false, detected: false });
    };
  }, [id, onDetectionUpdate]);

  const viewRange = route.viewRange;
  const halfFov = THREE.MathUtils.degToRad(50);

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

  const patrolStart = useMemo(() => route.start.clone(), [route.start]);
  const patrolEnd = useMemo(() => route.end.clone(), [route.end]);
  const nextPos = useMemo(() => new THREE.Vector3(), []);
  const prevPos = useMemo(() => new THREE.Vector3(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const toPlayer = useMemo(() => new THREE.Vector3(), []);
  const flatPlayer = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const scanQuat = useMemo(() => new THREE.Quaternion(), []);

  const sampleHeight = useCallback(
    (x: number, z: number) => terrainHeight(noise, x, z),
    [noise]
  );

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

    if (distance <= viewRange) {
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
    const blocked = isLineBlocked(scout.position, player.position, houses);
    const canSee = inCone && !inDarkness && !blocked;

    if (visionRef.current) {
      const targetOpacity = canSee ? 0.28 : inDarkness ? 0.05 : 0.16;
      visionMaterial.opacity = THREE.MathUtils.lerp(
        visionMaterial.opacity,
        targetOpacity,
        0.12
      );
      visionRef.current.visible = true;
    }

    const detectionRate = 100 / 2.8; // reach 100 swiftly
    const decayRate = 55; // drains quickly when hidden
    if (canSee) {
      detectionRef.current = Math.min(100, detectionRef.current + detectionRate * delta);
    } else {
      detectionRef.current = Math.max(0, detectionRef.current - decayRate * delta);
    }

    const detected = detectionRef.current >= 99.5;
    const needsReport =
      Math.abs(prevReportRef.current.value - detectionRef.current) > 0.05 ||
      prevReportRef.current.canSee !== canSee ||
      prevReportRef.current.detected !== detected;

    if (needsReport) {
      const report: DetectionReport = {
        id,
        value: detectionRef.current,
        canSee,
        detected,
      };
      prevReportRef.current = report;
      onDetectionUpdate(report);
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
  const villageLayout = useMemo(() => createVillageLayout(simplex), [simplex]);
  const { houses, paths, villagerZones, scoutRoutes } = villageLayout;
  const villagerConfigs = useMemo(() => {
    const configs: { id: string; zone: VillagerZone; phase: number }[] = [];
    villagerZones.forEach((zone) => {
      const count = zone.radius > 7 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        configs.push({
          id: `${zone.id}-${i}`,
          zone,
          phase: (i / Math.max(1, count)) * 0.5,
        });
      }
    });
    return configs;
  }, [villagerZones]);
  const detectionRecordsRef = useRef(new Map<string, DetectionReport>());
  const [detectionSummary, setDetectionSummary] = useState({
    value: 0,
    tracking: false,
    detected: false,
  });

  const handleDetectionUpdate = useCallback((report: DetectionReport) => {
    const map = detectionRecordsRef.current;
    if (!report.canSee && report.value <= 0 && !report.detected) {
      map.delete(report.id);
    } else {
      map.set(report.id, report);
    }

    const entries = Array.from(map.values());
    if (entries.length === 0) {
      setDetectionSummary({ value: 0, tracking: false, detected: false });
      return;
    }

    let highest = 0;
    let viewers = 0;
    let anyDetected = false;
    for (const entry of entries) {
      highest = Math.max(highest, entry.value);
      if (entry.canSee) viewers += 1;
      if (entry.detected) anyDetected = true;
    }
    const bonus = viewers > 1 ? Math.min(35, (viewers - 1) * 12) : 0;
    const total = Math.min(100, highest + bonus);

    setDetectionSummary({
      value: total,
      tracking: viewers > 0,
      detected: anyDetected,
    });
  }, []);

  useHeartbeat(detectionSummary.detected);

  const detectionPercent = Math.max(0, Math.min(100, detectionSummary.value));
  const detectionColor = detectionSummary.detected
    ? "#ff2b3a"
    : detectionSummary.tracking
    ? "#ffb347"
    : "#35c9ff";
  const vignetteClasses = [
    "danger-vignette",
    detectionSummary.detected ? "danger-vignette--active" : "",
    !detectionSummary.detected && detectionSummary.tracking
      ? "danger-vignette--tracking"
      : "",
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

        <VillagePaths paths={paths} />
        <Houses houses={houses} />
        <Trees trees={forestPositions} />

        <PlayerController
          target={target}
          noise={simplex}
          playerRef={playerRef}
          terrainRef={terrainRef}
        />
        <FollowCamera playerRef={playerRef} />

        {villagerConfigs.map((villager) => (
          <Villager
            key={villager.id}
            id={villager.id}
            zone={villager.zone}
            phase={villager.phase}
            playerRef={playerRef}
            noise={simplex}
            houses={houses}
            onDetectionUpdate={handleDetectionUpdate}
          />
        ))}

        {scoutRoutes.map((route) => (
          <Scout
            key={route.id}
            id={route.id}
            route={route}
            playerRef={playerRef}
            noise={simplex}
            houses={houses}
            onDetectionUpdate={handleDetectionUpdate}
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
          {detectionSummary.detected && (
            <div className="detected-text">Detected!</div>
          )}
        </div>
      </div>

      <div className={vignetteClasses} />
    </div>
  );
}
