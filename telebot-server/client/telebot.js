/*
 * Copyright (c) 2015-2018, Paul-Louis Ageneau
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

// WebRTC configuration
const rtcConfiguration = {
	rtcpMuxPolicy: 'require',
	bundlePolicy: 'balanced',
	iceServers: [{
		urls: 'stun:stun.ageneau.net:3478'
	},
	{
		urls: 'turn:stun.ageneau.net:3478',
		credential: '982364878597767',
		username: 'telebot'
	}]
};

// Media recorder options
const recorderOptions = {
	mimeType: 'video/webm',
	audioBitsPerSecond:  64000,	// sufficient for Opus
	videoBitsPerSecond: 640000	// 500-1000Kbps should be OK
};

// Local control API
const localControlUrl = 'http://127.0.0.1:11698/control';

// Global variables
let active = true;
let sessionId = '';
let userId = '';

let signaling;
let controlChannel;
let peerConnection;
let peer;
let localStream;
let remoteStream;
let recorder;

let selfView;
let remoteView;
let callButton;
let callContainer;
let videoContainer;
let controlContainer;
let arrowUp;
let arrowDown;
let arrowLeft;
let arrowRight;
let buttonRecord;
let buttonSpeed;
let logo;
let footer;

let controlUp    = false;
let controlDown  = false;
let controlLeft  = false;
let controlRight = false;

let oldStatus = 'online';
let displayMessageTimeout = null;

// Set orientation to 0 if not defined
window.orientation = window.orientation || 0;

// Initialization function
function init() {
	// Session and mode from hash
	let hash = window.location.hash.substr(1);
	if(hash && hash[0] == '_') {
		// Leading '_' enables passive mode
		if(!sessionStorage.mode) sessionStorage.mode = 'passive';
		hash = hash.substr(1);
		window.location.href = `${window.location.href.split('#')[0]}#${hash}`;
	}

	if(!sessionStorage.mode) sessionStorage.mode = 'active';
	active = (sessionStorage.mode != 'passive');
	sessionId = hash;
	if(!userId) userId = (active ? '' : '_') + Math.random().toString(16).substr(2);
	
	if(!active) {
		// If not active, switch to dark background
		document.body.style.background = '#000000';
		document.body.style.color = '#FFFFFF';
		logo.style.visibility = 'hidden';
		footer.style.visibility = 'hidden';
		callButton.style.visibility = 'hidden';
	}
	
	// Initialize everything
	if(signaling) signaling.close();
	if(controlChannel) controlChannel.close();
	if(peerConnection) peerConnection.close();
	signaling = null;
	controlChannel = null;
	peerConnection = null;
	peer = null;
	remoteStream = null;
	remoteView.style.visibility = 'hidden';
	logoContainer.style.display = 'block';
	footer.style.display = 'block';
	callContainer.style.display = 'block';
	sessionContainer.style.display = 'none';
	videoContainer.style.display = 'none';
	controlContainer.style.display = 'none';
	callButton.disabled = true;
	if(buttonRecord) buttonRecord.style.filter = 'grayscale(100%)';
	if(buttonSpeed) buttonSpeed.style.filter = 'grayscale(100%)';
	
	// If no session is specified, hide call container
	if(!sessionId) callContainer.style.display = 'none';

	if(active) {
		// If no session is specified, show session selector
		if(!sessionId) {
			sessionContainer.style.display = 'block';
			sessionButton.onclick = () => {
				hash = encodeURIComponent(sessionText.value);
				window.location.href = `${window.location.href.split('#')[0]}#${hash}`;
			};
			sessionText.onkeyup = (evt) => {
				evt.preventDefault();
				if(evt.keyCode == 13) {
					sessionButton.click();
				}
			};
			sessionText.focus();
			return;
		}
		
		// Refresh status
		requestStatus();
	}
	else {
		initLocalControl(); // Reset local control
		
		document.body.onclick = () => {
			requestFullScreen(document.body);
		}
	}
};

window.onload = () => {
	// Get elements ids
	selfView = document.getElementById('self_view');
	remoteView = document.getElementById('remote_view');
	logoContainer = document.getElementById('logo_container');
	sessionContainer = document.getElementById('session_container');
	sessionText = document.getElementById('session_text');
	sessionButton = document.getElementById('session_button');
	callContainer = document.getElementById('call_container');
	callButton = document.getElementById('call_button');
	videoContainer  = document.getElementById('video_container');
	controlContainer = document.getElementById('control_container');
	arrowUp    = document.getElementById('arrow_up');
	arrowDown  = document.getElementById('arrow_down');
	arrowLeft  = document.getElementById('arrow_left');
	arrowRight = document.getElementById('arrow_right');
	buttonRecord = document.getElementById('button_record');
	buttonSpeed = document.getElementById('button_speed');
	logo = document.getElementById('logo');
	footer = document.getElementById('footer');

	// Initialize
	init();

	// Check WebRTC is available
	if(!navigator.mediaDevices.getUserMedia || !RTCPeerConnection) {
		displayMessage('Browser not compatible');
		clearTimeout(displayMessageTimeout);
		return;
	}
	
	// By default, call button ask for media
	if(active) {
		callButton.onclick = () => {
			displayMessage('Access to media device not allowed');
		};
	}

	// Get a local stream
	const constraints = { audio: true, video: true }; 
	navigator.mediaDevices.getUserMedia(constraints)
		.then((stream) => {
			localStream = stream;
			
			// Set self view
			selfView.srcObject = stream;
			selfView.style.visibility = 'visible';
			selfView.onloadedmetadata = () => {
				selfView.play();
			};
			
			if(active) {
				// If active, call button triggers peerJoin()
				callButton.onclick = () => {
					callButton.disabled = true;
					peerJoin();
				};
			}
			else {
				// If not active, call peerJoin() directly
				peerJoin();
			}
		})
		.catch((err) => { 
			logError(err);
			callContainer.style.display = 'none';
			sessionContainer.style.display = 'none';
			displayMessage('Media device not available');
			clearTimeout(displayMessageTimeout);
		});
		
	if(active) {
		// Request notification permission
		if(Notification && Notification.permission != 'granted') {
			Notification.requestPermission((permission) => {
				console.log(permission);
			});
		}
		
		// Handle mouse down on arrows
		arrowUp.onmousedown = (evt) => {
			evt.preventDefault();
			if(!controlUp) {
				controlUp = true;
				updateControl();
			}
		};
		arrowDown.onmousedown = (evt) => {
			evt.preventDefault();
			if(!controlDown) {
				controlDown = true;
				updateControl();
			}
		};
		arrowLeft.onmousedown = (evt) => {
			evt.preventDefault();
			if(!controlLeft) {
				controlLeft = true;
				updateControl();
			}
		};
		arrowRight.onmousedown = (evt) => {
			evt.preventDefault();
			if(!controlRight) {
				controlRight = true;
				updateControl();
			}
		};
		
		// Handle mouse up on arrows
		arrowUp.onmouseup = (evt) => {
			controlUp = false;
			updateControl();
		};
		arrowDown.onmouseup = (evt) => {
			controlDown = false;
			updateControl();
		};
		arrowLeft.onmouseup = (evt) => {
			controlLeft = false;
			updateControl();
		};
		arrowRight.onmouseup = (evt) => {
			controlRight = false;
			updateControl();
		};
		
		// Handle touchscreens
		if('ontouchstart' in document.documentElement) {
			// touch start
			arrowUp.ontouchstart = arrowUp.onmousedown;
			arrowDown.ontouchstart = arrowDown.onmousedown;
			arrowLeft.ontouchstart = arrowLeft.onmousedown;
			arrowRight.ontouchstart = arrowRight.onmousedown;
			// touch end
			arrowUp.ontouchend = arrowUp.onmouseup;
			arrowDown.ontouchend = arrowDown.onmouseup;
			arrowLeft.ontouchend = arrowLeft.onmouseup;
			arrowRight.ontouchend = arrowRight.onmouseup;
		}
		
		// Set key callbacks
		document.onkeydown = handleKeyDown;
		document.onkeyup = handleKeyUp;
		
		// Set speed button
		if(buttonSpeed) {
			buttonSpeed.onclick = () => {
				if(buttonSpeed.style.filter != 'none')
					buttonSpeed.style.filter = 'none';
				else buttonSpeed.style.filter = 'grayscale(100%)';
			};
		}
		
		// Set status callback
		setInterval(() => { 
			requestStatus();
		}, 10000);
	}
}

window.onhashchange = () => {
	// Re-initialize
	init();
}

// Callback for status request
function requestStatus() {
	if(!sessionId) return;
	
	fetch(`status/${sessionId}`)
		.then((response) => {
			if(!response.ok) throw Error(response.statusText);
			return response.json();
		})
		.then((data) => {
			const name = `Telebot '${sessionId}'`;
			if(data.status == 'online') {
				displayStatus(`${name} is online!`);
				callButton.disabled = false;
				if(Notification && oldStatus != 'online') {
					const notif = new Notification('Telebot', {
						body: `${name} is now online!`
					});
				}
			}
			else if(data.status == 'busy') {
				displayStatus(`${name} is busy, please wait...`);
				callButton.disabled = true;
			}
			else {
				displayStatus(`${name} is offline, please wait...`);
				callButton.disabled = true;
			}
			oldStatus = data.status;
		})
		.catch((err) => {
			displayStatus('');
			console.error(err);
		});
}

// Callback for key down
function handleKeyDown(evt) {
	switch (evt.keyCode) {
	case 37: // left
		if(!controlLeft) {
			controlLeft = true;
			updateControl();
		}
		break;
	case 38: // up
		if(!controlUp) {
			controlUp = true;
			updateControl();
		}
		break;
	case 39: // right
		if(!controlRight) {
			controlRight = true;
			updateControl();
		}
		break;
	case 40: // down
		if(!controlDown) {
			controlDown = true;
			updateControl();
		}
		break;
	}
}

// Callback for key up
function handleKeyUp(evt) {
	switch (evt.keyCode) {
	case 37: // left
		controlLeft = false;
		updateControl();
		break;
	case 38: // up
		controlUp = false;
		updateControl();
		break;
	case 39: // right
		controlRight = false;
		updateControl();
		break;
	case 40: // down
		controlDown = false;
		updateControl();
		break;
	}
}

// Try to join peer
function peerJoin() {
	// This can be long, display proper message
	if(active) displayMessage('Calling...');
	else displayMessage('Ready\n\n'+sessionId);
	
	// Create signaling channel
	signaling = new SignalingChannel(sessionId, userId);
	
	// Set unavailability timeout if active
	let timeout = null;
	if(active) {
		timeout = setTimeout(() => {
			requestStatus();
			displayMessage('Unavailable');
			signaling.close();
			signaling = null;
			callButton.disabled = false;
		}, 5000);
	}
	
	// Handle busy session
	signaling.onbusy = (evt) => {
		if(active) requestStatus();
		displayMessage('Busy, retry later');
		signaling.close();
		signaling = null;
		if(active) callButton.disabled = false;
	};
	
	// Handle incoming peer
	signaling.onpeer = (evt) => {
		if(active && evt.userid[0] != '_') return;
		
		if(timeout) clearTimeout(timeout);
		peer = evt.peer;
		
		peer.onmessage = handleMessage;
		peer.ondisconnect = handleDisconnect;
		
		// Send orientation changes to peer
		/*window.onorientationchange = () => {
			if(peer) peer.send(JSON.stringify({
				orientation: window.orientation
			}));
		};*/
		
		// If active, schedule session initiation now
		if(active) {
			setTimeout(() => {
				start(true);
			}, 500);
		}
	};
	
	// Properly close signaling channel is window is closed
	window.onbeforeunload = () => {
		if(signaling) signaling.close();
		signaling = null;
		return null;
	};
}

