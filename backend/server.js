const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        // Multiplayer Dev Mode
        // origin: "http://localhost:5173"
        origin: '*',
    }
});

let games = new Map();
let gamesByRoom = new Map();
let gamesByStarted = new Map();
let intervals = new Map();
let sockets = new Map();
const boardTemplate = new Map(Array.from({length: 100}, (_, i) => [i, { 
    id: i,
    x: i % 10,
    z: Math.floor(i / 10),
    resource: null,
    unit: null,
    building: null,
}]));

// const actionsMap = {
//     'assemble-gather-node': { duration: 8000, cost: [{ resource: 'electricity', amount: 10 }, { resource: 'iron', amount: 10 }] },
//     'assemble-builder-node': { duration: 8000, cost: [{ resource: 'electricity', amount: 10 }, { resource: 'iron', amount: 10 }] },
//     'assemble-scanner-node': { duration: 8000, cost: [{ resource: 'electricity', amount: 20 }, { resource: 'iron', amount: 20 }] },
//     'assemble-combat-node': { duration: 18000, cost: [{ resource: 'electricity', amount: 50 }, { resource: 'steel', amount: 50 }, { resource: 'graphene', amount: 20 }] },
//     'assemble-hacker-node': { duration: 12000, cost: [{ resource: 'electricity', amount: 70 }, { resource: 'steel', amount: 30 }, { resource: 'graphene', amount: 20 }] },
//     'refine-iron': { duration: 6000, cost: [{ resource: 'electricity', amount: 30 }, { resource: 'iron', amount: 10 }, { resource: 'carbon', amount: 10 }], yield: { resource: 'steel', amount: 10 } },
//     'refine-carbon': { duration: 6000, cost: [{ resource: 'electricity', amount: 30 }, { resource: 'carbon', amount: 30 }], yield: { resource: 'graphene', amount: 10 } },
//     'gather': { duration: 2000, cost: [{ resource: 'electricity', amount: 10 }] },
//     'build': { duration: 10000, cost: [{ resource: 'electricity', amount: 30 }] },
//     'scan': { duration: 5000, cost: [{ resource: 'electricity', amount: 20 }] },
//     'hack': { duration: 10000, cost: [{ resource: 'electricity', amount: 50 }] },
//     'attack': { duration: 1000, cost: [{ resource: 'electricity', amount: 10 }] },
// }
// DEV Actions Map
const actionsMap = {
    'assemble-gather-node': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }] },
    'assemble-builder-node': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }] },
    'assemble-scanner-node': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }] },
    'assemble-combat-node': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'steel', amount: 1 }, { resource: 'graphene', amount: 1 }] },
    'assemble-hacker-node': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'steel', amount: 1 }, { resource: 'graphene', amount: 1 }] },
    'build-assembly-plant': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }] },
    'build-refinery': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }] },
    'build-generator': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }] },
    'refine-iron': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'iron', amount: 1 }, { resource: 'carbon', amount: 1 }], yield: { resource: 'steel', amount: 1 } },
    'refine-carbon': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }, { resource: 'carbon', amount: 1 }], yield: { resource: 'graphene', amount: 1 } },
    'gather': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }] },
    'build': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }] },
    'scan': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }] },
    'hack': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }] },
    'attack': { duration: 2000, cost: [{ resource: 'electricity', amount: 1 }] },
}

const unitActionsMap = [
    { type: 'gather', title: 'Gather', duration: actionsMap['gather'] },
    { type: 'build', title: 'Build', duration: actionsMap['build'] },
    { type: 'build-assembly-plant', title: 'Assembly Plant', duration: actionsMap['build-assembly-plant'] },
    { type: 'build-generator', title: 'Generator', duration: actionsMap['build-generator'] },
    { type: 'build-refinery', title: 'Refinery', duration: actionsMap['build-refinery'] },
    { type: 'scan', title: 'Scan', duration: actionsMap['scan'] },
    { type: 'hack', title: 'Hack', duration: actionsMap['hack'] },
    { type: 'attack', title: 'Attack', duration: actionsMap['attack'] },
]

const unitsMap = {
    'gather-node': {
        mobile: true,
        isMoving: false,
        name: 'Gather Node',
        type: 'gather',
        speed: 3,
        integrity: 100,
        material: 'iron',
        actions: [...unitActionsMap],
    },
    'builder-node':{
        mobile: true,
        isMoving: false,
        name: 'Builder Node',
        type: 'builder',
        speed: 3,
        integrity: 100,
        material: 'iron',
        actions: [...unitActionsMap],
    },
    'scanner-node':{
        mobile: true,
        isMoving: false,
        name: 'Scanner Node',
        type: 'scanner',
        speed: 3,
        integrity: 100,
        material: 'iron',
        actions: [...unitActionsMap],
    },
    'combat-node':{
        mobile: true,
        isMoving: false,
        name: 'Combat Node',
        type: 'combat',
        speed: 3,
        integrity: 100,
        material: 'iron',
        actions: [...unitActionsMap],
    },
    'hacker-node':{
        mobile: true,
        isMoving: false,
        name: 'Hacker Node',
        type: 'hacker',
        speed: 3,
        integrity: 100,
        material: 'iron',
        actions: [...unitActionsMap],
    }
}

