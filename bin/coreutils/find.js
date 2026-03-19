// Search for files and directories
// fas fa-search
function find(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: find [PATH...] [EXPRESSION]');
        stdout('Search for files in a directory hierarchy.');
        stdout('');
        stdout('  -name PATTERN         base of file name matches PATTERN');
        stdout('  -type TYPE            file is of type TYPE (f=file, d=directory)');
        stdout('  -maxdepth LEVELS      descend at most LEVELS');
        stdout('  -mindepth LEVELS      do not apply tests/actions at levels less than LEVELS');
        stdout('  -h, --help            display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  find /home -name "*.txt"    Find all .txt files in /home');
        stdout('  find . -type d              Find all directories in current dir');
        stdout('  find /var -maxdepth 1       Find files only 1 level deep');
        return;
    }
    
    let searchPath = processor.currentDir;
    let namePattern = null;
    let typeFilter = null;
    let maxDepth = Infinity;
    let minDepth = 0;
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '-name' && i + 1 < args.length) {
            namePattern = args[++i];
        } else if (arg === '-type' && i + 1 < args.length) {
            typeFilter = args[++i];
        } else if (arg === '-maxdepth' && i + 1 < args.length) {
            maxDepth = parseInt(args[++i]);
        } else if (arg === '-mindepth' && i + 1 < args.length) {
            minDepth = parseInt(args[++i]);
        } else if (!arg.startsWith('-')) {
            // Treat as search path
            searchPath = processor.resolvePath(arg);
        }
    }
    
    if (!processor.pathExists(searchPath)) {
        stdout(`find: '${searchPath}': No such file or directory`, 'error');
        return;
    }
    
    const results = [];
    searchRecursively(searchPath, 0);
    
    // Sort and display results
    results.sort().forEach(result => stdout(result));
    
    function searchRecursively(path, depth) {
        const entry = processor.fileSystem.get(path);
        if (!entry) return;
        
        // Check depth constraints
        if (depth < minDepth) {
            // Still need to recurse but don't include this item
            if (entry.type === 'directory' && depth < maxDepth) {
                entry.content.forEach(item => {
                    searchRecursively(path + '/' + item, depth + 1);
                });
            }
            return;
        }
        
        if (depth > maxDepth) return;
        
        // Apply filters
        let matches = true;
        
        // Type filter
        if (typeFilter) {
            if (typeFilter === 'f' && entry.type !== 'file') matches = false;
            if (typeFilter === 'd' && entry.type !== 'directory') matches = false;
        }
        
        // Name pattern filter (simple glob-like matching)
        if (namePattern && matches) {
            const basename = path.substring(path.lastIndexOf('/') + 1);
            if (namePattern.includes('*')) {
                const regex = new RegExp('^' + namePattern.replace(/\\*/g, '.*') + '$');
                if (!regex.test(basename)) matches = false;
            } else {
                if (basename !== namePattern) matches = false;
            }
        }
        
        // Add to results if matches
        if (matches) {
            results.push(path);
        }
        
        // Recurse into directories
        if (entry.type === 'directory' && depth < maxDepth) {
            entry.content.forEach(item => {
                searchRecursively(path + '/' + item, depth + 1);
            });
        }
    }
}