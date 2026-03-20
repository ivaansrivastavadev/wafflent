// Wafflent Terminal Processor
// Handles command execution and file system operations

class WafflentProcessor {
    constructor() {
        this.fileSystem = new Map();
        this.currentDir = '/usr';
        this.currentUser = 'user';
        this.isRoot = false;
        this.initialized = false;
        
        // Initialize file system synchronously first
        this.createBasicFileSystem();
        
        // Load external commands asynchronously
        this.initializeAsync();
    }

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
        this.createDirectory('/home');
        this.createDirectory('/tmp');
        this.createDirectory('/lib');

        // Load filesystem state from localStorage if available
        this.loadFileSystemFromStorage();
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

    async initializeAsync() {
        try {
            await this.loadExternalCommands();
            this.initialized = true;
        } catch (error) {
            console.warn('Failed to initialize external commands:', error);
            this.initialized = true; // Continue anyway with just built-in commands
        }
    }

    async loadExternalCommands() {
        // Load external commands from actual files with localStorage persistence and update detection
        try {
            const commandFiles = ['echo.js', 'date.js', 'uname.js', 'uptime.js', 'touch.js', 'mkdir.js', 'rm.js', 'cp.js', 'mv.js', 'find.js', 'nbasic.js', 'neofetch.js', 'log.js', 'puter.js', 'help.js', 'pwd.js', 'whoami.js', 'clear.js', 'cd.js', 'ls.js', 'cat.js', 'head.js', 'tail.js', 'journal.js', 'exit.js', 'su.js'];
            const testFiles = ['testprog.js'];
            
            let loaded = 0;
            let updated = 0;
            const updates = [];
            
            // Load coreutils commands
            for (const filename of commandFiles) {
                const result = await this.loadFileWithUpdate(`../pkgs/coreutils/${filename}`, `/pkgs/coreutils/${filename}`);
                if (result.loaded) loaded++;
                if (result.updated) {
                    updated++;
                    updates.push(`/pkgs/coreutils/${filename}`);
                }
            }
            
            // Load test commands  
            for (const filename of testFiles) {
                const result = await this.loadFileWithUpdate(`../tests/${filename}`, `/pkgs/tests/${filename}`);
                if (result.loaded) loaded++;
                if (result.updated) {
                    updated++;
                    updates.push(`/pkgs/tests/${filename}`);
                }
            }
            
            // Show update prompt if there were updates
            if (updated > 0) {
                this.showUpdatePrompt(updates);
            }
            
            console.log(`Loaded ${loaded} external commands and tests (${updated} updates available)`);
        } catch (error) {
            console.warn('Could not load external commands:', error);
        }
    }
    
    async loadFileWithUpdate(fetchPath, storagePath) {
        try {
            const response = await fetch(fetchPath);
            if (!response.ok) {
                // Try to load from localStorage if fetch fails
                const stored = this.loadFromLocalStorage(storagePath);
                if (stored) {
                    this.createFile(storagePath, stored);
                    return { loaded: true, updated: false, fromCache: true };
                }
                return { loaded: false, updated: false };
            }
            
            const content = await response.text();
            const storedContent = this.loadFromLocalStorage(storagePath);
            
            // Check if content has changed
            const hasUpdate = storedContent && storedContent !== content;
            
            // Always create/update the file in filesystem
            this.createFile(storagePath, content);
            
            // Store in localStorage for future use
            this.saveToLocalStorage(storagePath, content);
            
            return { 
                loaded: true, 
                updated: hasUpdate,
                fromCache: false,
                hasStored: !!storedContent
            };
            
        } catch (error) {
            console.warn(`Failed to load ${fetchPath}:`, error);
            
            // Try to load from localStorage as fallback
            const stored = this.loadFromLocalStorage(storagePath);
            if (stored) {
                this.createFile(storagePath, stored);
                return { loaded: true, updated: false, fromCache: true };
            }
            
            return { loaded: false, updated: false };
        }
    }
    
    loadFromLocalStorage(path) {
        try {
            const data = JSON.parse(localStorage.getItem('wafflent_data') || '{}');
            return data[path] || null;
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return null;
        }
    }
    