const buildingsMap = {
    'assembly-plant':{
        mobile: false,
        name: 'Assembly Plant',
        type: 'assembly-plant',
        sight: new Set(),
        integrity: 100,
        material: 'iron',
        actions: [
            { type: 'assemble-gather-node', title: 'Gather Node', duration: actionsMap['assemble-gather-node'] },
            { type: 'assemble-builder-node', title: 'Builder Node', duration: actionsMap['assemble-builder-node'] },
            { type: 'assemble-scanner-node', title: 'Scanner Node', duration: actionsMap['assemble-scanner-node'] },
            { type: 'assemble-hacker-node', title: 'Hacker Node', duration: actionsMap['assemble-hacker-node'] },
            { type: 'assemble-combat-node', title: 'Combat Node', duration: actionsMap['assemble-combat-node'] },
        ],
    },
    'refinery':{
        mobile: false,
        name: 'Refinery',
        type: 'refinery',
        sight: new Set(),
        integrity: 100,
        material: 'iron',
        actions: [
            { type: 'refine-iron', title: 'Refine Iron', duration: actionsMap['refine-iron'] },
            { type: 'refine-carbon', title: 'Refine Carbon', duration: actionsMap['refine-carbon'] },
        ],
    },
    'generator':{
        mobile: false,
        name: 'Generator',
        type: 'generator',
        sight: new Set(),
        integrity: 100,
        material: 'iron',
        actions: [],
    }
}

const playerMap = {
    resources: {
        iron: 10,
        steel: 0,
        carbon: 0,
        graphene: 0,
        electricity: 100
    },
    sight: new Set(),
    discovered: new Set(),
}

const oppositeRound = x => Math.round(x) + (Math.round(x) > x ? -1 : (Math.round(x) < x ? 1 : 0));

const calculateSight = (x, z, boardWidth = 10, boardHeight = 10) => {
    const deltas = [
        [0, 0],   // self
        [1, 0],   // right
        [-1, 0],  // left
        [0, 1],   // top
        [0, -1],  // bottom
        [1, 1],   // top-right
        [-1, 1],  // top-left
        [1, -1],  // bottom-right
        [-1, -1]  // bottom-left
    ];

    const sightTileIds = [];

    for (const [dx, dz] of deltas) {
        const nx = x + dx;
        const nz = z + dz;

        if (nx < 0 || nx >= boardWidth || nz < 0 || nz >= boardHeight) continue;

        sightTileIds.push(nz * boardWidth + nx);
    }

    return sightTileIds;
};

const calculatePosition = (x, z, boardWidth = 10) => {
    if (x < 0 || x >= boardWidth || z < 0 || z >= boardWidth) return undefined;
    return z * boardWidth + x;
}

const drainElectricity = (gameId) => {
    const game = games.get(gameId);

    if(game){
        game.players.forEach((player, socketId) => {
            player.resources.electricity -= 0.1;

            if(player.thresholdState === undefined) player.thresholdState = null;

            let newThreshold = null;

            if(player.resources.electricity <= 10) newThreshold = 'fatal';
            else if(player.resources.electricity <= 25) newThreshold = 'critical';
            else if(player.resources.electricity <= 50) newThreshold = 'alert';

            // Only push a new action if the threshold just changed
            if(newThreshold !== player.thresholdState){
                player.thresholdState = newThreshold;

                if(newThreshold){
                    game.actions.push({
                        id: randomUUID(),
                        playerId: socketId,
                        type: `electricity-threshold-${newThreshold}`,
                        startingTime: Date.now(),
                        duration: 1,
                        drainsElectricity: false,
                    });
                }
            }

            // if player started the game and electricity equals zero, halt everything, disconnect the game
            if(player.startedGame && player.resources.electricity <= 0){
                // immediately delete all actions
                game.actions = []

                const playerSocket = sockets.get(socketId);
                if (playerSocket){
                    playerSocket.emit('game-disconnect');
                    gameDisconnect(playerSocket);
                } 
            }

            // check in the array of actions for actions belonging to THIS player
            player.resources.electricity -= game.actions.filter(action => action.playerId === socketId && action.drainsElectricity).length * 0.2;

            const playerSocket = sockets.get(socketId);
            if (playerSocket) playerSocket.emit('player-update', { playerData: player });
        })
    }
}

const generateElectricity = (gameId) => {
    const game = games.get(gameId);

    if(game){
        game.players.forEach((player, socketId) => {
            // get the generator IDs from buildingsByType Map
            const generatorIds = game.buildingsByType.get('generator') || new Set();

            // map IDs to building objects
            const playerGenerators = Array.from(generatorIds)
                .map(id => game.buildings.get(id))
                .filter(b => b && b.player === socketId);  // keep only this player's generators

            player.resources.electricity += playerGenerators.length * 0.4;

            const playerSocket = sockets.get(socketId);
            if (playerSocket) playerSocket.emit('player-update', { playerData: player });
        })
    }
}

const refineResource = (game, action) => {
    const player = game.players.get(action.playerId);
    const playerSocket = sockets.get(action.playerId);
    
    const progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

    action.costPaid.forEach(cost => {
        const targetPaid = cost.amount * progress;
        const delta = targetPaid - cost.amountPaid;
        if(delta > 0){
            if(player.resources[cost.resource] >= delta){
                player.resources[cost.resource] -= delta;
                cost.amountPaid += delta;
            }else{
                action.paused = true;
            }
        }
    });

    const tickProgress = progress - (action.lastProgress || 0);
    action.lastProgress = progress;

    const amount = Math.min(tickProgress * 1, actionsMap[action.type].yield.amount);
    player.resources[actionsMap[action.type].yield.resource] = (player.resources[actionsMap[action.type].yield.resource] || 0) + amount;

    if (playerSocket){
        playerSocket.emit('player-update', { playerData: player });
        playerSocket.emit('action-progress-update', { actionId: action.id, progress: progress, actionType: action.type });
    }
}

