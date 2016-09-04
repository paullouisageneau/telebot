/*
 * Copyright (c) 2014, Ericsson AB.
 * Copyright (c) 2015-2016, Paul-Louis Ageneau
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this
 * list of conditions and the following disclaimer in the documentation and/or other
 * materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
 * OF SUCH DAMAGE.
 */

// This is a modified version of OpenWebRTC simple signaling server
// https://github.com/EricssonResearch/openwebrtc-examples/blob/master/web/channel_server.js

var http = require("http");
var path = require("path");
var fs   = require("fs");

var sessions = {};
var usersInSessionLimit = 3;	// 2 + bot
var botUserId = "telebot";

var port = 8081;
if (process.argv.length == 3)
	port = process.argv[2];

var serverDir = path.dirname(__filename)
var clientDir = path.join(serverDir, "client/");

var contentTypes = {
	"htm":  "text/html;charset=utf-8",
	"html": "text/html;charset=utf-8",
	"js":   "text/javascript",
	"css":  "text/css",
	"json": "application/json",
	"ico":  "image/x-icon",
	"png":  "image/png",
	"jpg":  "image/jpeg",
	"jpeg": "image/jpeg",
	"gif":  "image/gif"
};

var defaultHeaders = {
	"Cache-Control": "no-cache, no-store",
	"Pragma": "no-cache",
	"Expires": "0"
};

var server = http.createServer(function (request, response) {
	var parts = request.url.split("/");
	var headers = defaultHeaders;
	
	// Server to client
	if(parts[1] == "stoc") {
		var sessionId = parts[2];
		var userId = parts[3];
		if (!sessionId || !userId) {
			response.writeHead(400);
			response.end();
			return;
		}
		
		console.log("@" + sessionId + " - " + userId + " joined.");
		
		headers["Content-Type"] = "text/event-stream";
		response.writeHead(200, headers);
		function keepAlive(resp) {
			resp.write(":\n");
			resp.keepAliveTimer = setTimeout(arguments.callee, 10000, resp);
		}
		keepAlive(response);  // flush headers + keep-alive
		
		var session = sessions[sessionId];
		if(!session) session = sessions[sessionId] = {"users" : {}};
		
		var user = session.users[userId];
		if(!user) {
			if((userId != botUserId && !session.users[botUserId] && Object.keys(session.users).length >= usersInSessionLimit - 1)
			|| (Object.keys(session.users).length >= usersInSessionLimit)) {
				console.log("Limit for session reached");
				response.write("event:busy\ndata:" + sessionId + "\n\n");
				clearTimeout(response.keepAliveTimer);
				response.end();
				return;
			}
			
			user = session.users[userId] = {};
			for (var pname in session.users) {
				var esResp = session.users[pname].esResponse;
				if (esResp) {
					clearTimeout(esResp.keepAliveTimer);
					keepAlive(esResp);
					esResp.write("event:join\ndata:" + userId + "\n\n");
					response.write("event:join\ndata:" + pname + "\n\n");
				}
			}
		}
		else if (user.esResponse) {
			user.esResponse.end();
			clearTimeout(user.esResponse.keepAliveTimer);
			user.esResponse = null;
		}
		
		user.esResponse = response;
		
		request.on("close", function() {
			for(var pname in session.users) {
				if (pname == userId) continue;
				var esResp = session.users[pname].esResponse;
				esResp.write("event:leave\ndata:" + userId + "\n\n");
			}
			delete session.users[userId];
			clearTimeout(response.keepAliveTimer);
			console.log("@" + sessionId + " - " + userId + " left.");
			console.log("users in session " + sessionId + ": " + Object.keys(session.users).length);
		});
	}
	// Client to server
	else if(parts[1] == "ctos") {
		var sessionId = parts[2];
		var userId = parts[3];
		var peerId = parts[4];
		var session = sessionId ? sessions[sessionId] : null;
		var peer = session ? session.users[peerId] : null;
		if (!sessionId || !userId || !session || !peer) {
			response.writeHead(400);
			response.end();
			return;
		}
		
		var body = "";
		request.on("data", function(data) { 
			body += data;
		});
		request.on("end", function() {
			var json = JSON.parse(body);
			if(json.control) {
				peerId = botUserId;
				if(!(peer = session.users[peerId]))
					return;
			}
			console.log("@" + sessionId + " - " + userId + " => " + peerId + " :");
			console.log(body);
			var evtdata = "data:" + body.replace(/\n/g, "\ndata:") + "\n";
			peer.esResponse.write("event:user-" + userId + "\n" + evtdata + "\n");
		});
		
		headers["Content-Type"] = "text/plain";
		response.writeHead(204, headers);
		response.end();
	}
	else if(parts[1] == "status") {
		var sessionId = parts[2];
		if (!sessionId) {
			response.writeHead(400);
			response.end();
			return;
		}

		headers["Content-Type"] = "application/json";
		response.writeHead(200, headers);

		var session = sessions[sessionId];
		var online = Boolean(session && session.users[botUserId]);
		var busy = Boolean(session && Object.keys(session.users).length >= usersInSessionLimit);
		
		response.write(JSON.stringify({"session": sessionId, "status": (online ? (busy ? "busy" : "online") : "offline")}));
		response.end();
		return;
	}
	
	var url = request.url.split("?", 1)[0];
	var filePath = path.join(clientDir, url);
	if (filePath.indexOf(clientDir) != 0 || filePath == clientDir)
		filePath = path.join(clientDir, "/index.html");
	
	fs.stat(filePath, function (error, stats) {
		if(error || !stats.isFile()) {
			response.writeHead(404);
			response.end("404 Not found");
			return;
		}
		
		var type = contentTypes[path.extname(filePath).substr(1)] || "text/plain";
		response.writeHead(200, { "Content-Type": type });
		
		var readStream = fs.createReadStream(filePath);
		readStream.on("error", function () {
			response.writeHead(500);
			response.end("500 Server error");
		});
		readStream.pipe(response);
	});
});

console.log('Server listening on port ' + port);
server.timeout = 20000;
server.listen(port);
