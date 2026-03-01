import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations, Html } from '@react-three/drei';
import BottomUIBar from '../../components/ui/bottom-ui-bar/BottomUIBar';
import * as THREE from 'three';

import './GameRoom.css';

useGLTF.preload('/assets/models/NodeBase.glb');

function NodeBaseModel({type, rotation}) {
    const groupRef = useRef();
    const { scene, animations } = useGLTF('/assets/models/NodeBase.glb');
    const { actions } = useAnimations(animations, groupRef);

    useEffect(()=>{
        actions['idle']?.play();
    }, [actions])

    return (
        <group ref={groupRef} rotation={[0, rotation, 0]}>
            <primitive object={scene} scale={0.5} />
            {/* Perfect for UI elements that can be seen all the time */}
            {/* For Forehead symbols we want to useTexture and import the already existing svg */}
            {/* TODO: add assets/symbols/[symbol].svg */}
            <Html position={[0, 2, 0]} center>
                <svg width={30} height={30} viewBox="0 0 24 24">
                    {symbolByType(type)}
                </svg>
            </Html>
        </group>
    );
}

const colorByType = (type) => {
    switch(type){
        case "gather":
            return "limegreen";
        case "builder":
        case "build":
            return "gold";
        case "scanner":
        case "scan":
            return "rgb(128,128,210)"
        case "hacker":
        case "hack":
            return "cyan";
        case "combat":
        case "attack":
            return "rgb(255,0,0)"
    }
}

const gatherSymbol = (color) => <>
                <path
                d="M12,12 m0,-1 a1,1 0 1,1 -2,0 a2,2 0 1,1 4,0 a3,3 0 1,1 -6,0 a4,4 0 1,1 8,0 a5,5 0 1,1 -10,0 a5,5 0 0,1 5.5,-5.5"
                stroke={color}
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
                />
            </>

const buildSymbol = (color) => <>
                <path
                    d="M10,19 Q11,21 15,21 Q17,21 18,19.5
                        
                        L19.5,15 Q20,13.5 19,13 Q18,12.5 17.5,14 L17,15.5

                        M17,15.5 L17,8 Q17,7 16,7 Q15,7 15,8 L15,13

                        M15,13 L15,7 Q15,6 14,6 Q13,6 13,7 L13,13

                        M13,13 L13,8 Q13,7 12,7 Q11,7 11,8 L11,13

                        M11,13 L11,11 Q11,10 10,10 Q9,10 9,12 L9,12 Q10,19 10,19"
                    stroke={color}
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </>

const scanSymbol = (color) => <>
                {/* Pupil */}
                <circle cx="12" cy="12" r="3" fill={color} />
                {/* Top arc */}
                <path
                d="M4,12 Q12,4 20,12"
                stroke={color}
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
                />
                {/* Bottom arc */}
                <path
                d="M4,12 Q12,20 20,12"
                stroke={color}
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
                />
            </>

const hackSymbol = (color) => <>
                {/* Hand */}
                <path
                d="M10,19 Q11,21 15,21 Q17,21 18,19.5
                    L19.5,15 Q20,13.5 19,13 Q18,12.5 17.5,14 L17,15.5
                    M17,15.5 L17,8 Q17,7 16,7 Q15,7 15,8 L15,13
                    M15,13 L15,7 Q15,6 14,6 Q13,6 13,7 L13,13
                    M13,13 L13,8 Q13,7 12,7 Q11,7 11,8 L11,13
                    M11,13 L11,11 Q11,10 10,10 Q9,10 9,12 L9,12 Q10,19 10,19"
                stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"
                />
                {/* Eye in palm */}
                <circle cx="14" cy="16" r="1.5" fill={color} />
                <path d="M10,16 Q14,12 18,16" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d="M10,16 Q14,20 18,16" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round" />
            </>

const attackSymbol = (color) => <>
                {/* Concentric circles */}
                <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.2" fill="none" />
                <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.2" fill="none" />
                <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.2" fill="none" />
                <circle cx="12" cy="12" r="1.5" fill={color} />

                {/* Cross lines */}
                <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
                <line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            </>

const symbolByType = (type) => {
    switch(type){
        case "gather":
            return gatherSymbol(colorByType(type));
        case "builder":
        case "build":
            return buildSymbol(colorByType(type));
        case "scanner":
        case "scan":
            return scanSymbol(colorByType(type));
        case "hacker":
        case "hack":
            return hackSymbol(colorByType(type));
        case "combat":
        case "attack":
            return attackSymbol(colorByType(type));
    }
}

