/*
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

// WebRTC configuration
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

var active = true;
var sessionId = '';
var userId = '';

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
var footer;

var controlUp    = false;
var controlDown  = false;
var controlLeft  = false;
var controlRight = false;

var oldStatus = 'online';
var displayMessageTimeout = null;

// Set orientation to 0 if not defined
if(!window.hasOwnProperty("orientation"))
	window.orientation = 0;

// Request notification permission
var Notification = window.Notification || window.webkitNotification || window.mozNotification;
if(Notification && Notification.permission != 'granted')
{
	Notification.requestPermission(function (permission) {
		console.log(permission);
	});
}

// Get RTC objects
var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
var RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
var RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate || window.mozRTCIceCandidate;

// Initialization function
function init()
{
	// Session and mode from hash
	var hash = window.location.hash.substr(1);
	if(hash && hash[0] == '_') {
		// Leading '_' enables passive mode
		if(!sessionStorage.mode) sessionStorage.mode = 'passive';
		window.location.href = window.location.href.split("#")[0] + '#' + hash.substr(1);
		return;
	}
	if(!sessionStorage.mode) sessionStorage.mode = 'active';
	active = (sessionStorage.mode != 'passive');
	sessionId = hash;
	userId = (active ? '' : '_') + Math.random().toString(16).substr(2);
	
	// Get elements ids
	selfView = document.getElementById("self_view");
	remoteView = document.getElementById("remote_view");
	logoContainer = document.getElementById("logo_container");
	sessionContainer = document.getElementById("session_container");
	sessionText = document.getElementById("session_text");
	sessionButton = document.getElementById("session_button");
	callContainer = document.getElementById("call_container");
	callButton = document.getElementById("call_button");
	videoContainer  = document.getElementById("video_container");
	controlContainer = document.getElementById("control_container");
	arrowUp    = document.getElementById("arrow_up"); 
	arrowDown  = document.getElementById("arrow_down"); 
	arrowLeft  = document.getElementById("arrow_left"); 
	arrowRight = document.getElementById("arrow_right");
	footer = document.getElementById("footer");
	
	// If not active, switch to dark background
	if(!active) {
		var logo = document.getElementById("logo");
		document.body.style.background = "#000000";
		document.body.style.color = "#FFFFFF";
		logo.style.visibility = "hidden";
		footer.style.visibility = "hidden";
		callButton.style.visibility = "hidden";
	}
	
	// Initialize everything
	if(signaling) signaling.close();
	if(peerConnection) peerConnection.close();
	signaling = null;
	peerConnection = null;
	peer = null;
	remoteView.style.visibility = "hidden";
	logoContainer.style.display = "block";
	footer.style.display = "block";
	callContainer.style.display = "block";
	sessionContainer.style.display = "none";
	videoContainer.style.display = "none";
	controlContainer.style.display = "none";
	callButton.disabled = true;
	
	// If no session is specified, hide call container
	if(!sessionId) callContainer.style.display = "none";
	
	if(active)
	{
		// If no session is specified, show session selector
		if(!sessionId) {
			sessionContainer.style.display = "block";
			sessionButton.onclick = function() {
				window.location.href = window.location.href.split("#")[0] + '#' +  encodeURIComponent(sessionText.value);
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
		
		// Refresh status
		requestStatus();
	}
};

window.onload = function() {
	// Check WebRTC is available
	if(!navigator.mediaDevices.getUserMedia) {
		displayMessage("Browser not compatible");
		clearTimeout(displayMessageTimeout);
		return;
	}
	
	// Initialize
	init();
	
	// Get a local stream
	var constraints = { audio: true, video: true }; 
	navigator.mediaDevices.getUserMedia(constraints)
		.then(function(stream) {
			localStream = stream;

 			// Set self view
 			selfView.srcObject = stream;
			selfView.style.visibility = "visible";
			selfView.onloadedmetadata = function(evt) {
				selfView.play();
			};

			if(active) {
				// If active, call button triggers peerJoin()
				callButton.onclick = function() {
					callButton.disabled = true;
					peerJoin();
				};
			}
			else {
				// If not active, call peerJoin() directly
				peerJoin();
			}
		})
		.catch(function(err) { 
			logError(err);
			callContainer.style.display = "none";
			sessionContainer.style.display = "none";
			displayMessage("Service not available");
			clearTimeout(displayMessageTimeout);
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
		setInterval(function() { 
			requestStatus();
		}, 10000);
	}
}

window.onhashchange = function() {
	// Re-initialize
	init();
}

// Callback for status request
function requestStatus() {
	if(!sessionId) return;
	var request = new XMLHttpRequest();
	request.open('GET', "status/" + sessionId, true);
	
	request.onload = function() {
		if (this.status >= 200 && this.status < 400) {
			var data = JSON.parse(this.response);
			var name = "Telebot \""+sessionId+"\"";
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
	else displayMessage("Ready\n\n"+sessionId);
	
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
			if (peerConnection) peerConnection.close();
			signaling = null;
			peerConnection = null;
			peer = null;
			
			// Hide videos and display call container
			remoteView.style.visibility = "hidden";
			videoContainer.style.display = "none";
			controlContainer.style.display = "none";
			callContainer.style.display = "block";
			logoContainer.style.display = "block";
			footer.style.display = "block";
			
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
		if(signaling) signaling.close();
		signaling = null;
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
	
	if(message.candidate) {
		peerConnection.addIceCandidate(new RTCIceCandidate(message), function () {}, logError);
	}
	
	if(message.orientation) {
		if(remoteView) {
			var transform = "rotate(" + message.orientation + "deg)";
			remoteView.style.transform = remoteView.style.webkitTransform = remoteView.style.mozTransform = transform;
		}
	} 
}

// Initiate the session
function start(isInitiator) {
	// Clear message
	displayMessage("");
	
	videoContainer.style.display = "block";
	callContainer.style.display = "none";
	logoContainer.style.display = "none";
	footer.style.display = "none";
	
	// Create peer connection with the given configuration
	peerConnection = new RTCPeerConnection(configuration);
	
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
		remoteView.srcObject = evt.stream;
		remoteView.style.visibility = "visible";
		remoteView.onloadedmetadata = function(evt) {
			remoteView.play();
		};

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
	if(controlContainer.style.display == "none") return;
	
	var left  = 0;
	var right = 0;
	if(controlUp) {
		left += 1;
		right+= 1;
	}
	if(controlDown) {
		left += -1;
		right+= -1;
	}
	if(controlLeft) {
		left = Math.min(left  - 0.50, 0);
		right= Math.max(right + 0.25, 0);
	}
	if(controlRight) {
		left = Math.max(left  + 0.25, 0);
		right= Math.min(right - 0.50, 0);
	}
	
	var power = 100;
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
function logError(err) {
	if(err) {
		if(err.name && err.message) log(err.name + ": " + err.message);
		else log(err);
	}
	else {
		log("Unknown error");
	}
}

// Log alias
function log(msg) {
	console.log(msg);
}

