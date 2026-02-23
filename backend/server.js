const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173"
    }
});

let games = new Map();
let gamesByRoom = new Map();
let gamesByStarted = new Map();
let intervals = new Map();
let sockets = new Map();
const boardTemplate = Array.from({length: 100}, (_, i) => ({ 
                                    id: i,
                                    x: i % 10,
                                    z: Math.floor(i / 10),
                                    resource: null,
                                    unit: null,
                                    building: null,
                                }))

const actionsMap = {
    'build-gather-node': { duration: 8000, cost: [{ resource: 'electricity', amount: 10 }, { resource: 'iron', amount: 10 }] },
    'build-combat-node': { duration: 18000, cost: [{ resource: 'electricity', amount: 50 }, { resource: 'steel', amount: 50 }] },
    'gather': { duration: 2000, cost: [{ resource: 'electricity', amount: 10 }] },
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

        // skip tiles that are outside the board
        if (nx < 0 || nx >= boardWidth || nz < 0 || nz >= boardHeight) continue;

        // O(1) lookup
        sightTileIds.push(boardTemplate[nz * boardWidth + nx].id);
    }

    return sightTileIds;
};

const calculatePosition = (x, z, boardWidth = 10) => {
    if (x < 0 || x >= boardWidth || z < 0 || z >= boardWidth) return undefined;
    return boardTemplate[z * boardWidth + x].id;
}

const drainElectricity = (gameId) => {
    const game = games.get(gameId);

    if(game){
        game.players.forEach(player => {
            // just existing drains a percentage, start with this
            player.resources.electricity -= 0.1; // rate for dev :) 

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
                        playerId: player.socketId,
                        type: `electricity-threshold-${newThreshold}`,
                        startingTime: Date.now(),
                        duration: 1,
                    });
                }
            }

            // if player started the game and electricity equals zero, halt everything, disconnect the game
            if(player.startedGame && player.resources.electricity <= 0){
                // immediately delete all actions
                game.actions = []

                const playerSocket = sockets.get(player.socketId);
                if (playerSocket){
                    playerSocket.emit('game-disconnect');
                    gameDisconnect(playerSocket);
                } 
            }

            // check in the array of actions for actions belonging to THIS player
            player.resources.electricity -= game.actions.filter(action => action.playerId === player.socketId).length * 0.5;

            // then, for each player, we use their socket to emit, ONLY to THEIR socket
            const playerSocket = sockets.get(player.socketId);
            if (playerSocket) playerSocket.emit('player-update', { playerData: player });
        })
    }
}

const generateElectricity = (gameId) => {
    const game = games.get(gameId);

    if(game){
        game.players.forEach(player => {
            // get the generator IDs from buildingsByType Map
            const generatorIds = game.buildingsByType.get('generator') || new Set();

            // map IDs to building objects
            const playerGenerators = Array.from(generatorIds)
                .map(id => game.buildings.get(id))
                .filter(b => b && b.player === player.socketId);  // keep only this player's generators

            player.resources.electricity += playerGenerators.length * 0.15;

            // then, for each player, we use their socket to emit, ONLY to THEIR socket
            const playerSocket = sockets.get(player.socketId);
            if (playerSocket) playerSocket.emit('player-update', { playerData: player });
        })
    }
}

