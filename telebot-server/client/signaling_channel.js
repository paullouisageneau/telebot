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

// This is a modified version of OpenWebRTC simple signaling channel
// https://github.com/EricssonResearch/openwebrtc-examples/blob/master/web/client/signaling_channel.js

function SignalingChannel(sessionId, userId) {
	if(!sessionId) sessionId = createId();
	if(!userId) userId = createId();
	
	var channels = {};
	var listeners = {
		"onpeer": null,
		"onbusy": null
	};
	
	for(var name in listeners)
		Object.defineProperty(this, name, createEventListenerDescriptor(name, listeners));
	
	function createId() {
		return Math.random().toString(16).substr(2);
	};
	
	var es = new EventSource("stoc/" + sessionId + "/" + userId);
	
	this.close = function() {
		es.close();
	}
	
	es.onerror = function() {
		es.close();
	};
	
	es.addEventListener("join", function (evt) {
		var peerUserId = evt.data;
		console.log("join: " + peerUserId);
		var channel = new PeerChannel(peerUserId);
		channels[peerUserId] = channel;
		
		es.addEventListener("user-" + peerUserId, userDataHandler, false);
		fireEvent({ "type": "peer", "peer": channel, "userid": peerUserId }, listeners);
	}, false);
	
	function userDataHandler(evt) {
		var peerUserId = evt.type.substr(5); // discard "user-" part
		var channel = channels[peerUserId];
		if (channel)
		channel.didGetData(evt.data);
	}
	
	es.addEventListener("leave", function (evt) {
		var peerUserId = evt.data;
		
		es.removeEventListener("user-" + peerUserId, userDataHandler, false);
		
		channels[peerUserId].didLeave();
		delete channels[peerUserId];
	}, false);
	
	es.addEventListener("busy", function () {
		fireEvent({ "type": "busy" }, listeners);
		es.close();
	}, false);
	
	function PeerChannel(peerUserId) {
		var listeners = {
			"onmessage": null,
			"ondisconnect": null
		};
		
		for (var name in listeners)
			Object.defineProperty(this, name, createEventListenerDescriptor(name, listeners));
		
		this.didGetData = function(data) {
			fireEvent({"type": "message", "data": data }, listeners);
		};
		
		this.didLeave = function() {
			fireEvent({"type": "disconnect" }, listeners);
		};
		
		var sendQueue = []
		function processSendQueue() {
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "ctos/" + sessionId + "/" + userId + "/" + peerUserId);
			xhr.setRequestHeader("Content-Type", "text/plain");
			xhr.send(sendQueue[0]);
			xhr.onreadystatechange = function () {
				if (xhr.readyState == xhr.DONE) {
					sendQueue.shift();
					if (sendQueue.length > 0) processSendQueue();
				}
			};
		}
		
		this.send = function (message) {
		if (sendQueue.push(message) == 1)
			processSendQueue();
		};
	}
	
	function createEventListenerDescriptor(name, listeners) {
		return {
			"get": function() { return listeners[name]; },
			"set": function(cb) { listeners[name] = cb instanceof Function ? cb : null; },
			"enumerable": true
		};
	}
	
	function fireEvent(evt, listeners) {
		var listener = listeners["on" + evt.type]
		if(listener) listener(evt);
	}
}