const buildBuilding = (game, action) => {
    const unit = game.units.get(action.unitId);
    if(!unit) return;

    player = game.players.get(unit.player);
    playerSocket = sockets.get(action.playerId);

    if(action.paused) {
        const canResume = action.costPaid.every(cost => {
            const targetPaid = cost.amount * ((Date.now() - action.startingTime) / action.duration);
            return player.resources[cost.resource] >= (targetPaid - cost.amountPaid);
        });
        if(canResume) action.paused = false;
        else {
            if(playerSocket) playerSocket.emit('logs-update', { log: `Action paused: insufficient resources.`, type: 'action-paused' });
            return;
        }
    }

    progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

    action.costPaid.forEach(cost => {
        const targetPaid = cost.amount * progress;
        const delta = targetPaid - cost.amountPaid;
        if(delta > 0){
            if(player.resources[cost.resource] >= delta){
                player.resources[cost.resource] -= delta;
                cost.amountPaid += delta;
            } else {
                action.paused = true;
            }
        }
    });

    if(progress >= 1){

        const buildingType = action.type.replace('build-', '');
        let building = null;

        switch(buildingType){
            case 'assembly-plant':
                building = {
                    ...buildingsMap['assembly-plant'],
                    id: randomUUID(),
                    hackId: randomUUID(),
                    player: action.playerId,
                    sight: calculateSight(unit.x, unit.z+1),
                    x: unit.x,
                    z: unit.z+1,
                    position: calculatePosition(unit.x, unit.z+1),
                };
                break;
            case 'generator':
                building = {
                    ...buildingsMap['generator'],
                    id: randomUUID(),
                    hackId: randomUUID(),
                    player: action.playerId,
                    sight: calculateSight(unit.x, unit.z+1),
                    x: unit.x,
                    z: unit.z+1,
                    position: calculatePosition(unit.x, unit.z+1),
                };
                break;
            case 'refinery':
                building = {
                    ...buildingsMap['refinery'],
                    id: randomUUID(),
                    hackId: randomUUID(),
                    player: action.playerId,
                    sight: calculateSight(unit.x, unit.z+1),
                    x: unit.x,
                    z: unit.z+1,
                    position: calculatePosition(unit.x, unit.z+1),
                };
                break;
        }

        game.buildings.set(building.id, building);

        if (!game.buildingsByPlayer.has(action.playerId)) {
            game.buildingsByPlayer.set(action.playerId, new Set());
        }

        game.buildingsByPlayer.get(action.playerId).add(building.id);
        game.buildingsByType.get(building.type).add(building.id);

        if(playerSocket){
            const playerBuildingIds = game.buildingsByPlayer.get(action.playerId) || new Set();
            const playerBuildings = Array.from(playerBuildingIds).map(id => game.buildings.get(id));
            playerSocket.emit('player-buildings-update', { 
                buildings: playerBuildings.map(b => ({ ...b, sight: [...b.sight] }))
            });
            playerSocket.emit('logs-update', { log: `${building.name} was built.` })
        } 
    }

    if(playerSocket) playerSocket.emit('action-progress-update', { actionId: action.id, progress: progress, actionType: action.type })
}

