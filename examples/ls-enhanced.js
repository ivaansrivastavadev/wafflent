// Enhanced version of the ls command using the new API
// fas fa-list

// Using the simple approach
function ls(context) {
    const ctx = new CommandContext(context);
    
    // Auto-handle help
    if (ctx.showHelpIf([
        'Usage: ls [OPTION]... [FILE]...',
        'List information about the FILEs (the current directory by default).',
        '',
        'Options:',
        '  -a, --all      do not ignore entries starting with .',
        '  -l             use a long listing format',
        '  -h, --help     display this help and exit'
    ])) {
        return;
    }
    
    // Parse flags
    const showAll = ctx.hasFlag('-a', '--all');
    const longFormat = ctx.hasFlag('-l');
    const targetPath = ctx.parameters[0] || '.';
    
    try {
        // List directory contents
        const entries = ctx.fs.listDir(targetPath);
        
        // Filter hidden files if not showing all
        const filteredEntries = showAll ? entries : entries.filter(e => !e.name.startsWith('.'));
        
        if (filteredEntries.length === 0) {
            return; // Empty directory
        }
        
        // Output based on format
        if (longFormat) {
            filteredEntries.forEach(entry => {
                const type = entry.type === 'directory' ? 'd' : '-';
                const perms = entry.permissions;
                const size = entry.size.toString().padStart(8);
                const date = new Date(entry.modified).toLocaleDateString();
                ctx.output.print(`${type}${perms} ${entry.owner} ${size} ${date} ${entry.name}`);
            });
        } else {
            const names = filteredEntries.map(e => e.name);
            ctx.output.print(names.join('  '));
        }
        
    } catch (error) {
        ctx.output.error(`ls: ${error.message}`);
    }
}