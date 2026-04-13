/* ═══════════════════════════════════════════════════════════════
   MESSAGE RENDERING & REACTIONS
   ═══════════════════════════════════════════════════════════════ */

/* ─── Message state ─── */
let currentMsgElement = null;
let currentMsgUid = null;
let currentMsgText = null;
let currentMsgIsOwned = false; // Whether current message is owned by this device
const msgReactions = new Map(); // uid → { emoji: count, ... }
const EMOJIS = ['👍', '❤️', '😂', '🔥', '😍', '🎉', '😢', '😱', '🤔', '👏', '🙏', '✨'];

/* ─── Render text message ─── */
function renderMsg({ me, text, ts, from, name, uid, status = 'sent' }) {
  const box = document.createElement('div');
  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;
  const useInlineLayout = text.length <= 20;
  
  box.className = `lcg-msg ${me ? 'me' : 'them'}${useInlineLayout ? ' inline-meta' : ''}`;
  box.style.cursor = 'context-menu';
  if (uid) box.setAttribute('data-uid', uid);

  let metaHTML = senderLabel 
    ? `<span>${escapeHtml(senderLabel)}</span><span>·</span><span>${fmtTime(ts)}</span>`
    : `<span>${fmtTime(ts)}</span>`;

  if (me && uid) {
    const statusIcon = getStatusIcon(status);
    metaHTML += `<span class="msg-status" data-uid="${uid}" title="${status}">${statusIcon}</span>`;
  }

  box.innerHTML = `
    <div class="lcg-msg-content">${escapeHtml(text)}</div>
    <div class="lcg-msg-meta">${metaHTML}</div>
  `;
  
  if (me && uid) {
    msgStatus.set(uid, { status, element: box.querySelector('[data-uid]') });
  }
  
  if (uid) {
    box.addEventListener('contextmenu', (e) => openContextMenu(e, box, uid));
    let longPressTimer;
    box.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        openContextMenu(new MouseEvent('contextmenu', { bubbles: true }), box, uid);
      }, 500);
    });
    box.addEventListener('touchend', () => clearTimeout(longPressTimer));
    
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'msg-reactions';
    reactionsContainer.id = `reactions-${uid}`;
    reactionsContainer.style.display = 'none';
    box.appendChild(reactionsContainer);
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render image message ─── */
function renderImage({ me, src, ts, from, name, uid, status = 'sent' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');
  if (uid) box.setAttribute('data-uid', uid);

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  const img = document.createElement('img');
  img.className = 'lcg-msg-img';
  img.src = src;
  img.alt = 'Image';
  img.addEventListener('click', () => openLightbox(src));

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  let metaHTML = senderLabel
    ? `<span>${escapeHtml(senderLabel)}</span><span>·</span><span>${fmtTime(ts)}</span>`
    : `<span>${fmtTime(ts)}</span>`;
  
  if (me && uid) {
    const statusIcon = getStatusIcon(status);
    metaHTML += `<span class="msg-status" data-uid="${uid}" title="${status}">${statusIcon}</span>`;
  }
  
  meta.innerHTML = metaHTML;

  if (me && uid) {
    msgStatus.set(uid, { status, element: meta.querySelector('[data-uid]') });
  }

  box.appendChild(img);
  box.appendChild(meta);
  
  if (uid) {
    box.style.cursor = 'context-menu';
    box.addEventListener('contextmenu', (e) => openContextMenu(e, box, uid));
    let longPressTimer;
    box.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        openContextMenu(new MouseEvent('contextmenu', { bubbles: true }), box, uid);
      }, 500);
    });
    box.addEventListener('touchend', () => clearTimeout(longPressTimer));
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render video message ─── */
function renderVideo({ me, src, ts, from, name, fileName = 'video', uid, status = 'sent' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');
  if (uid) box.setAttribute('data-uid', uid);

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  const video = document.createElement('video');
  video.className = 'lcg-msg-img';
  video.src = src;
  video.controls = true;
  video.style.cursor = 'pointer';
  video.addEventListener('click', e => e.stopPropagation());

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  let metaHTML = senderLabel
    ? `<span>${escapeHtml(senderLabel)}</span><span>·</span><span>${fmtTime(ts)}</span>`
    : `<span>${fmtTime(ts)}</span>`;
  
  if (me && uid) {
    const statusIcon = getStatusIcon(status);
    metaHTML += `<span class="msg-status" data-uid="${uid}" title="${status}">${statusIcon}</span>`;
  }
  
  meta.innerHTML = metaHTML;
  
  if (me && uid) {
    msgStatus.set(uid, { status, element: meta.querySelector('[data-uid]') });
  }

  box.appendChild(video);
  box.appendChild(meta);
  
  if (uid) {
    box.style.cursor = 'context-menu';
    box.addEventListener('contextmenu', (e) => openContextMenu(e, box, uid));
    let longPressTimer;
    box.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        openContextMenu(new MouseEvent('contextmenu', { bubbles: true }), box, uid);
      }, 500);
    });
    box.addEventListener('touchend', () => clearTimeout(longPressTimer));
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render audio message ─── */
function renderAudio({ me, src, ts, from, name, fileName = 'audio', uid, status = 'sent' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');
  if (uid) box.setAttribute('data-uid', uid);

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  const audio = document.createElement('audio');
  audio.className = 'lcg-msg-audio';
  audio.src = src;
  audio.controls = true;
  audio.style.width = '100%';
  audio.style.maxWidth = '300px';

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  let metaHTML = senderLabel
    ? `<span>${escapeHtml(senderLabel)}</span><span>·</span><span>${fmtTime(ts)}</span>`
    : `<span>${fmtTime(ts)}</span>`;
  
  if (me && uid) {
    const statusIcon = getStatusIcon(status);
    metaHTML += `<span class="msg-status" data-uid="${uid}" title="${status}">${statusIcon}</span>`;
  }
  
  meta.innerHTML = metaHTML;
  
  if (me && uid) {
    msgStatus.set(uid, { status, element: meta.querySelector('[data-uid]') });
  }

  box.appendChild(audio);
  box.appendChild(meta);
  
  if (uid) {
    box.style.cursor = 'context-menu';
    box.addEventListener('contextmenu', (e) => openContextMenu(e, box, uid));
    let longPressTimer;
    box.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        openContextMenu(new MouseEvent('contextmenu', { bubbles: true }), box, uid);
      }, 500);
    });
    box.addEventListener('touchend', () => clearTimeout(longPressTimer));
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Render file message ─── */
function renderFile({ me, src, ts, from, name, fileName = 'file', mimeType = 'application/octet-stream', sending = false, uid, status = 'sent' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');
  if (uid) box.setAttribute('data-uid', uid);

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
    
    fileLink.addEventListener('mouseover', () => fileLink.style.opacity = '0.8');
    fileLink.addEventListener('mouseout', () => fileLink.style.opacity = '1');
    
    fileInfo.appendChild(fileLink);
  }

  fileContainer.appendChild(icon);
  fileContainer.appendChild(fileInfo);
  box.appendChild(fileContainer);

  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  let metaHTML = senderLabel
    ? `<span>${escapeHtml(senderLabel)}</span><span>·</span><span>${fmtTime(ts)}</span>`
    : `<span>${fmtTime(ts)}</span>`;
  
  if (me && uid) {
    const statusIcon = getStatusIcon(status);
    metaHTML += `<span class="msg-status" data-uid="${uid}" title="${status}">${statusIcon}</span>`;
  }
  
  meta.innerHTML = metaHTML;
  
  if (me && uid) {
    msgStatus.set(uid, { status, element: meta.querySelector('[data-uid]') });
  }

  box.appendChild(meta);
  
  if (uid) {
    box.style.cursor = 'context-menu';
    box.addEventListener('contextmenu', (e) => openContextMenu(e, box, uid));
    let longPressTimer;
    box.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        openContextMenu(new MouseEvent('contextmenu', { bubbles: true }), box, uid);
      }, 500);
    });
    box.addEventListener('touchend', () => clearTimeout(longPressTimer));
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

