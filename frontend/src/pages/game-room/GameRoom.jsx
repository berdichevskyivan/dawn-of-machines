import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import './GameRoom.css';


// Keep for example purposes
// function Plane(props) {
//   const meshRef = useRef()
//   const [hovered, setHover] = useState(false)
//   const [active, setActive] = useState(false)
//   useFrame((state, delta) => (meshRef.current.rotation.x += delta))
//   return (
//     <mesh
//       {...props}
//       ref={meshRef}
//       scale={active ? 1.5 : 1}
//       onClick={(event) => setActive(!active)}
//       onPointerOver={(event) => setHover(true)}
//       onPointerOut={(event) => setHover(false)}>
//       <planeGeometry args={[2, 2]} />
//       <meshStandardMaterial color={'green'} />
// meshBasicMaterial: does NOT calculate lighting, meshStandardMaterial: calculates lighting
//     </mesh>
//   )
// }

function Camera(){
    const { camera } = useThree();
    useEffect(()=>{
        camera.position.set(0, 7, 7);
        camera.lookAt(0, 0, 0);
    }, []);
    return null;
}

function Tile({position, tile}){

    const tileRef = useRef();

    // Not used yet
    // useFrame((state, delta) => {
    //     tileRef.current.scale.x += 0.01;
    // })

    return (
        <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Outline */}
            <mesh renderOrder={0}>
                <planeGeometry args={[1.2, 1.2]} />
                <meshBasicMaterial color="limegreen" depthWrite={false} />
            </mesh>

            {/* Tile */}
            <mesh 
                ref={tileRef}
                renderOrder={1}
                scale={[0.50, 0.50, 1]}
                onClick={(event) => { console.log('tile.id: ', tile.id) }}
            >
                <planeGeometry args={[1.9,1.9]} />
                <meshStandardMaterial color="green" />
            </mesh>
        </group>
    )
}

function GameRoom({socket}){
    const location = useLocation();
    const { startingGameData } = location.state || {};

    const [board, setBoard] = useState([]);

    useEffect(()=>{
        // perfect. This is enough to construct the board for now
        console.log('startingGameData: ', startingGameData);
        console.log('socket: ', socket);

        if(startingGameData){
            setBoard(startingGameData.board);
        }
    }, []);

    // think of this as a diagonal cutting from center of the first tile
    // towards the center of the last tile
    const maxX = Math.max(...board.map(t => t.x));
    const maxZ = Math.max(...board.map(t => t.z));
    const offsetX = maxX / 2;
    const offsetZ = maxZ / 2;

    return (
        <div className="game-room-container">
            <h1>Game Room</h1>

            {/* Board */}
            <Canvas>
                {/* Camera */}
                <Camera />

                {/* Lights */}
                <ambientLight intensity={Math.PI / 2} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
                <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

                {/* Tiles */}
                { board.length > 0 && board.map((tile, index) => (
                    <Tile key={index} position={[tile.x - offsetX, 0, tile.z - offsetZ]} tile={tile}/>
                ))}

                {/* Controls */}
                <OrbitControls />
            </Canvas>

            <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
        </div>
    );
}

export default GameRoom