const resolveActions = (gameId) => {
    const game = games.get(gameId);

    if(game){
        // now iterate over the actions
        let progress = null;
        let player = null;
        let playerSocket = null;
        game.actions.forEach(action => {
            switch(action.type){
                case 'electricity-threshold-alert':
                    player = game.players.find(p => p.socketId === action.playerId);
                    playerSocket = sockets.get(player.socketId);
                    if(playerSocket) playerSocket.emit('logs-update', { log: '[ALERT] Electricity dropped below 50.' });
                    break;
                case 'electricity-threshold-critical':
                    player = game.players.find(p => p.socketId === action.playerId);
                    playerSocket = sockets.get(player.socketId);
                    if(playerSocket) playerSocket.emit('logs-update', { log: '[CRITICAL] Electricity dropped below 25.' });
                    break;
                case 'electricity-threshold-fatal':
                    player = game.players.find(p => p.socketId === action.playerId);
                    playerSocket = sockets.get(player.socketId);
                    if(playerSocket) playerSocket.emit('logs-update', { log: '[FATAL] Electricity dropped below 10.' });
                    break;
                case 'movement':
                    const unit = game.units.get(action.unitId);
                    if(!unit) break;

                    progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

                    unit.x = action.startX + (action.destinationX - action.startX) * progress;
                    unit.z = action.startZ + (action.destinationZ - action.startZ) * progress;

                    const previousPosition = unit.position;
                    unit.position = calculatePosition(Math.round(unit.x), Math.round(unit.z));

                    if(previousPosition !== unit.position){
                        const previousPositionTile = game.board.find(tile => tile.id === previousPosition);
                        if(previousPositionTile) previousPositionTile.unit = null;
                        const newPositionTile = game.board.find(tile => tile.id === unit.position);
                        if(newPositionTile) newPositionTile.unit = unit.id;
                    }

                    player = game.players.find(p => p.socketId === unit.player);

                    if(player){
                        for (const tileId of unit.sight) {
                            const index = player.sight.indexOf(tileId);
                            if (index !== -1) {
                                player.sight.splice(index, 1);
                            }
                        }

                        // This works 
                        unit.sight = [...calculateSight(Math.round(unit.x), Math.round(unit.z)), ...calculateSight(oppositeRound(unit.x), oppositeRound(unit.z))];

                        const playerUnitIds = game.unitsByPlayer.get(player.socketId) || new Set();
                        const playerUnits = Array.from(playerUnitIds).map(id => game.units.get(id));
                        const playerBuildingIds = game.buildingsByPlayer.get(player.socketId) || new Set();
                        const playerBuildings = Array.from(playerBuildingIds).map(id => game.buildings.get(id));

                        player.sight = [
                            ...playerUnits.flatMap(u => u.sight),
                            ...unit.sight,
                            ...playerBuildings.flatMap(b => b.sight),
                        ];

                        player.discovered = [
                            ...new Set([...player.discovered, ...unit.sight])
                        ];

                        playerSocket = sockets.get(player.socketId);

                        if(playerSocket) playerSocket.emit('sight-discovery-update', { sight: player.sight, discovered: player.discovered })
                    }

                    io.to(game.room).emit('movement-update', { unitId: unit.id, x: unit.x, z: unit.z })
                    break;
                case 'build-gather-node':
                    const building = game.buildings.get(action.buildingId);
                    if(!building) break;

                    player = game.players.find(p => p.socketId === building.player);
                    playerSocket = sockets.get(player.socketId);

                    if(action.paused) {
                        // Try to unpause if resources are back
                        const canResume = action.costPaid.every(cost => {
                            const targetPaid = cost.amount * ((Date.now() - action.startingTime) / action.duration);
                            return player.resources[cost.resource] >= (targetPaid - cost.amountPaid);
                        });
                        if(canResume) action.paused = false;
                        else {
                            if(playerSocket) playerSocket.emit('logs-update', { log: `Action paused: insufficient resources.`, type: 'action-paused' });
                            break; // skip tick
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
                        const gatherNode = {
                            id: randomUUID(),
                            hackId: randomUUID(),
                            mobile: true,
                            name: 'Gather Node',
                            model: 'gather-node',
                            player: player.socketId,
                            sight: calculateSight(building.x, building.z+1),
                            x: building.x,
                            z: building.z+1,
                            position: calculatePosition(building.x, building.z+1),
                            speed: 3,
                            integrity: 100,
                            material: 'iron',
                            actions: [{ type: 'gather', title: 'Gather', duration: actionsMap['gather'] }],
                        }

                        // set in units Map
                        game.units.set(gatherNode.id, gatherNode);
                        // ALSO set in unitsByPlayer Map (in the name of performance)
                        if (!game.unitsByPlayer.has(player.socketId)) {
                            game.unitsByPlayer.set(player.socketId, new Set());
                        }
                        // here we add the id to the unitsByPlayer map, which contain a Set of ids. Not the unit itself
                        game.unitsByPlayer.get(player.socketId).add(gatherNode.id);

                        if(playerSocket){
                            const playerUnitIds = game.unitsByPlayer.get(player.socketId) || new Set();
                            const playerUnits = Array.from(playerUnitIds).map(id => game.units.get(id));
                            playerSocket.emit('player-units-update', { units: playerUnits });
                            playerSocket.emit('logs-update', { log: `${gatherNode.name} was deployed.` })
                        } 
                    }

                    if(playerSocket) playerSocket.emit('action-progress-update', { actionId: action.id, progress: progress, actionType: action.type })

                    break;
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

    // If it does NOT find the socket, push it
    // If it finds it, skip
    if(!sockets.get(socket.id)){
        sockets.set(socket.id, socket);
    }

    socket.on('disconnect', () => {
        console.log(`socket ${socket.id} disconnected`);
        if(sockets.get(socket.id)){
            // this is to give time for reconnection
            setTimeout(()=>{
                sockets.delete(socket.id);
            }, 2000)
        }
    });

    socket.on('games-fetch', () => {
        io.emit('games-update', Array.from(games.values()).map(g => ({ title: g.title, startingTime: g.startingTime })));
    });

    socket.on('game-start', () => {
        // we received a 'game-start' event from THIS socket(this is relevant, we must know WHICH socket initiated this, that's our Player 1)
        // here, we create a game, right now, straight up, in the future we automatically check for credentials, etc

        // For now, the socket that called game-start joins the room, the room is called based on the length of the games, that's it.
        const gameRoomName = `game-room-${(games.length+1).toString()}`;

        // later we verify if this gameRoomName already exist by iterating over games
        socket.join(gameRoomName);

        // remember to later call socket.leave(gameRoomName) or socket.leave(game.room)

        let game = {
            id: randomUUID(),
            title: `Game ${(games.length+1).toString()}`, // auto-generated, look at "games", get length, plus 1, that's it
            room: gameRoomName,
            startingTime: Date.now(), // Time. Each object or process has its own startingTime
            startingSocketId: socket.id,
            actions: [], // all actions in the game occur here. The main interval checks it every 50ms
            players: [
                {
                    name: 'Player 1',
                    socketId: socket.id,
                    startedGame: true,
                    resources: {
                        iron: 10,
                        steel: 0,
                        carbon: 0,
                        graphene: 0,
                        electricity: 100
                    },
                    sight: [], // this lives at the player level. Player total sight is determined and enforced by the server, not the client.
                    discovered: [], // player may or may not have sight on these tiles, but they are visible already. Still, sight has its own logic (some things depend SOLELY on sight, NOT discovery)
                }
            ],
            board: [...boardTemplate],
            resources: [
                {
                    id: randomUUID(),
                    name: 'Iron Deposit',
                    model: 'iron-deposit',
                    x: 6,
                    z: 7,
                    position: null,
                    yield: 100,
                },
                {
                    id: randomUUID(),
                    name: 'Carbon Deposit',
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

        // starter unit
        const starterUnit = {
            id: randomUUID(),
            hackId: randomUUID(),
            mobile: true,
            name: 'Gather Node',
            model: 'gather-node',
            player: socket.id,
            sight: [],
            x: 0,
            z: 0,
            position: null,
            speed: 3,
            integrity: 100,
            material: 'iron',
            actions: [{ type: 'gather', title: 'Gather', duration: actionsMap['gather'] }],
        };

        game.units.set(starterUnit.id, starterUnit);

        // starter buildings
        const starterBuildings = [
            {
                id: randomUUID(),
                hackId: randomUUID(),
                mobile: false,
                name: 'Assembly Plant',
                model: 'assembly-plant',
                type: 'assembly-plant',
                player: socket.id,
                sight: [],
                x: 1,
                z: 1,
                position: null,
                integrity: 100,
                material: 'iron',
                actions: [
                    { type: 'build-gather-node', title: 'Build Gather Node', duration: actionsMap['build-gather-node'] },
                    { type: 'build-combat-node', title: 'Build Combat Node', duration: actionsMap['build-combat-node'] }
                ],
            },
            {
                id: randomUUID(),
                hackId: randomUUID(),
                mobile: false,
                name: 'Generator',
                model: 'generator',
                type: 'generator',
                player: socket.id,
                sight: [],
                x: 2,
                z: 2,
                position: null,
                integrity: 100,
                material: 'iron',
                actions: [],
            }
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

        // Now game.units is a Map()
        game.units.forEach((u, unitId) => {
            const calculatedSight = calculateSight(u.x, u.z);
            const calculatedPosition = calculatePosition(u.x, u.z);

            game.players[0].sight.push(...calculatedSight);
            game.players[0].discovered.push(...calculatedSight);

            game.board = game.board.map(tile => {
                if(tile.id === calculatedPosition){
                    return {
                        ...tile,
                        unit: u.id,
                    };
                }
                return {...tile};
            });

            // update the unit object in the Map in-place
            u.sight = calculatedSight;
            u.position = calculatedPosition;

            // optional
            game.units.set(unitId, u);
        });

        // Now game.buildings is a Map()
        game.buildings.forEach((b, buildingId) => {
            const calculatedSight = calculateSight(b.x, b.z);
            const calculatedPosition = calculatePosition(b.x, b.z);

            game.players[0].sight.push(...calculatedSight);
            game.players[0].discovered.push(...calculatedSight);

            game.board = game.board.map(tile => {
                if(tile.id === calculatedPosition){
                    return { ...tile, building: b.id };
                }
                return { ...tile };
            });

            // update the building object in the Map in-place
            b.sight = calculatedSight;
            b.position = calculatedPosition;

            game.buildings.set(buildingId, b);
        });

        game.resources = game.resources.map(r => {
            const calculatedPosition = calculatePosition(r.x, r.z);

            game.board = game.board.map(tile => {
                if(tile.id === calculatedPosition){
                    return {
                        ...tile,
                        resource: r.id,
                    }
                }

                return {...tile}
            })

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
            units: Array.from(game.units.values()),
            buildings: Array.from(game.buildings.values()),
        };
        delete safeGameData.id;

        socket.emit('starting-game-data', safeGameData);
    })

    socket.on('player-reconnect', ({ originalSocketId, gameRoom }) => {
        const game = gamesByRoom.get(gameRoom);
        if (!game) return

        const player = game.players.find(p => p.socketId === originalSocketId)

        if (player) {
            // Update player socket
            player.socketId = socket.id

            // if this player was the one who started the game
            if(player.startedGame){
                game.startingSocketId = socket.id; // we ALSO update the startingSocketId
            }

            const oldSocket = sockets.get(originalSocketId);
            if (oldSocket) {
                sockets.delete(originalSocketId);      // remove old key
                sockets.set(socket.id, socket);        // add new key
            }
            
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
                units: Array.from(game.units.values()),
                buildings: Array.from(game.buildings.values()),
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

    // A socket requests movement
    socket.on('movement', (data)=>{
        console.log(`socket ${socket.id} in room ${data.room} requested movement for unit ${data.unitId} to tile ${data.tileId}`);

        const game = gamesByRoom.get(data.room);

        if(game){
            const unit = game.units.get(data.unitId);

            if(unit){
                // if unit is already moving, remove any type: 'movement' actions from array
                game.actions = game.actions.filter(action => !(action.type === 'movement' && action.unitId === data.unitId));

                const startTile = boardTemplate.find(t => t.id === unit.position);
                const endTile = boardTemplate.find(t => t.id === data.tileId);

                const gameBoardEndTile = game.board.find(tile => tile.id === endTile.id);

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
                })
            }
        }
    });

    socket.on('start-action', (data)=>{
        // we STAMP starting time here. (Date.now())
        console.log(`socket ${socket.id} in room ${data.room} requested an action for selected id ${data.selected.id}`);

        const game = gamesByRoom.get(data.room);
        if(game){

            // Check if player has the resources to cost that action
            const player = game.players.find(p => p.socketId === socket.id);
            const actionCost = actionsMap[data.actionType].cost;

            // Iterate over the cost (it can be more than one resource)
            for (const cost of actionCost) {
                if (player.resources[cost.resource] < cost.amount) {
                    const playerSocket = sockets.get(player.socketId);
                    playerSocket.emit('logs-update', {
                        log: `Not enough resources. ${cost.amount} ${cost.resource} is required.`,
                        type: 'error'
                    });
                    return; // exits socket.on handler
                }else{
                    console.log(`player has ${cost.amount} ${cost.resource}`)
                }
            }

            if(data.selected.mobile === true){
                const unit = game.units.get(data.selected.id);
            } else {
                const building = game.buildings.get(data.selected.id);

                if(building){
                    game.actions.push({
                        id: randomUUID(),
                        type: data.actionType,
                        buildingId: building.id,
                        startingTime: Date.now(),
                        duration: actionsMap[data.actionType].duration, // later you may add modifiers here or in resolveActions
                        costPaid: actionCost.map(cost => ({ ...cost, amountPaid: 0 })),
                        paused: false,
                    });
                }

            }
        }
    })

})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});