import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import './GameRoom.css';


function ModelMapper({model, previewRef}){
    switch(model){
        case 'gather-node':
            return (
                <mesh ref={previewRef}>
                    <sphereGeometry args={[0.5]} />
                    <meshStandardMaterial color="yellow" />
                </mesh>
            );
        case 'assembly-plant':
            return (
                <mesh ref={previewRef}>
                    <coneGeometry args={[0.5, 1, 4]} />
                    <meshStandardMaterial color="yellow" />
                </mesh>
            );
        case 'generator':
            return (
                <mesh ref={previewRef}>
                    <coneGeometry args={[0.5, 1, 4]} />
                    <meshStandardMaterial color="yellow" />
                </mesh>
            )
        default:
            return (<></>)
    }
}

function Camera({mainControlsRef}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 7, 7); // x,y,z where the point is the center of the camera

    if (mainControlsRef.current) {
      mainControlsRef.current.target.set(0, -4, 0); // x,y,z where the point is the target
      mainControlsRef.current.update();
    }
  }, [camera]);

  return <OrbitControls ref={mainControlsRef} camera={camera} />;
}

function ViewportCamera({ targetRef, selected }) {
  const { camera, size } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (!targetRef.current) return;

    // Compute bounds
    const box = new THREE.Box3().setFromObject(targetRef.current);
    const sizeVec = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(sizeVec);
    box.getCenter(center);

    if(selected.model !== 'gather-node'){
        // nudge the center slightly
        center.y += sizeVec.y * -0.10;
    }

    // Fit distance based on FOV
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fov = camera.fov * (Math.PI / 180);
    let distance = maxDim / (2 * Math.tan(fov / 2));

    distance *= 1.8; // padding factor

    camera.position.copy(center.clone().add(new THREE.Vector3(0, 0, distance)));
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [selected]);

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      enablePan
      enableZoom
    />
  );
}

function Tile({position, tile, moveToTile}){

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
            {/* On context menu, if unit, we trigger movement */}
            <mesh 
                ref={tileRef}
                renderOrder={1}
                scale={[0.50, 0.50, 1]}
                onClick={(event) => { console.log('tile.id: ', tile.id) }}
                onContextMenu={(event) => { moveToTile(tile.id) }}
            >
                <planeGeometry args={[1.9,1.9]} />
                <meshStandardMaterial color="green" />
            </mesh>
        </group>
    )
}

function Unit({position, unit, selectUnit}){
    const unitRef = useRef();

    useFrame((state, delta) => {
        if(!unitRef.current) return;
        
        const smoothTime = 0.1; // seconds to smooth movement
        unitRef.current.position.x += (position[0] - unitRef.current.position.x) * (delta / smoothTime);
        unitRef.current.position.z += (position[2] - unitRef.current.position.z) * (delta / smoothTime);
    });

    return (
        <mesh 
            ref={unitRef}
            position={[position[0], 0.5, position[2]]}
            rotation={[0, 0, 0]}
            scale={0.5}
            onClick={(event)=>{ selectUnit(unit.id) }} // left click selects the unit
        >
            {/* arg here is: radius */}
            <sphereGeometry args={[0.5]} />
            <meshStandardMaterial color="yellow" />
        </mesh>
    )
}

function Building({position, building, selectBuilding}){
    const buildingRef = useRef();

    return (
        <mesh 
            ref={buildingRef}
            position={[position[0], 0.5, position[2]]}
            rotation={[0, Math.PI / 4, 0]}
            scale={1}
            onClick={(event)=>{ selectBuilding(building.id) }} // left click selects the building
        >
            {/* arg here is: base radius, height, number of sides */}
            <coneGeometry args={[0.5, 1, 4]} />
            <meshStandardMaterial color="yellow" />
        </mesh>
    )
}

function Clock({ startingTime }) {
    const [elapsed, setElapsed] = useState(Date.now() - startingTime);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - startingTime);
        }, 1000);

        return () => clearInterval(interval);
    }, [startingTime]);

    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const displaySeconds = seconds % 60;

    return (
        <h1>{minutes}:{displaySeconds.toString().padStart(2, '0')}</h1>
    )
}

