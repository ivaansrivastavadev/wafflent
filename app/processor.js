/**
 * Wafflent Terminal Processor
 * Handles command execution and file system operations
 */
class WafflentProcessor {
    /**
     * Initialize the processor with default settings
     */
    constructor() {
        this.fileSystem = new Map();
        this.currentDir = '/usr';
        this.currentUser = 'user';
        this.isRoot = false;
        this.initialized = false;
        
        // Initialize storage service
        this.storage = new WafflentStorage();
        
        // Initialize everything asynchronously
        this.initializeAsync();
    }

    /**
     * Initialize all system components asynchronously
     * Sets up storage, file system, and external commands
     */
    async initializeAsync() {
        try {
            // Initialize storage system first
            await this.storage.init();
            
            // Create basic file system
            this.createBasicFileSystem();
            
            // Load existing files from storage
            await this.loadFileSystemFromStorage();
            
            // Load external commands
            await this.loadExternalCommands();
            
            this.initialized = true;
        } catch (error) {
            console.warn('Failed to initialize system:', error);
            // Create basic file system even if storage fails
            this.createBasicFileSystem();
            this.initialized = true;
        }
    }

    /**
     * Initialize file system with basic structure and load from storage
     */
    async initializeFileSystemAsync() {
        // Create basic file system and load from storage
        this.createBasicFileSystem();
        await this.loadFileSystemFromStorage();
    }

    /**
     * Create the basic file system structure and default files
     */
    createBasicFileSystem() {
        // Create base directories
        this.createDirectory('/');
        this.createDirectory('/home');
        this.createDirectory('/sys');
        this.createDirectory('/sys/core');
        this.createDirectory('/sys/extra');
        this.createDirectory('/pkgs');
        this.createDirectory('/pkgs/coreutils');
        this.createDirectory('/pkgs/tests');
        this.createDirectory('/usr');
        this.createDirectory('/tmp');
        this.createDirectory('/lib');

        // Create system files
        this.createFile('/sys/core/init.js', `// Wafflent System Init (PID 1)
// fas fa-play-circle

console.log('Wafflent OS v1.0 - System initializing...');
console.log('Starting system services...');
console.log('System ready.');`);

        this.createFile('/sys/extra/ascii.txt', `
    ░██╗░░░░░░░██╗░█████╗░███████╗███████╗██╗░░░░░███████╗███╗░░██╗████████╗
    ░██║░░██╗░░██║██╔══██╗██╔════╝██╔════╝██║░░░░░██╔════╝████╗░██║╚══██╔══╝
    ░╚██╗████╗██╔╝███████║█████╗░░█████╗░░██║░░░░░█████╗░░██╔██╗██║░░░██║░░░
    ░░████╔═████║░██╔══██║██╔══╝░░██╔══╝░░██║░░░░░██╔══╝░░██║╚████║░░░██║░░░
    ░░╚██╔╝░╚██╔╝░██║░░██║██║░░░░░██║░░░░░███████╗███████╗██║░╚███║░░░██║░░░
    ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░░░░╚═╝░░░░░╚══════╝╚══════╝╚═╝░░╚══╝░░░╚═╝░░░
    
                             Unix-like Terminal System`);
    }

    /**
     * Load external command files from the packages directory
     * Handles caching and update detection
     */
    async loadExternalCommands() {
        // Load external commands from actual files with storage persistence and update detection
        try {
            const commandFiles = ['echo.js', 'date.js', 'uname.js', 'uptime.js', 'touch.js', 'mkdir.js', 'rm.js', 'cp.js', 'mv.js', 'find.js', 'nbasic.js', 'neofetch.js', 'log.js', 'puter.js', 'help.js', 'pwd.js', 'whoami.js', 'clear.js', 'cd.js', 'ls.js', 'cat.js', 'head.js', 'tail.js', 'journal.js', 'exit.js', 'su.js'];
            
            let loaded = 0;
            let fromCache = 0;
            let updated = 0;
            const updates = [];
            
            // Load coreutils commands
            for (const filename of commandFiles) {
                const result = await this.loadFileWithUpdate(`../pkgs/coreutils/${filename}`, `/pkgs/coreutils/${filename}`);
                if (result.loaded) {
                    loaded++;
                    if (result.fromCache) fromCache++;
                    if (result.updated) {
                        updated++;
                        updates.push(`/pkgs/coreutils/${filename}`);
                    }
                }
            }
            
            // Show update prompt if there were updates
            if (updated > 0) {
                this.showUpdatePrompt(updates);
            }
            
            console.log(`Loaded ${loaded} external commands (${fromCache} from cache, ${updated} updates available)`);
        } catch (error) {
            console.warn('Could not load external commands:', error);
        }
    }
    