/* ─── Context Menu Functions ─── */
function initEmojiPicker() {
  const picker = $('emojiPicker');
  EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.addEventListener('click', () => addReaction(emoji));
    picker.appendChild(btn);
  });
}

function closeContextMenu() {
  $('msgContextMenu').classList.remove('open');
  $('emojiPicker').classList.remove('open');
  currentMsgElement = null;
  currentMsgUid = null;
  currentMsgText = null;
  currentMsgIsOwned = false;
}

function openContextMenu(e, msgElement, uid) {
  e.preventDefault();
  e.stopPropagation();
  
  currentMsgElement = msgElement;
  currentMsgUid = uid;
  currentMsgIsOwned = msgElement.classList.contains('me'); // Check if message has 'me' class
  
  const contentDiv = msgElement.querySelector('.lcg-msg-content');
  currentMsgText = contentDiv ? contentDiv.textContent : '';
  
  const menu = $('msgContextMenu');
  const rect = msgElement.getBoundingClientRect();
  
  menu.style.top = (rect.top + window.scrollY - 10) + 'px';
  menu.style.left = (rect.right + 10) + 'px';
  
  // Show/hide edit and delete buttons based on message ownership
  const editBtn = $('editMsgBtn');
  const deleteBtn = $('deleteMsgBtn');
  editBtn.style.display = currentMsgIsOwned ? 'block' : 'none';
  deleteBtn.style.display = currentMsgIsOwned ? 'block' : 'none';
  
  menu.classList.add('open');
}

