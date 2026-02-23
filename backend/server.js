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
let intervals = []; // TODO: Change to map
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
    'build-gather-node': { duration: 8000, cost: [{ resource: 'electricity', amount: 10 }, { resource: 'iron', amount: 10 }] }, // default values: duration, cost
    'gather': { duration: 2000, cost: [{ resource: 'electricity', amount: 10 }] },
}

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
            // check in the array of buildings for generators belonging to this player
            const playerGenerators = game.buildings.filter(b => b.type === 'generator');
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
        game.actions.forEach(action => {
            switch(action.type){
                case 'movement':
                    const unit = game.units.find(u => u.id === action.unitId);
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

                        unit.sight = calculateSight(Math.round(unit.x), Math.round(unit.z))

                        const allPlayerUnits = game.units.filter(u => u.player === player.socketId);
                        const allPlayerBuildings = game.buildings.filter(b => b.player === player.socketId);

                        player.sight = [
                            ...new Set([
                                ...allPlayerUnits.flatMap(u => u.sight),
                                ...allPlayerBuildings.flatMap(b => b.sight),
                            ])
                        ];

                        player.discovered = [
                            ...new Set([...player.discovered, ...unit.sight])
                        ];

                        const playerSocket = sockets.get(player.socketId);

                        if(playerSocket) playerSocket.emit('sight-discovery-update', { sight: player.sight, discovered: player.discovered })
                    }

                    io.to(game.room).emit('movement-update', { unitId: unit.id, x: unit.x, z: unit.z })
                    break;
                case 'build-gather-node':
                    console.log('executing action build-gather-node', action);
                    // we dont update anything from the building so we dont need the building now
                    // eventually yes, because we need to spawn the new node from adjacent tiles
                    const building = game.buildings.find(b => b.id === action.buildingId);

                    if(!building) break;

                    progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);
                    player = game.players.find(p => p.socketId === building.player);
                    const playerSocket = sockets.get(player.socketId);

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

                        game.units.push(gatherNode)

                        if(playerSocket){
                            playerSocket.emit('player-units-update', { units: game.units.filter(u => u.player === player.socketId) });
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
        intervals = intervals.filter(i => i.gameId !== game.id);
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
        console.log('user disconnected');
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
        // remember to also START THE CLOCK <- Super important. Start keeping track of time.

        socket.join(gameRoomName);

        // remember to later call socket.leave(gameRoomName) or socket.leave(game.room)

        // every process that starts has an intervalId AND a starting time
        // an action has a starting time. Lets say we start "an action", put it in the `actions` array (this is NOT the intervals array, those contain intervalIds and other things)
        // so, the interval, lets say, every 50ms, checks the action array. If the action is `resolved` , it REMOVES the action from the action array, cleaning it
        // an action takes a SET amount of time, so it takes the startingTime of the action, and compares to Date.now() -> Date.now() - startingTime = has much time passed
        // startingTime and "timeToResolve" are different things. startingTime is when the action started, and timeToResolve is how long should this action take
        // like this, we will manage the "actions" that occur on the board. Here, action is inpersonal, actions array carries ALL actions 

        // TODO: units and buildings will be universal. What this means is as follows
        // there will be NO units and buildings in each player , instead
        // there will be a global units, and each of those units will tell you if: a) its owned by a player, b) its part of the world. If its owned by a player, it will tell you its UNIQUE id which is its socketId
        // when selecting units, logic is: if you own those units, you CAN select them, if not , you can't . 
        // this will allow local and global units and buildings to coexist coherently

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
            ], // define the resource object and coordinates
            units: [
                {
                    id: randomUUID(),
                    hackId: randomUUID(), // the hackId is NOT the id of the unit. Players cannot know the id. And only if they use specific skills, they can discover the hackId and use it to hack into a unit or building.
                    mobile: true,
                    name: 'Gather Node', // It can do everything, but its SPECIALIZED in gathering, so its throughput is MAX when gathering, as opposed to other nodes
                    model: 'gather-node',
                    player: socket.id, // IMPORTANT: if player is null, it means its NOT controlled by ANY player.
                    sight: [],
                    x: 0,
                    z: 0,
                    position: null,
                    speed: 3, // tiles per second
                    integrity: 100, // essentially, the HP of machines
                    material: 'iron', // material the structure of the machine is built off. Other option is: steel. An upgrade. Structure resists MORE.
                    actions: [{ type: 'gather', title: 'Gather', duration: actionsMap['gather'] }],
                }
            ],
            buildings: [
                {
                    id: randomUUID(),
                    hackId: randomUUID(), // the hackId is NOT the id of the unit. Players cannot know the id. And only if they use specific skills, they can discover the hackId and use it to hack into a unit or building.
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
                    actions: [{ type: 'build-gather-node', title: 'Build Gather Node', duration: actionsMap['build-gather-node'] }],
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
            ],
        };

        // we calculate the sight and positions of units
        // we also assigned those calculatedPositions (tileIds) to the tiles of this game's board
        // at this point we only have ONE player so we can place total sight here
        // but later, in join-game event, we do this ONLY for the units and buildings of THAT player, not "all" (which here is just one: the first)
        game.units = game.units.map(u => {
            const calculatedSight = calculateSight(u.x, u.z);
            const calculatedPosition = calculatePosition(u.x, u.z);

            game.players[0].sight.push(...calculatedSight);
            // starting point, discovery is same as sight
            game.players[0].discovered.push(...calculatedSight)

            game.board = game.board.map(tile => {
                if(tile.id === calculatedPosition){
                    return {
                        ...tile,
                        unit: u.id,
                    }
                }

                return {...tile}
            })

            return {
                ...u,
                sight: calculatedSight,
                position: calculatedPosition,
            }
        });

        // we calculate the sight and positions of buildings
        // we also assigned those calculatedPositions (tileIds) to the tiles of this game's board
        game.buildings = game.buildings.map(b => {
            const calculatedSight = calculateSight(b.x, b.z);
            const calculatedPosition = calculatePosition(b.x, b.z);

            game.players[0].sight.push(...calculatedSight);
            // starting point, discovery is same as sight
            game.players[0].discovered.push(...calculatedSight)

            game.board = game.board.map(tile => {
                if(tile.id === calculatedPosition){
                    return {
                        ...tile,
                        building: b.id,
                    }
                }

                return {...tile}
            })

            return {
                ...b,
                sight: calculatedSight,
                position: calculatedPosition,
            }
        });

        // we calculate the position of resources (not sight)
        // And assign those tiledIds to the board's tiles
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

        // here, we also add the actions that we want starting ALREADY, as we said everything is an action
        // sight: action; movement: action; drain-electricity: action;
        // the interval checks the clock and passes the task to the resolver
        // once the resolver is done with the task, it updates the state of it
        // the interval can remove the action if: 1) timeToResolve reached the limit 2) the action is "resolved"
        // for example, we need to calculate SIGHT for each unit. SIGHT will tell us which TILE they see. 
        // the Tile they see is calculated based on the X and Z of the object (unit or building) like x+1 x-1 z+1 z-1, then that matches an ID, THEN that id is pushed into an array called `sight` inside
        // the unit of building

        const mainInterval = setInterval(()=>{
            drainElectricity(game.id);
            generateElectricity(game.id);

            // resolveActions while filtering the resolvedOnes (by duration)
            if(game.actions.length > 0){
                resolveActions(game.id);
                console.log('actions in the actions array: ', game.actions);
            }
        }, 50)

        intervals.push({gameId: game.id, interval: mainInterval});

        // start main interval. Each 50ms. resolves or removes (resolver doest the ACTUAL change, interval checks time and determines if enough has passed. Thats it.)
        // store than main interval id somewhere for cleaning afterwards. The interval sends state changes to the player but ONLY the player data

        // for now, we move onto just adding this bare bones game object to see it show in the /games page
        games.set(game.id, game);
        gamesByRoom.set(game.room, game);
        gamesByStarted.set(socket.id, game);

        // we tell all clients a game has started can be viewed in /games page
        io.emit('games-update', Array.from(games.values()).map(g => ({ title: g.title, startingTime: g.startingTime })));
        
        // Neccesary data to start the board
        // Remove id
        const safeGameData = { ...game };
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
            game.units.forEach(u => {
            if (u.player === originalSocketId) {
                u.player = socket.id
            }
            })
            
            // Update buildings owned by old socket
            game.buildings.forEach(b => {
            if (b.player === originalSocketId) {
                b.player = socket.id
            }
            })
            
            socket.join(gameRoom)
            socket.emit('starting-game-data', game)
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
            intervals = intervals.filter(i => i.gameId !== game.id);
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
            const unit = game.units.find(u => u.id === data.unitId);

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

    // A socket receives an action
    // We want to push into game.actions with minimal input from the user
    // From the user, we need to know this
    // - which action.type
    // - which unit or building is performing this action
    socket.on('start-action', (data)=>{
        // we STAMP starting time here. (Date.now())
        console.log(`socket ${socket.id} in room ${data.room} requested an action for selected id ${data.selected.id}`);

        const game = gamesByRoom.get(data.room);
        console.log(data);
        if(game){
            if(data.selected.mobile === true){
                const unit = game.units.find(u => u.id === data.selected.id);
            } else {
                const building = game.buildings.find(b => b.id === data.selected.id);

                if(building){
                    game.actions.push({
                        id: randomUUID(),
                        type: data.actionType,
                        buildingId: building.id,
                        startingTime: Date.now(),
                        duration: actionsMap[data.actionType].duration, // later you may add modifiers here or in resolveActions
                    });
                }

            }
        }
    })

})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});