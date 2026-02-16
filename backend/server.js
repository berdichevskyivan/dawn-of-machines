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
                    units: [
                        {
                            name: 'Gather Node', // It can do everything, but its SPECIALIZED in gathering, so its throughput is MAX when gathering, as opposed to other nodes
                        }
                    ],
                    buildings: [
                        {
                            name: 'Assembly Plant'
                        },
                        {
                            name: 'Generator'
                        }
                    ],
                    iron: 10,
                    carbon: 0,
                    electricity: 10
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
        };

        // here, we add resources, and also run functions and calculations to populate the board, place the players, place the units, etc

        // When everything is in place, we start our first interval, this is the main game's clock.
        // The other intervals relate to other processes and they must be stopped and closed but there is only ONE game main interval

        // for now, we move onto just adding this bare bones game object to see it show in the /games page
        games.push(game);

        io.emit('games-update', games.map(g => ({title: g.title, startingTime: g.startingTime})));
    })
})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});