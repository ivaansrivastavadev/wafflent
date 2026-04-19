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
}

function toggleQRCodeVisibility() {
   const qrSection = $('qrSection');
   const qrToggle = $('qrToggle');
   const isHidden = qrSection.style.display === 'none' || !qrSection.style.display;
   
   if (isHidden) {
     // Show QR with animation
     qrSection.style.display = 'flex';
     qrSection.style.animation = 'qr-expand 350ms var(--ease-spring) forwards';
     qrToggle.style.display = 'none';
   } else {
     // Hide QR with animation
     qrSection.style.animation = 'qr-collapse 300ms var(--ease) forwards';
     setTimeout(() => {
       qrSection.style.display = 'none';
       qrToggle.style.display = 'flex';
     }, 300);
   }
}

$('roomBtn').addEventListener('click', () => {
  openRoomModal();
});

/* ─── Join/Create room and generate QR ─── */
$('join').addEventListener('click', () => {
  const id = $('room').value.trim();
  if (id) {
    joinRoom(id);
    // Longer delay to ensure roomId is set
    setTimeout(() => {
      if (roomId) {
        generateRoomQR();
        // Auto-show QR code after joining
        const qrSection = $('qrSection');
        const qrToggle = $('qrToggle');
        if (qrSection.style.display === 'none' || !qrSection.style.display) {
          qrSection.style.display = 'flex';
          qrSection.style.animation = 'qr-expand 350ms var(--ease-spring) forwards';
          qrToggle.style.display = 'none';
        }
      }
    }, 500);
  }
});

/* ─── QR Code visibility toggle ─── */
$('qrToggle').addEventListener('click', () => {
  toggleQRCodeVisibility();
});

