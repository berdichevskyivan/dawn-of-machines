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
        io.emit('games-update', games);
    });

    socket.on('start-game', () => {
        // we received a 'start-game' event from THIS socket(this is relevant, we must know WHICH socket initiated this, that's our Player 1)
        // here, we create a game, right now, straight up, in the future we automatically check for credentials, etc
        const game = {
            title: `Game ${(games.length+1).toString()}`, // auto-generated, look at "games", get length, plus 1, that's it
            players: [{}], // define the player object // we start with already ONE player, so include the object there
            board: Array.from({length: 100}, (_, i) => { return { id:i } }), // board is an array of tiles (tile object) (define tile object) Now we return empty object, but we will later or here do other calculations
            resources: [], // define the resource object. These are the world resources. We add resources after creating the game
        }

        // here, we add resources, and also run functions and calculations to populate the board, place the players, place the units, etc

        // for now, we move onto just adding this bare bones game object to see it show in the /games page
        games.push(game);

        io.emit('games-update', games);
    })
})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});