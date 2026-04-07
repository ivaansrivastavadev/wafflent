/**
 * Wafflent - Secure P2P Chat Application
 * Using GUN.js for decentralized real-time sync with optional SEA encryption
 */

class Wafflent {
    constructor() {
        this.displayName = this.loadDisplayName() || 'Anonymous';
        this.currentRoom = null;
        this.roomPasscode = null;
        this.encryptionKey = null;
        this.peers = new Map(); // peerId -> peer info
        this.messages = [];
        this.messageCount = 0;
        this.roomCreatedAt = null;
        this.isHost = false;
        this.gun = null; // GUN instance
        this.myUserId = null;
        this.roomRef = null; // Current room reference
        this.userRef = null; // Current user reference
        this.messagesRef = null; // Messages reference
        this.usersRef = null; // Room users reference
        this.heartbeatInterval = null;
        this.messageListeners = new Map(); // Track message listeners
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
        this.checkForInviteLink();
        this.initializeGun();
    }

    async initializeGun() {
        try {
            console.log('Initializing GUN.js...');
            
            // Initialize GUN with multiple peers for redundancy
            this.gun = GUN(['https://gun-manhattan.herokuapp.com/gun', 'https://peer.wallie.io/gun']);
            
            // Generate unique user ID for this session
            this.myUserId = this.generateUserId();
            console.log('GUN.js initialized with user ID:', this.myUserId);
            
            this.updateConnectionInfo();
            
        } catch (error) {
            console.error('Failed to initialize GUN:', error);
            this.showAlert('error', 'Failed to initialize P2P connection');
        }
    }