// Handle signaling messages received from peer
function handleMessage(evt) {
	const message = JSON.parse(evt.data);
	
	if(!peerConnection && (message.sdp || message.candidate)) {
		start(false);
	}
	
	if(message.sdp) {
		// Parse session description
		const description = new RTCSessionDescription({
			sdp: message.sdp,
			type: message.type
		});
		// Set remote description
		peerConnection.setRemoteDescription(description)
			.then(() => {
				// If this is an offer, answer it
				if(peerConnection.remoteDescription.type == 'offer') {
					peerConnection.createAnswer()
						.then(localDescCreated)
						.catch(logError);
				}
			})
			.catch(logError);
	}
	
	if(message.candidate) {
		peerConnection.addIceCandidate(new RTCIceCandidate(message)).catch(logError);
	}
	
	if(message.orientation) {
		if(remoteView) {
			remoteView.style.transform = `rotate(${message.orientation}deg)`;
		}
	}
	
	if(message.control && !active) {
		const left = Math.floor(message.control.left);
		const right = Math.floor(message.control.right);
		localControl(left, right);
	}
}

function handleDisconnect() {
	if(peerConnection) peerConnection.close();
	if(signaling) signaling.close();
	signaling = null;
	peerConnection = null;
	peer = null;
	remoteStream = null;
	
	// Hide videos and display call container
	remoteView.style.visibility = 'hidden';
	videoContainer.style.display = 'none';
	controlContainer.style.display = 'none';
	callContainer.style.display = 'block';
	logoContainer.style.display = 'block';
	footer.style.display = 'block';
	
	if(active) {
		displayMessage('Disconnected');
		callButton.disabled = false;
	}
	else {
		localControl(0, 0);
		peerJoin();
	}
}