    /**
     * Load a file with update detection and caching
     * @param {string} fetchPath - Path to fetch the file from
     * @param {string} storagePath - Storage path for caching
     * @returns {Promise<Object>} Object with load status, cache info, and update status
     */
    async loadFileWithUpdate(fetchPath, storagePath) {
        try {
            // Ensure storage is initialized
            if (!this.storage.isReady) {
                await this.storage.init();
            }
            
            // First check if we have a cached version
            const storedContent = await this.storage.loadFile(storagePath);
            
            // If we have stored content, try to fetch for updates but don't fail if it doesn't work
            if (storedContent) {
                try {
                    const response = await fetch(fetchPath);
                    if (response.ok) {
                        const content = await response.text();
                        
                        // Check if content has changed
                        const hasUpdate = storedContent !== content;
                        
                        if (hasUpdate) {
                            // Update with new content
                            this.createFile(storagePath, content);
                            await this.storage.saveFile(storagePath, content);
                            return { 
                                loaded: true, 
                                updated: true,
                                fromCache: false
                            };
                        } else {
                            // Use cached content, no update needed
                            this.createFile(storagePath, storedContent);
                            return { 
                                loaded: true, 
                                updated: false,
                                fromCache: true
                            };
                        }
                    } else {
                        // Fetch failed, use cached content
                        this.createFile(storagePath, storedContent);
                        return { loaded: true, updated: false, fromCache: true };
                    }
                } catch (fetchError) {
                    // Network error, use cached content
                    this.createFile(storagePath, storedContent);
                    return { loaded: true, updated: false, fromCache: true };
                }
            } else {
                // No cached version, try to fetch
                const response = await fetch(fetchPath);
                if (!response.ok) {
                    return { loaded: false, updated: false };
                }
                
                const content = await response.text();
                
                // Save to filesystem and storage
                this.createFile(storagePath, content);
                await this.storage.saveFile(storagePath, content);
                
                return { 
                    loaded: true, 
                    updated: false, // It's new, not an update
                    fromCache: false
                };
            }
            
        } catch (error) {
            console.warn(`Failed to load ${fetchPath}:`, error);
            return { loaded: false, updated: false };
        }
    }
    
