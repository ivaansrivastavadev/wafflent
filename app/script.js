// Wafflent - Second Brain Memory Manager (Revamped)
// Powered by Puter.js

// ============================================================
// STATE MANAGEMENT
// ============================================================

let waffles = [];
let albums = [];
let chats = [];
let currentView = 'waffles';
let currentAlbum = 'all';
let currentModel = 'gpt-5.4-nano';
let currentChatId = null;
let uploadCountdown = null;
let db = null;

const OCR_MODELS = ['aws-textract-ocr', 'mistral-ocr'];

// ============================================================
// INDEXEDDB SETUP
// ============================================================

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WafflentDB', 3);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('waffles')) {
                db.createObjectStore('waffles', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('albums')) {
                db.createObjectStore('albums', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('chats')) {
                db.createObjectStore('chats', { keyPath: 'id' });
            }
        };
    });
}

async function saveData() {
    if (!db) return;
    
    try {
        const tx = db.transaction(['waffles', 'albums', 'chats'], 'readwrite');
        const waffleStore = tx.objectStore('waffles');
        const albumStore = tx.objectStore('albums');
        const chatStore = tx.objectStore('chats');
        
        // Clear and save waffles
        await waffleStore.clear();
        for (const waffle of waffles) {
            await waffleStore.put(waffle);
        }
        
        // Clear and save albums
        await albumStore.clear();
        for (const album of albums) {
            await albumStore.put(album);
        }
        
        // Clear and save chats
        await chatStore.clear();
        for (const chat of chats) {
            await chatStore.put(chat);
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Save data error:', error);
    }
}

async function loadData() {
    try {
        await initDB();
        
        const tx = db.transaction(['waffles', 'albums', 'chats', 'settings'], 'readonly');
        
        // Load waffles
        const waffleStore = tx.objectStore('waffles');
        const waffleRequest = waffleStore.getAll();
        waffleRequest.onsuccess = () => {
            waffles = waffleRequest.result || [];
            renderWaffles();
            renderFavorites();
        };
        
        // Load albums
        const albumStore = tx.objectStore('albums');
        const albumRequest = albumStore.getAll();
        albumRequest.onsuccess = () => {
            albums = albumRequest.result || [];
            if (albums.length === 0) {
                albums.push({ id: 'all', name: 'All', waffles: [] });
            }
            renderAlbums();
        };
        
        // Load chats
        if (db.objectStoreNames.contains('chats')) {
            const chatStore = tx.objectStore('chats');
            const chatRequest = chatStore.getAll();
            chatRequest.onsuccess = () => {
                chats = chatRequest.result || [];
                renderChatList();
                checkExpiredChats();
            };
        }
        
        // Load settings
        const settingsStore = tx.objectStore('settings');
        const modelRequest = settingsStore.get('currentModel');
        modelRequest.onsuccess = () => {
            if (modelRequest.result) {
                currentModel = modelRequest.result.value;
            }
        };
        
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve();
        });
    } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
        // Fallback to localStorage for migration
        const savedWaffles = localStorage.getItem('wafflent_waffles');
        const savedAlbums = localStorage.getItem('wafflent_albums');
        const savedModel = localStorage.getItem('wafflent_model');
        
        if (savedWaffles) waffles = JSON.parse(savedWaffles);
        if (savedAlbums) albums = JSON.parse(savedAlbums);
        if (savedModel) currentModel = savedModel;
        
        if (albums.length === 0) {
            albums.push({ id: 'all', name: 'All', waffles: [] });
        }
        
        renderWaffles();
        renderFavorites();
        renderAlbums();
        
        // Migrate to IndexedDB
        if (waffles.length > 0 || albums.length > 1) {
            setTimeout(() => {
                saveData();
                showToast('Data migrated to new storage!', 'success');
            }, 1000);
        }
    }
}