// Initiate the session
function start(isInitiator) {
	// Clear message
	displayMessage('');
	
	videoContainer.style.display = 'block';
	callContainer.style.display = 'none';
	logoContainer.style.display = 'none';
	footer.style.display = 'none';
	
	// Create peer connection with the given configuration
	peerConnection = new RTCPeerConnection(rtcConfiguration);
	
	// Send all ICE candidates to peer
	peerConnection.onicecandidate = (evt) => {
		if (evt.candidate) {
			const { candidate, sdpMid, sdpMLineIndex } = evt.candidate;
			peer.send(JSON.stringify({
				candidate,
				sdpMid,
				sdpMLineIndex
			}));
		}
	};
	
	// Once we get the remote stream
	peerConnection.ontrack = (evt) => {
		remoteStream = evt.streams[0];
		
		// Set remote view
		remoteView.srcObject = remoteStream;
		remoteView.style.visibility = 'visible';
		remoteView.onloadedmetadata = (evt) => {
			remoteView.play();
		};

		if(active) {
			// Display controls
			controlContainer.style.display = 'block';
		
			// Set recording button
			if(buttonRecord) buttonRecord.onclick = () => {
				startRecording();
			};
		}
	};
	
	// Add local stream
	for (const track of localStream.getTracks()) {
		peerConnection.addTrack(track, localStream);
	}

	if(active) {
		// Create control data channel
		const controlChannelOptions = {
			ordered: true
		};
		controlChannel = peerConnection.createDataChannel('control', controlChannelOptions);
	}
	else {
		// Accept control data channel
		peerConnection.ondatachannel = (evt) => {
			if(evt.channel.label == 'control') {
				controlChannel = evt.channel;
				controlChannel.onmessage = (evt) => {
					const message = JSON.parse(evt.data);
					if(message.control) {
						const { left, right } = message.control;
						localControl(Math.floor(left), Math.floor(right));
					}
				};
				controlChannel.onerror = (err) => {
					console.error(err);
					handleDisconnect();
				};
				controlChannel.onclose = handleDisconnect;
			}
		};
	}
	
	if(isInitiator) {
		peerConnection.createOffer()
			.then(localDescCreated)
			.catch(logError);
	}
}

