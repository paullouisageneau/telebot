/*
 * Telebot server
 * Copyright (c) 2018 by Paul-Louis Ageneau
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const http = require('http');
const path = require('path');
const fs   = require('fs');

const sessions = {};
const usersInSessionLimit = 2;

const port = process.argv.length >= 3 ? process.argv[2] : 8081;

const serverDir = path.dirname(__filename);
const clientDir = path.join(serverDir, 'client/');

const contentTypes = {
	'htm':  'text/html;charset=utf-8',
	'html': 'text/html;charset=utf-8',
	'js':   'text/javascript',
	'css':  'text/css',
	'json': 'application/json',
	'ico':  'image/x-icon',
	'png':  'image/png',
	'jpg':  'image/jpeg',
	'jpeg': 'image/jpeg',
	'gif':  'image/gif',
	'apk':  'application/vnd.android.package-archive'
};

const defaultHeaders = {
	'Cache-Control': 'no-cache',
	'Pragma': 'no-cache',
	'Expires': '0'
};

const server = http.createServer((request, response) => {
	const parts = request.url.substring(1).split('/');
	const route = parts.shift();
	const headers = {};
	Object.assign(headers, defaultHeaders);

	switch(route) {
		// Server to client
		case 'stoc': {
			const sessionId = parts.shift();
			const userId = parts.shift();
			if (!sessionId || !userId) {
				response.writeHead(400);
				response.end();
				return;
			}
			
			console.log(`@${sessionId}: ${userId} joined`);
			
			headers['Content-Type'] = 'text/event-stream';
			response.writeHead(200, headers);
			
			response.write(`retry: 1000\n\n`);
			response.keepaliveInterval = setInterval(() => {
				response.write(`event: keepalive\n\n`);
			}, 5000);
			
			let session = sessions[sessionId];
			if(!session) {
				session = {
					users: {}
				};
				sessions[sessionId] = session;
			}
			
			let user = session.users[userId];
			if(!user) {
				if(Object.keys(session.users).length >= usersInSessionLimit) {
					console.log(`@${sessionId}: Limit for session reached`);
					response.write(`event: busy\ndata: ${sessionId}\n\n`);
					clearInterval(response.keepaliveInterval);
					response.end();
					return;
				}
				
				user = session.users[userId] = {};
				for(const pname in session.users) {
					const esResp = session.users[pname].esResponse;
					if(esResp) {
						esResp.write(`event: join\ndata: ${userId}\n\n`);
						response.write(`event: join\ndata: ${pname}\n\n`);
					}
				}
			}
			else if(user.esResponse) {
				console.log(`@${sessionId}: Replacing user ${userId}`);
				clearInterval(user.esResponse.keepaliveInterval);
				user.esResponse.end();
				user.esResponse = null;
			}
			
			request.on('close', () => {
				for(const pname in session.users) {
					if(pname == userId) continue;
					const esResp = session.users[pname].esResponse;
					if(esResp) {
						esResp.write(`event: leave\ndata: ${userId}\n\n`);
					}
				}
				delete session.users[userId];
				clearInterval(response.keepaliveInterval);
				console.log(`@${sessionId}: ${userId} left`);
				console.log(`@${sessionId}: ${Object.keys(session.users).length} users`);
			});
			
			response.on('error', (err) => {
				console.log(`@${sessionId}: ${userId}: ${err}`);
				request.emit('close');
			});
			
			user.esResponse = response;
			break;
		}
		
		
		// Client to server
		case 'ctos': {
			const sessionId = parts.shift();
			const userId = parts.shift();
			const peerId = parts.shift();
			const session = sessionId ? sessions[sessionId] : null;
			const peer = session ? session.users[peerId] : null;
			if (!sessionId || !userId || !session || !peer) {
				response.writeHead(400);
				response.end();
				return;
			}
			
			let body = '';
			request.on('data', (data) => { 
				body += data;
			});
			
			request.on('end', () => {
				const json = JSON.parse(body);
				console.log(`@${sessionId}: ${userId} => ${peerId}:`);
				console.log(body);
				peer.esResponse.write(`event: user-${userId}\ndata: ${body.replace(/\n/g, '\ndata: ')}\n\n`);
			});
			
			headers['Content-Type'] = 'text/plain';
			response.writeHead(204, headers);
			response.end();
			break;
		}
		
		// Status
		case 'status': {
			const sessionId = parts.shift();
			if (!sessionId) {
				response.writeHead(400);
				response.end();
				return;
			}
			
			headers['Content-Type'] = 'application/json';
			response.writeHead(200, headers);
			
			const session = sessions[sessionId];
			const count = session ? Object.keys(session.users).length : 0;
			const online = count >= 1 && Object.keys(session.users)[0][0] == '_';
			const busy = count >= usersInSessionLimit;
			
			response.write(JSON.stringify({
				session: sessionId, 
				status: (online ? (busy ? 'busy' : 'online') : 'offline')
			}));
			response.end();
			break;
		}
		
		// Files
		default: {
			const url = request.url.split('?', 1)[0];
			let filePath = path.join(clientDir, url);
			if(filePath.indexOf(clientDir) != 0 || filePath == clientDir)
				filePath = path.join(clientDir, '/index.html');
			
			fs.stat(filePath, (error, stats) => {
				if(error || !stats.isFile()) {
					console.log('Error: File not found: ' + filePath);
					response.writeHead(404);
					response.end('404 Not found');
					return;
				}
				
				const type = contentTypes[path.extname(filePath).substr(1)] || 'text/plain';
				response.writeHead(200, { 'Content-Type': type });
				
				const readStream = fs.createReadStream(filePath);
				readStream.on('error', () => {
					response.writeHead(500);
					response.end('500 Server error');
				});
				readStream.pipe(response);
			});
			break;
		}
	}
});

console.log(`Server listening on port ${port}`);
server.timeout = 10000;
server.listen(port);
