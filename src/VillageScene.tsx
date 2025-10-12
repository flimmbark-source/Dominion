import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const TERRAIN_SIZE = 50;
const HOUSE_POSITIONS: Array<THREE.Vector3Tuple> = [
  [-8, 0, -6],
  [0, 0, -2],
  [10, 0, -8],
];

const NAV_AREAS = [
  { id: "forest-entry", position: [-20, 0.02, 15] as THREE.Vector3Tuple, size: [10, 6] },
  { id: "path-approach", position: [-10, 0.02, 5] as THREE.Vector3Tuple, size: [14, 4] },
  { id: "village-loop", position: [2, 0.02, -4] as THREE.Vector3Tuple, size: [16, 12] },
  { id: "back-alley", position: [12, 0.02, -10] as THREE.Vector3Tuple, size: [10, 6] },
];

function SceneSetup() {
  const { scene } = useThree();
  useMemo(() => {
    scene.background = new THREE.Color("#0b1019");
    scene.fog = new THREE.Fog("#0b1019", 20, 120);
  }, [scene]);
  return null;
}

function Terrain() {
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 120, 120);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h =
        Math.sin(x * 0.2) * 0.3 +
        Math.cos(y * 0.18) * 0.25 +
        Math.sin((x + y) * 0.1) * 0.15;
      pos.setZ(i, h);
    }
    geom.computeVertexNormals();
    return geom;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color={"#1f2a1d"}
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

function Path() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5, 0.01, 5]} receiveShadow>
      <planeGeometry args={[20, 4]} />
      <meshStandardMaterial color={"#4a3b2d"} roughness={1} />
    </mesh>
  );
}

function Tree({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 2, 8]} />
        <meshStandardMaterial color={"#5b3a1a"} />
      </mesh>
      <mesh position={[0, 2.4, 0]} castShadow>
        <coneGeometry args={[1.6, 3.4, 8]} />
        <meshStandardMaterial color={"#23422d"} />
      </mesh>
    </group>
  );
}

function TorchLight({ position }: { position: THREE.Vector3Tuple }) {
  const lightRef = useRef<THREE.PointLight>(null!);
  const baseIntensity = useMemo(() => 0.6 + Math.random() * 0.2, []);
  useFrame(({ clock }) => {
    if (lightRef.current) {
      const flicker = (Math.sin(clock.elapsedTime * 8 + position[0]) + 1) * 0.08;
      lightRef.current.intensity = baseIntensity + flicker;
    }
  });
  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color="#ffb46d"
        distance={12}
        decay={2}
        castShadow
        position={[0, 2.4, 0]}
      />
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color="#ffefc1" />
      </mesh>
    </group>
  );
}

function Chest({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <mesh
      position={position}
      castShadow
      userData={{ tag: "lootable", type: "chest" }}
    >
      <boxGeometry args={[0.8, 0.6, 0.5]} />
      <meshStandardMaterial color={"#7a4a2a"} metalness={0.2} roughness={0.6} />
    </mesh>
  );
}

function DoorCollider({ position, size }: { position: THREE.Vector3Tuple; size: THREE.Vector3Tuple }) {
  return (
    <mesh
      position={position}
      visible={false}
      userData={{ type: "doorway", collider: true }}
    >
      <boxGeometry args={size} />
    </mesh>
  );
}

function House({ position, chestCount }: { position: THREE.Vector3Tuple; chestCount: number }) {
  const chestPositions = useMemo(() => {
    const list: THREE.Vector3Tuple[] = [];
    for (let i = 0; i < chestCount; i++) {
      const offsetX = -1 + i * 1.6;
      list.push([offsetX, 0.35, 0]);
    }
    return list;
  }, [chestCount]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[4, 2, 4]} />
        <meshStandardMaterial color={"#5c5650"} />
      </mesh>
      <mesh castShadow position={[0, 2.6, 0]}>
        <coneGeometry args={[3.5, 2.4, 4]} />
        <meshStandardMaterial color={"#3a2f2a"} />
      </mesh>
      <DoorCollider position={[0, 0.9, 2.05]} size={[1.4, 1.8, 0.3]} />
      {chestPositions.map((pos, i) => (
        <Chest key={i} position={pos} />
      ))}
      <TorchLight position={[1.8, 0, 2.2]} />
    </group>
  );
}

function NavAreas() {
  return (
    <group>
      {NAV_AREAS.map((area) => (
        <mesh
          key={area.id}
          position={area.position}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          userData={{ type: "navArea", id: area.id }}
        >
          <planeGeometry args={[area.size[0], area.size[1]]} />
        </mesh>
      ))}
    </group>
  );
}

function Tavern({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1.2, 0]} userData={{ type: "tavern" }}>
        <boxGeometry args={[5, 2.4, 5]} />
        <meshStandardMaterial color={"#40362f"} />
      </mesh>
      <mesh castShadow position={[0, 3, 0]}>
        <coneGeometry args={[4, 2.5, 6]} />
        <meshStandardMaterial color={"#2e2621"} />
      </mesh>
      <TorchLight position={[2.2, 0, 2.4]} />
      <TorchLight position={[-2.2, 0, 2.4]} />
      <DoorCollider position={[0, 1, 2.6]} size={[1.8, 2, 0.4]} />
    </group>
  );
}

function TavernSpawner() {
  const position = useMemo<THREE.Vector3Tuple>(() => {
    const edge = Math.floor(Math.random() * 4);
    const offset = TERRAIN_SIZE / 2 - 4;
    switch (edge) {
      case 0:
        return [-offset, 0, THREE.MathUtils.randFloatSpread(10)];
      case 1:
        return [offset, 0, THREE.MathUtils.randFloatSpread(10)];
      case 2:
        return [THREE.MathUtils.randFloatSpread(10), 0, -offset];
      default:
        return [THREE.MathUtils.randFloatSpread(10), 0, offset];
    }
  }, []);

  return <Tavern position={position} />;
}

function Trees() {
  const treePositions = useMemo(() => {
    const positions: THREE.Vector3Tuple[] = [];
    const radius = TERRAIN_SIZE / 2 - 5;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = radius + THREE.MathUtils.randFloatSpread(6);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      positions.push([x, 0, z]);
    }
    return positions;
  }, []);

  return (
    <group>
      {treePositions.map((pos, index) => (
        <Tree key={index} position={pos} />
      ))}
    </group>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.25} color="#3a4a6a" />
      <directionalLight
        color="#8ba4d9"
        intensity={0.35}
        position={[20, 30, 10]}
        castShadow
      />
    </>
  );
}

function VillageContent() {
  return (
    <>
      <SceneSetup />
      <Lighting />
      <Terrain />
      <Path />
      <Trees />
      <NavAreas />
      {HOUSE_POSITIONS.map((position, index) => (
        <House key={index} position={position} chestCount={index % 2 === 0 ? 2 : 1} />
      ))}
      <TavernSpawner />
    </>
  );
}

const VillageScene: React.FC = () => {
  return (
    <Canvas shadows camera={{ position: [20, 22, 24], fov: 45 }}>
      <OrbitControls target={[0, 4, 0]} maxPolarAngle={Math.PI / 2.1} />
      <VillageContent />
    </Canvas>
  );
};

export default VillageScene;
