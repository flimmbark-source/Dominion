// WorldScene.tsx — Tier 1 “Fairytale Realism” upgrade
// ✨ Bright painterly tones, soft sky gradient, warm light, depth-fog shimmer

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import React, { useMemo, useRef, useState, useEffect } from "react";
import * as SimplexModule from "simplex-noise";

// ---------------------------------------------------------------------------
// 🔧 SimplexNoise Adapter
// ---------------------------------------------------------------------------
export interface SimplexLike { noise2D(x: number, y: number): number; }
function makeSimplex(seed?: number): SimplexLike {
  const anyMod: any = SimplexModule as any;
  const MaybeCtor = anyMod.default ?? anyMod;
  try {
    const inst = new MaybeCtor(seed);
    if (inst && typeof inst.noise2D === "function") return inst as SimplexLike;
  } catch (_) {}
  if (typeof anyMod.createNoise2D === "function") {
    const rand = seed != null ? (() => {
      let s = (seed >>> 0) || 1;
      return () => (s = (1664525 * s + 1013904223) >>> 0) / 0x100000000;
    })() : undefined;
    const fn = anyMod.createNoise2D(rand);
    return { noise2D: (x: number, y: number) => fn(x, y) } as SimplexLike;
  }
  throw new Error("Unsupported simplex-noise module shape");
}

