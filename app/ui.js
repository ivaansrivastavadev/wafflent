/* ═══════════════════════════════════════════════════════════════
   UI & QR CODE FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/* ─── Device pill setup & display name ─── */
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

/* ─── Scroll button management ─── */
$('chat').addEventListener('scroll', toggleScrollButton);

$('scrollDownBtn').addEventListener('click', () => {
  scrollChat();
});

/* ─── Sticker picker ─── */
$('stickerBtn').addEventListener('click', () => {
  toast('Stickers coming soon!');
});

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
