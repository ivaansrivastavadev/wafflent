/* ═══════════════════════════════════════════════════════════════
   P2P, RELAYS & PRESENCE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

/* ─── GUN Setup with relay fallback ─── */
const PEERS = [
  // Local development peers (try these first)
  'ws://localhost:3000/gun',
  'ws://127.0.0.1:3000/gun',
  'ws://localhost:8765/gun',
  // Fallback to public relays
  'https://relay.peer.ooo/gun',
  'https://gun-manhattan.herokuapp.com/gun',
  'https://gunjs.herokuapp.com/gun',
];

let gun;
let connectedPeers = new Set();
let reconnectAttempt = 0;

function initGun(peerList) {
  if (gun) return; // already init
  
  // Initialize GUN with WebRTC support and better error handling
  gun = Gun({ 
    peers: peerList, 
    retry: 2500, 
    localStorage: false,
    // Enable WebRTC for peer-to-peer connections
    webrtc: true,
    // Reduce timeout for faster fallback
    timeout: 5000
  });

  gun.on('hi', peer => {
    connectedPeers.add(peer.url || peer);
    reconnectAttempt = 0;
    updatePeerStatus();
    console.log('GUN: Connected to peer', peer.url || peer);
  });

  gun.on('bye', peer => {
    connectedPeers.delete(peer.url || peer);
    updatePeerStatus();
    console.log('GUN: Disconnected from peer', peer.url || peer);
    // Try reconnect after a short delay
    if (connectedPeers.size === 0) scheduleReconnect();
  });

  // Handle connection errors more gracefully
  gun.on('out', {get: {'#': {'>': 0}}, 'err': (err, key) => {
    if (err && connectedPeers.size === 0) {
      console.warn('GUN: Connection error, attempting fallback');
      scheduleReconnect();
    }
  }});
}

function updatePeerStatus() {
  const dot = $('peerDot');
  const label = $('peerStatus');
  if (connectedPeers.size > 0) {
    dot.classList.add('connected');
    label.textContent = `${connectedPeers.size} relay${connectedPeers.size > 1 ? 's' : ''} connected`;
  } else {
    dot.classList.remove('connected');
    label.textContent = reconnectAttempt > 0 ? 'Reconnecting…' : 'Connecting…';
  }
}

function scheduleReconnect() {
  reconnectAttempt++;
  const delay = Math.min(2000 * reconnectAttempt, 15000);
  updatePeerStatus();
  
  setTimeout(() => {
    if (connectedPeers.size === 0) {
      console.log(`GUN: Reconnection attempt ${reconnectAttempt}`);
      // Try next peer rotation
      const rotated = [...PEERS.slice(reconnectAttempt % PEERS.length), ...PEERS.slice(0, reconnectAttempt % PEERS.length)];
      rotated.forEach(p => gun.opt({ peers: [p] }));
      
      // If we've tried many times, enable local-only mode
      if (reconnectAttempt > 5) {
        const dot = $('peerDot');
        const label = $('peerStatus');
        dot.classList.remove('connected');
        label.textContent = 'Local mode (no relays)';
        console.log('GUN: Switched to local-only mode');
      }
    }
  }, delay);
}

// Initialize GUN on load
initGun(PEERS);

/* ─── Typing indicator ─── */
let typingTimer = null;
let isTyping = false;
const otherTyping = new Map(); // deviceId → { name, ts, element }
let typingCleanupTimer = null;
let typingMessageElement = null;

function setMyTyping(val) {
  if (!presenceNode || !roomId) return;
  if (isTyping === val) return;
  isTyping = val;
  (async () => {
    const encryptedName = secret ? await enc(getDisplayName() || 'Anonymous') : (getDisplayName() || 'Anonymous');
    presenceNode.get(deviceId).put({
      name: encryptedName,
      typing: val,
      ts: Date.now()
    });
  })();
}

function updateTypingHint() {
  const names = [...otherTyping.values()].filter(v => v && v.name).map(v => v.name);
  const chatEl = $('chat');
  
  if (names.length === 0) {
    // Remove typing message if exists
    if (typingMessageElement && typingMessageElement.parentNode) {
      typingMessageElement.remove();
      typingMessageElement = null;
    }
    return;
  }
  
  // Create or update typing message
  if (!typingMessageElement || !typingMessageElement.parentNode) {
    typingMessageElement = document.createElement('div');
    typingMessageElement.className = 'lcg-msg them';
    chatEl.appendChild(typingMessageElement);
  }
  
  const displayName = names.length === 1 
    ? names[0] 
    : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  
  const oldestTypingTime = Math.min(...[...otherTyping.values()].map(v => v.ts || Date.now()));
  
  typingMessageElement.innerHTML = `
    <div class="lcg-msg-content lcg-typing-message">
      ${escapeHtml(displayName)} is typing
      <span class="lcg-typing-dots">
        <span class="lcg-typing-dot"></span>
        <span class="lcg-typing-dot"></span>
        <span class="lcg-typing-dot"></span>
      </span>
    </div>
    <div class="lcg-msg-meta">
      <span>${fmtTime(oldestTypingTime)}</span>
    </div>
  `;
  
  // Auto-scroll to show typing indicator
  setTimeout(() => scrollChat(), 0);
}

function watchPresence() {
  if (!presenceNode) return;
  presenceNode.map().on(async (data, id) => {
    if (!data || id === deviceId) return;
    const stale = Date.now() - (data.ts || 0) > 8000;
    if (data.typing && !stale) {
      const decryptedName = secret && typeof data.name === 'string' ? await dec(data.name) : (data.name || id.slice(0, 8));
      otherTyping.set(id, { 
        name: decryptedName, 
        ts: data.ts || Date.now()
      });
    } else {
      otherTyping.delete(id);
    }
    updateTypingHint();
  });

  // Periodic cleanup of stale typing entries
  clearInterval(typingCleanupTimer);
  typingCleanupTimer = setInterval(() => {
    let changed = false;
    presenceNode.map().once((data, id) => {
      if (!data || id === deviceId) return;
      if (Date.now() - (data.ts || 0) > 8000 && otherTyping.has(id)) {
        otherTyping.delete(id);
        changed = true;
      }
    });
    if (changed) updateTypingHint();
  }, 4000);
}
