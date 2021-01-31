/*
 * Telebot client
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
let legacy = false;
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
let wrapper;
let arrowUp;
let arrowDown;
let arrowLeft;
let arrowRight;
let buttonRecord;
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
	if(sessionId.length == 6) { 
		legacy = true;
		console.log("Legacy mode");
	}
	if(!userId) userId = (active ? '' : '_') + Math.random().toString(16).substr(2);
	
	if(!active) {
		// If not active, switch to dark background
		document.body.style.background = '#000000';
		document.body.style.color = '#FFFFFF';
		wrapper.style.background = '#000000';
		logo.style.visibility = 'hidden';
		footer.style.visibility = 'hidden';
		callButton.style.visibility = 'hidden';

		// Set remote video to cover
		remoteView.style.objectFit = 'cover';
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
	wrapper.style.display = 'none';
	
	callButton.disabled = true;
	
	if(buttonRecord) buttonRecord.style.filter = 'grayscale(100%)';
	
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
	wrapper = document.getElementById('wrapper');
	arrowUp    = document.getElementById('arrow_up');
	arrowDown  = document.getElementById('arrow_down');
	arrowLeft  = document.getElementById('arrow_left');
	arrowRight = document.getElementById('arrow_right');
	buttonRecord = document.getElementById('button_record');
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

	if(active) {
		// Allow fullscreen
		videoContainer.onclick = () => {
			toggleFullscreen(wrapper);
		};
		// By default, call button ask for media
		callButton.onclick = () => {
			displayMessage('Access to media device not allowed');
		};
	}
	else {
		// Allow fullscreen
		document.body.onclick = () => {
			toggleFullscreen(document.body);
		};
	}
	
	// Get a local stream
	const constraints = {
		audio: true,
		video: {
			width: {
				min: 480,
				max: 1024
			},
			height: {
				min: 480,
				max: 1024
			},
			aspectRatio: 4/3,
			facingMode: "user"
		}
	};
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
	if(signaling) signaling.close();
	if(controlChannel) controlChannel.close();
	if(peerConnection) peerConnection.close();
	signaling = null;
	controlChannel = null;
	peerConnection = null;
	peer = null;
	remoteStream = null;
	
	// Hide videos and display call container
	videoContainer.style.display = 'none';
	wrapper.style.display = 'none';
	controlContainer.style.display = 'none';
	callContainer.style.display = 'block';
	logoContainer.style.display = 'block';
	footer.style.display = 'block';
	remoteView.style.visibility = 'hidden';
	
	if(active) {
		exitFullscreen();
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
	
	wrapper.style.display = 'flex';
	videoContainer.style.display = 'block';
	callContainer.style.display = 'none';
	logoContainer.style.display = 'none';
	footer.style.display = 'none';
	
	// Create peer connection with the given configuration
	peerConnection = new RTCPeerConnection(rtcConfiguration);
	
	// Start negociation
	peerConnection.onnegotiationneeded = () => {
		if(isInitiator) {
			peerConnection.createOffer()
				.then(localDescCreated)
				.catch(logError);
		}
	}
	
	// Send ICE candidates to peer
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

	if(isInitiator) {
		// Create control data channel
		const controlChannelOptions = {
			ordered: true
		};
		controlChannel = peerConnection.createDataChannel('control', controlChannelOptions);
		controlChannel.onopen = () => {
			handleControlChannel();
		};
	}
	else {
		// Accept control data channel
		peerConnection.ondatachannel = (evt) => {
			if(evt.channel.label == 'control') {
				controlChannel = evt.channel;
				handleControlChannel();
			}
		};
	}
}

function handleControlChannel() {
	const keepaliveInterval = setInterval(() => {
		if(controlChannel.readyState == 'open') {
			controlChannel.send(JSON.stringify({ 
				keepalive: true
			}));
		}
	}, 1000);

	let keepaliveTimeout = null;
	const resetKeepaliveTimeout = () => {
		if(keepaliveTimeout) clearTimeout(keepaliveTimeout);
		keepaliveTimeout = setTimeout(() => {
			if(controlChannel.readyState == 'open') {
				controlChannel.close();
			}
		}, 4000);
	}
	resetKeepaliveTimeout();
	
	controlChannel.onclose = () => {
		clearInterval(keepaliveInterval);
		clearTimeout(keepaliveTimeout);
		handleDisconnect();
	}
	
	controlChannel.onerror = (err) => {
		console.error(err);
	};
	
	controlChannel.onmessage = (evt) => {
		const message = JSON.parse(evt.data);
		if(message.control && !active) {
			const { left, right } = message.control;
			localControl(Math.floor(left), Math.floor(right));
		}
		resetKeepaliveTimeout();
	};
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
		if(legacy) {
			left += -0.70;
			right+= -0.70;
		} else {
			left += -1;
			right+= -1;
		}
	}
	if(controlLeft) {
		if(legacy) {
			left = Math.min(left  - 0.50, 0);
			right= Math.max(right + 0.30, 0);
		} else {
			left+= -1;
			right+= 1;
		}
	}
	if(controlRight) {
		if(legacy) {
			left = Math.max(left  + 0.30, 0);
			right= Math.min(right - 0.50, 0);
		} else {	
			left+= 1;
			right+= -1;
		}
	}
	
	const power = legacy ? 50 : 75;
	left  = Math.round(Math.min(Math.max(left,  -1), 1)*power);
	right = Math.round(Math.min(Math.max(right, -1), 1)*power);

	const message = { 
		control: {
			left: left,
			right: right
		}
	};

	if(controlChannel && controlChannel.readyState == 'open') {
		controlChannel.send(JSON.stringify(message));
	}
	else {
		if(peer) peer.send(JSON.stringify(message));
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

// Exit fullscreen mode
function exitFullscreen() {
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if (document.msExitFullscreen) {
		document.msExitFullscreen();
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	}
}

// Toggle fullscreen mode
function toggleFullscreen(element) {
	if (!document.fullscreenElement &&
      !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {
		if (element.requestFullscreen) {
			element.requestFullscreen();
		} else if (element.msRequestFullscreen) {
			element.msRequestFullscreen();
		} else if (element.mozRequestFullScreen) {
			element.mozRequestFullScreen();
		} else if (element.webkitRequestFullscreen) {
			element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		}
	} else {
		exitFullscreen();
	}
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