// Handle local session description
function localDescCreated(desc) {
	peerConnection.setLocalDescription(desc)
		.then(() => {
			peer.send(JSON.stringify({
				sdp: peerConnection.localDescription.sdp,
				type: peerConnection.localDescription.type
			}));
		})
		.catch(logError);
}

// Send new controls to peer
function updateControl() {
	if(controlContainer.style.display == 'none')
		return;
	
	let left  = 0;
	let right = 0;
	if(controlUp) {
		left += 1;
		right+= 1;
	}
	if(controlDown) {
		left += -0.70;
		right+= -0.70;
	}
	if(controlLeft) {
		left = Math.min(left  - 0.50, 0);
		right= Math.max(right + 0.30, 0);
	}
	if(controlRight) {
		left = Math.max(left  + 0.30, 0);
		right= Math.min(right - 0.50, 0);
	}
	
	const power = (buttonSpeed && buttonSpeed.style.filter != 'none' ? 50 : 100);
	left  = Math.round(Math.min(Math.max(left,  -1), 1)*power);
	right = Math.round(Math.min(Math.max(right, -1), 1)*power);

	const message = JSON.stringify({ 
		control: {
			left: left,
			right: right
		}
	});

	if(controlChannel && controlChannel.readyState == 'open') {
		controlChannel.send(message);
	}
	else {
		if(peer) peer.send(message);
	}
}

