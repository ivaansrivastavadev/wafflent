const $ = id => document.getElementById(id);

/* ─── Device ID & Display Name ─── */
function getDeviceId() {
  let id = localStorage.getItem('lcg_deviceId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('lcg_deviceId', id); }
  return id;
}

function getDisplayName() {
  return localStorage.getItem('lcg_displayName') || null;
}

function saveDisplayName(name) {
  localStorage.setItem('lcg_displayName', name);
}

const deviceId = getDeviceId();
$('deviceIdShort').textContent = deviceId.slice(0, 8);
$('deviceName').textContent = getDisplayName() || 'Anonymous';

/* Click pill to rename */
$('devicePill').addEventListener('click', () => {
  const current = getDisplayName() || '';
  const name = prompt('Set your display name:', current);
  if (name === null) return; // cancelled
  const clean = name.trim().slice(0, 24) || 'Anonymous';
  saveDisplayName(clean);
  $('deviceName').textContent = clean;
  toast(`Name set to "${clean}"`);
  // Update presence if in room
  if (roomId && presenceNode) {
    presenceNode.get(deviceId).put({ name: clean, typing: false, ts: Date.now() });
  }
});

/* ─── Helpers ─── */
function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

/* ─── File type detection ─── */
function getFileIcon(mimeType, fileName = '') {
  if (mimeType.startsWith('image/')) return 'fa-image';
  if (mimeType.startsWith('video/')) return 'fa-video';
  if (mimeType.startsWith('audio/')) return 'fa-music';
  if (mimeType.includes('pdf')) return 'fa-file-pdf';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'fa-file-word';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'fa-file-excel';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'fa-file-powerpoint';
  if (mimeType.includes('text') || mimeType.includes('plain')) return 'fa-file-text';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compress')) return 'fa-file-zipper';
  return 'fa-file';
}

function getMediaType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

let toastTimer;
function toast(msg, duration = 1800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function systemMsg(text) {
  const div = document.createElement('div');
  div.className = 'lcg-msg system';
  div.textContent = text;
  $('chat').appendChild(div);
  scrollChat();
}

function scrollChat() {
  const c = $('chat');
  c.scrollTop = c.scrollHeight;
}

/* ─── Scroll management ─── */
function isNearBottom() {
  const c = $('chat');
  return c.scrollHeight - c.scrollTop - c.clientHeight < 100;
}

function toggleScrollButton() {
  const btn = $('scrollDownBtn');
  const isAtBottom = isNearBottom();
  btn.style.display = isAtBottom ? 'none' : 'flex';
}

$('chat').addEventListener('scroll', toggleScrollButton);

$('scrollDownBtn').addEventListener('click', () => {
  scrollChat();
});

/* ─── Fullscreen mode ─── */
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

initGun(PEERS);

/* ─── Room state ─── */
let roomId = '';
let secret = '';
let roomNode = null;
let presenceNode = null;
const seen = new Set();

/* ─── Typing indicator ─── */
let typingTimer = null;
let isTyping = false;
const otherTyping = new Map(); // deviceId → name
let typingCleanupTimer = null;

function setMyTyping(val) {
  if (!presenceNode || !roomId) return;
  if (isTyping === val) return;
  isTyping = val;
  presenceNode.get(deviceId).put({
    name: getDisplayName() || 'Anonymous',
    typing: val,
    ts: Date.now()
  });
}

function updateTypingHint() {
  const names = [...otherTyping.values()].filter(Boolean);
  const el = $('typingHint');
  if (names.length === 0) {
    el.textContent = '';
  } else if (names.length === 1) {
    el.innerHTML = `<i class="fas fa-keyboard" style="opacity:0.6; margin-right:4px;"></i> <strong>${escapeHtml(names[0])}</strong> is typing…`;
  } else {
    const allButLast = names.slice(0, -1).map(n => `<strong>${escapeHtml(n)}</strong>`).join(', ');
    const last = `<strong>${escapeHtml(names[names.length - 1])}</strong>`;
    el.innerHTML = `<i class="fas fa-keyboard" style="opacity:0.6; margin-right:4px;"></i> ${allButLast} and ${last} are typing…`;
  }
}

function watchPresence() {
  if (!presenceNode) return;
  presenceNode.map().on((data, id) => {
    if (!data || id === deviceId) return;
    const stale = Date.now() - (data.ts || 0) > 8000;
    if (data.typing && !stale) {
      otherTyping.set(id, data.name || id.slice(0, 8));
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

/* ─── Encryption ─── */
async function enc(plain) {
  if (!secret) return plain;
  try { return await SEA.encrypt(plain, secret); }
  catch (e) { console.error(e); return plain; }
}

async function dec(cipher) {
  if (!secret) return cipher;
  if (typeof cipher !== 'string') return String(cipher);
  try { return await SEA.decrypt(cipher, secret); }
  catch { return '[Unable to decrypt — wrong secret?]'; }
}

/* ─── Room init ─── */
function randomRoom() {
  const animals = ['tiger','otter','panda','eagle','whale','koala','lynx','yak','zebra','gecko','sloth','ibis'];
  const colors  = ['yellow','gold','amber','sun','lemon','honey'];
  return `${colors[Math.floor(Math.random() * colors.length)]}-${animals[Math.floor(Math.random() * animals.length)]}-${Math.floor(1000 + Math.random() * 8999)}`;
}

function initFromHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, '')).trim();
  if (!h) {
    if (!$('room').value) $('room').value = randomRoom();
    return;
  }
  
  // Parse room and secret from hash (format: "room" or "room?secret=xxx")
  const parts = h.split('?');
  const roomId = parts[0].trim();
  const queryStr = parts[1] || '';
  
  if (roomId) $('room').value = roomId;
  if (!$('room').value) $('room').value = randomRoom();
  
  // Extract secret if present
  const secretMatch = queryStr.match(/secret=([^&]+)/);
  if (secretMatch) {
    const decodedSecret = decodeURIComponent(secretMatch[1]);
    $('secret').value = decodedSecret;
    secret = decodedSecret;
    setEncHint();
    
    // Clear the hash to remove secret from URL
    history.replaceState(null, '', location.pathname + '#' + encodeURIComponent(roomId));
  }
}

initFromHash();

function setEncHint() {
  $('encHint').textContent = secret
    ? '🔒 E2E encryption ON'
    : '🔓 Encryption OFF — add a Secret to enable';
}
setEncHint();

$('secret').addEventListener('input', () => { secret = $('secret').value; setEncHint(); });

/* ─── Join room ─── */
function joinRoom(id) {
  if (!id) { toast('Enter a Chat ID'); return; }
  if (!gun) { toast('Database not connected. Please wait and try again.'); return; }

  // Teardown old room
  if (roomNode) roomNode.off();
  if (presenceNode) {
    presenceNode.get(deviceId).put({ typing: false, ts: Date.now() });
    presenceNode.off();
  }
  otherTyping.clear();
  updateTypingHint();
  seen.clear();
  $('chat').innerHTML = '';

  roomId = id;
  location.hash = encodeURIComponent(roomId);
  $('roomHint').textContent = `Room: ${roomId}`;
  $('shareQRBtn').style.display = 'flex';

  roomNode     = gun.get('lcg_rooms').get(roomId);
  presenceNode = gun.get('lcg_presence').get(roomId);

  watchPresence();

  roomNode.get('messages').map().on(async (msg, key) => {
    if (!msg || typeof msg !== 'object') return;
    const uid = msg.uid || key;
    if (seen.has(uid)) return;

    // Check if at bottom before rendering
    const wasAtBottom = isNearBottom();

    if (msg.type === 'image') {
      renderImage({
        me:   msg.from === deviceId,
        src:  msg.data,
        ts:   msg.ts || Date.now(),
        from: msg.from,
        name: msg.fromName || null
      });
    } else if (msg.type === 'video') {
      renderVideo({
        me:       msg.from === deviceId,
        src:      msg.data,
        ts:       msg.ts || Date.now(),
        from:     msg.from,
        name:     msg.fromName || null,
        fileName: msg.fileName || 'video'
      });
    } else if (msg.type === 'audio') {
      renderAudio({
        me:       msg.from === deviceId,
        src:      msg.data,
        ts:       msg.ts || Date.now(),
        from:     msg.from,
        name:     msg.fromName || null,
        fileName: msg.fileName || 'audio'
      });
    } else if (msg.type === 'file') {
      renderFile({
        me:       msg.from === deviceId,
        src:      msg.data,
        ts:       msg.ts || Date.now(),
        from:     msg.from,
        name:     msg.fromName || null,
        fileName: msg.fileName || 'file',
        mimeType: msg.mimeType || 'application/octet-stream'
      });
    } else {
      const text = await dec(msg.text);
      if (!text) return;
      renderMsg({
        me:   msg.from === deviceId,
        text: String(text),
        ts:   msg.ts || Date.now(),
        from: msg.from,
        name: msg.fromName || null
      });
    }

    // Auto-scroll if was at bottom
    if (wasAtBottom) {
      scrollChat();
    }
    toggleScrollButton();
  });

  toast(`Joined room "${id}"`);
  systemMsg(`— Joined room: ${id} —`);
}

/* ─── Render text message ─── */
function renderMsg({ me, text, ts, from, name }) {
  const box = document.createElement('div');
  
  // Only show sender name for others' messages
  const senderLabel = !me
    ? (name || 'id ' + (from || '–').slice(0, 8))
    : null;

  // Determine layout based on text length (use inline for short messages)
  const useInlineLayout = text.length <= 20;
  
  box.className = `lcg-msg ${me ? 'me' : 'them'}${useInlineLayout ? ' inline-meta' : ''}`;

  if (senderLabel) {
    box.innerHTML = `
      <div class="lcg-msg-content">${escapeHtml(text)}</div>
      <div class="lcg-msg-meta">
        <span>${escapeHtml(senderLabel)}</span>
        <span>·</span>
        <span>${fmtTime(ts)}</span>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="lcg-msg-content">${escapeHtml(text)}</div>
      <div class="lcg-msg-meta">
        <span>${fmtTime(ts)}</span>
      </div>
    `;
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render image message ─── */
function renderImage({ me, src, ts, from, name }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');

  // Only show sender name for others' messages
  const senderLabel = !me
    ? (name || 'id ' + (from || '–').slice(0, 8))
    : null;

  const img = document.createElement('img');
  img.className = 'lcg-msg-img';
  img.src = src;
  img.alt = 'Image';
  img.addEventListener('click', () => openLightbox(src));

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  if (senderLabel) {
    meta.innerHTML = `
      <span>${escapeHtml(senderLabel)}</span>
      <span>·</span>
      <span>${fmtTime(ts)}</span>
    `;
  } else {
    meta.innerHTML = `<span>${fmtTime(ts)}</span>`;
  }

  box.appendChild(img);
  box.appendChild(meta);
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Lightbox ─── */
function openLightbox(src) {
  $('lightboxImg').src = src;
  $('lightbox').classList.add('open');
}
$('lightboxClose').addEventListener('click', () => $('lightbox').classList.remove('open'));
$('lightbox').addEventListener('click', e => {
  if (e.target === $('lightbox')) $('lightbox').classList.remove('open');
});

/* ─── QR Code Modal ─── */
function openQRModal() {
  if (!roomId) {
    toast('Join a room first');
    return;
  }
  
  // Clear previous QR code
  $('qrContainer').innerHTML = '';
  
  // Generate QR code with room invite URL and secret if present
  let inviteUrl = location.origin + location.pathname + '#' + encodeURIComponent(roomId);
  if (secret) {
    inviteUrl += '?secret=' + encodeURIComponent(secret);
  }
  
  new QRCode($('qrContainer'), {
    text: inviteUrl,
    width: 240,
    height: 240,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
  
  // Set room ID display
  $('qrRoomId').textContent = roomId;
  
  // Show modal
  $('qrModal').classList.add('open');
}

$('qrClose').addEventListener('click', () => $('qrModal').classList.remove('open'));
$('qrModal').addEventListener('click', e => {
  if (e.target === $('qrModal')) $('qrModal').classList.remove('open');
});

$('shareQRBtn').addEventListener('click', openQRModal);

/* ─── Render video message ─── */
function renderVideo({ me, src, ts, from, name, fileName = 'video' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  const video = document.createElement('video');
  video.className = 'lcg-msg-img';
  video.src = src;
  video.controls = true;
  video.style.cursor = 'pointer';
  video.addEventListener('click', e => e.stopPropagation());

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  if (senderLabel) {
    meta.innerHTML = `
      <span>${escapeHtml(senderLabel)}</span>
      <span>·</span>
      <span>${fmtTime(ts)}</span>
    `;
  } else {
    meta.innerHTML = `<span>${fmtTime(ts)}</span>`;
  }

  box.appendChild(video);
  box.appendChild(meta);
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render audio message ─── */
function renderAudio({ me, src, ts, from, name, fileName = 'audio' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  const audio = document.createElement('audio');
  audio.className = 'lcg-msg-audio';
  audio.src = src;
  audio.controls = true;
  audio.style.width = '100%';
  audio.style.maxWidth = '300px';

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  if (senderLabel) {
    meta.innerHTML = `
      <span>${escapeHtml(senderLabel)}</span>
      <span>·</span>
      <span>${fmtTime(ts)}</span>
    `;
  } else {
    meta.innerHTML = `<span>${fmtTime(ts)}</span>`;
  }

  box.appendChild(audio);
  box.appendChild(meta);
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render generic file message ─── */
function renderFile({ me, src, ts, from, name, fileName = 'file', mimeType = 'application/octet-stream', sending = false }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  const fileContainer = document.createElement('div');
  fileContainer.style.display = 'flex';
  fileContainer.style.alignItems = 'center';
  fileContainer.style.gap = '12px';
  fileContainer.style.padding = '8px 0';

  const icon = document.createElement('i');
  icon.className = `fas ${sending ? 'fa-hourglass-end' : getFileIcon(mimeType, fileName)}`;
  icon.style.fontSize = '20px';
  icon.style.color = me ? 'currentColor' : 'var(--accent)';
  icon.style.opacity = me ? '0.9' : '1';

  const fileInfo = document.createElement('div');
  fileInfo.style.display = 'flex';
  fileInfo.style.flexDirection = 'column';
  fileInfo.style.minWidth = '0';
  fileInfo.style.gap = '2px';

  const fileName_el = document.createElement('div');
  fileName_el.style.fontWeight = '500';
  fileName_el.style.wordBreak = 'break-word';
  fileName_el.style.fontSize = '14px';
  fileName_el.textContent = fileName;

  fileInfo.appendChild(fileName_el);

  if (sending) {
    const sendingLabel = document.createElement('div');
    sendingLabel.style.fontSize = '11px';
    sendingLabel.style.opacity = '0.7';
    sendingLabel.textContent = '⏳ Sending file…';
    fileInfo.appendChild(sendingLabel);
  } else {
    const fileLink = document.createElement('a');
    fileLink.href = src;
    fileLink.download = fileName;
    fileLink.style.color = me ? 'currentColor' : 'var(--accent)';
    fileLink.style.fontSize = '12px';
    fileLink.textContent = '⬇️ Download';
    fileLink.style.textDecoration = 'none';
    fileLink.style.cursor = 'pointer';
    fileLink.style.display = 'inline-block';
    fileLink.style.padding = '2px 6px';
    fileLink.style.borderRadius = '4px';
    fileLink.style.transition = 'opacity 120ms ease';
    fileLink.style.width = 'fit-content';
    
    fileLink.addEventListener('mouseover', () => {
      fileLink.style.opacity = '0.8';
    });
    fileLink.addEventListener('mouseout', () => {
      fileLink.style.opacity = '1';
    });
    
    fileInfo.appendChild(fileLink);
  }

  fileContainer.appendChild(icon);
  fileContainer.appendChild(fileInfo);
  box.appendChild(fileContainer);

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  if (senderLabel) {
    meta.innerHTML = `
      <span>${escapeHtml(senderLabel)}</span>
      <span>·</span>
      <span>${fmtTime(ts)}</span>
    `;
  } else {
    meta.innerHTML = `<span>${fmtTime(ts)}</span>`;
  }

  box.appendChild(meta);
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Send text ─── */
$('send').addEventListener('click', sendMessage);
$('text').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

$('text').addEventListener('input', () => {
  setMyTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => setMyTyping(false), 2500);
});

async function sendMessage() {
  const t = $('text').value.trim();
  if (!t) return;
  if (!roomId) { toast('Join a room first'); return; }
  if (!roomNode) { toast('Room not connected, please try joining again'); return; }

  setMyTyping(false);
  clearTimeout(typingTimer);

  const uid = crypto.randomUUID();
  const payload = {
    uid,
    from:     deviceId,
    fromName: getDisplayName() || 'Anonymous',
    ts:       Date.now(),
    type:     'text',
    text:     await enc(t)
  };

  seen.add(uid);
  renderMsg({ me: true, text: t, ts: payload.ts, from: deviceId, name: getDisplayName() });
  $('text').value = '';
  $('text').focus();
  roomNode.get('messages').set(payload);
}

/* ─── Send file ─── */
$('fileInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!roomId) { toast('Join a room first'); return; }
  if (!roomNode) { toast('Room not connected, please try joining again'); return; }

  const maxSize = 10 * 1024 * 1024; // 10MB hard limit
  if (file.size > maxSize) {
    toast(`File too large (max 10MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    return;
  }

  // Show "Sending file..." message with file info
  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  const sizeHint = file.size < 2 * 1024 * 1024 ? '✓' : '⚠';
  toast(`${sizeHint} Sending file… (${fileSize}MB)`, 4000);

  const mediaType = getMediaType(file.type);
  
  // First, show "sending" message
  const sendingMessageBox = document.createElement('div');
  const uid = crypto.randomUUID();
  seen.add(uid);
  
  if (mediaType === 'file') {
    renderFile({ 
      me: true, 
      src: '', 
      ts: Date.now(), 
      from: deviceId, 
      name: getDisplayName(), 
      fileName: file.name, 
      mimeType: file.type,
      sending: true
    });
  }

  const reader = new FileReader();
  reader.onload = async ev => {
    const dataUrl = ev.target.result;
    
    const basePayload = {
      uid,
      from:     deviceId,
      fromName: getDisplayName() || 'Anonymous',
      ts:       Date.now(),
      data:     dataUrl,
      fileName: file.name,
      mimeType: file.type
    };

    if (mediaType === 'image') {
      basePayload.type = 'image';
      renderImage({ me: true, src: dataUrl, ts: basePayload.ts, from: deviceId, name: getDisplayName() });
    } else if (mediaType === 'video') {
      basePayload.type = 'video';
      renderVideo({ me: true, src: dataUrl, ts: basePayload.ts, from: deviceId, name: getDisplayName(), fileName: file.name });
    } else if (mediaType === 'audio') {
      basePayload.type = 'audio';
      renderAudio({ me: true, src: dataUrl, ts: basePayload.ts, from: deviceId, name: getDisplayName(), fileName: file.name });
    } else {
      basePayload.type = 'file';
      // Remove the sending message and add the real one
      const messages = $('chat').querySelectorAll('.lcg-msg');
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.textContent.includes('Sending file')) {
          lastMsg.remove();
        }
      }
      renderFile({ me: true, src: dataUrl, ts: basePayload.ts, from: deviceId, name: getDisplayName(), fileName: file.name, mimeType: file.type, sending: false });
    }

    roomNode.get('messages').set(basePayload);
    toast('File sent!', 2000);
  };

  reader.onerror = () => {
    toast('Error reading file');
  };

  reader.readAsDataURL(file);
});

/* ─── Toolbar actions ─── */
$('join').addEventListener('click', () => joinRoom($('room').value.trim()));

$('copyLink').addEventListener('click', async () => {
  const id = $('room').value.trim();
  let url = location.origin + location.pathname + '#' + encodeURIComponent(id);
  
  // Include secret in URL if present
  if (secret) {
    url += '?secret=' + encodeURIComponent(secret);
  }
  
  await navigator.clipboard.writeText(url);
  toast('Invite link copied!');
});

$('clearBtn').addEventListener('click', () => {
  if (!confirm('Clear all messages from your view? (Does not delete from relay)')) return;
  $('chat').innerHTML = '';
  seen.clear();
  systemMsg('— Chat cleared (local only) —');
});

/* ─── Auto-join on load ─── */
window.addEventListener('load', () => {
  secret = $('secret').value;
  setEncHint();
  joinRoom($('room').value.trim());
});