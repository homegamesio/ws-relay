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
		const pieces = message.toString().split('-');
		if (pieces.length == 3) {
			if (!internalToClientIds[serverId]) {
				internalToClientIds[serverId] = {};
			}
			internalToClientIds[serverId][pieces[1]] = pieces[2];
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
			const realClient = clients[lol[serverClientId]];
			realClient && realClient.send(message);
		} else if (message[0] === 199) {
		    // standard proxy message, pull client id
			const lol = {};
			for (let key in internalToClientIds[serverId]) {
				lol[Number(internalToClientIds[serverId][key])] = Number(key);
			}

			const serverClientId = message[1];
			const realClient = clients[lol[serverClientId]];
			realClient && realClient.send(message.slice(2));
	
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
    const wsId = id++;
    clients[Number(wsId)] = ws;
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
//			ws.send(JSON.stringify({type: 'id', payload: '' + wsId}));
			connectedHgServer = servers[requestedServerId];
			connectedHgServer.send('gimmeid-' + wsId);
		}
//	    }
		//else if (codePayload.type === 'ready') {
		//    console.log('dasfsdfsdfdsf');
		//    console.log(codePayload);
		//// reconnecting from existing known session (eg. spectator to player or vice versa)
		//if (codePayload.code) {
		//	console.log('dsfdsfdsf');
		//	console.log(codePayload);
		//	clientCode = codePayload.code;
		//	const requestedServerId = sessionCodes[clientCode];
		//	if (!requestedServerId || !servers[requestedServerId]) {
		//  		ws.send('error: bad code supplied');
		//  		ws.close();
		//	} 
		//	console.log('sending this here to the thing');
		//	console.log(message.toString());
		//	connectedHgServer = servers[requestedServerId];
		//	connectedHgServer.send('gimmeid-' + wsId);
	
                //	servers[requestedServerId].send(message);
	
		//}
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