// Start recording of remote stream
function startRecording() {
	if(!remoteStream) return;

	record(remoteStream)
		.then((data) => {
			const mimeType = recorder.mimeType || 'video/webm';
			const blob = new Blob(data, { type: mimeType });
			const a = document.createElement('a');
			document.body.appendChild(a);
			a.style = 'display: none';
			a.href = URL.createObjectURL(blob);
			a.download = `telebot_${dateString(new Date())}.${mimeType.split('/')[1]}`;
			a.click();
			URL.revokeObjectURL(blob);
			document.body.removeChild(a);

			if(buttonRecord) {
				buttonRecord.style.filter = 'grayscale(100%)';
				buttonRecord.onclick = () => {
					startRecording();
				};
			}
		});
	
	if(buttonRecord) {
		buttonRecord.style.filter = 'none';
		buttonRecord.onclick = () => {
			if(recorder && recorder.state != 'inactive') {
				recorder.stop();
			}
			else {
				buttonRecord.style.filter = 'grayscale(100%)';
				buttonRecord.onclick = () => {
					startRecording();
				};
			}
		};
	}
}

// Record a media stream
function record(stream) {
	recorder = new MediaRecorder(stream, recorderOptions);
	
	const data = [];
	recorder.ondataavailable = (evt) => {
		data.push(evt.data);
	};

	recorder.start(1000);
 
	const finished = new Promise((resolve, reject) => {
		recorder.onstop = resolve;
		recorder.onerror = (err) => {
			logError(`MediaRecorder: ${err.name}`);
			if(data.length) resolve();
			else reject(err.name);
		};
	});

	return finished.then(() => { 
		return data;
	});
}

// Display a message
function displayMessage(msg) {
	const element = document.getElementById('message');
	if(displayMessageTimeout) clearTimeout(displayMessageTimeout);
	if(active) {
		displayMessageTimeout = setTimeout(() => {
			element.textContent = '';
		}, 10000);
	}
		
	element.textContent = msg;
	element.innerHTML = element.innerHTML.replace(/\n\r?/g, '<br>');
}

// Init local API
function initLocalControl() {
	const body = JSON.stringify({
		left: 0,
		right: 0
	});
	fetch(localControlUrl, {
		method: 'POST',
		body: body,
		headers: {
			'Content-Type': 'application/json'
		}
	})
	.then((response) => {
		if(!response.ok) throw Error(response.statusText);
	})
	.catch((err) => {
		window.location.href = 'https://telebot.ageneau.net/upgrade.html';
	});
}

// Send control to local API
function localControl(left, right) {
	const body = JSON.stringify({
		left: left,
		right: right
	});
	fetch(localControlUrl, {
		method: 'POST',
		body: body,
		headers: {
			'Content-Type': 'application/json'
		}
	})
	.then((response) => {
		if(!response.ok) throw Error(response.statusText);
	})
	.catch((err) => {
		console.log(err);
	});
}

// Display current status
function displayStatus(msg) {
	document.getElementById('status').textContent = msg;
}

// Format date as YYYY-MM-DD-HHMMSS
function dateString(date) {
	const d = new Date(date);
	return `${d.getFullYear()}-${('0'+(d.getMonth()+1)).slice(-2)}-${('0'+d.getDate()).slice(-2)}-${('0'+d.getHours()).slice(-2)}${('0'+d.getMinutes()).slice(-2)}${('0'+d.getSeconds()).slice(-2)}`;
}

// Switch element to fullscreen mode
function requestFullScreen(element) {
    if (element.requestFullscreen)
        element.requestFullscreen();
    else if (element.msRequestFullscreen)
        element.msRequestFullscreen();
    else if (element.mozRequestFullScreen)
        element.mozRequestFullScreen();
    else if (element.webkitRequestFullscreen)
        element.webkitRequestFullscreen();
}

// Log error
function logError(err) {
	if(err) {
		if(err.name && err.message) log(`${err.name}: ${err.message}`);
		else log(err);
	}
	else {
		log('Unknown error');
	}
}

// Log alias
function log(msg) {
	console.log(msg);
}