const resolveActions = (gameId) => {
    const game = games.get(gameId);

    if(game){
        let progress = null;
        let player = null;
        let playerSocket = null;
        let unit = null;
        let tickProgress = null;
        game.actions.forEach(action => {
            if(action.type.startsWith('assemble-')){
                const building = game.buildings.get(action.buildingId);
                if(!building) return;

                player = game.players.get(building.player);
                playerSocket = sockets.get(action.playerId);

                if(action.paused) {
                    // Try to unpause if resources are back
                    // TODO: Some actions get stuck when paused. Check this.
                    const canResume = action.costPaid.every(cost => {
                        const targetPaid = cost.amount * ((Date.now() - action.startingTime) / action.duration);
                        return player.resources[cost.resource] >= (targetPaid - cost.amountPaid);
                    });
                    if(canResume) action.paused = false;
                    else {
                        if(playerSocket) playerSocket.emit('logs-update', { log: `Action paused: insufficient resources.`, type: 'action-paused' });
                        return; // skip tick
                    }
                }

                progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

                // Deduct costs progressively
                action.costPaid.forEach(cost => {
                    const targetPaid = cost.amount * progress;
                    const delta = targetPaid - cost.amountPaid;
                    if(delta > 0){
                        if(player.resources[cost.resource] >= delta){
                            player.resources[cost.resource] -= delta;
                            cost.amountPaid += delta;
                        } else {
                            action.paused = true;
                        }
                    }
                });

                // Once we compute the progress, we perform the intended action
                if(progress >= 1){

                    const nodeType = action.type.replace('assemble-', '');
                    let node = null;

                    switch(nodeType){
                        case 'gather-node':
                            node = {
                                ...unitsMap['gather-node'],
                                id: randomUUID(),
                                hackId: randomUUID(),
                                player: action.playerId,
                                sight: calculateSight(building.x, building.z+1),
                                x: building.x,
                                z: building.z+1,
                                position: calculatePosition(building.x, building.z+1),
                            }
                            break;
                        case 'builder-node':
                            node = {
                                ...unitsMap['builder-node'],
                                id: randomUUID(),
                                hackId: randomUUID(),
                                player: action.playerId,
                                sight: calculateSight(building.x, building.z+1),
                                x: building.x,
                                z: building.z+1,
                                position: calculatePosition(building.x, building.z+1),
                            }
                            break;
                        case 'scanner-node':
                            node = {
                                ...unitsMap['scanner-node'],
                                id: randomUUID(),
                                hackId: randomUUID(),
                                player: action.playerId,
                                sight: calculateSight(building.x, building.z+1),
                                x: building.x,
                                z: building.z+1,
                                position: calculatePosition(building.x, building.z+1),
                            }
                            break;
                        case 'combat-node':
                            node = {
                                ...unitsMap['combat-node'],
                                id: randomUUID(),
                                hackId: randomUUID(),
                                player: action.playerId,
                                sight: calculateSight(building.x, building.z+1),
                                x: building.x,
                                z: building.z+1,
                                position: calculatePosition(building.x, building.z+1),
                            }
                            break;
                        case 'hacker-node':
                            node = {
                                ...unitsMap['hacker-node'],
                                id: randomUUID(),
                                hackId: randomUUID(),
                                player: action.playerId,
                                sight: calculateSight(building.x, building.z+1),
                                x: building.x,
                                z: building.z+1,
                                position: calculatePosition(building.x, building.z+1),
                            }
                            break;
                    }

                    game.units.set(node.id, node);

                    if (!game.unitsByPlayer.has(action.playerId)) {
                        game.unitsByPlayer.set(action.playerId, new Set());
                    }

                    game.unitsByPlayer.get(action.playerId).add(node.id);

                    if(playerSocket){
                        const playerUnitIds = game.unitsByPlayer.get(action.playerId) || new Set();
                        const playerUnits = Array.from(playerUnitIds).map(id => game.units.get(id));
                        playerSocket.emit('player-units-update', { 
                            units: playerUnits.map(u => ({ ...u, sight: [...u.sight] }))
                        });
                        playerSocket.emit('logs-update', { log: `${node.name} was deployed.` })
                    } 
                }

                if(playerSocket) playerSocket.emit('action-progress-update', { actionId: action.id, progress: progress, actionType: action.type })
            }else{
                switch(action.type){
                    case 'electricity-threshold-alert':
                        player = game.players.get(action.playerId);
                        playerSocket = sockets.get(action.playerId);
                        if(playerSocket) playerSocket.emit('logs-update', { log: '[ALERT] Electricity dropped below 50.' });
                        break;
                    case 'electricity-threshold-critical':
                        player = game.players.get(action.playerId);
                        playerSocket = sockets.get(action.playerId);
                        if(playerSocket) playerSocket.emit('logs-update', { log: '[CRITICAL] Electricity dropped below 25.' });
                        break;
                    case 'electricity-threshold-fatal':
                        player = game.players.get(action.playerId);
                        playerSocket = sockets.get(action.playerId);
                        if(playerSocket) playerSocket.emit('logs-update', { log: '[FATAL] Electricity dropped below 10.' });
                        break;
                    case 'movement':
                        unit = game.units.get(action.unitId);
                        if(!unit) break;

                        progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

                        unit.x = action.startX + (action.destinationX - action.startX) * progress;
                        unit.z = action.startZ + (action.destinationZ - action.startZ) * progress;
                        unit.isMoving = true;

                        const previousPosition = unit.position;
                        unit.position = calculatePosition(Math.round(unit.x), Math.round(unit.z));

                        if(previousPosition !== unit.position){
                            if(unit.position === undefined || unit.position === null) break;
                            const previousPositionTile = game.board.get(previousPosition);
                            if(previousPositionTile) previousPositionTile.unit = null;
                            const newPositionTile = game.board.get(unit.position);
                            if(newPositionTile) newPositionTile.unit = unit.id;
                        }

                        player = game.players.get(unit.player);

                        if(player){
                            if(progress >= 1){
                                const originTile = game.board.get(calculatePosition(action.startX, action.startZ));
                                if(originTile && originTile.unit === unit.id) originTile.unit = null;

                                const destPosition = calculatePosition(action.destinationX, action.destinationZ);
                                const destTile = game.board.get(destPosition);
                                if(destTile) destTile.unit = unit.id;

                                unit.position = destPosition;
                                unit.x = action.destinationX;
                                unit.z = action.destinationZ;
                                unit.isMoving = false;

                                unit.sight = new Set([
                                    ...calculateSight(Math.round(unit.x), Math.round(unit.z)),
                                    ...calculateSight(oppositeRound(unit.x), oppositeRound(unit.z)),
                                    destPosition,
                                ]);
                            } else {
                                unit.sight = new Set([
                                    ...calculateSight(Math.round(unit.x), Math.round(unit.z)),
                                    ...calculateSight(oppositeRound(unit.x), oppositeRound(unit.z))
                                ]);
                            }

                            const playerUnitIds = game.unitsByPlayer.get(unit.player) || new Set();
                            const playerUnits = Array.from(playerUnitIds)
                                .map(id => game.units.get(id))
                                .filter(Boolean);

                            const playerBuildingIds = game.buildingsByPlayer.get(unit.player) || new Set();
                            const playerBuildings = Array.from(playerBuildingIds)
                                .map(id => game.buildings.get(id))
                                .filter(Boolean);

                            player.sight = new Set([
                                ...playerUnits.flatMap(u => [...u.sight]),
                                ...playerBuildings.flatMap(b => [...b.sight]),
                            ]);

                            // once i have the player sight i can determine which units, buildings and resources are in his sight
                            // by checking the tiles
                            // then, we will send this data in the sight-discovery-update that already exists
                            // for now, do so with units and buildings so we can see other players units and buildings

                            const discoveredUnits = [];
                            const discoveredBuildings = [];
                            player.sight.forEach((tileId)=>{
                                const tile = game.board.get(tileId);
                                if(tile){
                                    // calculate units in sight
                                    if(tile.unit){
                                        const unit = game.units.get(tile.unit);
                                        discoveredUnits.push(unit);
                                    }
                                    // calculate buildings in sight
                                    if(tile.building){
                                        const building = game.buildings.get(tile.buildings);
                                        discoveredBuildings.push(building);
                                    }
                                }
                            })

                            player.discovered = new Set([...player.discovered, ...unit.sight]);

                            playerSocket = sockets.get(action.playerId);

                            if(playerSocket){
                                playerSocket.emit('sight-discovery-update', {
                                    sight: [...player.sight],
                                    discovered: [...player.discovered],
                                    discoveredUnits,
                                    discoveredBuildings,
                                })
                            }
                        }

                        io.to(game.room).emit('movement-update', { unitId: unit.id, x: unit.x, z: unit.z, sight: [...unit.sight], isMoving: unit.isMoving })
                        break;
                    case 'refine-iron':
                        refineResource(game, action);
                        break;
                    case 'refine-carbon':
                        refineResource(game, action);
                        break;
                    case 'build-assembly-plant':
                    case 'build-generator':
                    case 'build-refinery':
                        buildBuilding(game, action);
                        break;
                    case 'gather':
                        unit = game.units.get(action.unitId);
                        if (!unit) break;

                        player = game.players.get(unit.player);
                        playerSocket = sockets.get(action.playerId);

                        progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

                        // Deduct costs progressively
                        action.costPaid.forEach(cost => {
                            const targetPaid = cost.amount * progress;
                            const delta = targetPaid - cost.amountPaid;
                            if (delta > 0) {
                                if (player.resources[cost.resource] >= delta) {
                                    player.resources[cost.resource] -= delta;
                                    cost.amountPaid += delta;
                                } else {
                                    action.paused = true;
                                }
                            }
                        });

                        // Apply gathering progressively
                        tickProgress = progress - (action.lastProgress || 0);
                        action.lastProgress = progress;

                        unit.sight.forEach(tileId => {
                            const tile = game.board.get(tileId);
                            if (tile && tile.resource) {
                                const resource = game.resources.find(r => r.id === tile.resource);
                                if (resource && resource.yield > 0) {
                                    const modifier = 2; // later we can add other modifiers based on efficiency, for example.
                                    const amount = Math.min(tickProgress * modifier, resource.yield);
                                    resource.yield -= amount;
                                    player.resources[resource.resource] = (player.resources[resource.resource] || 0) + amount;
                                }
                            }
                        });

                        if (playerSocket){
                            playerSocket.emit('player-update', { playerData: player });
                            playerSocket.emit('action-progress-update', { actionId: action.id, progress: progress, actionType: action.type });
                        } 
                        io.to(game.room).emit('resources-update', game.resources);
                        break;
                }
            }
        });

        game.actions = game.actions.filter(action => (Date.now() - action.startingTime) < action.duration);
    }
}

