/* 
 * Telebot Remote Control System
 * Copyright (c) 2015-2016 by Paul-Louis Ageneau
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

var active = true;
var hash = window.location.hash.substr(1);
if(hash && hash[0] == '_') {
	active = false;
	hash = hash.substr(1);
}

var sessionId = hash;
var userId = (active ? '' : '_') + Math.random().toString(16).substr(2);

var configuration = {
  "rtcpMuxPolicy": "require",
  "bundlePolicy": "balanced",
  "iceServers": [
  {
    "url": "stun:stun.ageneau.net:3478"
  },
  {
      "url": "turn:stun.ageneau.net:3478",
      "credential": "982364878597767",
      "username": "telebot"
  }
  ]
};

var signaling;
var peerConnection;
var peer;
var localStream;

var selfView;
var remoteView;
var callButton;
var callContainer;
var videoContainer;
var controlContainer;
var arrowUp;
var arrowDown;
var arrowLeft;
var arrowRight;

var controlUp    = false;
var controlDown  = false;
var controlLeft  = false;
var controlRight = false;

var oldStatus = 'online';
var displayMessageTimeout = null;

// Handle legacy Mozilla Firefox browsers
if(window.mozRTCPeerConnection && !window.webkitRTCPeerConnection) {
	window.webkitURL = window.URL;
	navigator.webkitGetUserMedia = navigator.mozGetUserMedia;
	window.webkitRTCPeerConnection = window.mozRTCPeerConnection;
	window.RTCSessionDescription = window.mozRTCSessionDescription;
	window.RTCIceCandidate = window.mozRTCIceCandidate;
}

// Set orientation to 0 if not defined
if(!window.hasOwnProperty("orientation"))
	window.orientation = 0;

// Request notification permission
var Notification = window.Notification || window.mozNotification || window.webkitNotification;
if(Notification && Notification.permission != 'granted')
{
	Notification.requestPermission(function (permission) {
		console.log(permission);
	});
}

// onload handler
window.onload = function() {
	// Get elements ids
	selfView = document.getElementById("self_view");
	remoteView = document.getElementById("remote_view");
	callContainer = document.getElementById("call_container");
	callButton = document.getElementById("call_button");
	sessionContainer = document.getElementById("session_container");
	sessionText = document.getElementById("session_text");
	sessionButton = document.getElementById("session_button");
	videoContainer  = document.getElementById("video_container");
	controlContainer = document.getElementById("control_container");
	arrowUp    = document.getElementById("arrow_up"); 
	arrowDown  = document.getElementById("arrow_down"); 
	arrowLeft  = document.getElementById("arrow_left"); 
	arrowRight = document.getElementById("arrow_right");
	logo = document.getElementById("logo");
	
	// By default, call button is disabled
	callButton.disabled = true;
	
	// If not active, switch to dark background
	if(!active) {
		document.body.style.background = "#000000";
		document.body.style.color = "#FFFFFF";
		logo.style.visibility = "hidden";
		callButton.style.visibility = "hidden";
	}
	
	// If no session is specified, show session selector
	if(!sessionId) {
		callContainer.style.display = "none";
		sessionContainer.style.display = "block";
		sessionButton.onclick = function() {
			window.location.href = window.location.href.split("#")[0] + '#' + sessionText.value;
		};
		sessionText.addEventListener("keyup", function(event) {
			event.preventDefault();
			if(event.keyCode == 13) {
				sessionButton.click();
			}
		});
		sessionText.focus();
		return;
	}
	
	// Check WebRTC is available
	if(!navigator.webkitGetUserMedia) {
		displayMessage("Browser not compatible");
		return;
	}

	// Get a local stream
	navigator.webkitGetUserMedia({
			audio: true,
			video: true
		},
		function (stream) {
			localStream = stream;
			
			// Set self view
			selfView.src = URL.createObjectURL(localStream);
			selfView.style.visibility = "visible";
			
			if(active) {
				// If active, call button triggers peerJoin()
				//callButton.disabled = false;
				callButton.onclick = function() {
					callButton.disabled = true;
					peerJoin();
				};
			}
			else {
				// If not active, call peerJoin() directly
				peerJoin();
			}
		},
		function(error) {
			logError(JSON.stringify(error));
			displayMessage("Service not available");
		});
    
	if(active) {
		// Handle mouse down on arrows
		arrowUp.onmousedown = function (evt) {
			evt.preventDefault();
			if(!controlUp) {
				controlUp = true;
				updateControl();
			}
		};
		arrowDown.onmousedown = function (evt) {
			evt.preventDefault();
			if(!controlDown) {
				controlDown = true;
				updateControl();
			}
		};
		arrowLeft.onmousedown = function (evt) {
			evt.preventDefault();
			if(!controlLeft) {
				controlLeft = true;
				updateControl();
			}
		};
		arrowRight.onmousedown = function (evt) {
			evt.preventDefault();
			if(!controlRight) {
				controlRight = true;
				updateControl();
			}
		};
		
		// Handle mouse up on arrows
		arrowUp.onmouseup = function (evt) {
			controlUp = false;
			updateControl();
		};
		arrowDown.onmouseup = function (evt) {
			controlDown = false;
			updateControl();
		};
		arrowLeft.onmouseup = function (evt) {
			controlLeft = false;
			updateControl();
		};
		arrowRight.onmouseup = function (evt) {
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
		requestStatus();
		setInterval(function() { 
			requestStatus();
		}, 10000);
	}
};

// Reload on hash change
window.onhashchange = function() {
	window.location.reload();
}

// Callback for status request
function requestStatus() {
	var request = new XMLHttpRequest();
	request.open('GET', "status/" + sessionId, true);
	
	request.onload = function() {
		if (this.status >= 200 && this.status < 400) {
			var data = JSON.parse(this.response);
			var name = "Robot \""+sessionId+"\"";
			if(data.status == 'online') {
				displayStatus(name+" is online !");
				callButton.disabled = false;
				if(Notification && oldStatus != 'online') {
					var notif = new Notification("Telebot", {
						body: name+" is now online !"
					});
				}
			}
			else if(data.status == 'busy') {
				displayStatus(name+" is busy, please wait...");
				callButton.disabled = true;
			}
			else {
				displayStatus(name+" is offline, please wait...");
				callButton.disabled = true;
			}
			oldStatus = data.status;
		}
	};
	
	request.onerror = function() {
		displayStatus("");
	}
	
	request.send();
}


// Callback for key down
function handleKeyDown(evt) {
	switch (evt.keyCode) {
	case 37:	// left
		if(!controlLeft) {
			controlLeft = true;
			updateControl();
		}
		break;
	case 38:	// up
		if(!controlUp) {
			controlUp = true;
			updateControl();
		}
		break;
	case 39:	// right
		if(!controlRight) {
			controlRight = true;
			updateControl();
		}
		break;
	case 40:	// down
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
	case 37:	// left
		controlLeft = false;
		updateControl();
		break;
	case 38:	// up
		controlUp = false;
		updateControl();
		break;
	case 39:	// right
		controlRight = false;
		updateControl();
		break;
	case 40:	// down
		controlDown = false;
		updateControl();
		break;
	}
}

// Try to join peer
function peerJoin() {
	// This can be long, display proper message
	if(active) displayMessage("Calling...");
	else displayMessage("Ready\n"+sessionId);
	
	// Create signaling channel
	signaling = new SignalingChannel(sessionId, userId);
	
	// Set unavailability timeout if active
	var timeout = null;
	if(active) {
		timeout = setTimeout(function() {
			requestStatus();
			displayMessage("Unavailable");
			signaling.close();
			signaling = null;
			callButton.disabled = false;
		}, 4000);
	}
	
	// Handle busy session
	signaling.onbusy = function(evt) {
		if(active) requestStatus();
		displayMessage("Busy, retry later");
		signaling.close();
		signaling = null;
		if(active) callButton.disabled = false;
	};
	
	// Handle incoming peer
	signaling.onpeer = function (evt) {
	
		if(evt.userid == "telebot" || (active && evt.userid[0] != '_')) return;
		if(timeout) clearTimeout(timeout);
		
		peer = evt.peer;
		
		// Handle signaling messages from peer
		peer.onmessage = handleMessage;
		
		// Handle peer disconnection
		peer.ondisconnect = function() {
			signaling.close();
			signaling = null;
			if (peerConnection) peerConnection.close();
                        peerConnection = null;
			peer = null;
			
			// Hide videos and display call container
			remoteView.style.visibility = "hidden";
			videoContainer.style.display = "none";
			controlContainer.style.display = "none";
			callContainer.style.display = "block";
			logo.style.display = "block";
			
			if(active)
			{
				displayMessage("Disconnected");
				callButton.disabled = false;
			}
			else {
				peerJoin();
			}
		};
		
		// Send orientation changes to peer
		/*window.onorientationchange = function () {
			if(peer) peer.send(JSON.stringify({ "orientation": window.orientation }));
		};*/
		
		// If active, schedule session initiation now
		if(active) {
			setTimeout(function() {
				start(true);
			}, 500);
		}
	};
	
	// Properly close signaling channel is window is closed
	window.onbeforeunload = function () {
		if(signaling) {
			signaling.close();
			signaling = null;
		}
		return null;
	};
}

