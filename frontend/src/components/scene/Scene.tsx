import { OrbitControls, Center } from "@react-three/drei";
import { Canvas, useLoader, useFrame, useThree } from "@react-three/fiber";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import { Button } from "@material-ui/core";
import { useNavigate } from "react-router-dom";

import "./Scene.css";

const MovingCamera: React.FC = () => {
  const [angle, setAngle] = useState(0);

  useFrame(({ camera }) => {
    setAngle((prev) => prev + 0.03);
    const radius = 1.5;
    const height = 0;

    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = height;
    camera.lookAt(0, 0, 0);
  });

  return null;
};

const Background: React.FC = () => {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color("#161512");
  }, [scene]);

  return null;
};

const ChessPiece: React.FC = () => {
  const gltf = useMemo(
    () => useLoader(GLTFLoader as any, "/chess_pawn.glb"),
    []
  );

  useEffect(() => {
    gltf.scene.traverse((child: { material: THREE.MeshStandardMaterial }) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.6,
          metalness: 0.9,
        });
      }
    });
  }, [gltf]);

  return (
    <primitive
      object={gltf.scene}
      castShadow
      receiveShadow
      position={[0, 3, 0]}
    />
  );
};

const Scene: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="scene-container">
      <div className="scene">
        <Suspense fallback={null}>
          <Canvas camera={{ position: [5, 3, 5] }} shadows>
            <Background />
            <MovingCamera />
            <directionalLight
              position={[5, 10, 5]}
              castShadow
              intensity={1.5}
              shadow-mapSize-width={4096}
              shadow-mapSize-height={4096}
            />
            <Center>
              <group position={[0, 1, 0]}>
                <ChessPiece />
              </group>
            </Center>
            <OrbitControls target={[0, 1, 0]} />
          </Canvas>
        </Suspense>
      </div>

      <div className="play-button">
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate("/board")}
        >
          Play Against Gambitron
        </Button>
      </div>
    </div>
  );
};

export default Scene;
