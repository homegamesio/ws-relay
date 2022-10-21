const http = require("http");
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

const relayServer = `ws://localhost:81`;

const ws = new WebSocket(relayServer);

let socketReady = false;

ws.on('open', () => {
    socketReady = true;
});

setInterval(() => {
    if (socketReady) {
        ws.send('ayy lmao!');
    }
}, 500);

