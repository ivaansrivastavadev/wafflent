/* ═══════════════════════════════════════════════════════════════
   UI & QR CODE FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/* ─── Initialize Device ID display ─── */
const deviceId = getDeviceId();
$('modalDeviceIdShort').textContent = deviceId.slice(0, 8);
$('modalDeviceName').textContent = getDisplayName() || 'Anonymous';

/* ─── Edit Device Name ─── */
$('editDeviceNameBtn').addEventListener('click', () => {
  const current = getDisplayName() || '';
  const name = prompt('Set your display name:', current);
  if (name === null) return; // cancelled
  const clean = name.trim().slice(0, 24) || 'Anonymous';
  saveDisplayName(clean);
  $('modalDeviceName').textContent = clean;
  toast(`Name set to "${clean}"`);
  // Update presence if in room
  if (roomId && presenceNode) {
    presenceNode.get(deviceId).put({ name: clean, typing: false, ts: Date.now() });
  }
});

/* ─── Room Settings Modal ─── */
function openRoomModal() {
  $('roomModal').classList.add('open');
}

function generateRoomQR() {
  if (!roomId) {
    $('qrSection').style.display = 'none';
    return;
  }
  
  // Clear previous QR code
  $('roomQrContainer').innerHTML = '';
  
  // Generate QR code with room invite URL and secret if present
  let inviteUrl = location.origin + location.pathname + '#' + encodeURIComponent(roomId);
  if (secret) {
    inviteUrl += '?secret=' + encodeURIComponent(secret);
  }
  
  new QRCode($('roomQrContainer'), {
    text: inviteUrl,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
  
  // Set room ID display
  $('roomQrId').textContent = roomId;
  
  // Show QR section
  $('qrSection').style.display = 'flex';
}

$('roomBtn').addEventListener('click', () => {
  openRoomModal();
  // Generate QR if already in a room
  if (roomId) {
    setTimeout(generateRoomQR, 100);
  }
});

$('roomModalClose').addEventListener('click', () => $('roomModal').classList.remove('open'));

$('roomModal').addEventListener('click', e => {
  if (e.target === $('roomModal')) $('roomModal').classList.remove('open');
});

/* ─── Scroll button management ─── */
$('chat').addEventListener('scroll', toggleScrollButton);

$('scrollDownBtn').addEventListener('click', () => {
  scrollChat();
  // Ensure button hides after scrolling to bottom
  setTimeout(() => toggleScrollButton(), 0);
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