$('qrSection').addEventListener('click', (e) => {
  // Only toggle if clicking on the section itself or header text, not on QR or Room ID
  if (e.target === $('qrSection') || e.target.closest('div') === $('qrSection')) {
    toggleQRCodeVisibility();
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

/* ─── Auto-Join state ─── */
let autoJoinEnabled = localStorage.getItem('autoJoinEnabled') === 'true';

/* ─── Minimize Status Bar state ─── */
let minimizeStatusBarOnTyping = localStorage.getItem('minimizeStatusBarOnTyping') !== 'false'; // Default: true
let statusBarMinimized = false;
let keyboardOpen = false;
let lastViewportHeight = window.innerHeight;

/* ─── Menu Modal ─── */
$('wafflentBtn').addEventListener('click', () => {
  $('menuModal').classList.add('open');
});

$('menuModalClose').addEventListener('click', () => $('menuModal').classList.remove('open'));

$('menuModal').addEventListener('click', e => {
  if (e.target === $('menuModal')) $('menuModal').classList.remove('open');
});

$('menuSettings').addEventListener('click', () => {
  $('menuModal').classList.remove('open');
  $('settingsModal').classList.add('open');
});

/* ─── Settings Modal ─── */
$('settingsModalClose').addEventListener('click', () => $('settingsModal').classList.remove('open'));

$('settingsModal').addEventListener('click', e => {
  if (e.target === $('settingsModal')) $('settingsModal').classList.remove('open');
});

/* ─── Auto-Join Toggle ─── */
$('autoJoinToggle').checked = autoJoinEnabled;

$('autoJoinToggle').addEventListener('change', (e) => {
  autoJoinEnabled = e.target.checked;
  localStorage.setItem('autoJoinEnabled', autoJoinEnabled);
  updateJoinButtonVisibility();
  toast(autoJoinEnabled ? 'Auto-Join enabled' : 'Auto-Join disabled');
});

/* ─── Minimize Status Bar Toggle ─── */
$('minimizeStatusBarToggle').checked = minimizeStatusBarOnTyping;

$('minimizeStatusBarToggle').addEventListener('change', (e) => {
  minimizeStatusBarOnTyping = e.target.checked;
  localStorage.setItem('minimizeStatusBarOnTyping', minimizeStatusBarOnTyping);
  toast(minimizeStatusBarOnTyping ? 'Status bar auto-minimize enabled' : 'Status bar auto-minimize disabled');
  if (!minimizeStatusBarOnTyping && statusBarMinimized) {
    restoreStatusBar();
  }
});

/* ─── Update Join Button Visibility ─── */
function updateJoinButtonVisibility() {
  const joinBtn = $('join');
  if (autoJoinEnabled) {
    joinBtn.style.display = 'none';
  } else {
    joinBtn.style.display = 'flex';
  }
}

/* ─── Initialize Join Button ─── */
updateJoinButtonVisibility();

/* ─── Auto-Join on field changes ─── */
$('room').addEventListener('input', () => {
  if (autoJoinEnabled && $('room').value.trim()) {
    setTimeout(() => $('join').click(), 100);
  }
});

$('secret').addEventListener('input', () => {
  if (autoJoinEnabled && $('room').value.trim()) {
    setTimeout(() => $('join').click(), 100);
  }
});

/* ─── Mobile Keyboard & Status Bar Management ─── */
// Get status bar element
const statusBar = document.querySelector('[style*="Room status bar"]')?.parentElement;

function minimizeStatusBar() {
  if (!minimizeStatusBarOnTyping || statusBarMinimized || !statusBar) return;
  statusBarMinimized = true;
  keyboardOpen = true;
  
  statusBar.style.height = '40px';
  statusBar.style.overflow = 'hidden';
  statusBar.style.padding = '4px 8px';
  
  // Make Wafflent text smaller
  const wafflentBtn = $('wafflentBtn');
  if (wafflentBtn) {
    wafflentBtn.style.fontSize = 'var(--text-sm)';
  }
}

function restoreStatusBar() {
  if (!statusBar) return;
  statusBarMinimized = false;
  keyboardOpen = false;
  
  statusBar.style.height = 'auto';
  statusBar.style.overflow = 'visible';
  statusBar.style.padding = '8px 16px';
  
  // Restore Wafflent text size
  const wafflentBtn = $('wafflentBtn');
  if (wafflentBtn) {
    wafflentBtn.style.fontSize = 'var(--text-lg)';
  }
}

// Click minimized status bar to restore
$('wafflentBtn').addEventListener('click', function(e) {
  if (statusBarMinimized) {
    e.preventDefault();
    e.stopPropagation();
    restoreStatusBar();
    return false;
  }
  // Normal menu open happens after
  $('menuModal').classList.add('open');
});

// Detect keyboard open/close on mobile
$('text').addEventListener('focus', () => {
  if (window.innerHeight < lastViewportHeight - 100) {
    minimizeStatusBar();
  }
});

$('text').addEventListener('blur', () => {
  restoreStatusBar();
});

window.addEventListener('resize', () => {
  if (window.innerHeight < lastViewportHeight - 200) {
    minimizeStatusBar();
  } else if (keyboardOpen && window.innerHeight >= lastViewportHeight - 100) {
    restoreStatusBar();
  }
  lastViewportHeight = window.innerHeight;
});

// Ensure input box is always visible
window.addEventListener('scroll', () => {
  const inputBox = document.querySelector('[style*="Input"]')?.parentElement;
  if (inputBox && minimizeStatusBarOnTyping) {
    const rect = inputBox.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      inputBox.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }
});

/* ─── Hide/show sticker and attachment buttons on typing ─── */
const textInput = $('text');
const stickerBtn = $('stickerBtn');
const attachBtn = document.querySelector('.lcg-attach');

if (textInput && stickerBtn && attachBtn) {
  textInput.addEventListener('input', () => {
    const hasText = textInput.value.trim().length > 0;
    
    if (hasText) {
      stickerBtn.style.display = 'none';
      attachBtn.style.display = 'none';
    } else {
      stickerBtn.style.display = 'flex';
      attachBtn.style.display = 'flex';
    }
  });
}