function displayReactions(uid) {
  const reactionsContainer = $(`reactions-${uid}`);
  if (!reactionsContainer) return;
  
  if (!msgReactions.has(uid) || Object.keys(msgReactions.get(uid)).length === 0) {
    reactionsContainer.style.display = 'none';
    return;
  }
  
  const reactions = msgReactions.get(uid);
  reactionsContainer.innerHTML = '';
  
  Object.entries(reactions).forEach(([emoji, count]) => {
    const badge = document.createElement('div');
    badge.className = 'reaction-badge';
    badge.innerHTML = `<span class="reaction-emoji">${emoji}</span><span class="reaction-count">${count}</span>`;
    reactionsContainer.appendChild(badge);
  });
  
  reactionsContainer.style.display = 'flex';
}

function addReaction(emoji) {
  if (!currentMsgUid || !roomNode) {
    toast('Message or room context lost');
    closeContextMenu();
    return;
  }
  
  if (!msgReactions.has(currentMsgUid)) {
    msgReactions.set(currentMsgUid, {});
  }
  const reactions = msgReactions.get(currentMsgUid);
  reactions[emoji] = (reactions[emoji] || 0) + 1;
  
  displayReactions(currentMsgUid);
  
  roomNode.get('reactions').get(currentMsgUid).get(crypto.randomUUID()).put({
    msgUid: currentMsgUid,
    from: deviceId,
    fromName: getDisplayName() || 'Anonymous',
    emoji: emoji,
    ts: Date.now()
  });
  
  toast(`Reacted with ${emoji}`);
  closeContextMenu();
}

/* ─── Context Menu Event Handlers ─── */
$('editMsgBtn').addEventListener('click', async () => {
  if (!currentMsgElement || !currentMsgUid) return;
  
  if (!currentMsgIsOwned) {
    toast("You can only edit your own messages");
    closeContextMenu();
    return;
  }
  
  const newText = prompt('Edit message:', currentMsgText);
  if (newText === null || newText.trim() === '') {
    closeContextMenu();
    return;
  }
  
  const trimmedText = newText.trim();
  
  const contentDiv = currentMsgElement.querySelector('.lcg-msg-content');
  if (contentDiv) {
    contentDiv.textContent = trimmedText;
    contentDiv.style.opacity = '0.8';
    contentDiv.style.fontStyle = 'italic';
  }
  
  roomNode.get('edits').get(crypto.randomUUID()).put({
    msgUid: currentMsgUid,
    from: deviceId,
    text: await enc(trimmedText),
    ts: Date.now()
  });
  
  toast('Message edited');
  closeContextMenu();
});

$('deleteMsgBtn').addEventListener('click', () => {
  if (!currentMsgElement || !currentMsgUid) return;
  
  if (!currentMsgIsOwned) {
    toast("You can only delete your own messages");
    closeContextMenu();
    return;
  }
  
  if (!confirm('Delete this message? This will notify other devices.')) {
    closeContextMenu();
    return;
  }
  
  roomNode.get('deletes').get(crypto.randomUUID()).put({
    msgUid: currentMsgUid,
    from: deviceId,
    ts: Date.now()
  });
  
  currentMsgElement.style.animation = 'msg-disappear 200ms var(--ease) forwards';
  setTimeout(() => {
    if (currentMsgElement && currentMsgElement.parentNode) {
      currentMsgElement.parentNode.removeChild(currentMsgElement);
    }
  }, 200);
  
  toast('Message deleted');
  closeContextMenu();
});

$('reactMsgBtn').addEventListener('click', () => {
  const menu = $('msgContextMenu');
  const picker = $('emojiPicker');
  
  const rect = menu.getBoundingClientRect();
  picker.style.top = (rect.top + window.scrollY) + 'px';
  picker.style.left = (rect.left + 200) + 'px';
  picker.classList.add('open');
});

$('copyMsgBtn').addEventListener('click', () => {
  if (!currentMsgText) {
    toast('No text to copy');
    closeContextMenu();
    return;
  }
  
  navigator.clipboard.writeText(currentMsgText).then(() => {
    toast('Text copied to clipboard');
    closeContextMenu();
  }).catch(() => {
    toast('Failed to copy text');
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#msgContextMenu') && !e.target.closest('#emojiPicker')) {
    closeContextMenu();
  }
});

initEmojiPicker();