async function saveSetting(key, value) {
    if (!db) return;
    try {
        const tx = db.transaction(['settings'], 'readwrite');
        const store = tx.objectStore('settings');
        await store.put({ key, value });
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('Save setting error:', error);
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// ============================================================
// SETTINGS
// ============================================================

function openSettings() {
    document.getElementById('settingsModal').classList.remove('wf-hidden');
    const modelSelector = document.getElementById('modelSelector');
    modelSelector.value = currentModel;
    
    modelSelector.onchange = () => {
        const modelWarning = document.getElementById('modelWarning');
        modelWarning.style.display = OCR_MODELS.includes(modelSelector.value) ? 'block' : 'none';
    };
    
    if (OCR_MODELS.includes(currentModel)) {
        document.getElementById('modelWarning').style.display = 'block';
    }
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('wf-hidden');
}

function saveSettings() {
    currentModel = document.getElementById('modelSelector').value;
    saveSetting('currentModel', currentModel);
    closeSettings();
    showToast('Settings saved!', 'success');
}

// ============================================================
// VIEW SWITCHING
// ============================================================

function switchView(view, element) {
    currentView = view;
    
    // Update active tab
    document.querySelectorAll('.wf-tab').forEach(tab => tab.classList.remove('active'));
    element.classList.add('active');
    
    // Hide all views
    document.getElementById('wafflesView').classList.add('wf-hidden');
    document.getElementById('favoritesView').classList.add('wf-hidden');
    document.getElementById('albumsView').classList.add('wf-hidden');
    document.getElementById('tagsView').classList.add('wf-hidden');
    document.getElementById('chatView').classList.add('wf-hidden');
    document.getElementById('servicesView').classList.add('wf-hidden');
    document.getElementById('searchView').classList.add('wf-hidden');
    
    // Show albums section only for albums view
    const albumsSection = document.getElementById('albumsSection');
    albumsSection.style.display = (view === 'albums') ? 'block' : 'none';
    
    // Show selected view
    if (view === 'waffles') {
        document.getElementById('wafflesView').classList.remove('wf-hidden');
        renderWaffles();
    } else if (view === 'favorites') {
        document.getElementById('favoritesView').classList.remove('wf-hidden');
        renderFavorites();
    } else if (view === 'albums') {
        document.getElementById('albumsView').classList.remove('wf-hidden');
        renderAlbumsManagement();
    } else if (view === 'tags') {
        document.getElementById('tagsView').classList.remove('wf-hidden');
        renderTagsView();
    } else if (view === 'chat') {
        document.getElementById('chatView').classList.remove('wf-hidden');
        renderChatList();
        if (currentChatId) {
            loadChat(currentChatId);
        }
    } else if (view === 'services') {
        document.getElementById('servicesView').classList.remove('wf-hidden');
    } else if (view === 'search') {
        document.getElementById('searchView').classList.remove('wf-hidden');
        document.getElementById('globalSearchInput').focus();
    }
}

// ============================================================
// WAFFLE UPLOAD FLOW
// ============================================================

function showUploadPopup() {
    const popup = document.getElementById('uploadPopup');
    popup.classList.remove('wf-hidden');
    
    // Setup drag and drop
    const dropZone = document.getElementById('uploadDropZone');
    
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.background = 'var(--bg-elevated)';
    };
    
    dropZone.ondragleave = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.background = 'transparent';
    };
    
    dropZone.ondrop = async (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.background = 'transparent';
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            closeUploadPopup();
            await processImageFile(file);
        } else {
            showToast('Please drop an image file', 'error');
        }
    };
}

function closeUploadPopup() {
    document.getElementById('uploadPopup').classList.add('wf-hidden');
}

function triggerFileInput() {
    document.getElementById('imageInput').click();
}

async function pasteImage() {
    try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);
                    closeUploadPopup();
                    await processImageBlob(blob);
                    return;
                }
            }
        }
        showToast('No image found in clipboard', 'warning');
    } catch (error) {
        console.error('Clipboard error:', error);
        showToast('Could not access clipboard', 'error');
    }
}

async function handleWaffleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    closeUploadPopup();
    await processImageFile(file);
    event.target.value = '';
}

async function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        await showUploadOptionsModal(e.target.result);
    };
    reader.readAsDataURL(file);
}

async function processImageBlob(blob) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        await showUploadOptionsModal(e.target.result);
    };
    reader.readAsDataURL(blob);
}

