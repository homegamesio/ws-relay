const http = require("http");
const fs = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

const server = http.createServer();
const broadcast = http.createServer();

const wss = new WebSocketServer({ server });

const broadcastServer = new WebSocketServer({ server: broadcast });

const clients = {};

const servers = {};

let _serverId = 1;
wss.on('connection', (ws) => {
    const serverId = _serverId++;
    servers[serverId] = ws;

    ws.on('close', () => {
        servers[serverId] = null;
    });

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

    ws.on('message', (message) => {
        console.log('need to send this back to the things connected to me');
        Object.keys(servers).forEach(serverId => {
            servers[serverId] && servers[serverId].send(message);
        });
    });

    ws.on('close', () => {
        clients[wsId] = null;
    });
});

server.listen(81);
broadcast.listen(82);


