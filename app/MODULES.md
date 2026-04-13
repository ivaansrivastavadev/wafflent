# Wafflent - Module Structure

## Overview
The application has been refactored from a single 1379-line `script.js` into 6 focused, modular files with clear separation of concerns.

## Module Breakdown

### 1. **utils.js** (5.6 KB)
Core utilities and helpers used across the app.

**Exports:**
- `fmtTime(ts)` - Format timestamps
- `escapeHtml(s)` - HTML escape strings
- `getFileIcon(mimeType)` - Get Font Awesome icon for file type
- `getMediaType(mimeType)` - Determine media category
- `toast(msg, duration)` - Show toast notifications
- `systemMsg(text)` - Add system messages to chat
- `scrollChat()` - Scroll to bottom of chat
- `isNearBottom()` - Check if near bottom
- `toggleScrollButton()` - Show/hide scroll button
- `enc(plain)` - Encrypt text (AES-GCM)
- `dec(cipher)` - Decrypt text
- `openLightbox(src)` - Open image viewer
- `getStatusIcon(status)` - Get message status icon
- `updateMessageStatus(uid, newStatus)` - Update message status

**State:**
- `const $ = id => ...` - DOM helper
- `deviceId` - Device UUID
- `msgStatus` - Map of message statuses
- `toastTimer` - Toast timeout

### 2. **p2p.js** (5.8 KB)
Peer-to-peer networking, GUN/relay management, and presence tracking.

**Exports:**
- `initGun(peerList)` - Initialize GUN with relays
- `updatePeerStatus()` - Update relay connection status
- `scheduleReconnect()` - Retry peer connections
- `setMyTyping(val)` - Broadcast typing status
- `updateTypingHint()` - Update typing indicator message
- `watchPresence()` - Listen for presence changes

**State:**
- `gun` - GUN database instance
- `connectedPeers` - Set of connected relay URLs
- `reconnectAttempt` - Reconnection attempt counter
- `PEERS` - Array of relay URLs
- `otherTyping` - Map of who's typing
- `typingMessageElement` - DOM element for typing indicator

### 3. **chat.js** (13 KB)
Chat operations, room management, and message handling.

**Exports:**
- `randomRoom()` - Generate random room ID
- `initFromHash()` - Load room from URL hash
- `joinRoom(id)` - Join a chat room
- `sendMessage()` - Send text message
- File send functions for images, videos, audio, files

**State:**
- `roomId` - Current room ID
- `secret` - Encryption secret/password
- `roomNode` - GUN room reference
- `presenceNode` - GUN presence reference
- `seen` - Set of seen message UIDs
- `typingTimer` - Typing indicator timeout

### 4. **messages.js** (16 KB)
Message rendering and reaction handling.

**Exports (Render functions):**
- `renderMsg(opts)` - Render text message
- `renderImage(opts)` - Render image message
- `renderVideo(opts)` - Render video message
- `renderAudio(opts)` - Render audio message
- `renderFile(opts)` - Render file message

**Exports (Context menu):**
- `openContextMenu(e, msgElement, uid)` - Show message menu
- `closeContextMenu()` - Hide message menu
- `displayReactions(uid)` - Show emoji reactions
- `addReaction(emoji)` - Add reaction to message

**State:**
- `currentMsgElement` - Selected message element
- `currentMsgUid` - Selected message UID
- `currentMsgText` - Selected message text
- `msgReactions` - Map of reactions per message
- `EMOJIS` - Emoji list

### 5. **ui.js** (2.7 KB)
UI components and user interactions.

**Exports:**
- `openQRModal()` - Show QR code for room invite
- Setup for device pill name change

**Handlers:**
- Device pill click → rename dialog
- QR button click → open QR modal
- Lightbox close handlers
- Scroll button event listeners

### 6. **script.js** (14 lines)
Entry point with module documentation.

## Load Order in HTML

```html
<!-- Libraries -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/axe.js"></script>

<!-- App modules (order matters!) -->
<script src="/app/utils.js"></script>      <!-- 1. Base utilities -->
<script src="/app/p2p.js"></script>        <!-- 2. P2P (uses utils) -->
<script src="/app/chat.js"></script>       <!-- 3. Chat (uses utils, p2p) -->
<script src="/app/messages.js"></script>   <!-- 4. Messages (uses chat, utils) -->
<script src="/app/ui.js"></script>         <!-- 5. UI (uses all) -->
<script src="/app/script.js"></script>     <!-- 6. Entry point -->
```

## Dependency Graph

```
External Libraries (GUN, QR, Crypto)
        ↓
    utils.js  ← All modules use this
        ↓
   p2p.js (GUN/networking)
        ↓
   chat.js (room management)
    ↙       ↘
messages.js   ui.js
    ↓         ↓
  script.js ← (documentation)
```

## Benefits

✅ **Clear separation of concerns** - Each module has a single responsibility
✅ **Easier maintenance** - Find related code in one place
✅ **Better testing** - Can test modules independently
✅ **Reduced bundle** - Load only needed code
✅ **Scalability** - Easy to add new modules (e.g., `notifications.js`)
✅ **Documentation** - Each module is self-contained and documented

## Global Variables (Shared State)

These variables are exposed globally for cross-module access:

**User/Device:**
- `deviceId` - Device UUID
- `getDeviceId()`, `getDisplayName()`, `saveDisplayName()`

**Room:**
- `roomId` - Current room ID
- `secret` - Encryption secret
- `roomNode`, `presenceNode` - GUN references
- `seen` - Set of message UIDs

**Messaging:**
- `msgStatus` - Map of message statuses
- `msgReactions` - Map of reactions
- `currentMsgUid` - Selected message UID

**P2P:**
- `gun` - GUN database instance
- `connectedPeers` - Set of relay connections
- `PEERS` - Array of relay URLs

**Typing:**
- `otherTyping` - Map of who's typing
- `isTyping` - Whether user is currently typing

## Future Improvements

- Add `notifications.js` for notification handling
- Add `storage.js` for localStorage management
- Add `api.js` for API endpoints (if needed)
- Extract constants to `config.js`
- Add event emitter pattern for module communication
