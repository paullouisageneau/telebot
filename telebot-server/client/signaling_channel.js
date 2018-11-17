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
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND
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

// Simple signaling channel implementation
class SignalingChannel {
	constructor(sessionId, userId) {
		this.sessionId = sessionId;
		this.userId = userId;
		this.onpeer = null;
		this.onbusy = null;
		this.channels = {};
		
		const es = new EventSource(`stoc/${sessionId}/${userId}`);
		this.es = es;
		
		es.addEventListener('join', (evt) => {
			const peerUserId = evt.data;
			this.createPeer(peerUserId);
		});
		
		es.addEventListener('leave', (evt) => {
			const peerUserId = evt.data;
			this.removePeer(peerUserId);
		});
		
		es.addEventListener('busy', () => {
			this.emitBusy();
		});
		
		this.userDataCallback = (evt) => {
			const peerUserId = evt.type.split('-')[1];
			this.recv(peerUserId, evt.data);
		};
	}
	
	createPeer(peerUserId) {
		const channel = new PeerChannel(`ctos/${this.sessionId}/${this.userId}/${peerUserId}`);
		this.channels[peerUserId] = channel;
		this.es.addEventListener(`user-${peerUserId}`, this.userDataCallback);
		this.emitPeer(peerUserId, channel);
	}
	
	removePeer(peerUserId) {
		this.es.removeEventListener(`user-${peerUserId}`, this.userDataCallback);
		const channel = this.channels[peerUserId];
		if(channel) {
			channel.emitDisconnect();
			delete this.channels[peerUserId];
		}
	}
	
	recv(peerUserId, data) {
		const channel = this.channels[peerUserId];
		if(channel) channel.emitMessage(data);
	}
	
	send(peerUserId, data) {
		const channel = this.channels[peerUserId];
		if(channel) channel.send(data);
	}
	
	emitPeer(peerUserId, channel) {
		if(this.onpeer) this.onpeer({
			type: 'peer',
			peer: channel,
			userid: peerUserId
		});
	}
	
	emitBusy() {
		if(this.onbusy) this.onbusy({
			type: 'busy'
		});
	}
	
	close() {
		this.es.close();
	}
}

// Simple signaling channel with a peer
class PeerChannel {
	constructor(url) {
		this.url = url;
		this.onmessage = null;
		this.ondisconnect = null;
		this.queue = [];
	}
	
	send(message) {
		if(this.queue.push(message) == 1) this._process();
	}
	
	emitMessage(data) {
		if(this.onmessage) this.onmessage({
			type: 'message',
			data: data
		});
	}
	
	emitDisconnect() {
		if(this.ondisconnect) this.ondisconnect({
			type: 'disconnect'
		});
	}
	
	_process() {
		fetch(this.url, {
			method: 'POST',
			body: this.queue[0],
			headers: {
				'Content-Type': 'text/plain'
			}
		})
		.then((response) => {
			if(!response.ok) throw Error(response.statusText);
		})
		.catch((err) => {
			console.error(err);
		})
		.finally(() => {
			this.queue.shift();
			if(this.queue.length > 0) this._process();
		});
	}
}
