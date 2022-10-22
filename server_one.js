const http = require("http");
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

//const relayServer = `ws://54.176.82.103:81`;
const relayServer = `ws://localhost:81`;

const ws = new WebSocket(relayServer);

let socketReady = false;

ws.on('open', () => {
    socketReady = true;
});

ws.on('message', (message) => {
    console.log("got this message from a client");
    console.log(message.toString());
});

setInterval(() => {
    if (socketReady) {
        ws.send('ayy lmao!');
    }
}, 500);

// homegames server would be this in reality
