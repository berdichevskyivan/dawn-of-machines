import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import './GameRoom.css';

function Plane(props) {
  // This reference will give us direct access to the mesh
  const meshRef = useRef()
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  // Subscribe this component to the render-loop, rotate the mesh every frame
  // this rotates the plane. We dont want this now, but we will FOR SURE use useFrame for effects , etc
  // for now: commented
  // useFrame((state, delta) => (meshRef.current.rotation.x += delta))
  // Return view, these are regular three.js elements expressed in JSX
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}>
      <planeGeometry args={[2, 2]} />
      <meshStandardMaterial color={'green'} />
    </mesh>
  )
}

function GameRoom({socket}){
    const location = useLocation();
    const { startingGameData } = location.state || {};

    useEffect(()=>{
        // perfect. This is enough to construct the board for now
        console.log('startingGameData: ', startingGameData);
        console.log('socket: ', socket);
    }, []);

    return (
        <div className="game-room-container">
            <h1>Game Room</h1>

            {/* Board */}
            <Canvas>
                {/* Lights */}
                <ambientLight intensity={Math.PI / 2} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
                <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

                {/* Tiles */}
                <Plane position={[0, 0, 0]} />

                {/* Controls */}
                <OrbitControls />
            </Canvas>

            <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
        </div>
    );
}

export default GameRoom