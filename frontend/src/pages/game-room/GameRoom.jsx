import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import './GameRoom.css';


// Keep for example purposes
// function Plane(props) {
//   const [hovered, setHover] = useState(false)
//   const [active, setActive] = useState(false)
//   useFrame((state, delta) => (meshRef.current.rotation.x += delta))
//   return (
//     <mesh
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

function Unit({position}){
    const unitRef = useRef();

    return (
        <mesh ref={unitRef} position={[position[0], 0.5, position[2]]} rotation={[0, 0, 0]} scale={0.5}>
            {/* arg here is: radius */}
            <sphereGeometry args={[0.5]} />
            <meshStandardMaterial color="yellow" />
        </mesh>
    )
}

function Building({position}){
    const buildingRef = useRef();

    return (
        <mesh ref={buildingRef} position={[position[0], 0.5, position[2]]} rotation={[0, Math.PI / 4, 0]} scale={1}>
            {/* arg here is: base radius, height, number of sides */}
            <coneGeometry args={[0.5, 1, 4]} />
            <meshStandardMaterial color="yellow" />
        </mesh>
    )
}

function GameRoom({socket}){
    const location = useLocation();
    const { startingGameData } = location.state || {};

    const [board, setBoard] = useState([]);
    const [units, setUnits] = useState([]);
    const [buildings, setBuildings] = useState([]);

    useEffect(() => {
        const storedSocketId = localStorage.getItem('dom-player-socket');
        const storedRoom = localStorage.getItem('dom-game-room');

        // If we have stored credentials, attempt reconnect
        if (storedSocketId && storedRoom && storedSocketId !== socket.id) {
                console.log('Reconnecting with:', storedSocketId, storedRoom);
                socket.emit('player-reconnect', {
                    originalSocketId: storedSocketId,
                    gameRoom: storedRoom,
                })
        }

        // Handle reconnect response or fresh game data
        socket.on('starting-game-data', (data) => {
            console.log('Received game data:', data);

            // Update localStorage with current socket
            localStorage.setItem('dom-player-socket', socket.id);
            localStorage.setItem('dom-game-room', data.room);

            setBoard(data.board);
            setUnits(data.units.filter(u => u.player === socket.id));
            setBuildings(data.buildings.filter(b => b.player === socket.id));
        })

        // If we have fresh game data from navigation, use it
        if (startingGameData) {
            setBoard(startingGameData.board);
            setUnits(startingGameData.units.filter(u => u.player === socket.id));
            setBuildings(startingGameData.buildings.filter(b => b.player === socket.id));
        }

        return () => {
            socket.off('starting-game-data');
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

                {/* Units */}
                { units.length > 0 && units.map((unit, index) => (
                    <Unit key={index} position={[unit.x - offsetX, 0, unit.z - offsetZ]} />
                ))}

                {/* Buildings */}
                { buildings.length > 0 && buildings.map((building, index) => (
                    <Building key={index} position={[building.x - offsetX, 0, building.z - offsetZ]} />
                ))}

                {/* Controls */}
                <OrbitControls />
            </Canvas>

            <Link to="/"><button className="title-screen-button">Title Screen</button></Link>
        </div>
    );
}

export default GameRoom