import * as THREE from "three";
import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const TERRAIN_SIZE = 50;
const HALF_SIZE = TERRAIN_SIZE / 2;

function useHeightMap(width: number, depth: number) {
  return useMemo(() => {
    const geometry = new THREE.PlaneGeometry(width, depth, 100, 100);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / width;
      const y = pos.getY(i) / depth;
      const height =
        Math.sin(x * Math.PI * 2) * 0.2 +
        Math.sin(y * Math.PI * 1.5) * 0.2 +
        Math.sin((x + y) * Math.PI) * 0.3;
      pos.setZ(i, height);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [width, depth]);
}

function Terrain() {
  const geom = useHeightMap(TERRAIN_SIZE, TERRAIN_SIZE);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive attach="geometry" object={geom} />
      <meshStandardMaterial color="#2c3b2e" roughness={0.9} />
    </mesh>
  );
}

function Path() {
  const shape = useMemo(() => {
    const pathWidth = 4;
    const shape = new THREE.Shape();
    shape.moveTo(-HALF_SIZE + 4, -HALF_SIZE + 6);
    shape.quadraticCurveTo(-10, -5, -5, 0);
    shape.quadraticCurveTo(-2, 5, 0, 6);
    shape.quadraticCurveTo(5, 10, 8, 12);
    shape.quadraticCurveTo(12, 16, 15, 18);
    shape.lineTo(15 + pathWidth, 18);
    shape.quadraticCurveTo(12 + pathWidth, 16, 8 + pathWidth, 12);
    shape.quadraticCurveTo(5 + pathWidth, 10, 2 + pathWidth, 6);
    shape.quadraticCurveTo(pathWidth, 5, -3 + pathWidth, 0);
    shape.quadraticCurveTo(-8 + pathWidth, -5, -HALF_SIZE + 4 + pathWidth, -HALF_SIZE + 6);
    shape.closePath();
    return shape;
  }, []);

  const geom = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <primitive attach="geometry" object={geom} />
      <meshStandardMaterial color="#6d5a41" roughness={0.8} />
    </mesh>
  );
}

function Tree({ position }: { position: THREE.Vector3 | [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.3, 3, 8]} />
        <meshStandardMaterial color="#3d2f23" roughness={1} />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow>
        <coneGeometry args={[1.2, 3, 8]} />
        <meshStandardMaterial color="#1f3a1d" roughness={1} />
      </mesh>
    </group>
  );
}

const FOREST_EDGE_POSITIONS: [number, number, number][] = Array.from({ length: 14 }, (_, i) => [
  -HALF_SIZE + Math.random() * 8,
  0,
  -HALF_SIZE + 4 + Math.random() * 12
]);

function ForestEdge() {
  return (
    <group name="ForestEdge">
      {FOREST_EDGE_POSITIONS.map((pos, idx) => (
        <Tree key={idx} position={pos} />
      ))}
    </group>
  );
}

const HOUSE_DATA = [
  { position: [6, 0, 10] as [number, number, number], rotation: [0, -Math.PI / 8, 0] as [number, number, number] },
  { position: [12, 0, 4] as [number, number, number], rotation: [0, Math.PI / 6, 0] as [number, number, number] },
  { position: [18, 0, 11] as [number, number, number], rotation: [0, Math.PI / 4, 0] as [number, number, number] },
];

function House({ position, rotation, index }: { position: [number, number, number]; rotation: [number, number, number]; index: number }) {
  const chestPositions = useMemo(() => {
    const count = index % 2 === 0 ? 2 : 1;
    return Array.from({ length: count }, (_, i) => new THREE.Vector3(-1 + i * 1.3, 0.45, 0));
  }, [index]);

  return (
    <group position={position} rotation={rotation} name={`House_${index}`}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 3, 4.2]} />
        <meshStandardMaterial color="#7a5a3f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.7, 0]} castShadow>
        <cylinderGeometry args={[0, 3.2, 2.6, 4]} />
        <meshStandardMaterial color="#5c3f2b" roughness={0.8} />
      </mesh>

      {/* Doorway collider */}
      <mesh
        name="doorway"
        position={[0, 1, 2.2]}
        rotation={[0, 0, 0]}
        userData={{ type: "doorway", house: index }}
        visible={false}
      >
        <boxGeometry args={[1.2, 2, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Loot chests */}
      {chestPositions.map((chestPos, cIndex) => (
        <group
          key={cIndex}
          position={chestPos.toArray() as [number, number, number]}
          name={`Chest_${index}_${cIndex}`}
          userData={{ type: "lootable", house: index }}
        >
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[0.8, 0.6, 0.5]} />
            <meshStandardMaterial color="#a67c52" metalness={0.1} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, 0.75, 0]}>
            <boxGeometry args={[0.8, 0.2, 0.5]} />
            <meshStandardMaterial color="#8b5a2b" metalness={0.05} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Torch({ position }: { position: [number, number, number] }) {
  const lightRef = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const flicker = 1 + Math.sin(t * 13 + position[0]) * 0.2 + Math.sin(t * 7 + position[2]) * 0.1;
    if (lightRef.current) {
      lightRef.current.intensity = 2.4 * flicker;
    }
  });
  return (
    <group position={position}>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ff944d"
        intensity={2.4}
        distance={12}
        decay={2}
        castShadow
      />
    </group>
  );
}