// ---------------------------------------------------------------------------
// 🌄 Terrain — 3-band color blend + rim tint
// ---------------------------------------------------------------------------
const Terrain = React.forwardRef(function Terrain(
  {
    width, height, scale, noise, onSurfaceClick,
  }: {
    width: number; height: number; scale: number;
    noise: SimplexLike; onSurfaceClick: (point: THREE.Vector3) => void;
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
      const h = noise.noise2D(x / 40, y / 40);
      pos.setZ(i, h * scale * 8);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [width, height, scale, noise]);

  const material = useMemo(() => {
    const uniforms = {
      colorLow:   { value: new THREE.Color("#3a7f4b") }, // mossy green
      colorMid:   { value: new THREE.Color("#c6b472") }, // warm ochre
      colorHigh:  { value: new THREE.Color("#e9e5da") }, // light stone
      rimColor:   { value: new THREE.Color("#fff1d3") },
    };
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying float vHeight;
        varying vec3 vNormal;
        void main(){
          vHeight = position.z;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        varying float vHeight;
        varying vec3 vNormal;
        uniform vec3 colorLow;
        uniform vec3 colorMid;
        uniform vec3 colorHigh;
        uniform vec3 rimColor;
        void main(){
          float h = smoothstep(-8.0, 6.0, vHeight);
          vec3 base = mix(colorLow, colorMid, h);
          base = mix(base, colorHigh, smoothstep(4.0, 10.0, vHeight));
          float rim = pow(1.0 - max(dot(vNormal, vec3(0.0,1.0,0.0)),0.0), 3.0);
          vec3 col = base + rim * rimColor * 0.3;
          gl_FragColor = vec4(col,1.0);
        }`,
    });
  }, []);

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
    <mesh ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    />
  );
});

// ---------------------------------------------------------------------------
// 🧍 Player Controller (unchanged movement)
// ---------------------------------------------------------------------------
function PlayerController({
  target, noise, playerRef, terrainRef,
}: {
  target: THREE.Vector3 | null;
  noise: SimplexLike;
  playerRef: React.MutableRefObject<THREE.Mesh>;
  terrainRef: React.MutableRefObject<THREE.Mesh>;
}) {
  const speed = 20;
  const lerpSpeed = 4;
  const getHeightAt = (x: number, z: number) => noise.noise2D(x / 40, z / 40) * 8 * 1.2;
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);

  useFrame((_, delta) => {
    const mesh = playerRef.current;
    const terrain = terrainRef.current;
    if (!mesh || !terrain || !target) return;
    const pos = mesh.position;
    const dir = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
    const dist = dir.length();

    if (dist > 0.1) { dir.normalize(); pos.x += dir.x * speed * delta; pos.z += dir.z * speed * delta; }

    raycaster.set(new THREE.Vector3(pos.x, 100, pos.z), down);
    const hits = raycaster.intersectObject(terrain, true);
    const desiredY = hits.length ? hits[0].point.y + 1.5 : getHeightAt(pos.x, pos.z) + 1.5;
    pos.y = THREE.MathUtils.lerp(pos.y, desiredY, delta * 10);

    if (dist > 0.1) {
      const angle = Math.atan2(dir.x, dir.z);
      mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, angle, delta * lerpSpeed);
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
function FollowCamera({ playerRef }: { playerRef: React.MutableRefObject<THREE.Mesh> }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!playerRef.current) return;
    const playerPos = new THREE.Vector3();
    playerRef.current.getWorldPosition(playerPos);
    const desired = new THREE.Vector3(playerPos.x + 40, playerPos.y + 60, playerPos.z + 40);
    camera.position.lerp(desired, 0.05);
    camera.lookAt(playerPos);
  });
  return null;
}

// ---------------------------------------------------------------------------
// 🌅 Sky Gradient Dome
// ---------------------------------------------------------------------------
function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    const skyMat = (mesh.current.material as THREE.ShaderMaterial).uniforms;
    skyMat.time.value = t;
  });

  const uniforms = {
    topColor: { value: new THREE.Color("#cce5ff") },
    bottomColor: { value: new THREE.Color("#f8efd4") },
    time: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms,
    vertexShader: `varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 topColor; uniform vec3 bottomColor; uniform float time;
      void main(){
        float h = normalize(vPos).y * 0.5 + 0.5;
        vec3 day = mix(bottomColor, topColor, h);
        vec3 evening = mix(vec3(1.0,0.8,0.6), vec3(0.4,0.2,0.6), h);
        float dayMix = 0.5 + 0.5*sin(time*0.5);
        vec3 col = mix(evening, day, dayMix);
        gl_FragColor = vec4(col,1.0);
      }`,
  });

  return <mesh ref={mesh} geometry={new THREE.SphereGeometry(500, 32, 15)} material={material} />;
}

// ---------------------------------------------------------------------------
// 🌫️ Fog + ☀️ Lighting (warmer hue)
/// ---------------------------------------------------------------------------
function AnimatedFog() {
  const { scene } = useThree();
  const fogColor = new THREE.Color("#cfd7e2");
  const fog = useMemo(() => new THREE.FogExp2(fogColor, 0.004), []);
  scene.fog = fog;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    fog.color.setHSL(0.6 + 0.05 * Math.sin(t), 0.25, 0.85);
    fog.density = 0.004 + Math.sin(t * 0.5) * 0.0015;
  });
  return null;
}

function DayNightCycle() {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime * 0.05;
    const intensity = Math.sin(time) * 0.4 + 0.8;
    const color = new THREE.Color().setHSL(0.55 - 0.25 * Math.sin(time), 0.7, 0.6);
    if (lightRef.current) {
      lightRef.current.intensity = intensity;
      lightRef.current.color = color;
      lightRef.current.position.set(Math.cos(time) * 80, 100, Math.sin(time) * 80);
    }
  });
  return <directionalLight ref={lightRef} position={[50, 100, 20]} intensity={1.0} castShadow />;
}

// ---------------------------------------------------------------------------
// 🌳 Trees + Sparkle Particles
// ---------------------------------------------------------------------------
function BiomeParticles({ color }: { color: string }) {
  const group = useRef<THREE.Points>(null!);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = Math.random() * 15 + 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.PointsMaterial({ color, size: 0.5, transparent: true, opacity: 0.5 }),
    [color]
  );
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.05;
  });
  return <points ref={group} geometry={geom} material={mat} />;
}

// ---------------------------------------------------------------------------
// 🔊 Ambient Sound
// ---------------------------------------------------------------------------
function AmbientSound() {
  useEffect(() => {
    const audio = new Audio("/sounds/forest_ambience.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    audio.play().catch(() => {});
    return () => audio.pause();
  }, []);
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

  const trees = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < 600; i++) {
      const x = (Math.random() - 0.5) * 180;
      const y = (Math.random() - 0.5) * 180;
      const h = simplex.noise2D(x / 40, y / 40) * 8;
      if (h > -2 && h < 6) arr.push(new THREE.Vector3(x, h, y));
    }
    return arr;
  }, [simplex]);

  return (
    <Canvas
      orthographic
      camera={{ zoom: 40, position: [60, 80, 60] }}
      shadows
      style={{ width: "100vw", height: "100vh" }}
    >
      <color attach="background" args={["#e6f3ff"]} />
      <SkyDome />
      <ambientLight intensity={0.6} />
      <DayNightCycle />
      <AnimatedFog />

      <Terrain
        ref={terrainRef}
        width={200}
        height={200}
        scale={1.2}
        noise={simplex}
        onSurfaceClick={(p) => setTarget(p)}
      />

      {trees.map((p, i) => (
        <mesh key={i} position={p}>
          <coneGeometry args={[1, 3, 6]} />
          <meshStandardMaterial
            color={`hsl(${90 + Math.random() * 30}, 40%, ${35 + Math.random() * 20}%)`}
          />
        </mesh>
      ))}

      <PlayerController target={target} noise={simplex} playerRef={playerRef} terrainRef={terrainRef} />
      <FollowCamera playerRef={playerRef} />

      <BiomeParticles color="#ffd6a1" />
      <AmbientSound />
      <OrbitControls enableRotate={false} enableZoom={true} />
    </Canvas>
  );
}
