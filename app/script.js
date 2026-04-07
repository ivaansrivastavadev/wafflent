/**
 * Wafflent - Secure P2P Chat Application
 * Using WebRTC for peer-to-peer communication with optional SEA encryption
 */

class Wafflent {
    constructor() {
        this.displayName = this.loadDisplayName() || 'Anonymous';
        this.currentRoom = null;
        this.roomPasscode = null;
        this.encryptionKey = null; // Derived encryption key
        this.peers = new Map(); // peerId -> peer connection
        this.dataChannels = new Map(); // peerId -> data channel
        this.messages = [];
        this.messageCount = 0;
        this.roomCreatedAt = null;
        this.isHost = false;
        this.signalingServer = null; // We'll use simple-peer for WebRTC signaling
        this.myPeerId = this.generateUniquePeerId(); // Generate unique ID for this session
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
        this.checkNameCollision();
        this.checkForInviteLink();
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
            this.displayName = newName;
            this.saveDisplayName();
            this.updateUI();
            this.closeSettings();
            
            // Broadcast name change if in a room
            if (this.currentRoom) {
                this.broadcastMessage({
                    type: 'nameChange',
                    oldName: this.displayName,
                    newName: newName,
                    timestamp: Date.now()
                });
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

    checkNameCollision() {
        // Check if current name conflicts with other users in the room
        if (this.currentRoom) {
            const roomKey = `wafflent_room_${this.currentRoom}`;
            const roomData = JSON.parse(localStorage.getItem(roomKey) || '[]');
            
            // Check for name conflicts with other peers (excluding ourselves)
            const otherUsers = roomData.filter(p => p.id !== this.myPeerId);
            const conflictingUser = otherUsers.find(p => p.name === this.displayName);
            
            if (conflictingUser) {
                this.showAlert('error', 'Name collision detected! Please change your display name.');
                this.openSettings();
                return false;
            }
        }
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
        return true;
    }

    async createRoom() {
        if (!this.validateRoomInput() || !this.checkNameCollision()) return;
        
        const roomName = document.getElementById('roomName').value.trim();
        const passcode = document.getElementById('roomPasscode').value;
        
        this.showLoading('Creating room...');
        
        try {
            this.currentRoom = roomName;
            this.roomPasscode = passcode;
            this.roomCreatedAt = Date.now();
            this.isHost = true;
            
            // Derive encryption key if passcode provided
            if (passcode) {
                this.encryptionKey = await this.deriveEncryptionKey(passcode, roomName);
            } else {
                this.encryptionKey = null;
            }
            
            // Initialize the room
            await this.initializeRoom();
            this.showChatInterface();
            this.addSystemMessage(`Room "${roomName}" created successfully`);
            
        } catch (error) {
            this.showAlert('error', 'Failed to create room: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async joinRoom() {
        if (!this.validateRoomInput() || !this.checkNameCollision()) return;
        
        const roomName = document.getElementById('roomName').value.trim();
        const passcode = document.getElementById('roomPasscode').value;
        
        this.showLoading('Joining room...');
        
        try {
            this.currentRoom = roomName;
            this.roomPasscode = passcode;
            this.isHost = false;
            
            // Derive encryption key if passcode provided
            if (passcode) {
                this.encryptionKey = await this.deriveEncryptionKey(passcode, roomName);
            } else {
                this.encryptionKey = null;
            }
            
            // Try to connect to existing room
            await this.initializeRoom();
            await this.discoverPeers();
            
            this.showChatInterface();
            this.addSystemMessage(`Joined room "${roomName}"`);
            
        } catch (error) {
            this.showAlert('error', 'Failed to join room: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async initializeRoom() {
        // Initialize room-specific data
        this.messages = [];
        this.peers.clear();
        this.dataChannels.clear();
        
        // Set up peer discovery mechanism
        await this.setupPeerDiscovery();
    }

    async setupPeerDiscovery() {
        // For this demo, we'll simulate peer discovery using localStorage for same-origin peers
        // In a real app, you'd use a signaling server
        
        // First, clean up any stale entries from this session
        this.cleanupStaleEntries();
        
        // Create a room registry in localStorage
        const roomKey = `wafflent_room_${this.currentRoom}`;
        const existingRoom = JSON.parse(localStorage.getItem(roomKey) || '[]');
        
        // Check for name conflicts before joining
        const conflictingUser = existingRoom.find(p => p.name === this.displayName && p.id !== this.myPeerId);
        if (conflictingUser) {
            throw new Error(`Another user with name "${this.displayName}" is already in this room. Please choose a different name.`);
        }
        
        // Add ourselves to the room
        const ourPeerInfo = {
            id: this.myPeerId,
            name: this.displayName,
            timestamp: Date.now(),
            host: this.isHost,
            sessionId: this.generateSessionId() // Add session tracking
        };
        
        // Remove any existing entries for our peer ID and add the new one
        const filteredRoom = existingRoom.filter(p => p.id !== this.myPeerId);
        filteredRoom.push(ourPeerInfo);
        localStorage.setItem(roomKey, JSON.stringify(filteredRoom));
        
        // Listen for other peers joining
        this.startPeerDiscoveryListener(roomKey);
    }

    cleanupStaleEntries() {
        // Clean up entries older than 5 minutes to prevent stale data
        const roomKey = `wafflent_room_${this.currentRoom}`;
        const roomData = JSON.parse(localStorage.getItem(roomKey) || '[]');
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        const activeUsers = roomData.filter(p => p.timestamp > fiveMinutesAgo);
        
        if (activeUsers.length !== roomData.length) {
            localStorage.setItem(roomKey, JSON.stringify(activeUsers));
        }
    }

    generateSessionId() {
        return 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    startPeerDiscoveryListener(roomKey) {
        // Poll for room changes (simplified for demo)
        this.discoveryInterval = setInterval(() => {
            this.checkForNewPeers(roomKey);
        }, 2000);
    }

    async checkForNewPeers(roomKey) {
        const roomData = JSON.parse(localStorage.getItem(roomKey) || '[]');
        
        for (const peer of roomData) {
            // Skip ourselves and peers we're already connected to
            if (peer.id !== this.myPeerId && !this.peers.has(peer.id)) {
                // Double-check for name conflicts
                if (peer.name === this.displayName) {
                    this.showAlert('error', `Another user with name "${this.displayName}" joined the room. Please change your name.`);
                    this.leaveRoom();
                    this.openSettings();
                    return;
                }
                
                try {
                    await this.connectToPeer(peer);
                } catch (error) {
                    console.error('Failed to connect to peer:', error);
                }
            }
        }
    }

    async connectToPeer(peerInfo) {
        // Create WebRTC peer connection
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        // Create data channel for messages
        const dataChannel = peerConnection.createDataChannel('messages', {
            ordered: true
        });
        
        this.setupDataChannel(dataChannel, peerInfo.id);
        this.peers.set(peerInfo.id, { ...peerInfo, connection: peerConnection });
        this.dataChannels.set(peerInfo.id, dataChannel);
        
        // Handle ICE candidates and connection state
        this.setupPeerConnectionHandlers(peerConnection, peerInfo.id);
        
        // For demo purposes, we'll mark the connection as successful immediately
        // In a real app, you'd exchange SDP offers/answers through a signaling server
        setTimeout(() => {
            this.onPeerConnected(peerInfo.id, peerInfo.name);
        }, 1000);
    }

    setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => {
            console.log('Data channel opened for peer:', peerId);
        };
        
        dataChannel.onmessage = async (event) => {
            await this.handleIncomingMessage(JSON.parse(event.data), peerId);
        };
        
        dataChannel.onclose = () => {
            console.log('Data channel closed for peer:', peerId);
            this.onPeerDisconnected(peerId);
        };
    }

    setupPeerConnectionHandlers(peerConnection, peerId) {
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'disconnected' || 
                peerConnection.connectionState === 'failed') {
                this.onPeerDisconnected(peerId);
            }
        };
    }

    onPeerConnected(peerId, peerName) {
        this.addSystemMessage(`${peerName} joined the room`);
        this.updateParticipantCount();
        this.updateOnlineUsers();
        
        // Send our introduction
        this.sendToPeer(peerId, {
            type: 'introduction',
            name: this.displayName,
            timestamp: Date.now()
        });
    }

    onPeerDisconnected(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            this.addSystemMessage(`${peer.name} left the room`);
            this.peers.delete(peerId);
            this.dataChannels.delete(peerId);
            this.updateParticipantCount();
            this.updateOnlineUsers();
        }
    }

    leaveRoom() {
        // Cleanup room
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
        }
        
        // Close all peer connections
        for (const [peerId, peer] of this.peers) {
            if (peer.connection) {
                peer.connection.close();
            }
        }
        
        // Remove ourselves from room registry
        if (this.currentRoom) {
            const roomKey = `wafflent_room_${this.currentRoom}`;
            const roomData = JSON.parse(localStorage.getItem(roomKey) || '[]');
            const filteredData = roomData.filter(p => p.id !== this.myPeerId);
            
            if (filteredData.length === 0) {
                localStorage.removeItem(roomKey);
            } else {
                localStorage.setItem(roomKey, JSON.stringify(filteredData));
            }
        }
        
        this.peers.clear();
        this.dataChannels.clear();
        this.currentRoom = null;
        this.roomPasscode = null;
        this.encryptionKey = null; // Clear encryption key
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
        
        const message = {
            id: this.generateMessageId(),
            type: 'message',
            content: content, // Keep original content for local display
            sender: this.displayName,
            timestamp: Date.now()
        };
        
        // Create a copy for transmission that will be encrypted
        let messageToSend = { ...message };
        
        // Encrypt if encryption key is available
        if (this.encryptionKey) {
            try {
                const encryptedData = await this.encryptMessage(content);
                messageToSend.content = encryptedData.ciphertext;
                messageToSend.iv = encryptedData.iv;
                messageToSend.encrypted = true;
                
                // Mark our local message as encrypted but keep original content
                message.encrypted = true;
            } catch (error) {
                this.showAlert('error', 'Failed to encrypt message: ' + error.message);
                return;
            }
        }
        
        // Add to our message list (with original unencrypted content for display)
        this.messages.push(message);
        this.messageCount++;
        this.renderMessage(message);
        this.updateRoomStats();
        
        // Broadcast encrypted version to peers
        this.broadcastMessage(messageToSend);
        
        messageInput.value = '';
        this.scrollToBottom();
    }

    broadcastMessage(message) {
        for (const [peerId, dataChannel] of this.dataChannels) {
            if (dataChannel.readyState === 'open') {
                this.sendToPeer(peerId, message);
            }
        }
    }

    sendToPeer(peerId, data) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(JSON.stringify(data));
            } catch (error) {
                console.error('Failed to send message to peer:', error);
            }
        }
    }

    async handleIncomingMessage(message, fromPeerId) {
        switch (message.type) {
            case 'message':
                // Decrypt if encrypted
                if (message.encrypted && this.encryptionKey) {
                    try {
                        message.content = await this.decryptMessage({
                            ciphertext: message.content,
                            iv: message.iv
                        });
                    } catch (error) {
                        console.error('Decryption failed:', error);
                        message.content = '[Failed to decrypt message - wrong passcode?]';
                        message.decryptionFailed = true;
                    }
                } else if (message.encrypted && !this.encryptionKey) {
                    message.content = '[Encrypted message - no key available]';
                    message.decryptionFailed = true;
                }
                
                this.messages.push(message);
                this.messageCount++;
                this.renderMessage(message);
                this.updateRoomStats();
                this.scrollToBottom();
                break;
                
            case 'introduction':
                this.onPeerConnected(fromPeerId, message.name);
                break;
                
            case 'nameChange':
                const peer = this.peers.get(fromPeerId);
                if (peer) {
                    this.addSystemMessage(`${message.oldName} changed their name to ${message.newName}`);
                    peer.name = message.newName;
                }
                break;
        }
    }

    renderMessage(message) {
        const container = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        
        if (message.type === 'message') {
            const isOwnMessage = message.sender === this.displayName;
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
        document.getElementById('messageCount').textContent = this.messageCount.toString();
        
        if (this.roomCreatedAt) {
            const timeAgo = this.formatTimeAgo(this.roomCreatedAt);
            document.getElementById('roomCreated').textContent = timeAgo;
        }
        
        const encryptionType = this.encryptionKey ? 'AES-256-GCM' : 'None';
        document.getElementById('encryptionType').textContent = encryptionType;
    }

    updateOnlineUsers() {
        const usersList = document.getElementById('usersList');
        const userCount = document.getElementById('onlineUserCount');
        
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
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('chatScreen').style.display = 'flex';
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendMessageBtn').disabled = false;
        document.getElementById('messageInput').focus();
        
        // Update room info in both header and sidebar
        const roomNameElements = [
            document.getElementById('currentRoomName'),
            document.getElementById('sidebarRoomName')
        ];
        
        roomNameElements.forEach(element => {
            element.innerHTML = `
                <i class="fas fa-hashtag"></i>
                ${this.escapeHtml(this.currentRoom)}
            `;
        });
        
        // Update encryption status
        const encStatusElements = [
            document.getElementById('sidebarEncryptionStatus')
        ];
        
        encStatusElements.forEach(encStatus => {
            if (this.encryptionKey) {
                encStatus.innerHTML = '<i class="fas fa-shield-alt"></i> E2E Encrypted';
                encStatus.className = 'wf-chip wf-chip-success';
            } else {
                encStatus.innerHTML = '<i class="fas fa-unlock"></i> Not Encrypted';
                encStatus.className = 'wf-chip wf-chip-warning';
            }
        });
        
        this.updateParticipantCount();
        this.updateOnlineUsers();
        this.updateRoomStats();
        this.scrollToBottom();
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
        if (this.currentRoom) {
            statusChip.innerHTML = '<i class="fas fa-circle" style="color: var(--success); font-size: 8px;"></i> Online';
            statusChip.className = 'wf-chip wf-chip-success';
        } else {
            statusChip.innerHTML = '<i class="fas fa-circle" style="color: var(--error); font-size: 8px;"></i> Offline';
            statusChip.className = 'wf-chip wf-chip-default';
        }
        
        this.updateConnectionInfo();
    }

    updateConnectionInfo() {
        document.getElementById('connectionStatus').textContent = this.currentRoom ? 'Connected' : 'Offline';
        document.getElementById('peerId').textContent = this.currentRoom ? this.myPeerId : 'Not connected';
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
    generateUniquePeerId() {
        // Generate a truly unique peer ID for this session
        return 'peer_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9) + '_' + performance.now().toString(36);
    }

    generatePeerId() {
        // Keep the old method for backward compatibility, but use myPeerId instead
        return this.myPeerId;
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
    }

    async discoverPeers() {
        // For demo purposes, we'll simulate discovering existing peers
        console.log('Discovering existing peers in room...');
        
        // In a real implementation, you'd query a signaling server here
        return new Promise(resolve => {
            setTimeout(resolve, 500);
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.wafflent = new Wafflent();
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.wafflent) {
        window.wafflent.cleanup();
    }
});