function GameRoom({socket}){
    const location = useLocation();
    const navigate = useNavigate();
    const { startingGameData } = location.state || {};

    const mainControlsRef = useRef();
    const previewRef = useRef();

    const [board, setBoard] = useState([]);
    const [units, setUnits] = useState([]);
    const [buildings, setBuildings] = useState([]);
    const [resources, setResources] = useState(null);
    const [startingTime, setStartingTime] = useState(null);
    const [gameRoom, setGameRoom] = useState('');
    const [selected, setSelected] = useState(null);

    const selectUnit = (unitId) => {
        const unit = units.find(u => u.id === unitId);
        if(unit){
            console.log('unit: ', unit)
            setSelected(unit);
        }
    }

    const selectBuilding = (buildingId) => {
        const building = buildings.find(b => b.id === buildingId);

        if(building){
            console.log('building: ', building)
            setSelected(building);
        }
    }

    const moveToTile = (tileId) => {
        // If nothing is selected, no movement can be done
        if(!selected){
            console.log('Nothing is selected!');
            return;
        }

        // right now, we just move, but later
        // we will differentiate between moving units and non-moving buildings
        // TODO: units and buildings seem to be flowing to UNIFICATION, type: unit and type: building but what could be the name of the objects.
        // Entities? Perhaps. It's possible.

        // Ok. Here we emit. We NEED to know:
        // The Tile the player wants to go to
        // WHICH unit wants to go to that tile
        // the game can be looked up by the server
        socket.emit('movement', { tileId, unitId: selected.id, room: gameRoom })

        // We dont do anything else here. We just need to bind the "receiving signal" to a signal.on and we're good
        console.log('moveToTile: ', tileId);
    }

    const playerDisconnect = (socket) => {
        socket.emit('player-disconnect');
        setTimeout(()=>{
            navigate('/');
        }, 1000)
    }

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
            setResources(data.players.filter(p => p.socketId === socket.id)[0]?.resources);
            setStartingTime(data.startingTime);
            setGameRoom(data.room);
        })

        // Handles player-update
        socket.on('player-update', (data) => {
            setResources(data.playerData.resources);
        })

        // Handles movement
        socket.on('movement-update', (data) => {
            setUnits(prev => prev.map(u => 
                u.id === data.unitId ? { ...u, x: data.x, z: data.z } : u
            ));
        });

        socket.on('game-disconnect', () => {
            setTimeout(()=>{
                navigate('/');
            }, 1000)
        })

        // If we have fresh game data from navigation, use it
        if (startingGameData) {
            setBoard(startingGameData.board);
            setUnits(startingGameData.units.filter(u => u.player === socket.id));
            setBuildings(startingGameData.buildings.filter(b => b.player === socket.id));
            setResources(startingGameData.players.filter(p => p.socketId === socket.id)[0]?.resources);
            setStartingTime(startingGameData.startingTime);
            setGameRoom(startingGameData.room);
        }

        return () => {
            socket.off('starting-game-data');
            socket.off('player-update');
            socket.off('game-disconnect');
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
            { resources && (
                <div className="top-ui-bar">
                    <div className="resources-section">
                        <div className="resource-field">
                            <div className="icon">
                                <div className="electricity-icon" />
                            </div>
                            <h1 className="electricity-text">{Number(resources.electricity.toFixed(1))}</h1>
                        </div>
                        <div className="resource-field">
                            <div className="icon">
                                <div className="iron-icon" />
                            </div>
                            <h1>{resources.iron}</h1>
                        </div>
                        <div className="resource-field">
                            <div className="icon">
                                <svg className="carbon-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <line x1="10" y1="10" x2="10" y2="0"/>
                                    <line x1="10" y1="10" x2="20" y2="5"/>
                                    <line x1="10" y1="10" x2="20" y2="15"/>
                                    <line x1="10" y1="10" x2="10" y2="20"/>
                                    <line x1="10" y1="10" x2="0" y2="15"/>
                                    <line x1="10" y1="10" x2="0" y2="5"/>
                                    {/* Inner ring */}
                                    {/* Endpoints at radius 3 from center (10,10). */}
                                    {/* Control points offset 1 unit inward from the midpoint between adjacent radial endpoints. */}
                                    {/* Six arcs, one per radial segment. */}
                                    <path d="M 10 7 Q 11 9 13 8" fill="none"/>
                                    <path d="M 13 8 Q 11 11 13 12" fill="none"/>
                                    <path d="M 13 12 Q 11 11 10 13" fill="none"/>
                                    <path d="M 10 13 Q 9 11 7 12" fill="none"/>
                                    <path d="M 7 12 Q 9 11 7 8" fill="none"/>
                                    <path d="M 7 8 Q 9 9 10 7" fill="none"/>

                                    {/* Middle ring */}
                                    {/* Endpoints at radius 6 from center (10,10). */}
                                    {/* Control points offset 3 units inward from the midpoint between adjacent radial endpoints. */}
                                    {/* Six arcs, one per radial segment. */}
                                    <path d="M 10 4 Q 12 7 16 6" fill="none"/>
                                    <path d="M 16 6 Q 13 10 16 14" fill="none"/>
                                    <path d="M 16 14 Q 12 13 10 16" fill="none"/>
                                    <path d="M 10 16 Q 8 13 4 14" fill="none"/>
                                    <path d="M 4 14 Q 7 10 4 6" fill="none"/>
                                    <path d="M 4 6 Q 8 7 10 4" fill="none"/>

                                    {/* Outer ring */}
                                    {/* Endpoints at radius 9 from center (10,10). ViewBox 0-20, radius 9 places endpoints near icon edges. */}
                                    {/* Control points offset 5 units inward from the midpoint between adjacent radial endpoints. */}
                                    {/* Six arcs, one per radial segment. */}
                                    <path d="M 10 1 Q 13 4 19 5" fill="none"/>
                                    <path d="M 19 5 Q 16 10 19 15" fill="none"/>
                                    <path d="M 19 15 Q 13 16 10 19" fill="none"/>
                                    <path d="M 10 19 Q 7 16 1 15" fill="none"/>
                                    <path d="M 1 15 Q 4 10 1 5" fill="none"/>
                                    <path d="M 1 5 Q 7 4 10 1" fill="none"/>

                                    {/* Each arc is a quadratic bezier. Two endpoints on adjacent radial lines. */}
                                    {/* One control point pulled toward center to produce inward curve. */}
                                    {/* Inward pull increases proportionally with ring radius to maintain consistent visual sag. */}
                                </svg>
                            </div>
                            <h1>{resources.carbon}</h1>
                        </div>
                        <div className="resource-field">
                            <div className="icon">
                                <svg className="time-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    {/* Circle */}
                                    <circle cx="10" cy="10" r="9" fill="none"/>

                                    {/* Three FROM center — clockwise */}
                                    <path d="M 10 10 Q 7 6 10 3" fill="none"/>
                                    <path d="M 10 10 Q 19 11 16.8 13.5" fill="none"/>
                                    <path d="M 10 10 Q 4 15 3.2 13.5" fill="none"/>

                                    {/* Three FROM circumference — counterclockwise */}
                                    <path d="M 10 19 Q 13 16 10 13" fill="none"/>
                                    <path d="M 2.2 5.5 Q 4 9 7.5 8.5" fill="none"/>
                                    <path d="M 17.8 5.5 Q 14 4 12.5 8.5" fill="none"/>
                                </svg>
                            </div>
                            <Clock startingTime={startingTime}/>
                        </div>
                    </div>
                    <div className="buttons-section">
                        <button className="disconnect-button" onClick={()=>{playerDisconnect(socket)}}>Disconnect</button>
                    </div>
                </div>
            )}

            {/* Board */}
            <Canvas>
                {/* Camera and Controls (OrbitControls)*/}
                <Camera mainControlsRef={mainControlsRef}/>

                {/* Lights */}
                <ambientLight intensity={Math.PI / 2} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
                <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

                {/* Tiles */}
                { board.length > 0 && board.map((tile, index) => (
                    <Tile key={index} position={[tile.x - offsetX, 0, tile.z - offsetZ]} tile={tile} moveToTile={moveToTile} />
                ))}

                {/* Units */}
                { units.length > 0 && units.map((unit, index) => (
                    <Unit key={index} position={[unit.x - offsetX, 0, unit.z - offsetZ]} unit={unit} selectUnit={selectUnit}/>
                ))}

                {/* Buildings */}
                { buildings.length > 0 && buildings.map((building, index) => (
                    <Building key={index} position={[building.x - offsetX, 0, building.z - offsetZ]} building={building} selectBuilding={selectBuilding}/>
                ))}

                {/* Bottom UI Bar */}
                {/* This is a div by default */}
                {/* We add another wrapper div because Html adds another wrapper div */}
                {/* So we target that first div and then we have control over inner-wrapper */}
                <Html wrapperClass="bottom-ui-bar" style={{pointerEvents: 'auto'}} >
                    <div className="inner-wrapper">
                        {/* stopPropagation prevents the event from reaching the OrbitControls */}
                        <div className="bottom-ui-panel left-panel" onContextMenu={(e) => { e.stopPropagation() }}>
                        </div>
                        <div className="bottom-ui-panel center-panel" onContextMenu={(e) => { e.stopPropagation() }}>
                            {/* Selection Viewport */}
                            <div className="selection-container selection-viewport-container">
                                <div 
                                    className="selection-viewport"
                                    onPointerEnter={() => (mainControlsRef.current.enabled = false)}
                                    onPointerLeave={() => (mainControlsRef.current.enabled = true)}
                                >
                                    {/* Viewport R3F/Three Canvas */}
                                    <Canvas>
                                        {/* unit preview mesh */}
                                        { selected && (
                                            <>
                                                <ViewportCamera targetRef={previewRef} selected={selected}/>

                                                {/* lights */}
                                                <ambientLight intensity={1} />
                                                <directionalLight position={[5, 5, 5]} />
                                                <ModelMapper previewRef={previewRef} model={selected.model} />
                                            </>
                                        )}
                                    </Canvas>
                                </div>
                            </div>
                            {/* Selection Data */}
                            <div className="selection-container selection-data-container">
                                { selected && (
                                    <>
                                        <h1 className="selected-text">{ selected.name }</h1>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="bottom-ui-panel right-panel" onContextMenu={(e) => { e.stopPropagation() }}>
                        </div>
                    </div>
                </Html>
            </Canvas>
        </div>
    );
}

export default GameRoom