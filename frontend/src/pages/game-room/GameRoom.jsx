import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import BottomUIBar from '../../components/ui/bottom-ui-bar/BottomUIBar';
import * as THREE from 'three';

import './GameRoom.css';

const GatherNodeIcon = ({ color = '#00FF00', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} fill="none" />
  </svg>
);
// TODO: Assign each action its own icon
const actionIconsMap = {
    'assemble-gather-node': <GatherNodeIcon color="#00FF00" size={50} />,
    'assemble-builder-node': <GatherNodeIcon color="#00FF00" size={50} />,
    'assemble-scanner-node': <GatherNodeIcon color="#00FF00" size={50} />,
    'assemble-combat-node': <GatherNodeIcon color="#00FF00" size={50} />,
    'assemble-hacker-node': <GatherNodeIcon color="#00FF00" size={50} />,
    'refine-iron': <GatherNodeIcon color="#00FF00" size={50} />,
    'refine-carbon': <GatherNodeIcon color="#00FF00" size={50} />,
    'gather': <GatherNodeIcon color="#00FF00" size={50} />,
    'build': <GatherNodeIcon color="#00FF00" size={50} />,
    'scan': <GatherNodeIcon color="#00FF00" size={50} />,
    'hack': <GatherNodeIcon color="#00FF00" size={50} />,
    'attack': <GatherNodeIcon color="#00FF00" size={50} />,
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

function Tile({position, tile, moveToTile}){

    const tileRef = useRef();

    // useFrame((state, delta) => {
    //     tileRef.current.scale.x += 0.01;
    // })

    return (
        <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Outline */}
            <mesh 
                renderOrder={0}
                onClick={(event) => { console.log('tile.id: ', tile.id) }}
                onContextMenu={(event) => { moveToTile(tile.id) }}
            >
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

const SelectionRing = React.memo(function SelectionRing({position}){

    const selectionRingRef = useRef();

    return (
        <mesh
            ref={selectionRingRef}
            position={[position[0], 0.05, position[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
        >   
            <ringGeometry args={[0.6, 0.7, 32]} />
            <meshBasicMaterial color="yellow" /> 
        </mesh>
    )
});

const Unit = React.memo(function Unit({position, unit, selectUnit}){
    const unitRef = useRef();
    const lastPos = useRef([position[0], position[2]]);

    useFrame((state, delta) => {
        if(!unitRef.current) return;
        if (lastPos.current[0] === position[0] && lastPos.current[1] === position[2]) return;
        
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
});

const Building = React.memo(function Building({position, building, selectBuilding}){
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
});

const MapResource = React.memo(function MapResource({position, mapResource, selectMapResource}){
    const mapResourceRef = useRef();

    return (
        <mesh 
            ref={mapResourceRef}
            position={[position[0], 0.4, position[2]]}
            rotation={[0, 0, 0]}
            scale={1}
            onClick={(event)=>{ selectMapResource(mapResource.id) }} // left click selects the mapResource
        >
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color="yellow" />
        </mesh>
    )
});

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
    const startingTimeRef = useRef(null);
    const commsMainRef = useRef(null);

    const [board, setBoard] = useState([]);
    const [units, setUnits] = useState([]);
    const [buildings, setBuildings] = useState([]);
    const [mapResources, setMapResources] = useState([]);
    const [resources, setResources] = useState(null);
    const [startingTime, setStartingTime] = useState(null);
    const [gameRoom, setGameRoom] = useState('');
    const [sight, setSight] = useState([]);
    const [discovered, setDiscovered] = useState([]);
    const [selected, setSelected] = useState(null);

    const [currentActions, setCurrentActions] = useState([]);
    const [commsTabs, setCommsTabs] = useState({
        logs: true,
        console: false,
        signals: false,
    });

    const [commsInput, setCommsInput] = useState('');
    const [logs, setLogs] = useState([]);
    const [commands, setCommands] = useState([]);
    const [signals, setSignals] = useState([]);

    const [graphData, setGraphData] = useState([]);

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

    const selectMapResource = (mapResourceId) => {
        const mapResource = mapResources.find(b => b.id === mapResourceId);

        if(mapResource){
            console.log('mapResource: ', mapResource)
            setSelected(mapResource);
        }
    }

    const moveToTile = (tileId) => {
        if(!selected){
            console.log('Nothing is selected!');
            return;
        }
        socket.emit('movement', { tileId, unitId: selected.id, room: gameRoom })
    }

    const playerDisconnect = (socket) => {
        socket.emit('player-disconnect');
        setTimeout(()=>{
            navigate('/');
        }, 1000)
    }

    const startAction = (actionType) => {
        socket.emit('start-action', { actionType, room: gameRoom, selected: selected })
    }

    useEffect(() => {
        const storedSocketId = localStorage.getItem('dom-player-socket');
        const storedRoom = localStorage.getItem('dom-game-room');

        // If we have stored credentials, attempt reconnect
        if (storedSocketId && storedRoom) {
                console.log('Reconnecting with:', storedSocketId, storedRoom);
                socket.emit('player-reconnect', {
                    originalSocketId: storedSocketId !== socket.id ? storedSocketId : socket.id,
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
            startingTimeRef.current = data.startingTime;
            setGameRoom(data.room);
            setMapResources(data.resources);
            setSight(data.players.filter(p => p.socketId === socket.id)[0]?.sight);
            setDiscovered(data.players.filter(p => p.socketId === socket.id)[0]?.discovered);
        })

        // Handles player-update
        socket.on('player-update', (data) => {
            setResources(data.playerData.resources);
            setGraphData(prev => [...prev, {
                time: Date.now() - startingTimeRef.current,
                value: data.playerData.resources.electricity
            }]);
        })

        socket.on('resources-update', (data) => {
            setMapResources(data.map(resource => ({ ...resource })));
            setSelected(previous => {
                if (!previous) return previous;

                const resource = data.find(resource => resource.id === previous.id);
                if (!resource) return previous;

                return { 
                    ...previous, 
                    yield: resource.yield 
                };
            });
        });

        // Handles movement
        socket.on('movement-update', (data) => {
            setUnits(prev => prev.map(u => 
                u.id === data.unitId ? { ...u, x: data.x, z: data.z } : u
            ));
        });

        socket.on('movement-forbidden', (data) => {
            console.log('movement-forbidden: ', data.msg);
        });

        socket.on('sight-discovery-update', (data)=>{
            setSight(data.sight);
            setDiscovered(data.discovered);
        });

        socket.on('action-progress-update', (data) => {
            setCurrentActions(prev => {
                // remove completed
                if (data.progress >= 0.995) {
                    return prev.filter(a => a.actionId !== data.actionId);
                }

                const index = prev.findIndex(a => a.actionId === data.actionId);

                // insert new
                if (index === -1) {
                return [...prev, data];
                }

                // update existing
                const next = [...prev];
                next[index] = { ...next[index], progress: data.progress };

                return next;
            });
        });

        socket.on('player-units-update', (data)=>{
            setUnits(data.units);
        });

        socket.on('logs-update', (data)=>{
            // we timestamp it here
            const elapsed = Date.now() - startingTimeRef.current;
            const totalSeconds = Math.floor(elapsed / 1000);
            const displaySeconds = totalSeconds % 60;
            const totalMinutes = Math.floor(totalSeconds / 60);
            const displayMinutes = totalMinutes % 60;
            const displayHours = Math.floor(totalMinutes / 60);

            setLogs(prev => [...prev, `[${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}] ${data.log}`]);
        })

        socket.on('game-disconnect', () => {
            setTimeout(()=>{
                navigate('/');
            }, 1000)
        })

        // TODO: The filtering MUST be done by the backend
        // The frontend ONLY receives THAT player's data. Not others.
        if (startingGameData) {
            setBoard(startingGameData.board);
            setUnits(startingGameData.units.filter(u => u.player === socket.id));
            setBuildings(startingGameData.buildings.filter(b => b.player === socket.id));
            setResources(startingGameData.players.filter(p => p.socketId === socket.id)[0]?.resources);
            setStartingTime(startingGameData.startingTime);
            startingTimeRef.current = startingGameData.startingTime;
            setGameRoom(startingGameData.room);
            setMapResources(startingGameData.resources);
            setSight(startingGameData.players.filter(p => p.socketId === socket.id)[0]?.sight);
            setDiscovered(startingGameData.players.filter(p => p.socketId === socket.id)[0]?.discovered);
        }

        return () => {
            socket.off('starting-game-data');
            socket.off('player-update');
            socket.off('game-disconnect');
            socket.off('movement-update');
            socket.off('movement-forbidden');
            socket.off('sight-discovery-update');
        }
    }, []);

    const KEYBINDS = ["q", "w", "e", "r", "t"];

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selected?.actions?.length) return;

            const active = document.activeElement;
            if(active && ["INPUT", "TEXTAREA"].includes(active.tagName)) return;

            const key = e.key.toLowerCase();
            const index = KEYBINDS.indexOf(key);

            if (index === -1) return;
            if (!selected.actions[index]) return;

            startAction(selected.actions[index].type);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selected, startAction]);

    useEffect(() => {
        if (!commsMainRef.current) return;
        commsMainRef.current.scrollTop = commsMainRef.current.scrollHeight;
    }, [logs]);

    // think of this as a diagonal cutting from center of the first tile
    // towards the center of the last tile
    const maxX = Math.max(...board.map(t => t.x));
    const maxZ = Math.max(...board.map(t => t.z));
    const offsetX = maxX / 2;
    const offsetZ = maxZ / 2;

    const visibleTiles = useMemo(() => board.filter(tile => discovered?.includes(tile.id)), [board, discovered]);
    const tilePositions = useMemo(() => visibleTiles.map(t => [t.x - offsetX, 0, t.z - offsetZ]), [visibleTiles, offsetX, offsetZ]);

    const visibleUnits = useMemo(() => units.filter(u => sight?.includes(u.position)), [units, sight]);
    const unitPositions = useMemo(() => visibleUnits.map(u => [u.x - offsetX, 0, u.z - offsetZ]), [visibleUnits, offsetX, offsetZ]);

    const visibleBuildings = useMemo(() => buildings.filter(b => sight?.includes(b.position)), [buildings, sight]);
    const buildingPositions = useMemo(() => visibleBuildings.map(b => [b.x - offsetX, 0, b.z - offsetZ]), [visibleBuildings, offsetX, offsetZ]);

    const visibleResources = useMemo(() => mapResources.filter(mr => sight?.includes(mr.position)), [mapResources, sight]);
    const resourcePositions = useMemo(() => visibleResources.map(r => [r.x - offsetX, 0, r.z - offsetZ]), [visibleResources, offsetX, offsetZ]);

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
                            <h1>{Number(resources.iron.toFixed(1))}</h1>
                        </div>
                        <div className="resource-field">
                            <div className="icon">
                                <div className="steel-icon" />
                            </div>
                            <h1>{resources.steel}</h1>
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
                            <h1>{Number(resources.carbon.toFixed(1))}</h1>
                        </div>
                        <div className="resource-field">
                            <div className="icon">
                                <svg className="graphene-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <g transform="scale(1.50) translate(-3, -3)">
                                        {/* center */}
                                        <polygon points="11.73,9 11.73,11 10,12 8.27,11 8.27,9 10,8" fill="none"/>
                                        {/* right */}
                                        <polygon points="15.2,9 15.2,11 13.46,12 11.73,11 11.73,9 13.46,8" fill="none"/>
                                        {/* top-right */}
                                        <polygon points="13.46,6 13.46,8 11.73,9 10,8 10,6 11.73,5" fill="none"/>
                                        {/* top-left */}
                                        <polygon points="10,6 10,8 8.27,9 6.54,8 6.54,6 8.27,5" fill="none"/>
                                        {/* left */}
                                        <polygon points="8.27,9 8.27,11 6.54,12 4.8,11 4.8,9 6.54,8" fill="none"/>
                                        {/* bottom-left */}
                                        <polygon points="10,12 10,14 8.27,15 6.54,14 6.54,12 8.27,11" fill="none"/>
                                        {/* bottom-right */}
                                        <polygon points="13.46,12 13.46,14 11.73,15 10,14 10,12 11.73,11" fill="none"/>
                                    </g>
                                </svg>
                            </div>
                            <h1>{resources.graphene}</h1>
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
                { visibleTiles.map((tile, i) => (
                    <Tile key={tile.id} position={tilePositions[i]} tile={tile} moveToTile={moveToTile} />
                ))}

                {/* Units */}
                { visibleUnits.map((unit, i) => (
                    <>
                        <Unit key={unit.id} position={unitPositions[i]} unit={unit} selectUnit={selectUnit}/>
                        { selected && selected.id === unit.id && (<SelectionRing position={unitPositions[i]} />)}
                    </>
                ))}

                {/* Buildings */}
                { visibleBuildings.map((building, i) => (
                    <>
                        <Building key={building.id} position={buildingPositions[i]} building={building} selectBuilding={selectBuilding}/>
                        { selected && selected.id === building.id && (<SelectionRing position={buildingPositions[i]} />)}
                    </>
                ))}

                {/* Map Resources */}
                { visibleResources.map((mapResource, i) => (
                    <>
                        <MapResource key={mapResource.id} position={resourcePositions[i]} mapResource={mapResource} selectMapResource={selectMapResource}/>
                        { selected && selected.id === mapResource.id && (<SelectionRing position={resourcePositions[i]} />)}
                    </>
                ))}

                <BottomUIBar
                    mainControlsRef={mainControlsRef}
                    selected={selected}
                    previewRef={previewRef}
                    currentActions={currentActions}
                    commsTabs={commsTabs}
                    setCommsTabs={setCommsTabs}
                    logs={logs}
                    commsInput={commsInput}
                    setCommsInput={setCommsInput}
                    actionIconsMap={actionIconsMap}
                    startAction={startAction}
                    graphData={graphData}
                    commsMainRef={commsMainRef}
                />
            </Canvas>
        </div>
    );
}

export default GameRoom