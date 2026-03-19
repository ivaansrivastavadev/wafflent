// Wafflent Terminal Processor
// Handles command execution and file system operations

class WafflentProcessor {
    constructor() {
        this.fileSystem = new Map();
        this.currentDir = '/home/user';
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
        this.createDirectory('/home/user');
        this.createDirectory('/sys');
        this.createDirectory('/sys/core');
        this.createDirectory('/sys/extra');
        this.createDirectory('/bin');
        this.createDirectory('/bin/coreutils');
        this.createDirectory('/bin/tests');
        this.createDirectory('/usr');
        this.createDirectory('/home');
        this.createDirectory('/tmp');

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
            const commandFiles = ['echo.js', 'date.js', 'uname.js', 'uptime.js', 'touch.js', 'mkdir.js', 'rm.js', 'cp.js', 'mv.js', 'find.js', 'nbasic.js', 'neofetch.js', 'log.js', 'puter.js'];
            const testFiles = ['testprog.js'];
            
            let loaded = 0;
            let updated = 0;
            const updates = [];
            
            // Load coreutils commands
            for (const filename of commandFiles) {
                const result = await this.loadFileWithUpdate(`../bin/coreutils/${filename}`, `/bin/coreutils/${filename}`);
                if (result.loaded) loaded++;
                if (result.updated) {
                    updated++;
                    updates.push(`/bin/coreutils/${filename}`);
                }
            }
            
            // Load test commands  
            for (const filename of testFiles) {
                const result = await this.loadFileWithUpdate(`../bin/tests/${filename}`, `/bin/tests/${filename}`);
                if (result.loaded) loaded++;
                if (result.updated) {
                    updated++;
                    updates.push(`/bin/tests/${filename}`);
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
        
        // Add built-in commands
        commands.push({ name: 'help', description: 'Show available commands', icon: 'fas fa-question-circle' });
        commands.push({ name: 'cd', description: 'Change directory', icon: 'fas fa-folder-open' });
        commands.push({ name: 'pwd', description: 'Show current directory', icon: 'fas fa-folder' });
        commands.push({ name: 'whoami', description: 'Show current user', icon: 'fas fa-user' });
        commands.push({ name: 'clear', description: 'Clear terminal screen', icon: 'fas fa-broom' });
        commands.push({ name: 'ls', description: 'List files and directories', icon: 'fas fa-list' });
        commands.push({ name: 'cat', description: 'Display file content', icon: 'fas fa-file-alt' });
        commands.push({ name: 'tail', description: 'Display last lines of file', icon: 'fas fa-file-import' });
        commands.push({ name: 'head', description: 'Display first lines of file', icon: 'fas fa-file-export' });
        commands.push({ name: 'journal', description: 'View system journal', icon: 'fas fa-book' });
        commands.push({ name: 'su', description: 'Switch to root user', icon: 'fas fa-key' });
        commands.push({ name: 'exit', description: 'Exit terminal session', icon: 'fas fa-sign-out-alt' });
        
        // Scan /prog directory for external commands
        for (const [path, entry] of this.fileSystem.entries()) {
            if ((path.startsWith('/bin/coreutils/') || path.startsWith('/tests/')) && path.endsWith('.js') && entry.type === 'file') {
                let commandName, directory;
                
                if (path.startsWith('/bin/coreutils/')) {
                    commandName = path.substring('/bin/coreutils/'.length, path.length - 3);
                    directory = 'coreutils';
                } else if (path.startsWith('/tests/')) {
                    commandName = path.substring('/tests/'.length, path.length - 3);
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
            // Built-in commands
            switch (command) {
                case 'help':
                    this.handleHelp();
                    break;
                    
                case 'pwd':
                    this.stdout(this.currentDir);
                    break;
                    
                case 'whoami':
                    this.stdout(this.currentUser);
                    break;
                    
                case 'clear':
                    document.getElementById('terminal-output').innerHTML = '';
                    break;
                    
                case 'cd':
                    this.handleCd(args);
                    break;
                    
                case 'ls':
                    this.handleLs(args);
                    break;
                    
                case 'cat':
                    this.handleCat(args);
                    break;
                    
                case 'head':
                    this.handleHead(args);
                    break;
                    
                case 'tail':
                    this.handleTail(args);
                    break;
                    
                case 'journal':
                    this.handleJournal(args);
                    break;
                    
                case 'exit':
                    this.handleExit(args);
                    break;
                    
                default:
                    // Try to execute external command
                    await this.executeExternalCommand(command, args);
                    break;
            }
        } catch (error) {
            this.stdout(`Error: ${error.message}`, 'error');
        }
    }

    handleHelp() {
        this.stdout('Available commands:', 'info');
        this.stdout('');
        
        const commands = this.getAvailableCommands();
        for (const cmd of commands) {
            this.stdout(`  ${cmd.name.padEnd(12)} - ${cmd.description}`);
        }
        
        this.stdout('');
        this.stdout('Use [command] -h or --help for command-specific help', 'info');
    }

    handleCd(args) {
        if (args.length === 0) {
            this.currentDir = '/home/user';
            return;
        }

        const target = args[0];
        const newPath = this.resolvePath(target);
        
        if (this.fileSystem.has(newPath) && this.fileSystem.get(newPath).type === 'directory') {
            this.currentDir = newPath;
        } else {
            this.stdout(`cd: ${target}: No such file or directory`, 'error');
        }
    }

    handleLs(args) {
        const showAll = args.includes('-a');
        const longFormat = args.includes('-l');
        
        const files = [];
        for (const [path, entry] of this.fileSystem.entries()) {
            if (path.startsWith(this.currentDir + '/') && !path.substring(this.currentDir.length + 1).includes('/')) {
                const name = path.substring(this.currentDir.length + 1);
                if (showAll || !name.startsWith('.')) {
                    files.push({ name, entry });
                }
            }
        }
        
        files.sort((a, b) => a.name.localeCompare(b.name));
        
        if (longFormat) {
            for (const { name, entry } of files) {
                const type = entry.type === 'directory' ? 'd' : '-';
                const perms = entry.permissions || '644';
                const size = entry.size || 0;
                const date = entry.modified.toLocaleDateString();
                this.stdout(`${type}${perms} ${entry.owner} ${size} ${date} ${name}`);
            }
        } else {
            const names = files.map(f => f.name);
            this.stdout(names.join('  '));
        }
    }

    handleCat(args) {
        if (args.length === 0) {
            this.stdout('cat: missing file operand', 'error');
            return;
        }

        for (const filename of args) {
            const filepath = this.resolvePath(filename);
            const entry = this.fileSystem.get(filepath);
            
            if (!entry) {
                this.stdout(`cat: ${filename}: No such file or directory`, 'error');
                continue;
            }
            
            if (entry.type !== 'file') {
                this.stdout(`cat: ${filename}: Is a directory`, 'error');
                continue;
            }
            
            this.stdout(entry.content);
        }
    }

    handleHead(args) {
        const lines = 10; // default to 10 lines
        let numLines = lines;
        let files = args.slice();
        
        // Check for -n flag
        const nIndex = args.findIndex(arg => arg === '-n');
        if (nIndex !== -1 && nIndex + 1 < args.length) {
            numLines = parseInt(args[nIndex + 1]);
            files = args.filter((arg, index) => index !== nIndex && index !== nIndex + 1);
        }
        
        // Check for -h/--help
        if (args.includes('-h') || args.includes('--help')) {
            this.stdout('Usage: head [OPTION]... [FILE]...');
            this.stdout('Print the first 10 lines of each FILE to standard output.');
            this.stdout('');
            this.stdout('  -n NUM        print the first NUM lines instead of the first 10');
            this.stdout('  -h, --help    display this help and exit');
            return;
        }

        if (files.length === 0) {
            this.stdout('head: missing file operand', 'error');
            return;
        }

        for (const filename of files) {
            const filepath = this.resolvePath(filename);
            const entry = this.fileSystem.get(filepath);
            
            if (!entry) {
                this.stdout(`head: ${filename}: No such file or directory`, 'error');
                continue;
            }
            
            if (entry.type !== 'file') {
                this.stdout(`head: ${filename}: Is a directory`, 'error');
                continue;
            }
            
            const contentLines = entry.content.split('\n');
            const outputLines = contentLines.slice(0, numLines);
            
            if (files.length > 1) {
                this.stdout(`==> ${filename} <==`);
            }
            
            outputLines.forEach(line => this.stdout(line));
            
            if (files.length > 1) {
                this.stdout('');
            }
        }
    }

    handleTail(args) {
        const lines = 10; // default to 10 lines
        let numLines = lines;
        let files = args.slice();
        
        // Check for -n flag
        const nIndex = args.findIndex(arg => arg === '-n');
        if (nIndex !== -1 && nIndex + 1 < args.length) {
            numLines = parseInt(args[nIndex + 1]);
            files = args.filter((arg, index) => index !== nIndex && index !== nIndex + 1);
        }
        
        // Check for -h/--help
        if (args.includes('-h') || args.includes('--help')) {
            this.stdout('Usage: tail [OPTION]... [FILE]...');
            this.stdout('Print the last 10 lines of each FILE to standard output.');
            this.stdout('');
            this.stdout('  -n NUM        print the last NUM lines instead of the last 10');
            this.stdout('  -h, --help    display this help and exit');
            return;
        }

        if (files.length === 0) {
            this.stdout('tail: missing file operand', 'error');
            return;
        }

        for (const filename of files) {
            const filepath = this.resolvePath(filename);
            const entry = this.fileSystem.get(filepath);
            
            if (!entry) {
                this.stdout(`tail: ${filename}: No such file or directory`, 'error');
                continue;
            }
            
            if (entry.type !== 'file') {
                this.stdout(`tail: ${filename}: Is a directory`, 'error');
                continue;
            }
            
            const contentLines = entry.content.split('\n');
            const outputLines = contentLines.slice(-numLines);
            
            if (files.length > 1) {
                this.stdout(`==> ${filename} <==`);
            }
            
            outputLines.forEach(line => this.stdout(line));
            
            if (files.length > 1) {
                this.stdout('');
            }
        }
    }

    handleJournal(args) {
        // Help option
        if (args.includes('-h') || args.includes('--help')) {
            this.stdout('Usage: journal [OPTION]...');
            this.stdout('View system journal entries (similar to journalctl).');
            this.stdout('');
            this.stdout('  -n, --lines=NUM       show NUM most recent entries (default: 20)');
            this.stdout('  -f, --follow          follow journal entries (not implemented in web version)');
            this.stdout('  -u, --unit=UNIT       show entries for specific unit');
            this.stdout('      --since=TIME      show entries since specified time');
            this.stdout('  -p, --priority=LEVEL  show entries with priority LEVEL and above');
            this.stdout('  -x, --explanations    add explanation texts to entries');
            this.stdout('  -h, --help            display this help and exit');
            return;
        }

        // Parse arguments
        let numLines = 20;
        let unit = null;
        let priority = null;
        let since = null;
        let explanations = false;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n' && i + 1 < args.length) {
                numLines = parseInt(args[++i]) || 20;
            } else if (args[i].startsWith('--lines=')) {
                numLines = parseInt(args[i].split('=')[1]) || 20;
            } else if (args[i] === '-u' && i + 1 < args.length) {
                unit = args[++i];
            } else if (args[i].startsWith('--unit=')) {
                unit = args[i].split('=')[1];
            } else if (args[i] === '-p' && i + 1 < args.length) {
                priority = args[++i];
            } else if (args[i].startsWith('--priority=')) {
                priority = args[i].split('=')[1];
            } else if (args[i].startsWith('--since=')) {
                since = args[i].split('=')[1];
            } else if (args[i] === '-x' || args[i] === '--explanations') {
                explanations = true;
            }
        }

        // Get or create journal entries
        let journalEntries = this.getJournalEntries();

        // Filter by unit if specified
        if (unit) {
            journalEntries = journalEntries.filter(entry => entry.unit === unit);
        }

        // Filter by priority if specified
        if (priority) {
            const priorityLevels = { 'emerg': 0, 'alert': 1, 'crit': 2, 'err': 3, 'warning': 4, 'notice': 5, 'info': 6, 'debug': 7 };
            const targetLevel = priorityLevels[priority.toLowerCase()] || 6;
            journalEntries = journalEntries.filter(entry => entry.priority <= targetLevel);
        }

        // Filter by since time if specified
        if (since) {
            const sinceTime = new Date(since);
            if (!isNaN(sinceTime)) {
                journalEntries = journalEntries.filter(entry => new Date(entry.timestamp) >= sinceTime);
            }
        }

        // Get the most recent entries
        const recentEntries = journalEntries.slice(-numLines);

        if (recentEntries.length === 0) {
            this.stdout('-- No journal entries found --', 'info');
            return;
        }

        // Display entries
        recentEntries.forEach(entry => {
            const timestamp = new Date(entry.timestamp).toISOString().replace('T', ' ').substring(0, 19);
            const priority = entry.priorityName || 'info';
            const unit = entry.unit || 'system';
            const message = entry.message || '';

            this.stdout(`${timestamp} ${unit}[${entry.pid}]: ${message}`, 
                       entry.priority <= 3 ? 'error' : entry.priority <= 4 ? 'warning' : 'normal');

            if (explanations && entry.explanation) {
                this.stdout(`-- ${entry.explanation}`, 'info');
            }
        });

        if (recentEntries.length === numLines) {
            this.stdout('', '');
            this.stdout(`-- Showing ${numLines} most recent entries. Use -n to show more --`, 'info');
        }
    }

    handleExit(args) {
        if (args.includes('-h') || args.includes('--help')) {
            this.stdout('Usage: exit [n]');
            this.stdout('Exit the shell.');
            this.stdout('');
            this.stdout('  n             exit with status n (default: 0)');
            return;
        }

        this.stdout('Goodbye!', 'info');
        
        // Add journal entry for logout
        this.addJournalEntry('login', 'User session ended', 6, 'info', 'User logged out from terminal session');
        
        // In a web browser, we can't actually exit the application,
        // but we can simulate it by clearing the terminal and showing a goodbye message
        setTimeout(() => {
            document.getElementById('terminal-output').innerHTML = '';
            this.stdout('Terminal session ended. Refresh the page to restart.', 'warning');
        }, 1000);
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
        let commandPath = `/bin/coreutils/${command}.js`;
        let entry = this.fileSystem.get(commandPath);
        
        if (!entry || entry.type !== 'file') {
            // Try tests directory
            commandPath = `/tests/${command}.js`;
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
                // Create a new function that wraps the command code and returns the command function
                const wrappedCode = `
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
                if (!path.startsWith('/sys/') && !path.startsWith('/prog/') && !path.startsWith('/tests/') && !path.startsWith('/bin/')) {
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
                    if (!path.startsWith('/sys/') && !path.startsWith('/prog/') && !path.startsWith('/tests/') && !path.startsWith('/bin/')) {
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
                if (!path.startsWith('/sys/') && !path.startsWith('/prog/') && !path.startsWith('/tests/') && !path.startsWith('/bin/')) {
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
                if (!path.startsWith('/sys/') && !path.startsWith('/prog/') && !path.startsWith('/tests/') && !path.startsWith('/bin/')) {
                    userFiles[path] = entry;
                }
            }
            localStorage.setItem('wafflent_filesystem', JSON.stringify(userFiles));
        } catch (error) {
            console.warn('Failed to save filesystem to storage:', error);
        }
    }
}