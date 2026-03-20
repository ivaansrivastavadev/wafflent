// Wafflent Command API Helper
// Simplified API for creating commands with enhanced functionality

/**
 * Enhanced Command Context API
 * Provides a cleaner, more intuitive interface for command development
 */
class CommandContext {
    constructor(rawContext) {
        this.raw = rawContext;
        this.args = rawContext.args || [];
        this._stdout = rawContext.stdout;
        this.processor = rawContext.processor;
        
        // Enhanced filesystem operations
        this.fs = new FileSystemAPI(rawContext.processor);
        
        // Enhanced output methods
        this.output = new OutputAPI(rawContext.stdout);
        
        // Current directory helpers
        this.cwd = rawContext.currentDir;
    }
    
    /**
     * Get command line flags (arguments starting with -)
     */
    get flags() {
        return this.args.filter(arg => arg.startsWith('-'));
    }
    
    /**
     * Get non-flag arguments
     */
    get parameters() {
        return this.args.filter(arg => !arg.startsWith('-'));
    }
    
    /**
     * Check if a flag is present
     */
    hasFlag(...flags) {
        return flags.some(flag => this.flags.includes(flag));
    }
    
    /**
     * Show help if --help or -h flag is present
     */
    showHelpIf(helpText) {
        if (this.hasFlag('-h', '--help')) {
            if (Array.isArray(helpText)) {
                helpText.forEach(line => this.output.info(line));
            } else {
                this.output.info(helpText);
            }
            return true;
        }
        return false;
    }
    
    /**
     * Require parameters with automatic error handling
     */
    requireParams(minCount = 1, errorMessage = null) {
        if (this.parameters.length < minCount) {
            const msg = errorMessage || `Error: This command requires at least ${minCount} parameter(s)`;
            this.output.error(msg);
            return false;
        }
        return true;
    }
    
    /**
     * Resolve path relative to current directory
     */
    resolvePath(path) {
        return this.processor.resolvePath(path);
    }
}

/**
 * Enhanced File System API
 */
class FileSystemAPI {
    constructor(processor) {
        this.processor = processor;
    }
    
    /**
     * Check if path exists
     */
    exists(path) {
        const resolved = this.processor.resolvePath(path);
        return this.processor.pathExists(resolved);
    }
    
    /**
     * Read file content
     */
    readFile(path) {
        const resolved = this.processor.resolvePath(path);
        const content = this.processor.getFileContent(resolved);
        if (content === null) {
            throw new Error(`No such file: ${path}`);
        }
        return content;
    }
    
    /**
     * Write file content
     */
    writeFile(path, content = '') {
        const resolved = this.processor.resolvePath(path);
        this.ensureParentDir(resolved);
        this.processor.createFile(resolved, content);
        this.processor.saveFileSystem();
    }
    
    /**
     * Create directory
     */
    mkdir(path) {
        const resolved = this.processor.resolvePath(path);
        this.ensureParentDir(resolved);
        this.processor.createDirectory(resolved);
        this.processor.saveFileSystem();
    }
    
    /**
     * Remove file or directory
     */
    remove(path) {
        const resolved = this.processor.resolvePath(path);
        if (!this.exists(path)) {
            throw new Error(`No such file or directory: ${path}`);
        }
        this.processor.fileSystem.delete(resolved);
        this.processor.saveFileSystem();
    }
    
