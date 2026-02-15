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

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('signal', (data)=>{
        console.log('log this cos we arrived');
        console.log('now log the data: ', data);
        console.log('Server Time: ', new Date(Date.now()));
        // now we send a back-signal to test
        socket.emit('back-signal', { data: ['nice','cozy','data'] });
    })
})

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});