function showUploadOptionsModal(imageData) {
    const modal = document.createElement('div');
    modal.className = 'wf-modal-backdrop';
    modal.id = 'uploadModal';
    
    let countdown = 5;
    
    modal.innerHTML = `
        <div class="wf-modal" style="max-width: 500px;">
            <div class="wf-modal-header">
                <h2 class="wf-modal-title">Add Waffle</h2>
                <button class="wf-modal-close" onclick="cancelUpload()">×</button>
            </div>
            <div class="wf-modal-body" style="text-align: center;">
                <img src="${imageData}" style="max-width: 100%; max-height: 300px; border-radius: var(--r-lg); margin-bottom: var(--space-6);">
                <p class="wf-body" style="margin-bottom: var(--space-6); color: var(--text-secondary);">
                    Choose how to add this waffle
                </p>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                    <button class="wf-btn wf-btn-filled" onclick="addWaffleWithSummary('${imageData}')">
                        ✨ Summarize & Add
                    </button>
                    <button class="wf-btn wf-btn-outlined upload-add-btn" onclick="addWaffleQuick('${imageData}')" style="border-color: var(--accent); color: var(--accent); position: relative;">
                        <span>➕ Add</span>
                        <span id="countdown" style="position: absolute; right: 16px; font-size: var(--text-xs); opacity: 0.7;">(${countdown}s)</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Start countdown
    uploadCountdown = setInterval(() => {
        countdown--;
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.textContent = `(${countdown}s)`;
        }
        
        if (countdown <= 0) {
            clearInterval(uploadCountdown);
            if (document.getElementById('uploadModal')) {
                addWaffleQuick(imageData);
            }
        }
    }, 1000);
}

function cancelUpload() {
    if (uploadCountdown) {
        clearInterval(uploadCountdown);
        uploadCountdown = null;
    }
    document.getElementById('uploadModal')?.remove();
}

async function addWaffleQuick(imageData) {
    cancelUpload();
    showToast('Analyzing image...', 'info');
    
    try {
        // Ask AI for title and tags
        const result = await puter.ai.chat(
            'Analyze this image and provide: 1) A short title (5 words max), 2) Relevant tags. Format: TITLE: [title]\\nTAGS: #Tag, #Tag (if no tags possible, use #UnOrganised)',
            imageData,
            { model: currentModel }
        );
        
        const response = result.message?.content?.[0]?.text || result.toString();
        const titleMatch = response.match(/TITLE:\s*(.+)/i);
        const tagsMatch = response.match(/TAGS:\s*(.+)/i);
        
        let title = 'Untitled Waffle';
        let tags = [];
        
        if (titleMatch) title = titleMatch[1].trim();
        if (tagsMatch) tags = extractTags(tagsMatch[1]);
        
        const waffle = {
            id: Date.now(),
            title: title,
            image: imageData,
            tags: tags,
            timestamp: new Date().toISOString(),
            albums: [currentAlbum === 'all' ? 'all' : currentAlbum],
            favorite: false,
            description: '',
            remark: ''
        };
        
        waffles.unshift(waffle);
        await saveData();
        renderWaffles();
        renderAlbums();
        renderFavorites();
        
        showToast('Waffle added!', 'success');
    } catch (error) {
        console.error('Error adding waffle:', error);
        showToast('Failed to add waffle', 'error');
    }
}

async function addWaffleWithSummary(imageData) {
    cancelUpload();
    
    // Create waffle
    const waffle = {
        id: Date.now(),
        title: 'New Waffle',
        image: imageData,
        tags: [],
        timestamp: new Date().toISOString(),
        albums: [currentAlbum === 'all' ? 'all' : currentAlbum],
        favorite: false,
        description: '',
        remark: ''
    };
    
    waffles.unshift(waffle);
    await saveData();
    
    // Create new chat with this waffle
    const chat = {
        id: Date.now(),
        title: 'New Chat',
        mainWaffle: waffle.id,
        messages: [],
        createdAt: new Date().toISOString(),
        selfDestructTimer: 0
    };
    
    chats.unshift(chat);
    currentChatId = chat.id;
    await saveData();
    
    // Switch to chat view
    document.querySelectorAll('.wf-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-view="chat"]').classList.add('active');
    switchView('chat', document.querySelector('[data-view="chat"]'));
    
    renderChatList();
    loadChat(chat.id);
    
    // Auto-send summarize request
    showToast('Generating summary...', 'info');
    
    try {
        const result = await puter.ai.chat(
            'Analyze this image and provide: 1) A short title (5 words max), 2) A description with relevant hashtags using #tag format. Format: TITLE: [title]\nDESCRIPTION: [description with #tags]',
            imageData,
            { model: currentModel }
        );
        
        const response = result.message?.content?.[0]?.text || result.toString();
        const titleMatch = response.match(/TITLE:\s*(.+)/i);
        const descMatch = response.match(/DESCRIPTION:\s*(.+)/is);
        
        if (titleMatch) {
            waffle.title = titleMatch[1].trim();
            chat.title = waffle.title;
        }
        if (descMatch) {
            waffle.description = descMatch[1].trim();
            waffle.tags = extractTags(waffle.description);
        }
        
        await saveData();
        renderChatList();
        updateChatHeader();
        
        // Add AI message to chat with markdown
        addChatMessage('ai', `I've analyzed your waffle:\n\n**${waffle.title}**\n\n${waffle.description}`);
        
        showToast('Summary generated!', 'success');
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to generate summary', 'error');
    }
}

// ============================================================
// ALBUMS
// ============================================================

