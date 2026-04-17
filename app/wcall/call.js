/* ═══════════════════════════════════════════════════════════════
   WAFFLENT CALLS — WebRTC P2P Audio Calling
   ═══════════════════════════════════════════════════════════════ */

// Global state
let gun = null;
let deviceId = null;
let roomId = '';
let secret = '';
let callRoom = null;
let presenceRoom = null;

let localStream = null;
let peerConnection = null;
let remoteStream = null;
let dataChannel = null;

let isMicEnabled = true;
let isCallActive = false;
let callStartTime = null;
let callDurationInterval = null;

let selectedAudioDevice = '';

// ICE servers
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

/* ─── Initialize on page load ─── */
window.addEventListener('load', () => {
  initializeGun();
  setupEventListeners();
  generateDeviceId();
  populateAudioDevices();
});

function generateDeviceId() {
  let stored = localStorage.getItem('wcall_device_id');
  if (!stored) {
    stored = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('wcall_device_id', stored);
  }
  deviceId = stored;
}

/* ─── GUN Initialization ─── */
function initializeGun() {
  gun = Gun(['https://gun-server-example.herokuapp.com/gun', localStorage]).get('wcall');
  updateConnectionStatus(true);
}

function updateConnectionStatus(connected) {
  const dot = $('wcallStatusDot');
  const status = $('wcallStatus');
  if (connected) {
    dot.classList.add('connected');
    status.textContent = 'Online';
  } else {
    dot.classList.remove('connected');
    status.textContent = 'Offline';
  }
}