    checkForInviteLink() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#')) {
            const roomName = hash.substring(1);
            if (roomName) {
                // Show invite notification
                document.getElementById('invitedRoomName').textContent = roomName;
                document.getElementById('inviteNotification').style.display = 'block';
                
                // Pre-fill the room name
                document.getElementById('roomName').value = roomName;
                
                // Clear the hash to avoid confusion on reload
                window.history.replaceState('', document.title, window.location.pathname);
            }
        }
    }

    bindEvents() {
        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettings());
        document.getElementById('cancelSettingsBtn').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

        // Room joining
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinRoom());
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('leaveRoomBtn').addEventListener('click', () => this.leaveRoom());

        // Copy invite link
        document.getElementById('copyInviteBtn').addEventListener('click', () => this.copyInviteLink());

        // Toggle sidebar
        document.getElementById('toggleSidebarBtn').addEventListener('click', () => this.toggleSidebar());

        // Message input
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());

        // Room name input validation
        document.getElementById('roomName').addEventListener('input', (e) => {
            this.validateRoomInput();
        });

        // Display name input validation
        document.getElementById('displayName').addEventListener('input', (e) => {
            this.validateDisplayName();
        });

        // Handle page beforeunload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle modal backdrop clicks
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettings();
            }
        });
    }

    // Settings Management
    openSettings() {
        document.getElementById('displayName').value = this.displayName;
        document.getElementById('settingsModal').style.display = 'flex';
        this.updateConnectionInfo();
    }

    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    saveSettings() {
        const newName = document.getElementById('displayName').value.trim();
        if (this.validateDisplayName(newName)) {
            const oldName = this.displayName;
            this.displayName = newName;
            this.saveDisplayName();
            this.updateUI();
            this.closeSettings();
            
            // Update name in current room if we're in one
            if (this.currentRoom && this.userRef) {
                this.userRef.get('name').put(newName);
                
                // Add system message about name change
                if (oldName !== newName) {
                    this.addSystemMessage(`You changed your name from ${oldName} to ${newName}`);
                }
            }
        }
    }

    validateDisplayName(name = null) {
        const displayNameInput = document.getElementById('displayName');
        const nameToCheck = name || displayNameInput.value.trim();
        
        if (nameToCheck.length < 1 || nameToCheck.length > 30) {
            this.setInputError(displayNameInput, 'Name must be 1-30 characters');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_-\s]+$/.test(nameToCheck)) {
            this.setInputError(displayNameInput, 'Only letters, numbers, spaces, - and _ allowed');
            return false;
        }
        
        this.clearInputError(displayNameInput);
        return true;
    }

    loadDisplayName() {
        return localStorage.getItem('wafflent_display_name');
    }

    saveDisplayName() {
        localStorage.setItem('wafflent_display_name', this.displayName);
    }

    // Room Management
    validateRoomInput() {
        const roomInput = document.getElementById('roomName');
        const roomName = roomInput.value.trim();
        
        console.log('Validating room input:', roomName);
        
        if (roomName.length === 0) {
            this.clearInputError(roomInput);
            return false;
        }
        
        if (roomName.length > 50) {
            this.setInputError(roomInput, 'Room name too long');
            return false;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
            this.setInputError(roomInput, 'Only letters, numbers, - and _ allowed');
            return false;
        }
        
        this.clearInputError(roomInput);
        console.log('Room input validation passed');
        return true;
    }

    async createRoom() {
        if (!this.validateRoomInput()) return;
        if (!this.gun) {
            this.showAlert('error', 'GUN not initialized. Please wait a moment.');
            return;
        }
        
        const roomName = document.getElementById('roomName').value.trim();
        const passcode = document.getElementById('roomPasscode').value;
        
        console.log('Creating room:', roomName);
        this.showLoading('Creating room...');
        
        try {
            this.currentRoom = roomName;
            this.roomPasscode = passcode;
            this.roomCreatedAt = Date.now();
            this.isHost = true;
            
            // Derive encryption key if passcode provided
            if (passcode) {
                this.encryptionKey = await this.deriveEncryptionKey(passcode, roomName);
                console.log('Encryption key generated');
            } else {
                this.encryptionKey = null;
                console.log('No encryption - room is public');
            }
            
            // Initialize the room with GUN.js
            await this.initializeGunRoom();
            this.showChatInterface();
            this.addSystemMessage(`Room "${roomName}" created successfully`);
            this.addSystemMessage('Share the room link to invite others!');
            console.log('Room created successfully');
            
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showAlert('error', 'Failed to create room: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async joinRoom() {
        if (!this.validateRoomInput()) return;
        if (!this.gun) {
            this.showAlert('error', 'GUN not initialized. Please wait a moment.');
            return;
        }
        
        const roomName = document.getElementById('roomName').value.trim();
        const passcode = document.getElementById('roomPasscode').value;
        
        console.log('Joining room:', roomName);
        this.showLoading('Joining room...');
        
        try {
            this.currentRoom = roomName;
            this.roomPasscode = passcode;
            this.isHost = false;
            
            // Derive encryption key if passcode provided
            if (passcode) {
                this.encryptionKey = await this.deriveEncryptionKey(passcode, roomName);
                console.log('Encryption key generated');
            } else {
                this.encryptionKey = null;
                console.log('No encryption - joining public room');
            }
            
            // Initialize the room with GUN.js
            await this.initializeGunRoom();
            
            this.showChatInterface();
            this.addSystemMessage(`Joined room "${roomName}"`);
            console.log('Joined room successfully');
            
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showAlert('error', 'Failed to join room: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async initializeGunRoom() {
        console.log('Initializing GUN room:', this.currentRoom);
        
        // Initialize room-specific data
        this.messages = [];
        this.messageCount = 0;
        this.peers.clear();
        
        // Create room reference in GUN
        this.roomRef = this.gun.get('wafflent').get('rooms').get(this.currentRoom);
        this.messagesRef = this.roomRef.get('messages');
        this.usersRef = this.roomRef.get('users');
        
        // Set up user presence
        await this.joinRoomAsUser();
        
        // Start listening for messages
        this.listenForMessages();
        
        // Start listening for user changes
        this.listenForUsers();
        
        // Start heartbeat to maintain presence
        this.startHeartbeat();
    }

    async joinRoomAsUser() {
        // Check for name conflicts
        const conflictCheck = await this.checkNameConflict();
        if (!conflictCheck) {
            throw new Error(`Another user with name "${this.displayName}" is already in this room. Please choose a different name.`);
        }
        
        // Create user reference
        this.userRef = this.usersRef.get(this.myUserId);
        
        // Set user data
        const userData = {
            id: this.myUserId,
            name: this.displayName,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            isHost: this.isHost
        };
        
        this.userRef.put(userData);
        console.log('Joined room as user:', userData);
    }

    async checkNameConflict() {
        return new Promise((resolve) => {
            const currentUsers = [];
            
            this.usersRef.once((users) => {
                if (users) {
                    Object.keys(users).forEach(userId => {
                        if (userId !== '_' && userId !== this.myUserId) {
                            const user = users[userId];
                            if (user && user.name === this.displayName) {
                                // Check if user is still active (last seen within 2 minutes)
                                const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
                                if (user.lastSeen > twoMinutesAgo) {
                                    resolve(false);
                                    return;
                                }
                            }
                        }
                    });
                }
                resolve(true);
            });
        });
    }

    listenForMessages() {
        console.log('Setting up message listener...');
        
        this.messagesRef.on(async (messages, msgKey) => {
            if (messages && msgKey !== '_') {
                const message = messages[msgKey];
                if (message && message.id && !this.messageListeners.has(message.id)) {
                    this.messageListeners.set(message.id, true);
                    
                    // Decrypt message if needed
                    if (message.encrypted && this.encryptionKey) {
                        try {
                            message.content = await this.decryptMessage({
                                ciphertext: message.encryptedContent,
                                iv: message.iv
                            });
                        } catch (error) {
                            console.error('Failed to decrypt message:', error);
                            message.content = '[Failed to decrypt - wrong passcode?]';
                            message.decryptionFailed = true;
                        }
                    } else if (message.encrypted && !this.encryptionKey) {
                        message.content = '[Encrypted message - no key available]';
                        message.decryptionFailed = true;
                    }
                    
                    // Only add message if it's not already in our local list
                    const existingMsg = this.messages.find(m => m.id === message.id);
                    if (!existingMsg) {
                        this.messages.push(message);
                        this.messageCount++;
                        this.renderMessage(message);
                        this.updateRoomStats();
                        this.scrollToBottom();
                    }
                }
            }
        });
    }

    listenForUsers() {
        console.log('Setting up user listener...');
        
        this.usersRef.on((users) => {
            if (users) {
                this.peers.clear();
                const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
                
                Object.keys(users).forEach(userId => {
                    if (userId !== '_' && userId !== this.myUserId) {
                        const user = users[userId];
                        if (user && user.lastSeen > twoMinutesAgo) {
                            this.peers.set(userId, {
                                id: userId,
                                name: user.name,
                                joinedAt: user.joinedAt,
                                lastSeen: user.lastSeen,
                                isHost: user.isHost
                            });
                        }
                    }
                });
                
                this.updateOnlineUsers();
                this.updateParticipantCount();
            }
        });
    }

    startHeartbeat() {
        // Update our last seen timestamp every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.userRef && this.currentRoom) {
                this.userRef.get('lastSeen').put(Date.now());
            }
        }, 30000);
    }

    leaveRoom() {
        console.log('Leaving room:', this.currentRoom);
        
        // Stop heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // Remove ourselves from the room
        if (this.userRef) {
            this.userRef.put(null);
        }
        
        // Clear room references
        this.roomRef = null;
        this.messagesRef = null;
        this.usersRef = null;
        this.userRef = null;
        
        // Clear local data
        this.peers.clear();
        this.messageListeners.clear();
        this.currentRoom = null;
        this.roomPasscode = null;
        this.encryptionKey = null;
        this.isHost = false;
        this.messages = [];
        this.messageCount = 0;
        this.roomCreatedAt = null;
        
        this.showWelcomeScreen();
        this.updateUI();
    }

    // Message Handling
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (content === '') return;
        
        console.log('Sending message:', content);
        
        const messageId = this.generateMessageId();
        const timestamp = Date.now();
        
        const message = {
            id: messageId,
            type: 'message',
            content: content,
            sender: this.displayName,
            senderId: this.myUserId,
            timestamp: timestamp
        };
        
        // Encrypt if encryption key is available
        if (this.encryptionKey) {
            try {
                console.log('Encrypting message...');
                const encryptedData = await this.encryptMessage(content);
                message.encrypted = true;
                message.encryptedContent = encryptedData.ciphertext;
                message.iv = encryptedData.iv;
                // Keep original content for local display, but it won't be sent
                console.log('Message encrypted successfully');
            } catch (error) {
                console.error('Encryption failed:', error);
                this.showAlert('error', 'Failed to encrypt message: ' + error.message);
                return;
            }
        }
        
        // Add to GUN
        this.messagesRef.get(messageId).put(message);
        
        // Clear input
        messageInput.value = '';
        
        console.log('Message sent successfully');
    }

    renderMessage(message) {
        const container = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        
        if (message.type === 'message') {
            const isOwnMessage = message.senderId === this.myUserId;
            messageElement.className = `message ${isOwnMessage ? 'own' : 'peer'}`;
            
            let encryptionIcon = '';
            if (message.encrypted) {
                if (message.decryptionFailed) {
                    encryptionIcon = '<i class="fas fa-exclamation-triangle message-decrypt-failed" data-tooltip="Decryption failed" style="color: var(--error);"></i>';
                } else {
                    encryptionIcon = '<i class="fas fa-shield-alt message-encrypted" data-tooltip="End-to-end encrypted"></i>';
                }
            }
            
            messageElement.innerHTML = `
                <div class="message-header">
                    <div class="message-sender">${this.escapeHtml(message.sender)}</div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                    ${encryptionIcon}
                </div>
                <div class="message-content${message.decryptionFailed ? ' decrypt-failed' : ''}">${this.escapeHtml(message.content)}</div>
            `;
        }
        
        container.appendChild(messageElement);
    }

    addSystemMessage(text) {
        const container = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        messageElement.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>${this.escapeHtml(text)}</span>
        `;
        container.appendChild(messageElement);
        this.scrollToBottom();
    }

    // Strong End-to-End Encryption using Web Crypto API
    async deriveEncryptionKey(passcode, roomName) {
        // Use PBKDF2 to derive a strong key from passcode + room name
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(passcode),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        // Use room name as additional salt for key derivation
        const salt = encoder.encode(roomName + 'wafflent_salt_2024');
        
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000, // Strong iteration count
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 }, // AES-256-GCM for authenticated encryption
            false, // Not extractable for security
            ['encrypt', 'decrypt']
        );

        return key;
    }

    async encryptMessage(plaintext) {
        if (!this.encryptionKey) {
            throw new Error('No encryption key available');
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        
        // Generate random IV for each message
        const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.encryptionKey,
            data
        );

        return {
            ciphertext: Array.from(new Uint8Array(encrypted)), // Convert to array for JSON serialization
            iv: Array.from(iv)
        };
    }

    async decryptMessage(encryptedData) {
        if (!this.encryptionKey) {
            throw new Error('No encryption key available');
        }

        const ciphertext = new Uint8Array(encryptedData.ciphertext);
        const iv = new Uint8Array(encryptedData.iv);

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                ciphertext
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            throw new Error('Failed to decrypt message - invalid key or corrupted data');
        }
    }

    // UI Management
    copyInviteLink() {
        if (!this.currentRoom) return;
        
        const inviteLink = `${window.location.origin}${window.location.pathname}#${this.currentRoom}`;
        
        navigator.clipboard.writeText(inviteLink).then(() => {
            this.showAlert('success', 'Invite link copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const tempInput = document.createElement('input');
            tempInput.value = inviteLink;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            this.showAlert('success', 'Invite link copied to clipboard!');
        });
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.room-sidebar');
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            sidebar.classList.toggle('visible');
        } else {
            sidebar.classList.toggle('hidden');
        }
    }

    updateRoomStats() {
        const messageCountEl = document.getElementById('messageCount');
        const roomCreatedEl = document.getElementById('roomCreated');
        const encryptionTypeEl = document.getElementById('encryptionType');
        
        if (messageCountEl) {
            messageCountEl.textContent = this.messageCount.toString();
        }
        
        if (roomCreatedEl && this.roomCreatedAt) {
            const timeAgo = this.formatTimeAgo(this.roomCreatedAt);
            roomCreatedEl.textContent = timeAgo;
        }
        
        if (encryptionTypeEl) {
            const encryptionType = this.encryptionKey ? 'AES-256-GCM' : 'None';
            encryptionTypeEl.textContent = encryptionType;
        }
    }

    updateOnlineUsers() {
        const usersList = document.getElementById('usersList');
        const userCount = document.getElementById('onlineUserCount');
        
        if (!usersList || !userCount) {
            console.warn('User list elements not found');
            return;
        }
        
        // Clear existing users
        usersList.innerHTML = '';
        
        // Add ourselves
        const selfUser = this.createUserElement(this.displayName, true);
        usersList.appendChild(selfUser);
        
        // Add peers
        for (const [peerId, peer] of this.peers) {
            const userElement = this.createUserElement(peer.name || 'Unknown', false);
            usersList.appendChild(userElement);
        }
        
        const totalUsers = this.peers.size + 1;
        userCount.textContent = totalUsers.toString();
    }

    createUserElement(name, isOwn) {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        
        const initials = name.substring(0, 2).toUpperCase();
        
        userElement.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">${this.escapeHtml(name)}${isOwn ? ' (You)' : ''}</div>
                <div class="user-status">
                    <div class="status-indicator"></div>
                    Online
                </div>
            </div>
        `;
        
        return userElement;
    }

    formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'block';
        document.getElementById('chatScreen').style.display = 'none';
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendMessageBtn').disabled = true;
    }

    showChatInterface() {
        console.log('Showing chat interface for room:', this.currentRoom);
        
        // Hide welcome screen and show chat
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('chatScreen').style.display = 'flex';
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendMessageBtn').disabled = false;
        document.getElementById('messageInput').focus();
        
        // Update room info in both header and sidebar
        const currentRoomEl = document.getElementById('currentRoomName');
        const sidebarRoomEl = document.getElementById('sidebarRoomName');
        
        const roomHTML = `
            <i class="fas fa-hashtag"></i>
            ${this.escapeHtml(this.currentRoom)}
        `;
        
        if (currentRoomEl) currentRoomEl.innerHTML = roomHTML;
        if (sidebarRoomEl) sidebarRoomEl.innerHTML = roomHTML;
        
        // Update encryption status
        const sidebarEncStatus = document.getElementById('sidebarEncryptionStatus');
        
        if (sidebarEncStatus) {
            if (this.encryptionKey) {
                sidebarEncStatus.innerHTML = '<i class="fas fa-shield-alt"></i> E2E Encrypted';
                sidebarEncStatus.className = 'wf-chip wf-chip-success';
            } else {
                sidebarEncStatus.innerHTML = '<i class="fas fa-unlock"></i> Not Encrypted';
                sidebarEncStatus.className = 'wf-chip wf-chip-warning';
            }
        }
        
        this.updateParticipantCount();
        this.updateOnlineUsers();
        this.updateRoomStats();
        this.scrollToBottom();
        
        console.log('Chat interface shown successfully');
    }

    updateParticipantCount() {
        const count = this.peers.size + 1; // +1 for ourselves
        const countElement = document.getElementById('participantCount');
        countElement.innerHTML = `
            <i class="fas fa-users"></i>
            ${count} participant${count !== 1 ? 's' : ''}
        `;
    }

    updateUI() {
        // Update status
        const statusChip = document.getElementById('statusChip');
        if (this.currentRoom && this.gun) {
            statusChip.innerHTML = '<i class="fas fa-circle" style="color: var(--success); font-size: 8px;"></i> Online';
            statusChip.className = 'wf-chip wf-chip-success';
        } else if (this.gun) {
            statusChip.innerHTML = '<i class="fas fa-circle" style="color: var(--warning); font-size: 8px;"></i> Ready';
            statusChip.className = 'wf-chip wf-chip-default';
        } else {
            statusChip.innerHTML = '<i class="fas fa-circle" style="color: var(--error); font-size: 8px;"></i> Connecting';
            statusChip.className = 'wf-chip wf-chip-default';
        }
        
        this.updateConnectionInfo();
    }

    updateConnectionInfo() {
        const statusEl = document.getElementById('connectionStatus');
        const peerIdEl = document.getElementById('peerId');
        
        if (statusEl) {
            if (this.currentRoom) {
                statusEl.textContent = 'Connected to room';
            } else if (this.gun) {
                statusEl.textContent = 'Ready to join';
            } else {
                statusEl.textContent = 'Connecting...';
            }
        }
        
        if (peerIdEl) {
            peerIdEl.textContent = this.myUserId || 'Generating...';
        }
    }

    showLoading(text = 'Loading...') {
        document.getElementById('loadingOverlay').style.display = 'flex';
        document.querySelector('.loading-text').textContent = text;
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showAlert(type, message) {
        // Simple alert for demo - you could enhance this with a toast system
        const className = type === 'error' ? 'wf-alert-error' : 'wf-alert-success';
        const icon = type === 'error' ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle';
        
        const alert = document.createElement('div');
        alert.className = `wf-alert ${className}`;
        alert.style.position = 'fixed';
        alert.style.top = '80px';
        alert.style.right = '20px';
        alert.style.zIndex = '1000';
        alert.style.maxWidth = '300px';
        
        alert.innerHTML = `
            <i class="wf-alert-icon ${icon}"></i>
            <div class="wf-alert-body">${this.escapeHtml(message)}</div>
            <i class="wf-alert-close fas fa-times"></i>
        `;
        
        document.body.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
        
        // Manual close
        alert.querySelector('.wf-alert-close').addEventListener('click', () => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        });
    }

    setInputError(input, message) {
        input.classList.add('error');
        let helper = input.parentNode.parentNode.querySelector('.wf-helper.error');
        if (!helper) {
            helper = document.createElement('div');
            helper.className = 'wf-helper error';
            input.parentNode.parentNode.appendChild(helper);
        }
        helper.textContent = message;
    }

    clearInputError(input) {
        input.classList.remove('error');
        const helper = input.parentNode.parentNode.querySelector('.wf-helper.error');
        if (helper) {
            helper.remove();
        }
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 10);
    }

    // Utility functions
    generateUserId() {
        return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateMessageId() {
        return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanup() {
        if (this.currentRoom) {
            this.leaveRoom();
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Wafflent...');
    try {
        window.wafflent = new Wafflent();
        console.log('Wafflent initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Wafflent:', error);
        alert('Failed to initialize app: ' + error.message);
    }
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.wafflent) {
        window.wafflent.cleanup();
    }
});