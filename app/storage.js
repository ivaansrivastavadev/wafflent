/**
 * Wafflent IndexedDB Storage Service
 * Pure IndexedDB implementation for persistent data storage
 * Supports filesystem, system configuration, and journal entries
 */
class WafflentStorage {
    /**
     * Initialize the storage service
     */
    constructor() {
        this.db = null;
        this.dbName = 'wafflent_db';
        this.dbVersion = 1;
        this.isReady = false;
    }

    /**
     * Initialize IndexedDB connection and create object stores
     * @returns {Promise<boolean>} True if initialization successful
     */
    async init() {
        if (this.isReady) return true;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('IndexedDB initialization failed: ' + request.error));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log('IndexedDB initialized successfully');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Filesystem object store
                if (!db.objectStoreNames.contains('filesystem')) {
                    const filesystemStore = db.createObjectStore('filesystem', { keyPath: 'path' });
                    filesystemStore.createIndex('type', 'type', { unique: false });
                    filesystemStore.createIndex('modified', 'modified', { unique: false });
                }

                // System configuration object store
                if (!db.objectStoreNames.contains('system')) {
                    const systemStore = db.createObjectStore('system', { keyPath: 'key' });
                }

                // Journal entries object store
                if (!db.objectStoreNames.contains('journal')) {
                    const journalStore = db.createObjectStore('journal', { keyPath: 'id', autoIncrement: true });
                    journalStore.createIndex('timestamp', 'timestamp', { unique: false });
                    journalStore.createIndex('priority', 'priority', { unique: false });
                }
            };
        });
    }

    /**
     * Save a file to the filesystem store
     * @param {string} path - File path
     * @param {string} content - File content
     * @param {string} type - File type ('file' or 'directory')
     * @returns {Promise<boolean>} True if save successful
     */
    async saveFile(path, content, type = 'file') {
        if (!this.isReady) throw new Error('Storage not initialized');

        const fileEntry = {
            path: path,
            type: type,
            content: content,
            created: new Date(),
            modified: new Date(),
            size: content ? content.length : 0
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['filesystem'], 'readwrite');
            const store = transaction.objectStore('filesystem');
            
            // Check if file exists to preserve creation date
            const getRequest = store.get(path);
            getRequest.onsuccess = () => {
                const existing = getRequest.result;
                if (existing) {
                    fileEntry.created = existing.created;
                }
                
                const putRequest = store.put(fileEntry);
                putRequest.onsuccess = () => resolve(true);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Load a file's content from the filesystem store
     * @param {string} path - File path
     * @returns {Promise<string|null>} File content or null if not found
     */
    async loadFile(path) {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['filesystem'], 'readonly');
            const store = transaction.objectStore('filesystem');
            const request = store.get(path);
            
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.content : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load all files from the filesystem store
     * @returns {Promise<Map>} Map of file paths to file objects
     */
    async loadAllFiles() {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['filesystem'], 'readonly');
            const store = transaction.objectStore('filesystem');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const results = request.result || [];
                const fileMap = new Map();
                
                for (const entry of results) {
                    fileMap.set(entry.path, {
                        type: entry.type,
                        content: entry.content,
                        created: entry.created,
                        modified: entry.modified,
                        size: entry.size
                    });
                }
                
                resolve(fileMap);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a file from the filesystem store
     * @param {string} path - File path
     * @returns {Promise<boolean>} True if deletion successful
     */
    async deleteFile(path) {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['filesystem'], 'readwrite');
            const store = transaction.objectStore('filesystem');
            const request = store.delete(path);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check if a file exists in the filesystem store
     * @param {string} path - File path
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(path) {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['filesystem'], 'readonly');
            const store = transaction.objectStore('filesystem');
            const request = store.get(path);
            
            request.onsuccess = () => {
                resolve(request.result !== undefined);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save system configuration data
     * @param {string} key - Configuration key
     * @param {any} value - Configuration value
     * @returns {Promise<boolean>} True if save successful
     */
    async saveSystemData(key, value) {
        if (!this.isReady) throw new Error('Storage not initialized');

        const systemEntry = {
            key: key,
            value: value,
            timestamp: new Date()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['system'], 'readwrite');
            const store = transaction.objectStore('system');
            const request = store.put(systemEntry);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load system configuration data
     * @param {string} key - Configuration key
     * @returns {Promise<any|null>} Configuration value or null if not found
     */
    async loadSystemData(key) {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['system'], 'readonly');
            const store = transaction.objectStore('system');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add an entry to the journal
     * @param {Object} entry - Journal entry object
     * @returns {Promise<boolean>} True if add successful
     */
    async addJournalEntry(entry) {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['journal'], 'readwrite');
            const store = transaction.objectStore('journal');
            const request = store.add(entry);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load journal entries from storage
     * @param {number} limit - Maximum number of entries to return
     * @returns {Promise<Array>} Array of journal entries (most recent first)
     */
    async loadJournalEntries(limit = 100) {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['journal'], 'readonly');
            const store = transaction.objectStore('journal');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev'); // Most recent first
            
            const entries = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && entries.length < limit) {
                    entries.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(entries);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data from all stores (for development/testing)
     * @returns {Promise<boolean>} True if clear successful
     */
    async clearAllData() {
        if (!this.isReady) throw new Error('Storage not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['filesystem', 'system', 'journal'], 'readwrite');
            
            const clearPromises = [
                new Promise((res, rej) => {
                    const req = transaction.objectStore('filesystem').clear();
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                }),
                new Promise((res, rej) => {
                    const req = transaction.objectStore('system').clear();
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                }),
                new Promise((res, rej) => {
                    const req = transaction.objectStore('journal').clear();
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                })
            ];

            Promise.all(clearPromises)
                .then(() => resolve(true))
                .catch(reject);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WafflentStorage;
}