function createAlbum() {
    const name = prompt('Enter album name:');
    if (!name || !name.trim()) return;
    
    const album = {
        id: Date.now(),
        name: name.trim(),
        waffles: []
    };
    
    albums.push(album);
    saveData();
    renderAlbums();
    showToast(`Album "${name}" created!`, 'success');
}

function filterByAlbum(albumId, element) {
    currentAlbum = albumId;
    
    document.querySelectorAll('#albumsList .wf-chip').forEach(chip => {
        chip.classList.remove('active-album');
    });
    element.classList.add('active-album');
    
    renderWaffles();
}

function renderAlbums() {
    const albumsList = document.getElementById('albumsList');
    const customAlbums = albums.filter(a => a.id !== 'all');
    
    // Keep "All" button and add custom albums
    albumsList.innerHTML = `
        <button class="wf-chip wf-chip-accent ${currentAlbum === 'all' ? 'active-album' : ''}" onclick="filterByAlbum('all', this)">All</button>
        ${customAlbums.map(album => `
            <button class="wf-chip wf-chip-default ${currentAlbum === album.id ? 'active-album' : ''}" onclick="filterByAlbum('${album.id}', this)">
                ${album.name}
            </button>
        `).join('')}
    `;
}

function renderAlbumsManagement() {
    const container = document.getElementById('albumsManagement');
    const customAlbums = albums.filter(a => a.id !== 'all');
    
    container.innerHTML = customAlbums.map(album => {
        const waffleCount = waffles.filter(w => w.albums.includes(album.id)).length;
        return `
            <div class="wf-card wf-card-hover" onclick="filterByAlbum('${album.id}', this); switchView('waffles', document.querySelector('[data-view=\\'waffles\\']'));">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <h3 class="wf-card-title">${album.name}</h3>
                    <button class="wf-btn-icon sm" onclick="event.stopPropagation(); deleteAlbum('${album.id}')" style="background: var(--bg-elevated);">
                        🗑️
                    </button>
                </div>
                <p class="wf-body-sm" style="margin-top: var(--space-2); color: var(--text-tertiary);">
                    ${waffleCount} waffle${waffleCount !== 1 ? 's' : ''}
                </p>
            </div>
        `;
    }).join('');
}

function deleteAlbum(albumId) {
    if (!confirm('Delete this album? Waffles will not be deleted.')) return;
    
    albums = albums.filter(a => a.id !== albumId);
    waffles.forEach(w => {
        w.albums = w.albums.filter(a => a !== albumId);
        if (w.albums.length === 0) w.albums.push('all');
    });
    
    saveData();
    renderAlbums();
    renderAlbumsManagement();
    showToast('Album deleted', 'success');
}

// ============================================================
// RENDER WAFFLES
// ============================================================

function renderWaffles() {
    const grid = document.getElementById('wafflesGrid');
    const emptyState = document.getElementById('emptyState');
    
    grid.style.display = '';
    grid.className = 'wf-grid-3';
    grid.style.gap = 'var(--space-6)';
    
    let displayWaffles = waffles;
    
    if (currentAlbum !== 'all') {
        displayWaffles = waffles.filter(w => w.albums.includes(currentAlbum));
    }
    
    grid.innerHTML = '';
    
    if (displayWaffles.length === 0) {
        grid.classList.add('wf-hidden');
        emptyState.classList.remove('wf-hidden');
        return;
    }
    
    grid.classList.remove('wf-hidden');
    emptyState.classList.add('wf-hidden');
    
    displayWaffles.forEach(waffle => {
        const card = document.createElement('div');
        card.className = 'wf-card wf-card-hover waffle-card';
        card.onclick = () => viewWaffle(waffle.id);
        
        card.innerHTML = `
            <div class="wf-card-media" style="position: relative; max-height: 200px; overflow: hidden;">
                <img src="${waffle.image}" style="width: 100%; height: 100%; object-fit: cover;">
                <button class="wf-btn-icon sm" onclick="event.stopPropagation(); toggleFavorite(${waffle.id})" 
                    style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); color: white;">
                    ${waffle.favorite ? '⭐' : '☆'}
                </button>
            </div>
            <h3 class="wf-card-title" style="margin-top: var(--space-3);">${waffle.title}</h3>
            ${waffle.tags.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: var(--space-2);">
                    ${waffle.tags.slice(0, 3).map(tag => `<span class="wf-chip wf-chip-accent" style="font-size: 10px; padding: 2px 8px;">#${tag}</span>`).join('')}
                    ${waffle.tags.length > 3 ? `<span class="wf-chip wf-chip-default" style="font-size: 10px; padding: 2px 8px;">+${waffle.tags.length - 3}</span>` : ''}
                </div>
            ` : ''}
            <p class="wf-caption" style="margin-top: var(--space-3);">${formatDate(waffle.timestamp)}</p>
        `;
        
        grid.appendChild(card);
    });
}