    /**
     * List directory contents
     */
    listDir(path = '.') {
        const resolved = this.processor.resolvePath(path);
        const entries = [];
        
        for (const [entryPath, entry] of this.processor.fileSystem.entries()) {
            if (entryPath.startsWith(resolved + '/')) {
                const relativePath = entryPath.substring(resolved.length + 1);
                if (!relativePath.includes('/')) { // Only direct children
                    entries.push({
                        name: relativePath,
                        type: entry.type,
                        size: entry.size || 0,
                        modified: entry.modified,
                        permissions: entry.permissions || '644',
                        owner: entry.owner || 'user'
                    });
                }
            }
        }
        
        return entries.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    /**
     * Get file/directory info
     */
    stat(path) {
        const resolved = this.processor.resolvePath(path);
        const entry = this.processor.fileSystem.get(resolved);
        if (!entry) {
            throw new Error(`No such file or directory: ${path}`);
        }
        
        return {
            type: entry.type,
            size: entry.size || 0,
            created: entry.created,
            modified: entry.modified,
            permissions: entry.permissions || '644',
            owner: entry.owner || 'user'
        };
    }
    
    /**
     * Ensure parent directories exist
     */
    ensureParentDir(filePath) {
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        if (parentPath === '/' || this.processor.pathExists(parentPath)) {
            return;
        }
        
        const parts = parentPath.split('/').filter(p => p);
        let currentPath = '';
        
        for (const part of parts) {
            currentPath += '/' + part;
            if (!this.processor.pathExists(currentPath)) {
                this.processor.createDirectory(currentPath);
            }
        }
    }
}

/**
 * Enhanced Output API
 */
class OutputAPI {
    constructor(stdout) {
        this._stdout = stdout;
    }
    
    /**
     * Normal output
     */
    print(text) {
        this._stdout(text);
    }
    
    /**
     * Success message (green)
     */
    success(text) {
        this._stdout(text, 'success');
    }
    
    /**
     * Error message (red)
     */
    error(text) {
        this._stdout(text, 'error');
    }
    
    /**
     * Warning message (yellow)
     */
    warning(text) {
        this._stdout(text, 'warning');
    }
    
    /**
     * Info message (blue)
     */
    info(text) {
        this._stdout(text, 'info');
    }
    
    /**
     * Empty line
     */
    newline() {
        this._stdout('');
    }
    
    /**
     * Print multiple lines
     */
    lines(textArray) {
        textArray.forEach(line => this._stdout(line));
    }
    
    /**
     * Print table (simple column-based output)
     */
    table(data, headers = null) {
        if (headers) {
            this._stdout(headers.join('\t'));
        }
        
        if (Array.isArray(data)) {
            data.forEach(row => {
                if (Array.isArray(row)) {
                    this._stdout(row.join('\t'));
                } else {
                    this._stdout(String(row));
                }
            });
        }
    }
}

/**
 * Command Builder - Fluent API for creating commands
 */
class CommandBuilder {
    constructor(name) {
        this.name = name;
        this.description = 'Command description';
        this.icon = 'fas fa-terminal';
        this.handler = null;
        this.helpText = null;
    }
    
    /**
     * Set command description
     */
    desc(description) {
        this.description = description;
        return this;
    }
    
    /**
     * Set command icon
     */
    setIcon(icon) {
        this.icon = icon;
        return this;
    }
    
    /**
     * Set help text
     */
    help(text) {
        this.helpText = text;
        return this;
    }
    
    /**
     * Set command handler function
     */
    action(handler) {
        this.handler = handler;
        return this;
    }
    
    /**
     * Build the command function
     */
    build() {
        const command = (rawContext) => {
            const ctx = new CommandContext(rawContext);
            
            // Auto-handle help if helpText is provided
            if (this.helpText && ctx.showHelpIf(this.helpText)) {
                return;
            }
            
            // Execute the handler
            if (this.handler) {
                return this.handler(ctx);
            }
        };
        
        // Attach metadata as comments
        const commandCode = `// ${this.description}
// ${this.icon}
${command.toString()}`;
        
        return commandCode;
    }
}

/**
 * Create a new command builder
 */
function createCommand(name) {
    return new CommandBuilder(name);
}

/**
 * Simple command creation helper
 */
function simpleCommand(description, icon, handler) {
    return function(rawContext) {
        const ctx = new CommandContext(rawContext);
        return handler(ctx);
    };
}

// Export for use in commands (browser compatibility)
if (typeof window !== 'undefined') {
    window.WafflentAPI = {
        CommandContext,
        FileSystemAPI,
        OutputAPI,
        CommandBuilder,
        createCommand,
        simpleCommand
    };
}