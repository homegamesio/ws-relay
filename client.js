const http = require("http");
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

//const broadcastServer = `ws://54.176.82.103:82`;
const broadcastServer = `ws://localhost:82`;

const ws = new WebSocket(broadcastServer);

let socketReady = false;

ws.on('open', () => {
    socketReady = true;
});

ws.on('message', (msg) => {
    console.log('got a message from server');
    console.log(msg.toString());
});

setInterval(() => {
    if (socketReady) {
        ws.send('i am a client');
    }
}, 500);