function toggleFavorite(id) {
    const waffle = waffles.find(w => w.id === id);
    if (waffle) {
        waffle.favorite = !waffle.favorite;
        saveData();
        renderWaffles();
        renderFavorites();
    }
}

function viewWaffle(id) {
    const waffle = waffles.find(w => w.id === id);
    if (!waffle) return;
    
    // Show waffle detail modal
    const modal = document.createElement('div');
    modal.className = 'wf-modal-backdrop';
    modal.id = 'waffleDetailModal';
    
    modal.innerHTML = `
        <div class="wf-modal" style="max-width: 90vw; max-height: 90vh; overflow-y: auto;">
            <div class="wf-modal-header">
                <h2 class="wf-modal-title">${waffle.title}</h2>
                <button class="wf-modal-close" onclick="closeWaffleDetail()">×</button>
            </div>
            <div class="wf-modal-body">
                <img src="${waffle.image}" style="width: 100%; max-width: 90%; max-height: 90vh; object-fit: contain; border-radius: var(--r-lg); margin: 0 auto; display: block;">
                
                ${waffle.description ? `
                    <div style="margin-top: var(--space-6);">
                        <h4 class="wf-h5">Description</h4>
                        <div class="wf-body" style="margin-top: var(--space-2);">${renderMarkdown(waffle.description)}</div>
                    </div>
                ` : ''}
                
                ${waffle.tags.length > 0 ? `
                    <div style="margin-top: var(--space-6);">
                        <h4 class="wf-h5">Tags</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2);">
                            ${waffle.tags.map(tag => `<span class="wf-chip wf-chip-accent">#${tag}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: var(--space-4);">
                    <p class="wf-caption" style="color: var(--text-tertiary);">Created ${formatDate(waffle.timestamp)}</p>
                </div>
            </div>
            <div class="wf-modal-footer" style="display: flex; gap: var(--space-3);">
                <button class="wf-btn wf-btn-outlined" onclick="downloadWaffle(${waffle.id})">Download</button>
                <button class="wf-btn wf-btn-outlined" onclick="askAboutWaffle(${waffle.id})">Ask</button>
                <button class="wf-btn wf-btn-ghost" onclick="closeWaffleDetail()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeWaffleDetail() {
    document.getElementById('waffleDetailModal')?.remove();
}

function downloadWaffle(id) {
    const waffle = waffles.find(w => w.id === id);
    if (!waffle) return;
    
    const link = document.createElement('a');
    link.href = waffle.image;
    link.download = `${waffle.title.replace(/[^a-z0-9]/gi, '_')}.png`;
    link.click();
    
    showToast('Downloaded!', 'success');
}

function askAboutWaffle(id) {
    closeWaffleDetail();
    
    // Create new chat with this waffle
    const chat = {
        id: Date.now(),
        title: 'New Chat',
        mainWaffle: id,
        messages: [],
        createdAt: new Date().toISOString(),
        selfDestructTimer: 0
    };
    
    chats.unshift(chat);
    currentChatId = chat.id;
    saveData();
    
    // Switch to chat view
    document.querySelectorAll('.wf-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-view="chat"]').classList.add('active');
    switchView('chat', document.querySelector('[data-view="chat"]'));
    
    renderChatList();
    loadChat(chat.id);
    
    showToast('Chat created with waffle!', 'success');
}

// ============================================================
// FAVORITES VIEW
// ============================================================

function renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    const emptyState = document.getElementById('emptyFavorites');
    
    const favoriteWaffles = waffles.filter(w => w.favorite);
    
    if (favoriteWaffles.length === 0) {
        grid.classList.add('wf-hidden');
        emptyState.classList.remove('wf-hidden');
        return;
    }
    
    grid.classList.remove('wf-hidden');
    emptyState.classList.add('wf-hidden');
    grid.innerHTML = '';
    
    favoriteWaffles.forEach(waffle => {
        const card = document.createElement('div');
        card.className = 'wf-card wf-card-hover waffle-card';
        card.onclick = () => viewWaffle(waffle.id);
        
        card.innerHTML = `
            <div class="wf-card-media" style="position: relative; max-height: 200px; overflow: hidden;">
                <img src="${waffle.image}" style="width: 100%; height: 100%; object-fit: cover;">
                <button class="wf-btn-icon sm" onclick="event.stopPropagation(); toggleFavorite(${waffle.id})" 
                    style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); color: white;">
                    ⭐
                </button>
            </div>
            <h3 class="wf-card-title" style="margin-top: var(--space-3);">${waffle.title}</h3>
            ${waffle.tags.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: var(--space-2);">
                    ${waffle.tags.slice(0, 3).map(tag => `<span class="wf-chip wf-chip-accent" style="font-size: 10px; padding: 2px 8px;">#${tag}</span>`).join('')}
                    ${waffle.tags.length > 3 ? `<span class="wf-chip wf-chip-default" style="font-size: 10px; padding: 2px 8px;">+${waffle.tags.length - 3}</span>` : ''}
                </div>
            ` : ''}
            <p class="wf-caption" style="margin-top: var(--space-3);">${formatDate(waffle.timestamp)}</p>
        `;
        
        grid.appendChild(card);
    });
}

