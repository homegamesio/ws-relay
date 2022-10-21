const http = require("http");
const fs = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

const server = http.createServer();
const broadcast = http.createServer();

const wss = new WebSocketServer({ server });

const broadcastServer = new WebSocketServer({ server: broadcast });

const clients = {};

wss.on('connection', (ws) => {
    console.log('wssss');
    ws.on('message', (message) => {
        Object.keys(clients).forEach(id => {
            console.log('need to relay message to client ' + id);
            clients[id] && clients[id].send(message);
        });
    });
});

let id = 1;
broadcastServer.on('connection', (ws) => {
    console.log('someone wants to listen');
    const wsId = id++;
    clients[wsId] = ws;

    ws.on('close', () => {
        clients[wsId] = null;
    });
});

server.listen(81);
broadcast.listen(82);


