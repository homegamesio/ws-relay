const http = require('http');
const https = require('https');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const process = require('process');

const isSecure = process.env.CERT_PATH && process.env.KEY_PATH;

const broadcastListenerServer = isSecure ? https.createServer({ key: fs.readFileSync(process.env.KEY_PATH), cert: fs.readFileSync(process.env.CERT_PATH) }) : http.createServer();

const broadcasterServer =  isSecure ? https.createServer({ key: fs.readFileSync(process.env.KEY_PATH), cert: fs.readFileSync(process.env.CERT_PATH) }) : http.createServer();

const broadcastListenerSocket = new WebSocketServer({ server: broadcastListenerServer });

const broadcasterSocket = new WebSocketServer({ server: broadcasterServer });

const clients = {};

const servers = {};

let _serverId = 1;

const generateCode = () => crypto.randomBytes(2).toString('hex').toUpperCase();

const sessionCodes = {};

const internalToClientIds = {};

// which server is a person in
const consumerIdToServerId = {};

const invertMap = (map) => {
    const inverted = {};
    for (const key in map) {
        inverted[map[key]] = key;
    }
    return inverted;
};

broadcastListenerSocket.on('connection', (ws) => {
    const serverId = _serverId++;
    servers[serverId] = ws;
    internalToClientIds[serverId] = {};

    const serverCode = generateCode();
    sessionCodes[serverCode] = serverId;
    const codePayload = {
        type: 'code',
        code: serverCode
    };

    ws.send(JSON.stringify(codePayload));

    ws.on('close', () => {
        delete servers[serverId];
        delete sessionCodes[serverCode];

        delete internalToClientIds[serverId];

        const serverIdsToClientIds = invertMap(consumerIdToServerId);
	let keysToDelete = [];
	for (let key in consumerIdToServerId) {
		if (consumerIdToServerId[key] === serverId) {
			keysToDelete.push(key);
		}
	}
	for (let i in keysToDelete) {
		delete consumerIdToServerId[keysToDelete[i]];
	}
    });

    ws.on('message', (message) => {
        if (message.toString().startsWith('idres-')) {
            const pieces = message.toString().split('-');
            if (pieces.length == 3) {
                if (!internalToClientIds[serverId]) {
                    internalToClientIds[serverId] = {};
                }
                internalToClientIds[serverId][pieces[1]] = pieces[2];
                consumerIdToServerId[pieces[1]] = serverId;
                const clientToNotify = clients[pieces[1]];
                clientToNotify.send([2, pieces[2]]);
            }
        } else {
            if (message[0] === 2) {
                // init message, pull client id
                const clientToInternalIds = invertMap(internalToClientIds[serverId]);
                const serverClientId = message[1];
                const realClient = clients[clientToInternalIds[serverClientId]];
                realClient && realClient.send(message);
            } else if (message[0] === 199) {
            // standard proxy message, pull client id
                const clientToInternalIds = invertMap(internalToClientIds[serverId]);
                const serverClientId = message[1];
                const realClient = clients[clientToInternalIds[serverClientId]];
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
broadcasterSocket.on('connection', (ws) => {
    const wsId = id++;
    clients[Number(wsId)] = ws;
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
                    connectedHgServer.send('idreq-' + wsId);
                }
            } else {
                console.log('bad message from public client');
                console.log(codePayload);
            }
        } else {
            if (!connectedHgServer) {
                console.error('not connected to hg server');
            } else {
                const connectedServerId = consumerIdToServerId[wsId];
                if (connectedServerId) {
                    const serverClientId = internalToClientIds[connectedServerId][wsId];
                    connectedHgServer.send([serverClientId, ...message]);
                }
            }
        }
    });

    ws.on('close', () => {
        clients[wsId] = null;
        const connectedServerId = consumerIdToServerId[wsId];
        if (connectedServerId) {
            const serverClientId = internalToClientIds[connectedServerId][wsId];
            connectedHgServer && connectedHgServer.send('close-' + serverClientId);
            delete internalToClientIds[connectedServerId][wsId];
            delete consumerIdToServerId[wsId];
        }
    });
});

broadcastListenerServer.listen(81);
broadcasterServer.listen(82);
