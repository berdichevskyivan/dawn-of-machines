import io from 'socket.io-client';

// const URL = 'http://localhost:3000';
// Multiplayer Dev Mode
const URL = 'http://192.168.100.232:3000';
export const socket = io(URL, { autoConnect: false, transports: ['websocket'] });