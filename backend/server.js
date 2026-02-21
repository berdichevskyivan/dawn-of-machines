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

let games = []; // this array contains all the currently active games
let intervals = []; // this array contains all the intervals related to games (linked by gameId)
let sockets = []; // here we store the socketId and the socket itself
const boardTemplate = Array.from({length: 100}, (_, i) => ({ 
                                    id: i,
                                    x: i % 10,
                                    z: Math.floor(i / 10),
                                    resource: null,
                                    unit: null,
                                    building: null,
                                }))

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
    const game = games.find(g => g.id === gameId);

    if(game){
        game.players.forEach(player => {
            // just existing drains a percentage, start with this
            player.resources.electricity -= 0.01; // rate for dev :) 

            // if player started the game and electricity equals zero, halt everything, disconnect the game
            if(player.startedGame && player.resources.electricity <= 0){
                // immediately delete all actions
                game.actions = []

                const playerSocket = sockets.find(s => s.socketId === player.socketId);
                if (playerSocket){
                    playerSocket.socket.emit('game-disconnect');
                    gameDisconnect(playerSocket.socket);
                } 
            }

            // check in the array of actions for actions belonging to THIS player
            player.resources.electricity -= game.actions.filter(action => action.playerId === player.socketId).length * 0.5;

            // then, for each player, we use their socket to emit, ONLY to THEIR socket
            const playerSocket = sockets.find(s => s.socketId === player.socketId);
            if (playerSocket) playerSocket.socket.emit('player-update', { playerData: player });
        })
    }
}

const resolveActions = (gameId) => {
    const game = games.find(g => g.id === gameId);

    if(game){
        // now iterate over the actions
        game.actions.forEach(action => {
            switch(action.type){
                case 'movement':
                    const unit = game.units.find(u => u.id === action.unitId);
                    if(!unit) break;

                    const progress = Math.min((Date.now() - action.startingTime) / action.duration, 1);

                    unit.x = action.startX + (action.destinationX - action.startX) * progress;
                    unit.z = action.startZ + (action.destinationZ - action.startZ) * progress;
                    unit.position = calculatePosition(Math.round(unit.x), Math.round(unit.z));

                    io.to(game.room).emit('movement-update', { unitId: unit.id, x: unit.x, z: unit.z })
                    break;
            }
        });

        game.actions = game.actions.filter(action => (Date.now() - action.startingTime) < action.duration);
    }
}

const gameDisconnect = (socket) => {
    const game = games.find(g => g.startingSocketId === socket.id);

    if(game){
        intervals = intervals.filter(i => i.gameId !== game.id);
    }

    // Delete games this socket started
    games = games.filter(g => g.startingSocketId !== socket.id);
}

