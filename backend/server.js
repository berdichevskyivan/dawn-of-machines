const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173"
    }
});

const games = []; // this array contains all the currently active games
const boardTemplate = Array.from({length: 100}, (_, i) => ({ 
                                    id: i,
                                    x: i % 10,
                                    z: Math.floor(i / 10),
                                    resource: null,
                                    unit: null,
                                    building: null,
                                }))

const calculateSight = (x, z) => {
    // returns an array of integers, the id of the tiles
    const sightArray = [];
    // this is where we are right now
    sightArray.push({ x, z })
    // this is right
    sightArray.push({ x:x+1, z })
    // this is left
    sightArray.push({ x:x-1, z })
    // this is top
    sightArray.push({ x, z:z+1 })
    // this is bottom
    sightArray.push({ x, z:z-1 })
    // this is top-right
    sightArray.push({ x:x+1, z:z+1 })
    // this is top-left
    sightArray.push({ x:x-1, z:z+1 })
    // this is bottom-right
    sightArray.push({ x:x+1, z:z-1 })
    // this is bottom-left
    sightArray.push({ x:x-1, z:z-1 })

    console.log('sightArray: ', sightArray);

    const sightTileArray = sightArray.map(coordinate => {
        const tile = boardTemplate.find(tile=>tile.x === coordinate.x && tile.z === coordinate.z);
        console.log('tile is: ', tile);
        return tile?.id;
    }).filter(id => id !== undefined)

    console.log('sightTileArray is: ', sightTileArray);

    return sightTileArray;
}

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
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
        // there will be a global units, and each of those units will tell you if: a) its owned by a player, b) its part of the world. If its owned by a player, it will tell you its UNIQUE id which is its playerSocketId
        // when selecting units, logic is: if you own those units, you CAN select them, if not , you can't . 
        // this will allow local and global units and buildings to coexist coherently

        const game = {
            title: `Game ${(games.length+1).toString()}`, // auto-generated, look at "games", get length, plus 1, that's it
            room: gameRoomName,
            startingTime: Date.now(), // Time. Each object or process has its own startingTime
            startingSocketId: socket.id,
            intervals: [], // every game has its own set of intervals
            actions: [], // all actions in the game occur here. The main interval checks it every 50ms
            players: [
                {
                    name: 'Player 1',
                    playerSocketId: socket.id,
                    resources: {
                        iron: 10,
                        carbon: 0,
                        electricity: 10
                    },
                }
            ],
            board: Array.from({length: 100}, (_, i) => ({ 
                id: i,
                x: i % 10,
                z: Math.floor(i / 10),
                resource: null,
                unit: null,
                building: null,
            })), // board is an array of tiles (tile object) (define tile object) Now we return empty object, but we will later or here do other calculations
            resources: [], // define the resource object. These are the world resources. We add resources after creating the game
            units: [
                {
                    id: 0,
                    name: 'Gather Node', // It can do everything, but its SPECIALIZED in gathering, so its throughput is MAX when gathering, as opposed to other nodes
                    player: socket.id, // IMPORTANT: if player is null, it means its NOT controlled by ANY player.
                    sight: [],
                    x: 0,
                    z: 0,
                }
            ], // TODO: add coordinates
            buildings: [
                {
                    id: 0,
                    name: 'Assembly Plant',
                    player: socket.id,
                    sight: [],
                    x: 1,
                    z: 1,
                },
                {
                    id: 1,
                    name: 'Generator',
                    player: socket.id,
                    sight: [],
                    x: 2,
                    z: 2,
                }
            ],
        };

        // here, we add resources, and also run functions and calculations to populate the board, place the players, place the units, etc

        // we calculate the sight of the units
        game.units = game.units.map(u => {
            return {
                ...u,
                sight: calculateSight(u.x, u.z),
            }
        })

        // we calculate the sight of buildings
        game.buildings = game.buildings.map(b => {
            return {
                ...b,
                sight: calculateSight(b.x, b.z),
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
            console.log('to test');
        }, 50)

        // push the main interval into the intervals array
        game.intervals.push(mainInterval);

        // start main interval. Each 50ms. resolves or removes (resolver doest the ACTUAL change, interval checks time and determines if enough has passed. Thats it.)
        // store than main interval id somewhere for cleaning afterwards. The interval sends state changes to the player but ONLY the player data

        // for now, we move onto just adding this bare bones game object to see it show in the /games page
        games.push(game);

        // we tell all clients a game has started can be viewed in /games page
        io.emit('games-update', games.map(g => ({title: g.title, startingTime: g.startingTime})));

        // Neccesary data to start the board
        // Remove intervals from client side data
        const safeGameData = { ...game };
        delete safeGameData.intervals;

        socket.emit('starting-game-data', safeGameData);
    })
})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});