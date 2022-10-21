const http = require("http");
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

const broadcastServer = `ws://localhost:82`;

const ws = new WebSocket(broadcastServer);

let socketReady = false;

ws.on('open', () => {
    socketReady = true;
});

ws.on('message', (msg) => {
    console.log('got a message from relay server');
    console.log(msg);
    console.log(msg.toString());
});