/* ─── Audio Device Selection ─── */
async function populateAudioDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    
    const selects = [
      $('wcallAudioDeviceSelect'),
      $('wcallAudioDeviceDuringCall')
    ];
    
    selects.forEach(select => {
      select.innerHTML = '<option value="">Default</option>';
      audioDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${audioDevices.indexOf(device) + 1}`;
        select.appendChild(option);
      });
    });
  } catch (err) {
    console.error('Error enumerating audio devices:', err);
  }
}

/* ─── Event Listeners ─── */
function setupEventListeners() {
  $('wcallJoinBtn').addEventListener('click', joinCall);
  $('wcallMicBtn').addEventListener('click', toggleMicrophone);
  $('wcallHangUpBtn').addEventListener('click', endCall);
  
  $('wcallRoomId').addEventListener('keydown', e => {
    if (e.key === 'Enter') joinCall();
  });
  
  $('wcallSecret').addEventListener('keydown', e => {
    if (e.key === 'Enter') joinCall();
  });

  $('wcallAudioDeviceSelect').addEventListener('change', (e) => {
    selectedAudioDevice = e.target.value;
  });

  $('wcallAudioDeviceDuringCall').addEventListener('change', async (e) => {
    selectedAudioDevice = e.target.value;
    // Switch audio device if call is active
    if (isCallActive && localStream) {
      await switchAudioDevice();
    }
  });

  // Listen for incoming calls
  navigator.mediaDevices.addEventListener('devicechange', populateAudioDevices);
}

/* ─── Join Call ─── */
async function joinCall() {
  roomId = $('wcallRoomId').value.trim();
  secret = $('wcallSecret').value.trim();

  if (!roomId) {
    toast('Please enter a room ID');
    return;
  }

  if (roomId.length < 3) {
    toast('Room ID must be at least 3 characters');
    return;
  }

  try {
    // Request microphone access
    const constraints = {
      audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
      video: false
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    toast('Microphone access granted');

    // Set up call room in GUN
    callRoom = gun.get(`call_${roomId}`);
    presenceRoom = gun.get(`presence_${roomId}`);

    // Set up presence
    presenceRoom.get(deviceId).put({ 
      online: true, 
      name: 'User',
      ts: Date.now()
    });

    // Listen for peer signals
    listenForPeerSignals();

    // Publish our SDP offer/answer
    initiateCallSignaling();

    // Show call interface
    showCallInterface();
    toast('Joined call room: ' + roomId);

  } catch (err) {
    console.error('Error accessing microphone:', err);
    if (err.name === 'NotAllowedError') {
      toast('Microphone permission denied');
    } else if (err.name === 'NotFoundError') {
      toast('No microphone found');
    } else {
      toast('Error accessing microphone');
    }
  }
}

/* ─── WebRTC Signaling ─── */
async function initiateCallSignaling() {
  // Check if there's an existing peer
  let hasPeer = false;

  presenceRoom.map().on((data, key) => {
    if (key !== deviceId && data && data.online) {
      hasPeer = true;
      
      // If we're the first to join, create offer
      if (deviceId < key && !peerConnection) {
        createPeerConnection();
        createOffer();
      }
    }
  });

  // If no peer found, wait for incoming signals
  if (!hasPeer) {
    // Listen for when a peer joins
    presenceRoom.map().once((data) => {
      if (data && data.online && !peerConnection) {
        createPeerConnection();
        // Check if we should create offer
        presenceRoom.map().once((peerData, peerId) => {
          if (peerId !== deviceId && peerData && deviceId < peerId) {
            createOffer();
          }
        });
      }
    });
  }
}

function listenForPeerSignals() {
  callRoom.get('signals').map().on(async (signal, key) => {
    if (!signal || signal.from === deviceId) return;

    if (signal.type === 'offer') {
      if (!peerConnection) createPeerConnection();
      
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: signal.sdp
      });
      
      try {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer back
        const encryptedAnswer = secret ? btoa(JSON.stringify({ sdp: answer.sdp })) : { sdp: answer.sdp };
        callRoom.get('signals').set({
          type: 'answer',
          sdp: encryptedAnswer,
          from: deviceId,
          to: signal.from,
          ts: Date.now()
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    } 
    else if (signal.type === 'answer') {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: signal.sdp
      });
      
      try {
        await peerConnection.setRemoteDescription(answer);
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    } 
    else if (signal.type === 'ice-candidate' && peerConnection) {
      const candidate = new RTCIceCandidate({
        candidate: signal.candidate,
        sdpMLineIndex: signal.sdpMLineIndex,
        sdpMid: signal.sdpMid
      });
      
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  });
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceServers);

  // Add local stream
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    playRemoteAudio(remoteStream);
    updateCallStatus('Connected');
    startCallTimer();
    isCallActive = true;
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      callRoom.get('signals').set({
        type: 'ice-candidate',
        candidate: event.candidate.candidate,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        sdpMid: event.candidate.sdpMid,
        from: deviceId,
        ts: Date.now()
      });
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    switch (peerConnection.connectionState) {
      case 'connected':
        updateCallStatus('Connected');
        break;
      case 'disconnected':
        updateCallStatus('Disconnected');
        break;
      case 'failed':
        updateCallStatus('Connection Failed');
        break;
      case 'closed':
        updateCallStatus('Call Ended');
        break;
    }
  };
}

async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer
    callRoom.get('signals').set({
      type: 'offer',
      sdp: offer.sdp,
      from: deviceId,
      ts: Date.now()
    });

    toast('Calling...');
  } catch (err) {
    console.error('Error creating offer:', err);
  }
}

/* ─── Microphone Toggle ─── */
function toggleMicrophone() {
  if (!localStream) return;

  isMicEnabled = !isMicEnabled;
  
  localStream.getAudioTracks().forEach(track => {
    track.enabled = isMicEnabled;
  });

  const btn = $('wcallMicBtn');
  if (isMicEnabled) {
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
    btn.classList.remove('mic-off');
    btn.title = 'Mute microphone';
  } else {
    btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    btn.classList.add('mic-off');
    btn.title = 'Unmute microphone';
  }
}

async function switchAudioDevice() {
  if (!localStream) return;

  try {
    // Stop current audio tracks
    localStream.getAudioTracks().forEach(track => track.stop());

    // Get new stream with selected device
    const constraints = {
      audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
      video: false
    };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Replace tracks in peer connection
    const newTrack = newStream.getAudioTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track?.kind === 'audio');
    
    if (sender) {
      await sender.replaceTrack(newTrack);
    } else {
      peerConnection.addTrack(newTrack, newStream);
    }

    localStream = newStream;
    toast('Audio device switched');
  } catch (err) {
    console.error('Error switching audio device:', err);
    toast('Error switching audio device');
  }
}

/* ─── Call Management ─── */
function startCallTimer() {
  callStartTime = Date.now();
  callDurationInterval = setInterval(updateCallDuration, 100);
}

function updateCallDuration() {
  if (!callStartTime) return;
  
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  
  $('wcallCallDuration').textContent = 
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateCallStatus(status) {
  $('wcallCallStatus').textContent = status;
}

function playRemoteAudio(stream) {
  const audio = document.createElement('audio');
  audio.srcObject = stream;
  audio.autoplay = true;
  audio.playsinline = true;
  document.body.appendChild(audio);
}

function endCall() {
  // Clean up
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (callDurationInterval) {
    clearInterval(callDurationInterval);
  }

  // Update presence
  if (presenceRoom) {
    presenceRoom.get(deviceId).put({ online: false });
  }

  isCallActive = false;
  isMicEnabled = true;
  callStartTime = null;

  // Reset UI
  hideCallInterface();
  resetFormInputs();
  toast('Call ended');
}

/* ─── UI Management ─── */
function showCallInterface() {
  $('wcallForm').classList.add('wcall-hidden');
  $('wcallInterface').classList.remove('wcall-hidden');
  $('wcallRemoteName').textContent = 'Call in progress';
  updateCallStatus('Connecting...');
}

function hideCallInterface() {
  $('wcallForm').classList.remove('wcall-hidden');
  $('wcallInterface').classList.add('wcall-hidden');
  $('wcallCallDuration').textContent = '00:00';
}

function resetFormInputs() {
  $('wcallRoomId').value = '';
  $('wcallSecret').value = '';
  roomId = '';
  secret = '';
}

/* ─── Helper Functions ─── */
function $(id) {
  return document.getElementById(id);
}

function toast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'lcg-toast show';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: auto;
    top: 80px;
    right: 24px;
    background: var(--bg-overlay);
    color: var(--text-primary);
    border: 1px solid var(--border);
    padding: 10px 18px;
    border-radius: var(--r-pill);
    font-size: var(--text-sm);
    font-weight: 500;
    box-shadow: var(--shadow-lg);
    z-index: 999;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
