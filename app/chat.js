/* ═══════════════════════════════════════════════════════════════
   CHAT OPERATIONS & ROOM MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

/* ─── Room state ─── */
let roomId = '';
let secret = '';
let roomNode = null;
let presenceNode = null;
const seen = new Set();
const msgStatus = new Map(); // uid → { status: 'sending'|'sent'|'seen', element: DOM }

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
    
    // Clear the hash to remove secret from URL
    history.replaceState(null, '', location.pathname + '#' + encodeURIComponent(roomId));
  }
}

initFromHash();

$('secret').addEventListener('input', () => { secret = $('secret').value; });

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
    
    // Mark as seen immediately to prevent duplicates
    seen.add(uid);

    // Check if at bottom before rendering
    const wasAtBottom = isNearBottom();

    if (msg.type === 'image') {
      renderImage({
        me:   msg.from === deviceId,
        src:  msg.data,
        ts:   msg.ts || Date.now(),
        from: msg.from,
        name: msg.fromName || null,
        uid:  msg.uid || key,
        status: 'sent'
      });
    } else if (msg.type === 'video') {
      renderVideo({
        me:       msg.from === deviceId,
        src:      msg.data,
        ts:       msg.ts || Date.now(),
        from:     msg.from,
        name:     msg.fromName || null,
        fileName: msg.fileName || 'video',
        uid:      msg.uid || key,
        status:   'sent'
      });
    } else if (msg.type === 'audio') {
      renderAudio({
        me:       msg.from === deviceId,
        src:      msg.data,
        ts:       msg.ts || Date.now(),
        from:     msg.from,
        name:     msg.fromName || null,
        fileName: msg.fileName || 'audio',
        uid:      msg.uid || key,
        status:   'sent'
      });
    } else if (msg.type === 'file') {
      renderFile({
        me:       msg.from === deviceId,
        src:      msg.data,
        ts:       msg.ts || Date.now(),
        from:     msg.from,
        name:     msg.fromName || null,
        fileName: msg.fileName || 'file',
        mimeType: msg.mimeType || 'application/octet-stream',
        uid:      msg.uid || key,
        status:   'sent'
      });
    } else {
      const text = await dec(msg.text);
      if (!text) return;
      renderMsg({
        me:   msg.from === deviceId,
        text: String(text),
        ts:   msg.ts || Date.now(),
        from: msg.from,
        name: msg.fromName || null,
        uid:  msg.uid || key,
        status: 'sent'
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
  
  // Listen for edit signals
  roomNode.get('edits').map().on(async (edit, key) => {
    if (!edit || typeof edit !== 'object') return;
    if (edit.from === deviceId) return; // Ignore own edits
    
    // Find message element by UID
    const msgBox = $('chat').querySelector(`[data-uid="${edit.msgUid}"]`);
    if (msgBox && edit.text) {
      try {
        const decryptedText = await dec(edit.text);
        const contentDiv = msgBox.querySelector('.lcg-msg-content');
        if (contentDiv) {
          contentDiv.textContent = decryptedText;
          contentDiv.style.opacity = '0.8';
          contentDiv.style.fontStyle = 'italic';
        }
      } catch (e) {
        const contentDiv = msgBox.querySelector('.lcg-msg-content');
        if (contentDiv) {
          contentDiv.textContent = '(Failed to decrypt edited message)';
        }
      }
      toast(`Message edited by ${edit.fromName || 'someone'}`);
    }
  });
  
  // Listen for delete signals
  roomNode.get('deletes').map().on((del, key) => {
    if (!del || typeof del !== 'object') return;
    
    // Find and remove message by UID
    const msgBox = $('chat').querySelector(`[data-uid="${del.msgUid}"]`);
    if (msgBox) {
      msgBox.style.animation = 'msg-disappear 200ms var(--ease) forwards';
      setTimeout(() => {
        if (msgBox.parentNode) {
          msgBox.parentNode.removeChild(msgBox);
        }
      }, 200);
      if (del.from !== deviceId) {
        toast(`Message deleted by sender`);
      }
    }
  });
  
  // Listen for reactions
  roomNode.get('reactions').map().on((reaction, key) => {
    if (!reaction || typeof reaction !== 'object') return;
    if (!reaction.msgUid || !reaction.emoji) return;
    
    // Track reaction
    if (!msgReactions.has(reaction.msgUid)) {
      msgReactions.set(reaction.msgUid, {});
    }
    const reactions = msgReactions.get(reaction.msgUid);
    reactions[reaction.emoji] = (reactions[reaction.emoji] || 0) + 1;
    
    // Display reactions for this message
    displayReactions(reaction.msgUid);
    
    // Show toast for others' reactions
    if (reaction.from !== deviceId) {
      toast(`${reaction.fromName || 'Someone'} reacted: ${reaction.emoji}`);
    }
  });
}

/* ─── Update message status ─── */
function updateMessageStatus(uid, newStatus) {
  if (!msgStatus.has(uid)) return;
  const msg = msgStatus.get(uid);
  msg.status = newStatus;
  if (msg.element) {
    msg.element.innerHTML = getStatusIcon(newStatus);
    msg.element.title = newStatus;
  }
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
  // Show message with 'sending' status initially
  renderMsg({ me: true, text: t, ts: payload.ts, from: deviceId, name: getDisplayName(), uid, status: 'sending' });
  $('text').value = '';
  $('text').focus();
  roomNode.get('messages').set(payload);
  
  // Update status to 'sent' after storing
  setTimeout(() => updateMessageStatus(uid, 'sent'), 100);
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
  joinRoom($('room').value.trim());
});