const gameDisconnect = (socket) => {
    const game = gamesByStarted.get(socket.id);

    if(game){
        intervals.delete(game.id)
    }

    // Delete games this socket started
    for (const [gameId, game] of games.entries()) {
        if (game.startingSocketId === socket.id) {
            games.delete(gameId);
            gamesByRoom.delete(game.room);
            gamesByStarted.delete(socket.id);
        }
    }
}

io.on('connection', (socket) => {
    console.log(`${socket.id} connected. Adding socket to global array of sockets.`);

    if(!sockets.get(socket.id)){
        sockets.set(socket.id, socket);
    }

    socket.on('disconnect', () => {
        console.log(`socket ${socket.id} disconnected`);
        if(sockets.get(socket.id)){
            // Grace time for reconnection
            setTimeout(()=>{
                sockets.delete(socket.id);
            }, 2000)
        }
    });

    socket.on('games-fetch', () => {
        io.emit('games-update', Array.from(games.values()).map(g => ({ title: g.title, startingTime: g.startingTime, room: g.room })));
    });

    socket.on('game-start', () => {
        // TODO: Check for credentials
        // TODO: Very if room already exists
        // TODO: Call socket.leave(room);
        const gameRoomName = `game-room-${(games.size+1).toString()}`;
        socket.join(gameRoomName);

        let game = {
            id: randomUUID(),
            title: `Game ${(games.size+1).toString()}`,
            room: gameRoomName,
            startingTime: Date.now(),
            startingSocketId: socket.id,
            actions: [],
            players: new Map([
                [socket.id, {
                    name: 'Player 1',
                    startedGame: true,
                    ...playerMap,
                }]
            ]),
            board: new Map(boardTemplate),
            resources: [
                {
                    id: randomUUID(),
                    name: 'Iron Deposit',
                    resource: 'iron',
                    model: 'iron-deposit',
                    x: 6,
                    z: 7,
                    position: null,
                    yield: 100,
                },
                {
                    id: randomUUID(),
                    name: 'Carbon Deposit',
                    resource: 'carbon',
                    model: 'carbon-deposit',
                    x: 8,
                    z: 9,
                    position: null,
                    yield: 100,
                }
            ],
            units: new Map(),
            unitsByPlayer: new Map(),
            buildings: new Map(),
            buildingsByPlayer: new Map(),
            buildingsByType: new Map(),
        };

        // TODO: Add efficiency.
        // Units can perform all actions, but they have different efficiency mapping.
        const starterUnit = {
            ...unitsMap['gather-node'],
            id: randomUUID(),
            hackId: randomUUID(),
            player: socket.id,
            sight: new Set(),
            x: 0,
            z: 0,
            position: null,
        };

        game.units.set(starterUnit.id, starterUnit);

        const starterBuildings = [
            {
                ...buildingsMap['assembly-plant'],
                id: randomUUID(),
                hackId: randomUUID(),
                player: socket.id,
                x: 1,
                z: 1,
                position: null,
            },
            {
                ...buildingsMap['generator'],
                id: randomUUID(),
                hackId: randomUUID(),
                player: socket.id,
                x: 2,
                z: 2,
                position: null,
            },
            {
                ...buildingsMap['refinery'],
                id: randomUUID(),
                hackId: randomUUID(),
                player: socket.id,
                x: 3,
                z: 3,
                position: null,
            },
        ];

        starterBuildings.forEach(sb => game.buildings.set(sb.id, sb));

        // add starter unit to unitsByPlayer
        if (!game.unitsByPlayer.has(socket.id)) {
            game.unitsByPlayer.set(socket.id, new Set());
        }
        game.unitsByPlayer.get(socket.id).add(starterUnit.id);

        starterBuildings.forEach(sb => {
            // by player
            if(!game.buildingsByPlayer.has(socket.id)){
                game.buildingsByPlayer.set(socket.id, new Set());
            }
            game.buildingsByPlayer.get(socket.id).add(sb.id);

            // by type
            if(!game.buildingsByType.has(sb.type)){
                game.buildingsByType.set(sb.type, new Set());
            }
            game.buildingsByType.get(sb.type).add(sb.id);
        });

        game.units.forEach((u, unitId) => {
            const calculatedSight = calculateSight(u.x, u.z);
            const calculatedPosition = calculatePosition(u.x, u.z);

            const player = game.players.get(socket.id);
            calculatedSight.forEach(v => player.sight.add(v));
            calculatedSight.forEach(v => player.discovered.add(v));

            const tile = game.board.get(calculatedPosition);
            if(tile) tile.unit = u.id;

            // update the unit object in the Map in-place
            calculatedSight.forEach(v => u.sight.add(v));
            u.position = calculatedPosition;

            // optional
            game.units.set(unitId, u);
        });

        game.buildings.forEach((b, buildingId) => {
            const calculatedSight = calculateSight(b.x, b.z);
            const calculatedPosition = calculatePosition(b.x, b.z);

            const player = game.players.get(socket.id);
            calculatedSight.forEach(v => player.sight.add(v));
            calculatedSight.forEach(v => player.discovered.add(v));

            const tile = game.board.get(calculatedPosition);
            if(tile) tile.building = b.id;

            // update the building object in the Map in-place
            calculatedSight.forEach(v => b.sight.add(v));
            b.position = calculatedPosition;

            game.buildings.set(buildingId, b);
        });

        game.resources = game.resources.map(r => {
            const calculatedPosition = calculatePosition(r.x, r.z);

            const tile = game.board.get(calculatedPosition);
            if(tile) tile.resource = r.id;

            return {
                ...r,
                position: calculatedPosition,
            }
        });

        const mainInterval = setInterval(()=>{
            drainElectricity(game.id);
            generateElectricity(game.id);

            if(game.actions.length > 0){
                resolveActions(game.id);
            }
        }, 50)

        intervals.set(game.id, mainInterval);

        games.set(game.id, game);
        gamesByRoom.set(game.room, game);
        gamesByStarted.set(socket.id, game);

        io.emit('games-update', Array.from(games.values()).map(g => ({ title: g.title, startingTime: g.startingTime })));
        
        const safeGameData = { 
            ...game,
            units: Array.from(game.unitsByPlayer.get(socket.id)).map(id => {
                const u = game.units.get(id);
                return {
                    ...u,
                    sight: [...u.sight]
                };
            }),
            buildings: Array.from(game.buildingsByPlayer.get(socket.id)).map(id => {
                const b = game.buildings.get(id);
                return {
                    ...b,
                    sight: [...b.sight]
                };
            }),
            board: Array.from(game.board.values()),
            player: { 
                ...game.players.get(socket.id),
                sight: [...game.players.get(socket.id).sight],
                discovered: [...game.players.get(socket.id).discovered]
            },
        };
        delete safeGameData.id;

        socket.emit('starting-game-data', safeGameData);
    })
    // TODO: Calculate units or buildings in joining player's sight
    socket.on('game-join', ({room})=>{
        const game = gamesByRoom.get(room);
        if(!game) return;

        // If this socket already started a game, return
        if(gamesByStarted.get(socket.id)){
            return;
        }

        // we have the room, now we may join
        socket.join(room);

        console.log(`player ${socket.id} has joined room ${room}`);

        // add new player to game.players
        game.players.set(socket.id, {
            name: `Player ${game.players.size+1}`,
            startedGame: false,
            ...playerMap,
        })

        // ok we now have the game, we need to put that player in the game
        // the player is essentially the socket id so we have all we need here
        // prepare starter units and buildings
        const starterUnit = {
            ...unitsMap['gather-node'],
            id: randomUUID(),
            hackId: randomUUID(),
            player: socket.id,
            sight: new Set(),
            x: 9,
            z: 9, // other end of the board for now
            position: null,
        };

        const starterBuildings = [
            {
                ...buildingsMap['assembly-plant'],
                id: randomUUID(),
                hackId: randomUUID(),
                player: socket.id,
                x: 8,
                z: 8,
                position: null,
            },
            {
                ...buildingsMap['generator'],
                id: randomUUID(),
                hackId: randomUUID(),
                player: socket.id,
                x: 8,
                z: 7,
                position: null,
            },
            {
                ...buildingsMap['refinery'],
                id: randomUUID(),
                hackId: randomUUID(),
                player: socket.id,
                x: 8,
                z: 6,
                position: null,
            },
        ];

        // add units to game and maps
        game.units.set(starterUnit.id, starterUnit);
        if(!game.unitsByPlayer.has(socket.id)){
            game.unitsByPlayer.set(socket.id, new Set());
        }
        game.unitsByPlayer.get(socket.id).add(starterUnit.id);

        // add buildings to game and maps
        starterBuildings.forEach(sb => game.buildings.set(sb.id, sb));
        starterBuildings.forEach(sb => {
            // by player
            if(!game.buildingsByPlayer.has(socket.id)){
                game.buildingsByPlayer.set(socket.id, new Set());
            }
            game.buildingsByPlayer.get(socket.id).add(sb.id);

            // by type
            if(!game.buildingsByType.has(sb.type)){
                game.buildingsByType.set(sb.type, new Set());
            }
            game.buildingsByType.get(sb.type).add(sb.id);
        });

        // calculate sight and position for units only for joining player
        game.unitsByPlayer.get(socket.id).forEach((unitId) => {
            const unit = game.units.get(unitId);
            const calculatedSight = calculateSight(unit.x, unit.z);
            const calculatedPosition = calculatePosition(unit.x, unit.z);

            const player = game.players.get(socket.id);
            calculatedSight.forEach(v => player.sight.add(v));
            calculatedSight.forEach(v => player.discovered.add(v));

            const tile = game.board.get(calculatedPosition);
            if(tile) tile.unit = unit.id;

            // update the unit object in the Map in-place
            calculatedSight.forEach(v => unit.sight.add(v));
            unit.position = calculatedPosition;

            // optional
            game.units.set(unitId, unit);
        });

        // calculate sight and position for buildings only for joining player
        game.buildingsByPlayer.get(socket.id).forEach((buildingId)=>{
            const building = game.buildings.get(buildingId);
            const calculatedSight = calculateSight(building.x, building.z);
            const calculatedPosition = calculatePosition(building.x, building.z);

            const player = game.players.get(socket.id);
            calculatedSight.forEach(v => player.sight.add(v));
            calculatedSight.forEach(v => player.discovered.add(v));

            const tile = game.board.get(calculatedPosition);
            if(tile) tile.building = building.id;

            // update the building object in the Map in-place
            calculatedSight.forEach(v => building.sight.add(v));
            building.position = calculatedPosition;

            game.buildings.set(buildingId, building);
        })

        const safeGameData = { 
            ...game,
            units: Array.from(game.unitsByPlayer.get(socket.id)).map(id => {
                const u = game.units.get(id);
                return {
                    ...u,
                    sight: [...u.sight]
                };
            }),
            buildings: Array.from(game.buildingsByPlayer.get(socket.id)).map(id => {
                const b = game.buildings.get(id);
                return {
                    ...b,
                    sight: [...b.sight]
                };
            }),
            board: Array.from(game.board.values()),
            player: { 
                ...game.players.get(socket.id),
                sight: [...game.players.get(socket.id).sight],
                discovered: [...game.players.get(socket.id).discovered]
            },
        };
        delete safeGameData.id;

        socket.emit('starting-game-data', safeGameData);

    })

    socket.on('player-reconnect', ({ originalSocketId, gameRoom }) => {
        const game = gamesByRoom.get(gameRoom);
        if (!game) return

        const player = game.players.get(originalSocketId);

        if (player) {
            // Update player socket
            // no need to update a field that doesnt exist anymore
            // verify it works
            // player.socketId = socket.id

            // if this player was the one who started the game
            if(player.startedGame){
                game.startingSocketId = socket.id; // we ALSO update the startingSocketId
            }

            const oldSocket = sockets.get(originalSocketId);
            if (oldSocket) {
                sockets.delete(originalSocketId);      // remove old key
                sockets.set(socket.id, socket);        // add new key
            }

            // Update players that had the old socket
            game.players.delete(originalSocketId);
            game.players.set(socket.id, player);
            
            // Update units owned by old socket
            const playerUnitIds = game.unitsByPlayer.get(originalSocketId) || new Set();

            // Update the player reference on each unit
            playerUnitIds.forEach(unitId => {
                const unit = game.units.get(unitId);
                if (unit) unit.player = socket.id;
            });

            // Move the unit IDs to the new key in unitsByPlayer
            if (!game.unitsByPlayer.has(socket.id)) {
                game.unitsByPlayer.set(socket.id, new Set());
            }
            // we can do this ONLY because of previous code block where if it doenst exist, we add the socket.id
            const newUnitIdsSet = game.unitsByPlayer.get(socket.id);
            playerUnitIds.forEach(id => newUnitIdsSet.add(id));
            // game.unitsByPlayer.delete(originalSocketId);
            
            // Update buildings owned by old socket
            // First we get the ids
            const playerBuildingIds = game.buildingsByPlayer.get(originalSocketId) || new Set();

            // Update references on each building
            playerBuildingIds.forEach(buildingId => {
                const building = game.buildings.get(buildingId);
                if(building) building.player = socket.id;
            })

            // update building ids in the new added conditionally here
            if(!game.buildingsByPlayer.has(socket.id)){
                game.buildingsByPlayer.set(socket.id, new Set());
            }
            const newBuildingIdsSet = game.buildingsByPlayer.get(socket.id);
            playerBuildingIds.forEach(id => newBuildingIdsSet.add(id));
            // game.buildingsByPlayer.delete(originalSocketId); 

            // Join the room
            socket.join(gameRoom)

            const safeGameData = { 
                ...game,
                units: Array.from(game.units.values()).map(u => ({
                    ...u,
                    sight: [...u.sight]
                })),
                buildings: Array.from(game.buildings.values()).map(b => ({
                    ...b,
                    sight: [...b.sight]
                })),
                board: Array.from(game.board.values()),
                player: { 
                    ...game.players.get(socket.id),
                    sight: [...game.players.get(socket.id).sight],
                    discovered: [...game.players.get(socket.id).discovered]
                },
            };

            socket.emit('starting-game-data', safeGameData);
        }
    })

    socket.on('player-disconnect', () => {
        if(sockets.get(socket.id)){
            // Grace time: 2s
            setTimeout(()=>{
                sockets.delete(socket.id);
            }, 2000)
        }

        const game = gamesByStarted.get(socket.id);

        // also clean the intervals attached to that gameId
        if(game){
            intervals.delete(game.id);
        }

        // Delete games this socket started
        for (const [gameId, game] of games.entries()) {
            if (game.startingSocketId === socket.id) {
                games.delete(gameId);
                gamesByRoom.delete(game.room);
                gamesByStarted.delete(socket.id);
            }
        }
    })

    socket.on('movement', (data)=>{
        const game = gamesByRoom.get(data.room);

        if(game){
            const unit = game.units.get(data.unitId);

            if(unit && unit.player === socket.id){
                // if unit is already moving, remove any type: 'movement' actions from array
                game.actions = game.actions.filter(action => !(action.type === 'movement' && action.unitId === data.unitId));

                const startTile = boardTemplate.get(unit.position);
                const endTile = boardTemplate.get(data.tileId);

                const gameBoardEndTile = game.board.get(endTile.id);

                // We have the endTile. If the endTile is occupied, we forbid movement.
                if(gameBoardEndTile && (gameBoardEndTile.resource || gameBoardEndTile.building || gameBoardEndTile.unit)){
                    socket.emit('movement-forbidden', { msg: 'End tile is occupied' });
                    return;
                }

                const distance = Math.sqrt(
                    Math.pow(endTile.x - startTile.x, 2) + 
                    Math.pow(endTile.z - startTile.z, 2)
                );

                const duration = (distance / unit.speed) * 1000; // convert to ms

                game.actions.push({
                    id: randomUUID(),
                    type: 'movement',
                    playerId: unit.player || null,
                    unitId: data.unitId,
                    startingTime: Date.now(),
                    duration: duration,
                    startX: startTile.x,
                    startZ: startTile.z,
                    destinationX: endTile.x,
                    destinationZ: endTile.z,
                    drainsElectricity: true,
                })
            }
        }
    });

    socket.on('start-action', (data)=>{
        console.log(`socket ${socket.id} in room ${data.room} requested an action for selected id ${data.selected.id}`);

        const game = gamesByRoom.get(data.room);
        if(game){

            // Check if player has the resources to cost that action
            const player = game.players.get(socket.id);
            const playerSocket = sockets.get(socket.id);
            const actionCost = actionsMap[data.actionType].cost;

            // Iterate over the cost (it can be more than one resource)
            for (const cost of actionCost) {
                if (playerSocket && player.resources[cost.resource] < cost.amount) {
                    playerSocket.emit('logs-update', {
                        log: `Not enough resources. ${cost.amount} ${cost.resource} is required.`,
                        type: 'error'
                    });
                    return;
                }
            }

            if(data.selected.mobile === true){
                const unit = game.units.get(data.selected.id);

                const hasResourceInSight = [...unit.sight].some(tileId => {
                    const tile = game.board.get(tileId);
                    return tile && tile.resource;
                });
                if (!hasResourceInSight && data.actionType === 'gather') {
                    playerSocket.emit('logs-update', { log: 'No resource in sight.' });
                    return;
                }

                if(unit && unit.player === socket.id){
                    game.actions.push({
                        id: randomUUID(),
                        type: data.actionType,
                        unitId: unit.id,
                        startingTime: Date.now(),
                        duration: actionsMap[data.actionType].duration,
                        costPaid: actionCost.map(cost => ({...cost, amountPaid:0})),
                        paused: false,
                        drainsElectricity: true,
                        playerId: socket.id,
                    });
                }
            } else {
                const building = game.buildings.get(data.selected.id);

                if(building && building.player === socket.id){
                    game.actions.push({
                        id: randomUUID(),
                        type: data.actionType,
                        buildingId: building.id,
                        startingTime: Date.now(),
                        duration: actionsMap[data.actionType].duration,
                        costPaid: actionCost.map(cost => ({ ...cost, amountPaid: 0 })),
                        paused: false,
                        drainsElectricity: true,
                        playerId: socket.id,
                    });
                }

            }
        }
    })

})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});