// Handle signaling messages received from peer
function handleMessage(evt) {
	var message = JSON.parse(evt.data);
	
	if(!peerConnection && (message.sdp || message.candidate))
		start(false);
	
	if(message.sdp) {
		// Parse session description
		var description = new RTCSessionDescription({
			"sdp": message.sdp,
			"type": message.type
		});
		// Set remote description
		peerConnection.setRemoteDescription(description, function () {
			// If this is an offer, answer it
			if(peerConnection.remoteDescription.type == "offer")
				peerConnection.createAnswer(localDescCreated, logError);
		}, logError);
	}
	
	if(message.orientation) {
		if(remoteView) {
			var transform = "rotate(" + message.orientation + "deg)";
			remoteView.style.transform = remoteView.style.webkitTransform = transform;
		}
	} 
	
	if(message.candidate) {
		peerConnection.addIceCandidate(new RTCIceCandidate(message), function () {}, logError);
	}
}

// Initiate the session
function start(isInitiator) {
	// Clear message
	displayMessage("");
	
	videoContainer.style.display = "block";
	callContainer.style.display = "none";
	logo.style.display = "none";
	
	// Create peer connection with the given configuration
	peerConnection = new webkitRTCPeerConnection(configuration);
	
	// Send all ICE candidates to peer
	peerConnection.onicecandidate = function (evt) {
		if (evt.candidate) {
		peer.send(JSON.stringify({
			"candidate": evt.candidate.candidate,
			"sdpMLineIndex": evt.candidate.sdpMLineIndex
		}));
		console.log("Candidate emitted: " + evt.candidate.candidate);
		}
	};
	
	// Once we get the remote stream, show it
	peerConnection.onaddstream = function (evt) {
		remoteView.src = URL.createObjectURL(evt.stream);
		remoteView.style.visibility = "visible";
		if(active) controlContainer.style.display = "block";
		sendOrientationUpdate();
	};
	
	// Add local stream
	peerConnection.addStream(localStream);
	
	if (isInitiator)
		peerConnection.createOffer(localDescCreated, logError);
}

