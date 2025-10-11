// WorldScene.tsx — Tier 2 “Enchanted Realism” (No @react-three/postprocessing)
// Realistic palette, golden-hour light, gold-green haze, clustered forests,
// meadows, procedural dirt paths, night fireflies, and custom Bloom + Vignette.

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import React, { useMemo, useRef, useState, useEffect } from "react";
import * as SimplexModule from "simplex-noise";
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
  const meshRef = useRef<THREE.Mesh>(null!);
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
    <mesh ref={meshRef}>
      <sphereGeometry args={[1200, 40, 24]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 🪨 Terrain — (same as before)
// ---------------------------------------------------------------------------
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
      const h =
        noise.noise2D(x / 40, y / 40) * 7.5 +
        noise.noise2D(x / 120, y / 120) * 5.0;
      pos.setZ(i, h * scale);
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
// 🌫️ Haze + Sun
// ---------------------------------------------------------------------------
// ☀️ Golden-Hour Lighting Only (no fog)
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
function PlayerController({ target, noise, playerRef, terrainRef }: any) {
  const speed = 20;
  const lerpSpeed = 4;
  const getHeightAt = (x: number, z: number) => noise.noise2D(x / 40, z / 40) * 8 * 1.2;
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  useFrame((_, delta) => {
    const mesh = playerRef.current, terrain = terrainRef.current;
    if (!mesh || !terrain || !target) return;
    const pos = mesh.position;
    const dir = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
    const dist = dir.length();
    if (dist > 0.1) { dir.normalize(); pos.x += dir.x * speed * delta; pos.z += dir.z * speed * delta; }
    raycaster.set(new THREE.Vector3(pos.x, 100, pos.z), down);
    const hits = raycaster.intersectObject(terrain, true);
    const groundY = hits.length > 0 ? hits[0].point.y : getHeightAt(pos.x, pos.z);
    pos.y = THREE.MathUtils.lerp(pos.y, groundY + 1.5, delta * 10);
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
function FollowCamera({ playerRef }: any) {
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
// 🌳 Forest Clusters
// ---------------------------------------------------------------------------
function useForestLayout(noise: SimplexLike) {
  return useMemo(() => {
    const trees: THREE.Vector3[] = [], centers: { x: number; y: number }[] = [];
    for (let i = 0; i < 18; i++) centers.push({ x: (Math.random() - 0.5) * 160, y: (Math.random() - 0.5) * 160 });
    for (const c of centers) {
      const count = 20 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = (Math.random() ** 1.6) * 14 + 2;
        const x = c.x + Math.cos(ang) * rad, y = c.y + Math.sin(ang) * rad;
        const h = noise.noise2D(x / 40, y / 40) * 8 + noise.noise2D(x / 120, y / 120) * 5;
        if (h > -3.5) trees.push(new THREE.Vector3(x, h, y));
      }
    }
    return trees;
  }, [noise]);
}

function Trees({ positions }: any) {
  return (
    <>
      {positions.map((p: THREE.Vector3, i: number) => (
        <group key={i} position={p}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.18, 0.24, 1.2, 6]} />
            <meshStandardMaterial color={"#6b4a2e"} />
          </mesh>
          <mesh position={[0, 2.0, 0]} rotation={[0, Math.random() * Math.PI, 0]}>
            <coneGeometry args={[1.25 + Math.random() * 0.3, 2.4 + Math.random() * 0.4, 8]} />
            <meshStandardMaterial color={`hsl(${95 + Math.random() * 20}, ${35 + Math.random() * 20}%, ${28 + Math.random() * 18}%)`} roughness={0.9} metalness={0.0} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// ✨ Fireflies
// ---------------------------------------------------------------------------
function Fireflies() {
  const pointsRef = useRef<THREE.Points>(null!);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry(); const c = 120, pos = new Float32Array(c * 3);
    for (let i = 0; i < c; i++) { pos[i * 3] = (Math.random() - 0.5) * 180; pos[i * 3 + 1] = Math.random() * 6 + 2; pos[i * 3 + 2] = (Math.random() - 0.5) * 180; }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.7, color: "#ffd37a", transparent: true, opacity: 0.0 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    const night = 1.0 - THREE.MathUtils.clamp(0.6 + 0.4 * Math.sin(t), 0.0, 1.0);
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.6 * night, 0.1);
    if (pointsRef.current) pointsRef.current.rotation.y += Math.sin(clock.elapsedTime * 0.7) * 0.002;
  });
  return <points ref={pointsRef} geometry={geom} material={mat} />;
}

// ---------------------------------------------------------------------------
// 💡 Custom Bloom + Vignette
// ---------------------------------------------------------------------------
function FXBloom({ strength = 0.35, radius = 0.35, threshold = 0.6 }: any) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<ThreeEffectComposer | null>(null);

  useEffect(() => {
    // ✅ guard: don't start until renderer & camera exist
    if (!gl || !scene || !camera) return;

    const composer = new ThreeEffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      strength,
      radius,
      threshold
    );

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.setSize(size.width, size.height);
    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera, size, strength, radius, threshold]);

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
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

  return (
    <Canvas orthographic camera={{ zoom: 40, position: [60, 80, 60] }} shadows style={{ width: "100vw", height: "100vh" }}>
      <SkyDome />
      <HazeAndSun />
      <Terrain ref={terrainRef} width={200} height={200} scale={1.0} noise={simplex} onSurfaceClick={(p) => setTarget(p)} />
      <Trees positions={forestPositions} />
      <PlayerController target={target} noise={simplex} playerRef={playerRef} terrainRef={terrainRef} />
      <FollowCamera playerRef={playerRef} />
      <Fireflies />
      <FXBloom strength={0.35} radius={0.35} threshold={0.6} />
      <OrbitControls enableRotate={false} enableZoom />
    </Canvas>
  );
}
