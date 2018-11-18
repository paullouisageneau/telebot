/*
 * Telebot signaling channel
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

// Simple channel with a peer
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
