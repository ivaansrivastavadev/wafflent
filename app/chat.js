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
/* Note: enc() and dec() are defined in utils.js and available globally */

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
       const decryptedData = await dec(msg.data);
       renderImage({
         me:   msg.from === deviceId,
         src:  decryptedData,
         ts:   msg.ts || Date.now(),
         from: msg.from,
         name: msg.fromName || null,
         uid:  msg.uid || key,
         status: 'sent'
       });
     } else if (msg.type === 'video') {
       const decryptedData = await dec(msg.data);
       const decryptedFileName = await dec(msg.fileName);
       renderVideo({
         me:       msg.from === deviceId,
         src:      decryptedData,
         ts:       msg.ts || Date.now(),
         from:     msg.from,
         name:     msg.fromName || null,
         fileName: decryptedFileName || 'video',
         uid:      msg.uid || key,
         status:   'sent'
       });
     } else if (msg.type === 'audio') {
       const decryptedData = await dec(msg.data);
       const decryptedFileName = await dec(msg.fileName);
       renderAudio({
         me:       msg.from === deviceId,
         src:      decryptedData,
         ts:       msg.ts || Date.now(),
         from:     msg.from,
         name:     msg.fromName || null,
         fileName: decryptedFileName || 'audio',
         uid:      msg.uid || key,
         status:   'sent'
       });
      } else if (msg.type === 'file') {
        const decryptedData = await dec(msg.data);
        const decryptedFileName = await dec(msg.fileName);
        const decryptedMimeType = await dec(msg.mimeType);
        renderFile({
          me:       msg.from === deviceId,
          src:      decryptedData,
          ts:       msg.ts || Date.now(),
          from:     msg.from,
          name:     msg.fromName || null,
          fileName: decryptedFileName || 'file',
          mimeType: decryptedMimeType || 'application/octet-stream',
          uid:      msg.uid || key,
          status:   'sent'
        });
      } else if (msg.type === 'voice') {
        const decryptedData = await dec(msg.data);
        const decryptedDuration = parseInt(await dec(msg.duration)) || 0;
        renderVoice({
          me:       msg.from === deviceId,
          src:      decryptedData,
          ts:       msg.ts || Date.now(),
          from:     msg.from,
          name:     msg.fromName || null,
          duration: decryptedDuration,
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
    // Defer button toggle to after scroll completes
    setTimeout(() => toggleScrollButton(), 0);
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
  
  // Listen for reactions - simple and direct
  roomNode.get('reactions').on((data, key) => {
    if (!data || typeof data !== 'object') return;
    
    // Iterate through all messages with reactions
    Object.keys(data).forEach(msgUid => {
      if (msgUid === '_' || msgUid === '#') return; // Skip Gun metadata
      
      const msgReactionsObj = data[msgUid];
      if (!msgReactionsObj || typeof msgReactionsObj !== 'object') return;
      
      // Count reactions per emoji
      const emojiCount = {};
      Object.values(msgReactionsObj).forEach(reaction => {
        if (reaction && reaction.emoji) {
          emojiCount[reaction.emoji] = (emojiCount[reaction.emoji] || 0) + 1;
        }
      });
      
      // Update the reaction map and display
      if (Object.keys(emojiCount).length > 0) {
        msgReactions.set(msgUid, emojiCount);
        displayReactions(msgUid);
      }
    });
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
$('send').addEventListener('click', () => {
  sendMessage();
  // Update voice button after sending
  setTimeout(() => toggleVoiceButton(), 50);
});
$('text').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { 
    e.preventDefault(); 
    sendMessage(); 
    // Update voice button after sending
    setTimeout(() => toggleVoiceButton(), 50);
  }
});

/* ─── Voice message ─── */
// Voice recording is now handled by hold-to-record in voice.js


$('text').addEventListener('input', () => {
  setMyTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => setMyTyping(false), 2500);
  toggleVoiceButton();
});

/* ─── Toggle voice button visibility ─── */
function toggleVoiceButton() {
  const textInput = $('text');
  const sendBtn = $('send');
  const voiceBtn = $('voiceBtn');
  
  const isEmpty = textInput.value.trim() === '';
  
  if (isEmpty) {
    sendBtn.style.display = 'none';
    voiceBtn.style.display = 'flex';
  } else {
    sendBtn.style.display = 'flex';
    voiceBtn.style.display = 'none';
  }
}

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
  toggleVoiceButton();
  
  // Show attachment buttons again
  const stickerBtn = $('stickerBtn');
  const attachBtn = document.querySelector('.lcg-attach');
  if (stickerBtn) stickerBtn.style.display = 'flex';
  if (attachBtn) attachBtn.style.display = 'flex';
  
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
     
     // Encrypt media data and metadata
     const encryptedData = await enc(dataUrl);
     const encryptedFileName = await enc(file.name);
     const encryptedMimeType = await enc(file.type);
     
     const basePayload = {
       uid,
       from:     deviceId,
       fromName: getDisplayName() || 'Anonymous',
       ts:       Date.now(),
       data:     encryptedData,
       fileName: encryptedFileName,
       mimeType: encryptedMimeType
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

/* ─── Auto-join on load ─── */
window.addEventListener('load', () => {
  secret = $('secret').value;
  joinRoom($('room').value.trim());
  // Initialize voice button visibility
  setTimeout(() => toggleVoiceButton(), 0);
});

// Also try to initialize voice button as soon as this script loads
// (in case DOM is already ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', toggleVoiceButton);
} else {
  // DOM is already loaded, call immediately
  toggleVoiceButton();
}