io.on('connection', (socket) => {
    console.log(`${socket.id} connected. Adding socket to global array of sockets.`);

    // If it does NOT find the socket, push it
    // If it finds it, skip
    if(!sockets.find(s => s.socketId === socket.id)){
        sockets.push({ socketId: socket.id, socket: socket })
    }

    socket.on('disconnect', () => {
        console.log('user disconnected');
        if(sockets.find(s => s.socketId === socket.id)){
            // this is to give time for reconnection
            setTimeout(()=>{
                sockets = sockets.filter(s => s.socketId !== socket.id);
            }, 2000)
        }
    });

    socket.on('games-fetch', () => {
        io.emit('games-update', games.map(g => ({title: g.title, startingTime: g.startingTime})));
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
                        carbon: 0,
                        electricity: 100
                    },
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
                }
            ],
            buildings: [
                {
                    id: randomUUID(),
                    name: 'Assembly Plant',
                    model: 'assembly-plant',
                    player: socket.id,
                    sight: [],
                    x: 1,
                    z: 1,
                    position: null,
                    integrity: 100,
                    material: 'iron',
                },
                {
                    id: randomUUID(),
                    name: 'Generator',
                    model: 'generator',
                    player: socket.id,
                    sight: [],
                    x: 2,
                    z: 2,
                    position: null,
                    integrity: 100,
                    material: 'iron',
                }
            ],
        };

        // here, we add resources, and also run functions and calculations to populate the board, place the players, place the units, etc

        // we calculate the sight of the units
        game.units = game.units.map(u => {
            return {
                ...u,
                sight: calculateSight(u.x, u.z),
                position: calculatePosition(u.x, u.z),
            }
        })

        // we calculate the sight of buildings
        game.buildings = game.buildings.map(b => {
            return {
                ...b,
                sight: calculateSight(b.x, b.z),
                position: calculatePosition(b.x, b.z),
            }
        })

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

            // resolveActions while filtering the resolvedOnes (by duration)
            resolveActions(game.id);
            if(game.actions.length > 0){
                console.log('actions in the actions array: ', game.actions);
            }
        }, 50)

        intervals.push({gameId: game.id, interval: mainInterval});

        // start main interval. Each 50ms. resolves or removes (resolver doest the ACTUAL change, interval checks time and determines if enough has passed. Thats it.)
        // store than main interval id somewhere for cleaning afterwards. The interval sends state changes to the player but ONLY the player data

        // for now, we move onto just adding this bare bones game object to see it show in the /games page
        games.push(game);

        // we tell all clients a game has started can be viewed in /games page
        io.emit('games-update', games.map(g => ({title: g.title, startingTime: g.startingTime})));

        // Neccesary data to start the board
        // Remove id
        const safeGameData = { ...game };
        delete safeGameData.id;

        socket.emit('starting-game-data', safeGameData);
    })

    socket.on('player-reconnect', ({ originalSocketId, gameRoom }) => {
        const game = games.find(g => g.room === gameRoom)
        if (!game) return

        const player = game.players.find(p => p.socketId === originalSocketId)

        if (player) {
            // Update player socket
            player.socketId = socket.id

            // if this player was the one who started the game
            if(player.startedGame){
                game.startingSocketId = socket.id; // we ALSO update the startingSocketId
            }

            // Also update socket id in sockets array
            // I see. The socket id immediately disconnects so we need to remove it from 
            // the sockets array more slowly
            const socketToUpdate = sockets.find(s => s.socketId === originalSocketId);

            if(socketToUpdate){
                socketToUpdate.socketId = socket.id; // the new id
                socketToUpdate.socket = socket; // the new socket itself
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
        if(sockets.find(s => s.socketId === socket.id)){
            // Grace time: 2s
            setTimeout(()=>{
                sockets = sockets.filter(s => s.socketId !== socket.id);
            }, 2000)
        }

        const game = games.find(g => g.startingSocketId === socket.id);

        // also clean the intervals attached to that gameId
        if(game){
            intervals = intervals.filter(i => i.gameId !== game.id);
        }

        // Delete games this socket started
        games = games.filter(g => g.startingSocketId !== socket.id);
    })

    // A socket requests movement
    socket.on('movement', (data)=>{
        console.log(`socket ${socket.id} in room ${data.room} requested movement for unit ${data.unitId} to tile ${data.tileId}`);

        const game = games.find(g => g.room === data.room);

        if(game){
            const unit = game.units.find(u => u.id === data.unitId);

            if(unit){
                // if unit is already moving, remove any type: 'movement' actions from array
                game.actions = game.actions.filter(action => !(action.type === 'movement' && action.unitId === data.unitId));

                const startTile = boardTemplate.find(t => t.id === unit.position);
                const endTile = boardTemplate.find(t => t.id === data.tileId);

                const distance = Math.sqrt(
                    Math.pow(endTile.x - startTile.x, 2) + 
                    Math.pow(endTile.z - startTile.z, 2)
                );

                const duration = (distance / unit.speed) * 1000; // convert to ms

                game.actions.push({
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

})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});