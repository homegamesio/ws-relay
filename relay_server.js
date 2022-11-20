const http = require("http");
const https = require("https");
const fs = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');
const crypto = require('crypto');
const process = require('process');

const server = process.env.CERT_PATH && process.env.KEY_PATH ? https.createServer({ key: fs.readFileSync(process.env.KEY_PATH), cert: fs.readFileSync(process.env.CERT_PATH) }) : http.createServer();

const broadcast =  process.env.CERT_PATH && process.env.KEY_PATH ? https.createServer({ key: fs.readFileSync(process.env.KEY_PATH), cert: fs.readFileSync(process.env.CERT_PATH) }) : http.createServer();

const wss = new WebSocketServer({ server });

const broadcastServer = new WebSocketServer({ server: broadcast });

const clients = {};

const servers = {};

let _serverId = 1;

const generateCode = () => crypto.randomBytes(2).toString('hex').toUpperCase();

const sessionCodes = {};

wss.on('connection', (ws) => {
    const serverId = _serverId++;
    servers[serverId] = ws;

    console.log('a broadcaster just connected to me');

    const serverCode = generateCode();
    sessionCodes[serverCode] = serverId;
    const codePayload = {
        type: 'code',
        code: serverCode
    };

    ws.send(JSON.stringify(codePayload));

    ws.on('close', () => {
        servers[serverId] = null;
	sessionCodes[serverCode] = null;
    });

    ws.on('message', (message) => {
        Object.keys(clients).forEach(id => {
            clients[id] && clients[id].send(message);
        });
    });
});

let id = 1;
broadcastServer.on('connection', (ws) => {
    console.log('someone wants to listen');
    const wsId = id++;
    clients[wsId] = ws;
    let clientCode;
    let connectedHgServer;
    ws.on('message', (message) => {
	// first message should be code
	if (!clientCode) {
	    const codePayload = JSON.parse(message);
	    if (codePayload.type === 'code') {
		clientCode = codePayload.code;
		const requestedServerId = sessionCodes[clientCode];
		if (!requestedServerId || !servers[requestedServerId]) {
		  ws.send('error: bad code supplied');
		  ws.close();
		} else {
			connectedHgServer = servers[requestedServerId];
		}
	    } else {
		console.log('bad message from public client');
		console.log(codePayload);
	    }
	} else {
	   if (!connectedHgServer) {
		console.error('not connected to hg server');
	   } else {
                connectedHgServer.send(message);
	   }
	}
    });

    ws.on('close', () => {
        clients[wsId] = null;
    });
});

server.listen(81);
broadcast.listen(82);