// Handle local session description
function localDescCreated(desc) {
	peerConnection.setLocalDescription(desc, function () {
		peer.send(JSON.stringify({
			"sdp": peerConnection.localDescription.sdp,
			"type": peerConnection.localDescription.type
		}));
		var logMessage = "Local description sent, type: " + peerConnection.localDescription.type + ", sdp:\n" + peerConnection.localDescription.sdp;
		console.log(logMessage);
	}, logError);
}

// Send new controls to peer
function updateControl() {
	if(controlContainer.style.display == "none")
		return;
	
	var left = 0;
	var right = 0;
	if(controlUp) {
		left = 1;
		right= 1;
	}
	if(controlDown) {
		left = -1;
		right= -1;
	}
	if(controlLeft) {
		left = -1;
		right= 1;
	}
	if(controlRight) {
		left = 1;
		right= -1;
	}
	
	var power = 50;
	left  = Math.min(Math.max(left,  -1), 1)*power;
	right = Math.min(Math.max(right, -1), 1)*power;
	
	if(peer) {
		peer.send(JSON.stringify({ 
			"control": {
				"left": left,
				"right": right
			}
		}));
	}
}

// Display a message
function displayMessage(msg) {
	var element = document.getElementById("message");
	if(displayMessageTimeout) clearTimeout(displayMessageTimeout);
	if(active) {
		displayMessageTimeout = setTimeout(function() {
			element.textContent = "";
		}, 10000);
	}
		
	element.textContent = msg;
	element.innerHTML = element.innerHTML.replace(/\n\r?/g, '<br>');
}

// Display current status
function displayStatus(msg) {
	document.getElementById("status").textContent = msg;
}

// Log error
function logError(error) {
	if(error) {
		if(error.name && error.message) log(error.name + ": " + error.message);
		else log(error);
	}
	else {
		log("Unknown error");
	}
}

// Log alias
function log(msg) {
	console.log(msg);
}