// ============================================================
// TAGS VIEW
// ============================================================

function renderTagsView() {
    const container = document.getElementById('tagsView');
    const allTags = getAllTags();
    
    if (allTags.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-16) 0;">
                <div style="font-size: 72px; margin-bottom: var(--space-4);">🏷️</div>
                <h3 class="wf-h3" style="margin-bottom: var(--space-2);">No tags yet</h3>
                <p class="wf-body" style="color: var(--text-tertiary);">Tags will appear when you add waffles</p>
            </div>
        `;
        return;
    }
    
    const tagsByLetter = {};
    allTags.forEach(tag => {
        const letter = tag[0].toUpperCase();
        if (!tagsByLetter[letter]) tagsByLetter[letter] = [];
        tagsByLetter[letter].push(tag);
    });
    
    container.innerHTML = Object.keys(tagsByLetter).sort().map(letter => `
        <div style="margin-bottom: var(--space-6);">
            <h3 class="wf-h3" style="margin-bottom: var(--space-4); color: var(--accent);">${letter}</h3>
            <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
                ${tagsByLetter[letter].map(tag => {
                    const count = waffles.filter(w => w.tags && w.tags.includes(tag)).length;
                    return `
                        <button class="wf-chip wf-chip-accent wf-chip-clickable" onclick="filterByTag('${tag}')" style="font-size: var(--text-base); padding: 8px 16px;">
                            #${tag} <span style="opacity: 0.6; margin-left: 4px;">(${count})</span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function getAllTags() {
    const tagSet = new Set();
    waffles.forEach(w => w.tags && w.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
}

function filterByTag(tag) {
    currentAlbum = 'all';
    switchView('waffles', document.querySelector('[data-view="waffles"]'));
    
    const filtered = waffles.filter(w => w.tags && w.tags.includes(tag));
    
    const grid = document.getElementById('wafflesGrid');
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="wf-body" style="color: var(--text-tertiary);">No waffles with this tag</p>';
        return;
    }
    
    filtered.forEach(waffle => {
        const card = document.createElement('div');
        card.className = 'wf-card wf-card-hover waffle-card';
        card.onclick = () => viewWaffle(waffle.id);
        
        card.innerHTML = `
            <div class="wf-card-media" style="max-height: 200px; overflow: hidden;">
                <img src="${waffle.image}" style="width: 100%; object-fit: cover;">
            </div>
            <h3 class="wf-card-title" style="margin-top: var(--space-3);">${waffle.title}</h3>
        `;
        
        grid.appendChild(card);
    });
}

// ============================================================
// CHAT
// ============================================================

function renderChatList() {
    const container = document.getElementById('chatList');
    
    if (chats.length === 0) {
        container.innerHTML = '<p class="wf-caption" style="color: var(--text-tertiary); text-align: center;">No chats yet</p>';
        return;
    }
    
    container.innerHTML = chats.map(chat => {
        const waffle = waffles.find(w => w.id === chat.mainWaffle);
        const preview = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.substring(0, 50) + '...' : 'No messages yet';
        
        return `
            <div class="wf-card wf-card-hover" onclick="loadChat(${chat.id})" style="padding: var(--space-3); cursor: pointer; ${currentChatId === chat.id ? 'border: 2px solid var(--accent);' : ''}">
                ${waffle ? `<img src="${waffle.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--r-md); margin-bottom: var(--space-2);">` : ''}
                <h4 class="wf-h6" style="margin-bottom: 4px;">${chat.title}</h4>
                <p class="wf-caption" style="color: var(--text-tertiary); font-size: 11px;">${preview}</p>
            </div>
        `;
    }).join('');
}

function createNewChat() {
    const chat = {
        id: Date.now(),
        title: 'New Chat',
        mainWaffle: null,
        messages: [],
        createdAt: new Date().toISOString(),
        selfDestructTimer: 0
    };
    
    chats.unshift(chat);
    currentChatId = chat.id;
    
    // Save data asynchronously
    saveData().then(() => {
        renderChatList();
        loadChat(chat.id);
        showToast('New chat created!', 'success');
    }).catch(error => {
        console.error('Failed to save chat:', error);
        showToast('Failed to create chat', 'error');
    });
}

function loadChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    
    // Show active chat view
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChatView').classList.remove('wf-hidden');
    
    // Update header
    updateChatHeader();
    
    // Render messages
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    chat.messages.forEach(msg => {
        addChatMessage(msg.role, msg.content, false);
    });
    
    renderChatList();
}

function updateChatHeader() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    document.getElementById('currentChatTitle').textContent = chat.title;
    
    const waffle = waffles.find(w => w.id === chat.mainWaffle);
    if (waffle) {
        document.getElementById('currentChatWaffle').textContent = `Main: ${waffle.title}`;
    } else {
        document.getElementById('currentChatWaffle').textContent = 'No main waffle';
    }
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !currentChatId) return;
    
    addChatMessage('user', message, true);
    input.value = '';
    
    // Send to AI
    handleChatAI(message);
}

function addChatMessage(role, content, save = true) {
    const container = document.getElementById('chatMessages');
    
    const msg = document.createElement('div');
    msg.style.display = 'flex';
    msg.style.flexDirection = role === 'user' ? 'row-reverse' : 'row';
    msg.style.gap = 'var(--space-3)';
    
    const renderedContent = role === 'ai' ? renderMarkdown(content) : escapeHtml(content);
    
    msg.innerHTML = `
        <div style="background: ${role === 'user' ? 'var(--accent)' : 'var(--bg-surface)'}; color: ${role === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)'}; padding: var(--space-3) var(--space-4); border-radius: var(--r-lg); max-width: 70%;">
            <div style="font-size: var(--text-sm); line-height: 1.6;">${renderedContent}</div>
        </div>
    `;
    
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    
    if (save && currentChatId) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
            chat.messages.push({ role, content, timestamp: new Date().toISOString() });
            // Save asynchronously without blocking UI
            saveData().then(() => {
                renderChatList();
            }).catch(error => {
                console.error('Failed to save message:', error);
            });
        }
    }
}

async function handleChatAI(userMessage) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    const waffle = waffles.find(w => w.id === chat.mainWaffle);
    
    showToast('AI is thinking...', 'info');
    
    try {
        // Build context from message history
        const context = chat.messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const waffleContext = waffle ? `Main Waffle: ${waffle.title}\nDescription: ${waffle.description}\n\n` : '';
        
        const result = await puter.ai.chat(
            `${waffleContext}Previous conversation:\n${context}\n\nUser: ${userMessage}`,
            waffle?.image,
            { model: currentModel }
        );
        
        const response = result.message?.content?.[0]?.text || result.toString();
        addChatMessage('ai', response, true);
    } catch (error) {
        console.error('Chat error:', error);
        addChatMessage('ai', 'Sorry, I encountered an error. Please try again.', true);
    }
}

function openChatSettings() {
    if (!currentChatId) return;
    
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    document.getElementById('chatSettingsModal').classList.remove('wf-hidden');
    document.getElementById('chatTimerSelector').value = chat.selfDestructTimer;
    
    // Update main waffle display
    const waffle = waffles.find(w => w.id === chat.mainWaffle);
    const selector = document.getElementById('chatMainWaffleSelector');
    if (waffle) {
        selector.innerHTML = `
            <div style="display: flex; gap: var(--space-3); align-items: center; padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--r-md);">
                <img src="${waffle.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--r-md);">
                <div>
                    <h5 class="wf-h6">${waffle.title}</h5>
                    <p class="wf-caption" style="color: var(--text-tertiary);">${waffle.tags.map(t => `#${t}`).join(' ')}</p>
                </div>
            </div>
        `;
    } else {
        selector.innerHTML = '<p class="wf-body-sm" style="color: var(--text-tertiary);">No waffle selected</p>';
    }
}

function closeChatSettings() {
    document.getElementById('chatSettingsModal').classList.add('wf-hidden');
}

function saveChatSettings() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    chat.selfDestructTimer = parseInt(document.getElementById('chatTimerSelector').value);
    
    if (chat.selfDestructTimer > 0) {
        chat.selfDestructAt = Date.now() + (chat.selfDestructTimer * 1000);
    } else {
        chat.selfDestructAt = null;
    }
    
    saveData().then(() => {
        closeChatSettings();
        showToast('Chat settings saved!', 'success');
    }).catch(error => {
        console.error('Save error:', error);
        showToast('Failed to save settings', 'error');
    });
}

function selectMainWaffleForChat() {
    document.getElementById('waffleSelectorModal').classList.remove('wf-hidden');
    
    const grid = document.getElementById('waffleSelectorGrid');
    grid.innerHTML = waffles.map(waffle => `
        <div class="wf-card wf-card-hover" onclick="setMainWaffleForChat(${waffle.id})" style="cursor: pointer;">
            <div class="wf-card-media" style="max-height: 150px; overflow: hidden;">
                <img src="${waffle.image}" style="width: 100%; object-fit: cover;">
            </div>
            <h4 class="wf-card-title" style="margin-top: var(--space-2);">${waffle.title}</h4>
        </div>
    `).join('');
}

function closeWaffleSelector() {
    document.getElementById('waffleSelectorModal').classList.add('wf-hidden');
}

function setMainWaffleForChat(waffleId) {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    chat.mainWaffle = waffleId;
    const waffle = waffles.find(w => w.id === waffleId);
    if (waffle) {
        chat.title = waffle.title;
    }
    
    saveData().then(() => {
        closeWaffleSelector();
        updateChatHeader();
        renderChatList();
        openChatSettings();
        showToast('Main waffle set!', 'success');
    }).catch(error => {
        console.error('Save error:', error);
        showToast('Failed to save', 'error');
    });
}

function deleteCurrentChat() {
    if (!currentChatId || !confirm('Delete this chat? This cannot be undone.')) return;
    
    chats = chats.filter(c => c.id !== currentChatId);
    currentChatId = null;
    
    saveData().then(() => {
        closeChatSettings();
        document.getElementById('noChatSelected').style.display = 'flex';
        document.getElementById('activeChatView').classList.add('wf-hidden');
        renderChatList();
        showToast('Chat deleted', 'success');
    }).catch(error => {
        console.error('Save error:', error);
        showToast('Failed to delete chat', 'error');
    });
}

function checkExpiredChats() {
    const now = Date.now();
    const originalLength = chats.length;
    
    chats = chats.filter(chat => {
        if (!chat.selfDestructAt) return true;
        return chat.selfDestructAt > now;
    });
    
    if (chats.length < originalLength) {
        saveData().then(() => {
            renderChatList();
            console.log('Expired chats removed');
        }).catch(error => {
            console.error('Failed to save after removing expired chats:', error);
        });
    }
    
    // Check again in 1 minute
    setTimeout(checkExpiredChats, 60000);
}

// ============================================================
// GLOBAL SEARCH
// ============================================================

function performGlobalSearch() {
    const query = document.getElementById('globalSearchInput').value.toLowerCase();
    const results = document.getElementById('globalSearchResults');
    
    if (!query.trim()) {
        results.innerHTML = '';
        return;
    }
    
    const matches = waffles.filter(w => 
        w.title.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query) ||
        w.tags.some(t => t.toLowerCase().includes(query))
    );
    
    results.innerHTML = `
        <h3 class="wf-h5" style="margin-bottom: var(--space-4);">Results (${matches.length})</h3>
        <div class="wf-grid-3" style="gap: var(--space-6);">
            ${matches.map(w => `
                <div class="wf-card wf-card-hover" onclick="viewWaffle(${w.id})">
                    <div class="wf-card-media" style="max-height: 150px; overflow: hidden;">
                        <img src="${w.image}" style="width: 100%; object-fit: cover;">
                    </div>
                    <h3 class="wf-card-title" style="margin-top: var(--space-3);">${w.title}</h3>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// UTILITIES
// ============================================================

function renderMarkdown(text) {
    if (!text) return '';
    
    // Escape HTML first
    let html = escapeHtml(text);
    
    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Code `code`
    html = html.replace(/`(.+?)`/g, '<code style="background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');
    
    // Links [text](url)
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>');
    
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: var(--text-lg); font-weight: 600; margin-top: var(--space-3);">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: var(--text-xl); font-weight: 600; margin-top: var(--space-4);">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size: var(--text-2xl); font-weight: 600; margin-top: var(--space-4);">$1</h1>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li style="margin-left: var(--space-4);">$1</li>');
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractTags(text) {
    const tagRegex = /#(\w+)/g;
    const matches = text.match(tagRegex);
    if (!matches) return [];
    return [...new Set(matches.map(tag => tag.substring(1)))];
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'wf-snackbar';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '999';
    
    if (type === 'success') toast.style.borderColor = 'var(--success)';
    if (type === 'error') toast.style.borderColor = 'var(--error)';
    if (type === 'warning') toast.style.borderColor = 'var(--warning)';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