const steelIcon = (<div className="steel-icon" />)

const grapheneIcon = (
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
)

const NodeIcon = ({ size = 24, type }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <clipPath id="topHalf">
      <rect x="0" y="-2" width="24" height="14" />
    </clipPath>
    {/* Head */}
    <circle cx="12" cy="10" r="10" stroke={colorByType(type)} strokeWidth={1.5} fill="none" clipPath="url(#topHalf)" />
    {/* Forehead symbol */}
    <g transform="translate(6, 2) scale(0.5)">
        {symbolByType(type)}
    </g>
    {/* Eyes */}
    <circle cx="8" cy="18" r="2" fill={colorByType(type)} />
    <circle cx="16" cy="18" r="2" fill={colorByType(type)} />
    {/* Face */}
    <path
        d="M2,12 L4,21 L8,26 L12,27 L16,26 L20,21 L22,12"
        stroke={colorByType(type)}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
  </svg>
);

const GatherIcon = ({ size = 24, type }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {symbolByType(type)}
  </svg>
);

const ScanIcon = ({ size = 24, type }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {symbolByType(type)}
  </svg>
);

const BuildIcon = ({ size = 24, type }) => (
  <svg width={size} height={size} viewBox="2 2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {symbolByType(type)}
  </svg>
);

const AttackIcon = ({ size = 24, type }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {symbolByType(type)}
  </svg>
);

const HackIcon = ({ size = 24, type }) => (
  <svg width={size} height={size} viewBox="2 2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {symbolByType(type)}
  </svg>
);

// TODO: Assign each action its own icon
const actionIconsMap = {
    'assemble-gather-node': <NodeIcon color="#00FF00" size={50} type="gather"/>,
    'assemble-builder-node': <NodeIcon color="#00FF00" size={50} type="builder"/>,
    'assemble-scanner-node': <NodeIcon color="#00FF00" size={50} type="scanner"/>,
    'assemble-combat-node': <NodeIcon color="#00FF00" size={50} type="combat"/>,
    'assemble-hacker-node': <NodeIcon color="#00FF00" size={50} type="hacker"/>,
    'refine-iron': steelIcon,
    'refine-carbon': grapheneIcon,
    'gather': <GatherIcon color="limegreen" type="gather" size={70} />,
    'build': <BuildIcon color="gold" type="build" size={70} />,
    'scan': <ScanIcon type="scan" size={70} />,
    'hack': <HackIcon color="cyan" type="hack" size={70} />,
    'attack': <AttackIcon color="#FF0000" type="attack" size={50} />,
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
    const rotationRef = useRef(0);

    useFrame((state, delta) => {
        if(!unitRef.current) return;
        if (lastPos.current[0] === position[0] && lastPos.current[1] === position[2]) return;

        const dx = position[0] - lastPos.current[0];
        const dz = position[2] - lastPos.current[1];
        rotationRef.current = Math.atan2(dx, dz);
        
        const smoothTime = 0.1; // seconds to smooth movement
        unitRef.current.position.x += (position[0] - unitRef.current.position.x) * (delta / smoothTime);
        unitRef.current.position.z += (position[2] - unitRef.current.position.z) * (delta / smoothTime);

        lastPos.current = [position[0], position[2]];
    });

    return (
        <group
            ref={unitRef}
            position={[position[0], 0, position[2]]}
            onClick={() => selectUnit(unit.id)}
        >
            <NodeBaseModel type="gather" rotation={rotationRef.current}/>
        </group>
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
            setResources(data.players[0]?.resources);
            setStartingTime(data.startingTime);
            startingTimeRef.current = data.startingTime;
            setGameRoom(data.room);
            setMapResources(data.resources);
            setSight(data.players[0]?.sight);
            setDiscovered(data.players[0]?.discovered);
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
            setResources(startingGameData.players[0]?.resources);
            setStartingTime(startingGameData.startingTime);
            startingTimeRef.current = startingGameData.startingTime;
            setGameRoom(startingGameData.room);
            setMapResources(startingGameData.resources);
            setSight(startingGameData.players[0]?.sight);
            setDiscovered(startingGameData.players[0]?.discovered);
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

    // max X and max Z are always 9 in a 10 x 10 board
    const maxX = 9;
    const maxZ = 9;
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
                                {steelIcon}
                            </div>
                            <h1>{Number(resources.steel.toFixed(1))}</h1>
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
                                {grapheneIcon}
                            </div>
                            <h1>{Number(resources.graphene.toFixed(1))}</h1>
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
                <directionalLight position={[5, 10, 5]} intensity={2} />

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