/* ═══════════════════════════════════════════════════════════════
   UTILITIES & HELPERS
   ═══════════════════════════════════════════════════════════════ */

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

/* ─── Formatting ─── */
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

/* ─── Toast notifications ─── */
let toastTimer;
function toast(msg, duration = 1800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ─── System messages ─── */
function systemMsg(text) {
  const div = document.createElement('div');
  div.className = 'lcg-msg system';
  div.textContent = text;
  $('chat').appendChild(div);
  scrollChat();
}

/* ─── Chat scroll ─── */
function scrollChat() {
  const c = $('chat');
  c.scrollTop = c.scrollHeight;
}

function isNearBottom() {
  const c = $('chat');
  return c.scrollHeight - c.scrollTop - c.clientHeight < 100;
}

function toggleScrollButton() {
   const btn = $('scrollDownBtn');
   const c = $('chat');
   const isAtBottom = isNearBottom();
   const isScreenFilled = c.scrollHeight > c.clientHeight;
   // Only show button if there's content to scroll to (screen filled) and user has scrolled up
   btn.style.display = (!isAtBottom && isScreenFilled) ? 'flex' : 'none';
 }

/* ─── Encryption helpers ─── */
async function enc(plain) {
  if (!secret) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain)
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function dec(cipher) {
  if (!secret) return cipher;
  try {
    const combined = Uint8Array.from(atob(cipher), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      combined.slice(12)
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('Decryption error:', e);
    return '(Failed to decrypt)';
  }
}

/* ─── Lightbox ─── */
function openLightbox(src) {
  const lightbox = $('lightbox');
  const img = lightbox.querySelector('img');
  img.src = src;
  lightbox.classList.add('open');
}

$('lightbox').addEventListener('click', (e) => {
  if (e.target === $('lightbox')) {
    $('lightbox').classList.remove('open');
  }
});

/* ─── Message status icon ─── */
function getStatusIcon(status) {
  const icons = {
    'sending': '<i class="fas fa-hourglass-end" style="opacity:0.5;"></i>',
    'sent': '<i class="fas fa-check"></i>',
    'seen': '<i class="fas fa-check-double" style="color:var(--accent);"></i>'
  };
  return icons[status] || '';
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
