import React, {useRef, useEffect} from 'react';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const ElectricityGraph = ({ data }) => {
    const width = 300;
    const height = 100;
    const maxTime = data[data.length - 1]?.time || 1;
    const minTime = data[0]?.time || 0;
    const timeRange = maxTime - minTime || 1;

    const points = data.map(d => ({
        x: ((d.time - minTime) / timeRange) * width,
        y: height - (d.value / 100) * height,
    }));

    const d = points.reduce((acc, point, i) => {
        if (i === 0) return `M ${point.x},${point.y}`;
        const prev = points[i - 1];
        const cpx = (prev.x + point.x) / 2;
        return `${acc} C ${cpx},${prev.y} ${cpx},${point.y} ${point.x},${point.y}`;
    }, '');

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <path d={d} fill="none" stroke="rgb(0,255,0)" strokeWidth={1.5} />
        </svg>
    )
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

    if(selected.model !== 'gather-node' && selected.model !== 'iron-deposit' && selected.model !== 'carbon-deposit'){
        // nudge the center slightly
        center.y += sizeVec.y * -0.10;
    }

    // Fit distance based on FOV
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fov = camera.fov * (Math.PI / 180);
    let distance = maxDim / (2 * Math.tan(fov / 2));

    distance *= 3; // padding factor

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
        case 'refinery':
            return (
                <mesh ref={previewRef}>
                    <coneGeometry args={[0.5, 1, 4]} />
                    <meshStandardMaterial color="yellow" />
                </mesh>
            )
        case 'iron-deposit':
            return (
                <mesh ref={previewRef}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="yellow" />
                </mesh>
            )
        case 'carbon-deposit':
            return (
                <mesh ref={previewRef}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="yellow" />
                </mesh>
            )
        default:
            return (<></>)
    }
}

const BottomUIBar = React.memo(({
    mainControlsRef,
    selected,
    previewRef,
    currentActions,
    commsTabs,
    setCommsTabs,
    logs,
    commsInput,
    setCommsInput,
    actionIconsMap,
    startAction,
    graphData,
    commsMainRef,
}) => {
    return (
        <Html wrapperClass="bottom-ui-bar" style={{ pointerEvents: 'auto' }}>
            <div
                className="inner-wrapper"
                onPointerEnter={() => (mainControlsRef.current.enabled = false)}
                onPointerLeave={() => (mainControlsRef.current.enabled = true)}
            >
                {/* Left Panel */}
                <div className="bottom-ui-panel left-panel" onContextMenu={(e) => e.stopPropagation()}>
                    <div className="actions-container">
                        {selected?.actions?.length > 0 &&
                            selected.actions.map((action, index) => (
                                <div
                                    key={action.type}
                                    className="action-container"
                                    onClick={() => startAction(action.type)}
                                >
                                    <div className="action-bound-key">
                                        {index === 0 && <p>Q</p>}
                                        {index === 1 && <p>W</p>}
                                        {index === 2 && <p>E</p>}
                                        {index === 3 && <p>R</p>}
                                        {index === 4 && <p>T</p>}
                                    </div>
                                    <div className="action-icon">{actionIconsMap[action.type]}</div>
                                    <div className="action-title">
                                        <h1>{action.title}</h1>
                                    </div>
                                </div>
                            ))}
                    </div>
                    <div className="actions-progress-container">
                        {currentActions?.length > 0 &&
                            currentActions.map((action) => (
                                <div key={action.actionId} className="action-progress">
                                    <div className="action-icon">{actionIconsMap[action.actionType]}</div>
                                    <span className="action-percentage">
                                        {Math.round(action.progress * 100)}%
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Center Panel */}
                <div className="bottom-ui-panel center-panel" onContextMenu={(e) => e.stopPropagation()}>
                    <div className="selection-container selection-viewport-container">
                        <div
                            className="selection-viewport"
                            onPointerEnter={() => (mainControlsRef.current.enabled = false)}
                            onPointerLeave={() => (mainControlsRef.current.enabled = true)}
                        >
                            <Canvas>
                                {selected && (
                                    <>
                                        <ViewportCamera targetRef={previewRef} selected={selected} />
                                        <ambientLight intensity={1} />
                                        <directionalLight position={[5, 5, 5]} />
                                        <ModelMapper previewRef={previewRef} model={selected.model} />
                                    </>
                                )}
                            </Canvas>
                        </div>
                    </div>
                    <div className="selection-container selection-data-container">
                        {selected && (
                            <>
                                <h1 className="selected-text">{selected.name}</h1>
                                {selected.integrity && selected.material && (
                                    <>
                                        <h2 className="selected-text-property">Integrity: {selected.integrity}</h2>
                                        <h2 className="selected-text-property">
                                            Material: {selected.material[0].toUpperCase() + selected.material.slice(1)}
                                        </h2>
                                    </>
                                )}
                                {selected.yield && (
                                    <h2 className="selected-text-property">
                                        Yield: {Number(selected.yield.toFixed(1))}
                                    </h2>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right Panel */}
                <div className="bottom-ui-panel right-panel" onContextMenu={(e) => e.stopPropagation()}>
                    <div className="right-panel-communications right-panel-side">
                        <div className="communications-tabs">
                            <div
                                className={`comms-tab ${commsTabs.logs ? 'comms-tab-selected' : ''}`}
                                onClick={() => setCommsTabs({ logs: true, console: false, signals: false })}
                            >
                                <h1>Logs</h1>
                            </div>
                            <div
                                className={`comms-tab ${commsTabs.console ? 'comms-tab-selected' : ''}`}
                                onClick={() => setCommsTabs({ logs: false, console: true, signals: false })}
                            >
                                <h1>Console</h1>
                            </div>
                            <div
                                className={`comms-tab ${commsTabs.signals ? 'comms-tab-selected' : ''}`}
                                onClick={() => setCommsTabs({ logs: false, console: false, signals: true })}
                            >
                                <h1>Signals</h1>
                            </div>
                        </div>
                        <div className="communications-main" ref={commsMainRef}>
                            {commsTabs.logs &&
                                logs?.map((log, i) => (
                                    <div key={i} className="communications-main-entry">
                                        <p>{log}</p>
                                    </div>
                                ))}
                        </div>
                        <div className="communications-prompt">
                            <input
                                className="communications-prompt-input"
                                spellCheck={false}
                                value={commsInput}
                                onChange={(e) => setCommsInput(e.target.value)}
                            />
                            <button className="communications-prompt-enter-button">Enter</button>
                        </div>
                    </div>
                    <div className="right-panel-electricity-graph right-panel-side">
                        <div className="electricity-graph-title">
                            <h1>Electricity Graph</h1>
                        </div>
                        <div className="electricity-graph">
                            <ElectricityGraph data={graphData} />
                        </div>
                    </div>
                </div>
            </div>
        </Html>
    );
});

export default BottomUIBar;