    /**
     * Load the file system from IndexedDB storage
     * Only loads user files, preserving system files
     */
    async loadFileSystemFromStorage() {
        try {
            // Ensure storage is ready
            if (!this.storage.isReady) {
                await this.storage.init();
            }
            
            // Load files from storage
            const fileMap = await this.storage.loadAllFiles();
            
            // Apply user files to the filesystem (skip system files)
            for (const [path, entry] of fileMap.entries()) {
                if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
                    this.fileSystem.set(path, entry);
                }
            }
            
            if (fileMap.size > 0) {
                console.log(`Restored ${fileMap.size} filesystem entries from storage`);
            }
        } catch (error) {
            console.warn('Failed to load filesystem from storage:', error);
        }
    }
    
    async saveFileSystemToStorage() {
        try {
            // Ensure storage is ready
            if (!this.storage.isReady) {
                await this.storage.init();
            }
            
            // Save only user files (not system files)
            const promises = [];
            for (const [path, entry] of this.fileSystem.entries()) {
                if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
                    if (entry.type === 'file') {
                        promises.push(this.storage.saveFile(path, entry.content || '', entry.type));
                    }
                }
            }
            
            // Save all files concurrently
            await Promise.all(promises);
        } catch (error) {
            console.warn('Failed to save filesystem to storage:', error);
        }
    }
    
    showUpdatePrompt(updatedFiles) {
        // Show update notification in terminal
        this.stdout('', 'info'); // Empty line
        this.stdout('📦 Update Available!', 'warning');
        this.stdout(`${updatedFiles.length} file(s) have been updated on the server:`, 'info');
        updatedFiles.forEach(file => {
            this.stdout(`  - ${file}`, 'info');
        });
        this.stdout('', 'info'); // Empty line
        this.stdout('Updates have been automatically applied.', 'success');
        this.stdout('Use "log --storage" to see cached versions.', 'info');
        
        // Apply updates immediately without user interaction
        this.stdout('🔄 Updates applied successfully!', 'success');
        this.stdout(`Updated files: ${updatedFiles.join(', ')}`, 'info');
        this.stdout('Commands reloaded with latest versions.', 'info');
    }

    // Get available commands by scanning /prog directory
    getAvailableCommands() {
        const commands = [];
        
        // Scan filesystem for all command files (now all commands are external)
        for (const [path, entry] of this.fileSystem.entries()) {
            if ((path.startsWith('/pkgs/coreutils/') || path.startsWith('/pkgs/tests/')) && path.endsWith('.js') && entry.type === 'file') {
                let commandName, directory;
                
                if (path.startsWith('/pkgs/coreutils/')) {
                    commandName = path.substring('/pkgs/coreutils/'.length, path.length - 3);
                    directory = 'coreutils';
                } else if (path.startsWith('/pkgs/tests/')) {
                    commandName = path.substring('/pkgs/tests/'.length, path.length - 3);
                    directory = 'tests';
                }
                
                const content = entry.content;
                
                if (content) {
                    const lines = content.split('\n');
                    let description = 'External command';
                    let icon = 'fas fa-terminal';
                    
                    // Parse first line for description
                    if (lines[0] && lines[0].startsWith('//')) {
                        description = lines[0].substring(2).trim();
                    }
                    
                    // Parse second line for icon
                    if (lines[1] && lines[1].startsWith('//')) {
                        const iconLine = lines[1].substring(2).trim();
                        if (iconLine.startsWith('fas ') || iconLine.startsWith('far ') || iconLine.startsWith('fab ')) {
                            icon = iconLine;
                        }
                    }
                    
                    commands.push({ name: commandName, description, icon, directory });
                }
            }
        }
        
        return commands;
    }

    createDirectory(path) {
        this.fileSystem.set(path, {
            type: 'directory',
            created: new Date(),
            modified: new Date(),
            permissions: '755',
            owner: this.currentUser
        });
    }

    createFile(path, content = '') {
        this.fileSystem.set(path, {
            type: 'file',
            content: content,
            created: new Date(),
            modified: new Date(),
            permissions: '644',
            owner: this.currentUser,
            size: content.length
        });
    }

    async createUserFile(path, content = '') {
        this.fileSystem.set(path, {
            type: 'file',
            content: content,
            created: new Date(),
            modified: new Date(),
            permissions: '644',
            owner: this.currentUser,
            size: content.length
        });
        
        // Save to storage if it's a user file (not system file)
        if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
            try {
                await this.storage.saveFile(path, content, 'file');
            } catch (error) {
                console.warn('Failed to persist file to storage:', error);
            }
        }
    }

    // Output function for commands to use
    stdout(text, type = 'normal') {
        const outputElement = document.getElementById('terminal-output');
        const line = document.createElement('div');
        
        switch (type) {
            case 'error':
                line.className = 'error';
                break;
            case 'success':
                line.className = 'success';
                break;
            case 'warning':
                line.className = 'warning';
                break;
            case 'info':
                line.className = 'info';
                break;
            default:
                break;
        }
        
        line.textContent = text;
        outputElement.appendChild(line);
        outputElement.scrollTop = outputElement.scrollHeight;
    }

    /**
     * Main command execution method
     * @param {string} commandLine - Complete command line input
     */
    async executeCommand(commandLine) {
        const [command, ...args] = commandLine.trim().split(/\s+/);
        
        try {
            // All commands are now external - execute from files
            await this.executeExternalCommand(command, args);
        } catch (error) {
            this.stdout(`Error: ${error.message}`, 'error');
        }
    }

    async getJournalEntries() {
        try {
            // Get entries from storage
            const entries = await this.storage.loadJournalEntries(1000);
            
            if (entries && entries.length > 0) {
                return entries;
            }

            // Create default journal entries for system initialization
            const installTime = await this.storage.loadSystemData('install_time') || Date.now();
            const currentTime = Date.now();

            const defaultEntries = await this.createDefaultJournalEntries(installTime, currentTime);
            
            // Save default entries to storage
            for (const entry of defaultEntries) {
                await this.storage.addJournalEntry(entry);
            }
            
            return defaultEntries;
        } catch (error) {
            console.warn('Failed to load journal entries:', error);
            return [];
        }
    }

    async createDefaultJournalEntries(installTime, currentTime) {
        const defaultEntries = [
            {
                timestamp: new Date(parseInt(installTime)).toISOString(),
                unit: 'systemd',
                pid: 1,
                priority: 6,
                priorityName: 'info',
                message: 'Starting Wafflent OS v1.0...',
                explanation: 'System initialization started'
            },
            {
                timestamp: new Date(parseInt(installTime) + 1000).toISOString(),
                unit: 'kernel',
                pid: 1,
                priority: 6,
                priorityName: 'info',
                message: 'Wafflent kernel 1.0.0 started on x86_64',
                explanation: 'JavaScript-based kernel initialization'
            },
            {
                timestamp: new Date(parseInt(installTime) + 2000).toISOString(),
                unit: 'systemd',
                pid: 1,
                priority: 6,
                priorityName: 'info',
                message: 'Reached target Basic System',
                explanation: 'Basic system services are ready'
            },
            {
                timestamp: new Date(parseInt(installTime) + 3000).toISOString(),
                unit: 'filesystem',
                pid: 143,
                priority: 6,
                priorityName: 'info',
                message: 'Virtual filesystem mounted successfully',
                explanation: 'Browser IndexedDB-based filesystem initialized'
            },
            {
                timestamp: new Date(parseInt(installTime) + 4000).toISOString(),
                unit: 'terminal',
                pid: 256,
                priority: 6,
                priorityName: 'info',
                message: 'Wafflent terminal service started',
                explanation: 'Terminal interface ready for user interaction'
            },
            {
                timestamp: new Date(parseInt(installTime) + 5000).toISOString(),
                unit: 'systemd',
                pid: 1,
                priority: 6,
                priorityName: 'info',
                message: 'Startup finished in 5.000s (kernel) + 1.000s (userspace) = 6.000s',
                explanation: 'System is fully operational'
            }
        ];

        // Add login entry if user has used the terminal
        if (currentTime - parseInt(installTime) > 10000) {
            defaultEntries.push({
                timestamp: new Date(parseInt(installTime) + 10000).toISOString(),
                unit: 'login',
                pid: 512,
                priority: 6,
                priorityName: 'info',
                message: 'User session started for user',
                explanation: 'User logged into terminal session'
            });
        }

        return defaultEntries;
    }

    async addJournalEntry(unit, message, priority = 6, priorityName = 'info', explanation = null) {
        const newEntry = {
            timestamp: new Date().toISOString(),
            unit: unit,
            pid: Math.floor(Math.random() * 1000) + 100,
            priority: priority,
            priorityName: priorityName,
            message: message,
            explanation: explanation
        };
        
        try {
            await this.storage.addJournalEntry(newEntry);
        } catch (error) {
            console.warn('Failed to add journal entry to storage:', error);
        }
    }

    // Helper methods for external commands
    pathExists(path) {
        return this.fileSystem.has(path);
    }

    async saveFileSystem() {
        // Save user files to storage for persistence
        await this.saveFileSystemToStorage();
        return true;
    }

    // Async file operations for commands
    async deleteFile(path) {
        const resolved = this.resolvePath(path);
        this.fileSystem.delete(resolved);
        
        // Remove from storage if it's a user file
        if (!resolved.startsWith('/sys/') && !resolved.startsWith('/pkgs/') && !resolved.startsWith('/lib/')) {
            try {
                await this.storage.deleteFile(resolved);
            } catch (error) {
                console.warn('Failed to delete file from storage:', error);
            }
        }
        
        await this.saveFileSystem();
    }

    async updateFile(path, content) {
        const resolved = this.resolvePath(path);
        const existing = this.fileSystem.get(resolved);
        if (existing) {
            existing.content = content;
            existing.modified = new Date();
            existing.size = content.length;
            
            // Save to storage if it's a user file
            if (!resolved.startsWith('/sys/') && !resolved.startsWith('/pkgs/') && !resolved.startsWith('/lib/')) {
                try {
                    await this.storage.saveFile(resolved, content, existing.type);
                } catch (error) {
                    console.warn('Failed to update file in storage:', error);
                }
            }
        }
    }

    getFileContent(path) {
        const entry = this.fileSystem.get(path);
        return entry && entry.type === 'file' ? entry.content : null;
    }

    async executeExternalCommand(command, args) {
        // Try coreutils first, then tests
        let commandPath = `/pkgs/coreutils/${command}.js`;
        let entry = this.fileSystem.get(commandPath);
        
        if (!entry || entry.type !== 'file') {
            // Try tests directory
            commandPath = `/pkgs/tests/${command}.js`;
            entry = this.fileSystem.get(commandPath);
        }
        
        if (!entry || entry.type !== 'file') {
            this.stdout(`${command}: command not found`, 'error');
            return;
        }
        
        try {
            // Create context for the command
            const context = {
                args: args || [], // Ensure args is always an array
                stdout: this.stdout.bind(this),
                currentDir: this.currentDir,
                fileSystem: this.fileSystem,
                resolvePath: this.resolvePath.bind(this),
                processor: this  // Add processor reference for external commands
            };
            
            // Execute the command function
            try {
                // Load command API helper classes
                const apiCode = await this.loadCommandAPI();
                
                // Create a new function that wraps the command code and returns the command function
                const wrappedCode = `
                    ${apiCode}
                    ${entry.content}
                    return ${command};
                `;
                
                // Execute the code and get the function
                const commandFunction = new Function(wrappedCode)();
                
                if (typeof commandFunction === 'function') {
                    await commandFunction(context);
                } else {
                    this.stdout(`${command}: function not found in script`, 'error');
                }
            } catch (evalError) {
                this.stdout(`${command}: ${evalError.message}`, 'error');
            }
        } catch (error) {
            this.stdout(`${command}: ${error.message}`, 'error');
        }
    }

    async loadCommandAPI() {
        // Load the command API helper from lib/command-api.js
        try {
            const apiPath = '/lib/command-api.js';
            let apiContent = this.getFileContent(apiPath);
            
            if (!apiContent) {
                // Try to load from actual file
                const response = await fetch('../lib/command-api.js');
                if (response.ok) {
                    apiContent = await response.text();
                    // Store it in the virtual filesystem for future use
                    this.createFile(apiPath, apiContent);
                } else {
                    // Return empty string if API not available
                    return '';
                }
            }
            
            return apiContent;
        } catch (error) {
            console.warn('Could not load command API:', error);
            return '';
        }
    }

    resolvePath(path) {
        if (path.startsWith('/')) {
            return path;
        }
        
        if (path === '.') {
            return this.currentDir;
        }
        
        if (path === '..') {
            const parts = this.currentDir.split('/').filter(p => p);
            parts.pop();
            return '/' + parts.join('/');
        }
        
        return this.currentDir + '/' + path;
    }
}