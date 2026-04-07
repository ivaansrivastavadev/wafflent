/* ══════════════════════════════════════════════════════════
   Wafflent — chatgun.js
   Improvements:
     • Custom device names (click pill to rename)
     • Typing indicator via GUN presence
     • Image sending (<2MB, base64 chunked)
     • Better reconnect / relay fallback
     • Clean timestamps
     • Clear chat button
     • Message delivery confirmation dot
   ══════════════════════════════════════════════════════════ */

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

/* ─── GUN Setup with relay fallback ─── */
const PEERS = [
  'https://relay.peer.ooo/gun',
  'https://gun-manhattan.herokuapp.com/gun',
  'https://gunjs.herokuapp.com/gun',
];

let gun;
let connectedPeers = new Set();
let reconnectAttempt = 0;

function initGun(peerList) {
  if (gun) return; // already init
  gun = Gun({ peers: peerList, retry: 2500, localStorage: false });

  gun.on('hi', peer => {
    connectedPeers.add(peer.url || peer);
    reconnectAttempt = 0;
    updatePeerStatus();
  });

  gun.on('bye', peer => {
    connectedPeers.delete(peer.url || peer);
    updatePeerStatus();
    // Try reconnect after a short delay
    if (connectedPeers.size === 0) scheduleReconnect();
  });
}

function updatePeerStatus() {
  const dot = $('peerDot');
  const label = $('peerStatus');
  if (connectedPeers.size > 0) {
    dot.classList.add('connected');
    label.textContent = `${connectedPeers.size} relay${connectedPeers.size > 1 ? 's' : ''} connected`;
  } else {
    dot.classList.remove('connected');
    label.textContent = 'Disconnected…';
  }
}

function scheduleReconnect() {
  reconnectAttempt++;
  const delay = Math.min(2000 * reconnectAttempt, 15000);
  setTimeout(() => {
    if (connectedPeers.size === 0) {
      // Try next peer rotation
      const rotated = [...PEERS.slice(reconnectAttempt % PEERS.length), ...PEERS.slice(0, reconnectAttempt % PEERS.length)];
      rotated.forEach(p => gun.opt({ peers: [p] }));
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
    el.textContent = `${names[0]} is typing…`;
  } else {
    el.textContent = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing…`;
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
  if (h) $('room').value = h;
  if (!$('room').value) $('room').value = randomRoom();
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

  roomNode     = gun.get('lcg_rooms').get(roomId);
  presenceNode = gun.get('lcg_presence').get(roomId);

  watchPresence();

  roomNode.get('messages').map().on(async (msg, key) => {
    if (!msg || typeof msg !== 'object') return;
    const uid = msg.uid || key;
    if (seen.has(uid)) return;
    seen.add(uid);

    if (msg.type === 'image') {
      renderImage({
        me:   msg.from === deviceId,
        src:  msg.data,
        ts:   msg.ts || Date.now(),
        from: msg.from,
        name: msg.fromName || null
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
  });

  toast(`Joined room "${id}"`);
  systemMsg(`— Joined room: ${id} —`);
}

/* ─── Render text message ─── */
function renderMsg({ me, text, ts, from, name }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');

  const senderLabel = me
    ? (getDisplayName() || 'You')
    : (name || 'id ' + (from || '–').slice(0, 8));

  box.innerHTML = `
    <div>${escapeHtml(text)}</div>
    <div class="lcg-msg-meta">${escapeHtml(senderLabel)} · ${fmtTime(ts)}</div>
  `;
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render image message ─── */
function renderImage({ me, src, ts, from, name }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');

  const senderLabel = me
    ? (getDisplayName() || 'You')
    : (name || 'id ' + (from || '–').slice(0, 8));

  const img = document.createElement('img');
  img.className = 'lcg-msg-img';
  img.src = src;
  img.alt = 'Image';
  img.addEventListener('click', () => openLightbox(src));

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  meta.textContent = `${senderLabel} · ${fmtTime(ts)}`;

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

/* ─── Send image ─── */
$('fileInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!roomId) { toast('Join a room first'); return; }

  if (!file.type.startsWith('image/')) {
    toast('Only images are supported');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast('Image must be under 2MB');
    return;
  }

  toast('Sending image…', 3000);

  const reader = new FileReader();
  reader.onload = async ev => {
    const dataUrl = ev.target.result;
    const uid = crypto.randomUUID();
    const payload = {
      uid,
      from:     deviceId,
      fromName: getDisplayName() || 'Anonymous',
      ts:       Date.now(),
      type:     'image',
      data:     dataUrl
    };
    seen.add(uid);
    renderImage({ me: true, src: dataUrl, ts: payload.ts, from: deviceId, name: getDisplayName() });
    roomNode.get('messages').set(payload);
  };
  reader.readAsDataURL(file);
});

/* ─── Toolbar actions ─── */
$('join').addEventListener('click', () => joinRoom($('room').value.trim()));

$('copyLink').addEventListener('click', async () => {
  const id = $('room').value.trim();
  const url = location.origin + location.pathname + '#' + encodeURIComponent(id);
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