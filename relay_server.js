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

const internalToClientIds = {};

wss.on('connection', (ws) => {
    const serverId = _serverId++;
    servers[serverId] = ws;
    internalToClientIds[serverId] = {};

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
	if (message.toString().startsWith('gimmeidresponse-')) {
		console.log('got id response thing');
		console.log(message);
		const pieces = message.toString().split('-');
		if (pieces.length == 3) {
			if (!internalToClientIds[serverId]) {
				internalToClientIds[serverId] = {};
			}
			internalToClientIds[serverId][pieces[1]] = pieces[2];
			console.log('id map');
			console.log(internalToClientIds);
			const clientToNotify = clients[pieces[1]];
			clientToNotify.send([2, pieces[2]]);
		}
	} else {
		if (message[0] === 2) {
		// init message, pull client id
			const lol = {};
			for (let key in internalToClientIds[serverId]) {
				lol[Number(internalToClientIds[serverId][key])] = Number(key);
			}
			const serverClientId = message[1];
			console.log('looks like im sending more info about this ' + serverClientId + ', fsdfds' + serverId);
			console.log(lol);
			console.log(internalToClientIds);
			const realClient = clients[lol[serverClientId]];
			realClient.send(message);
		} else if (message[0] === 199) {
		    // standard proxy message, pull client id
		    console.log(internalToClientIds);	
			const lol = {};
			for (let key in internalToClientIds[serverId]) {
				lol[Number(internalToClientIds[serverId][key])] = Number(key);
			}
			const serverClientId = message[1];
		        console.log('looks like im passing a message to this ' + serverClientId + ' gs ' + serverId);
			console.log(internalToClientIds);
			const realClient = clients[lol[serverClientId]];
			realClient.send(message.slice(2));
	
		} else {
		// something else
                    Object.keys(clients).forEach(id => {
                        clients[id] && clients[id].send(message);
                    });
		}
	}
    });
});

let id = 1;
broadcastServer.on('connection', (ws) => {
    console.log('someone wants to listen');
    const wsId = id++;
    clients[wsId] = ws;
    let clientCode;
    let clientId;
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
			console.log('just did this. requesting player ID from game server');
//			ws.send(JSON.stringify({type: 'id', payload: '' + wsId}));
			connectedHgServer = servers[requestedServerId];
			connectedHgServer.send('gimmeid-' + wsId);
		}
	    } else {
		console.log('bad message from public client');
		console.log(codePayload);
	    }
	//}// else if (!clientId) {
	//	console.log('please tell me this is an ayylmao message');
	//	console.log(message);
	//	console.log(message.toString());
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