function MoonLight() {
  return (
    <directionalLight
      color="#9faad1"
      intensity={0.35}
      position={[30, 40, -10]}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
    />
  );
}

function NavAreas() {
  const navData = useMemo(
    () => [
      { position: [-15, 0.02, -10], rotation: [-Math.PI / 2, 0, 0], size: [8, 6], tag: "forest_spawn" },
      { position: [6, 0.02, 8], rotation: [-Math.PI / 2, 0, 0], size: [6, 6], tag: "village_center" },
      { position: [18, 0.02, 12], rotation: [-Math.PI / 2, 0, 0], size: [6, 5], tag: "tavern_patrol" },
      { position: [0, 0.02, 0], rotation: [-Math.PI / 2, 0, 0], size: [6, 10], tag: "path_patrol" },
    ],
    []
  );

  return (
    <group name="NavAreas">
      {navData.map((area, idx) => (
        <mesh
          key={idx}
          position={area.position as [number, number, number]}
          rotation={area.rotation as [number, number, number]}
          visible={false}
          userData={{ navArea: area.tag }}
        >
          <planeGeometry args={area.size} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

function TavernSpawn() {
  const tavernPlacement = useMemo(() => {
    const edge = Math.floor(Math.random() * 4);
    const margin = HALF_SIZE - 4;
    if (edge === 0) return new THREE.Vector3(-margin, 0, (Math.random() - 0.5) * TERRAIN_SIZE);
    if (edge === 1) return new THREE.Vector3(margin, 0, (Math.random() - 0.5) * TERRAIN_SIZE);
    if (edge === 2) return new THREE.Vector3((Math.random() - 0.5) * TERRAIN_SIZE, 0, -margin);
    return new THREE.Vector3((Math.random() - 0.5) * TERRAIN_SIZE, 0, margin);
  }, []);

  return (
    <group position={tavernPlacement.toArray() as [number, number, number]} name="Tavern">
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 2, 4]} />
        <meshStandardMaterial color="#4b2f1f" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <coneGeometry args={[3, 2, 6]} />
        <meshStandardMaterial color="#2d1b12" roughness={0.9} />
      </mesh>
      <mesh
        position={[0, 1.1, 2.1]}
        userData={{ type: "doorway", tavern: true }}
        visible={false}
      >
        <boxGeometry args={[1.5, 2.2, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function Ambient() {
  return <ambientLight intensity={0.2} color="#1b1f2a" />;
}

function TorchRing() {
  const torchPositions: [number, number, number][] = [
    [5, 0, 8],
    [10, 0, 5],
    [14, 0, 9],
    [18, 0, 13],
  ];
  return (
    <group name="Torches">
      {torchPositions.map((pos, idx) => (
        <Torch key={idx} position={pos} />
      ))}
    </group>
  );
}

function VillageContent() {
  return (
    <group>
      <Terrain />
      <Path />
      <ForestEdge />
      {HOUSE_DATA.map((house, idx) => (
        <House key={idx} position={house.position} rotation={house.rotation} index={idx} />
      ))}
      <TavernSpawn />
      <TorchRing />
      <NavAreas />
      <MoonLight />
      <Ambient />
    </group>
  );
}

function SceneRoot() {
  return (
    <Canvas shadows camera={{ position: [-20, 20, 30], fov: 50 }}>
      <color attach="background" args={["#06090d"]} />
      <fog attach="fog" color="#06090d" near={30} far={120} />
      <Suspense fallback={null}>
        <VillageContent />
      </Suspense>
      <OrbitControls target={[10, 0, 10]} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}

export default SceneRoot;