    saveToLocalStorage(path, content) {
        try {
            // Load existing data
            const data = JSON.parse(localStorage.getItem('wafflent_data') || '{}');
            
            // Update the specific file
            data[path] = content;
            
            // Save back to localStorage
            localStorage.setItem('wafflent_data', JSON.stringify(data));
            
            // Also update metadata separately for compatibility
            const metaKey = `wafflent_meta_${path}`;
            localStorage.setItem(metaKey, JSON.stringify({
                lastUpdated: new Date().toISOString(),
                size: content ? content.length : 0
            }));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
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

    // Main command execution method
    async executeCommand(commandLine) {
        const [command, ...args] = commandLine.trim().split(/\s+/);
        
        try {
            // All commands are now external - execute from files
            await this.executeExternalCommand(command, args);
        } catch (error) {
            this.stdout(`Error: ${error.message}`, 'error');
        }
    }

    getJournalEntries() {
        // Get existing journal or create default entries
        const stored = localStorage.getItem('wafflent_journal');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                // If corrupted, reset
            }
        }

        // Create default journal entries for system initialization
        const installTime = localStorage.getItem('wafflent_install_time') || Date.now();
        const currentTime = Date.now();

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
                explanation: 'Browser localStorage-based filesystem initialized'
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

        // Save default entries
        localStorage.setItem('wafflent_journal', JSON.stringify(defaultEntries));
        return defaultEntries;
    }

    addJournalEntry(unit, message, priority = 6, priorityName = 'info', explanation = null) {
        const entries = this.getJournalEntries();
        const newEntry = {
            timestamp: new Date().toISOString(),
            unit: unit,
            pid: Math.floor(Math.random() * 1000) + 100,
            priority: priority,
            priorityName: priorityName,
            message: message,
            explanation: explanation
        };
        
        entries.push(newEntry);
        
        // Keep only last 1000 entries to avoid storage bloat
        if (entries.length > 1000) {
            entries.splice(0, entries.length - 1000);
        }
        
        localStorage.setItem('wafflent_journal', JSON.stringify(entries));
    }

    // Helper methods for external commands
    pathExists(path) {
        return this.fileSystem.has(path);
    }

    saveFileSystem() {
        // Save user files to localStorage for persistence
        this.saveFileSystemToStorage();
        return true;
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
    
    loadFileSystemFromStorage() {
        try {
            // Try to load from new wafflent_data structure first
            const wafflentData = JSON.parse(localStorage.getItem('wafflent_data') || '{}');
            
            // Load user files from the new structure
            for (const [path, content] of Object.entries(wafflentData)) {
                if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
                    // Only user files (not system files)
                    if (content === null) {
                        // This is a .folderkeeper entry for empty directories
                        this.fileSystem.set(path, { type: 'file', content: '' });
                    } else if (typeof content === 'string') {
                        this.fileSystem.set(path, { type: 'file', content });
                    }
                }
            }
            
            // Fallback: also try to load from legacy wafflent_filesystem 
            const fsData = localStorage.getItem('wafflent_filesystem');
            if (fsData) {
                const parsed = JSON.parse(fsData);
                // Only load user files, not system files - those should be loaded fresh
                for (const [path, entry] of Object.entries(parsed)) {
                    if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
                        if (!this.fileSystem.has(path)) { // Don't overwrite data from new structure
                            this.fileSystem.set(path, entry);
                        }
                    }
                }
            }
            
            const totalEntries = Object.keys(wafflentData).length + (fsData ? Object.keys(JSON.parse(fsData)).length : 0);
            if (totalEntries > 0) {
                console.log(`Restored ${this.fileSystem.size} filesystem entries from localStorage`);
            }
        } catch (error) {
            console.warn('Failed to load filesystem from storage:', error);
        }
    }
    
    saveFileSystemToStorage() {
        try {
            // Load existing wafflent_data
            const wafflentData = JSON.parse(localStorage.getItem('wafflent_data') || '{}');
            
            // Add user files to wafflent_data (preserve existing system files)
            for (const [path, entry] of this.fileSystem.entries()) {
                if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
                    if (entry.type === 'file') {
                        wafflentData[path] = entry.content || '';
                    }
                }
            }
            
            // Save the updated wafflent_data
            localStorage.setItem('wafflent_data', JSON.stringify(wafflentData));
            
            // Keep legacy wafflent_filesystem for backward compatibility
            const userFiles = {};
            for (const [path, entry] of this.fileSystem.entries()) {
                if (!path.startsWith('/sys/') && !path.startsWith('/pkgs/') && !path.startsWith('/lib/')) {
                    userFiles[path] = entry;
                }
            }
            localStorage.setItem('wafflent_filesystem', JSON.stringify(userFiles));
        } catch (error) {
            console.warn('Failed to save filesystem to storage:', error);
        }
    }
}