// Remove files and directories
// fas fa-trash
function rm(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: rm [OPTION]... [FILE]...');
        stdout('Remove (unlink) the FILE(s).');
        stdout('');
        stdout('Options:');
        stdout('  -f, --force           ignore nonexistent files and arguments, never prompt');
        stdout('  -r, -R, --recursive   remove directories and their contents recursively');
        stdout('  -v, --verbose         explain what is being done');
        stdout('  -h, --help            display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  rm file.txt           remove file.txt');
        stdout('  rm -r directory/      remove directory and all its contents');
        stdout('  rm -f *.tmp           forcibly remove all .tmp files');
        stdout('');
        stdout('WARNING: rm permanently removes files. Use with caution.');
        return;
    }
    
    if (args.length === 0) {
        stdout('rm: missing operand', 'error');
        stdout("Try 'rm --help' for more information.");
        return;
    }
    
    const forceFlag = args.includes('-f') || args.includes('--force');
    const recursiveFlag = args.includes('-r') || args.includes('-R') || args.includes('--recursive');
    const verboseFlag = args.includes('-v') || args.includes('--verbose');
    
    // Get file/directory names (filter out flags)
    const targets = args.filter(arg => !arg.startsWith('-'));
    
    if (targets.length === 0) {
        if (!forceFlag) {
            stdout('rm: missing operand', 'error');
            stdout("Try 'rm --help' for more information.");
        }
        return;
    }
    
    // Helper function to remove recursively
    function removeRecursively(path, proc, verbose) {
        const entry = proc.fileSystem.get(path);
        if (!entry) return;
        
        if (entry.type === 'directory') {
            // Find all files/directories under this path
            const childPaths = [];
            for (const [fsPath, fsEntry] of proc.fileSystem.entries()) {
                if (fsPath.startsWith(path + '/') && fsPath !== path) {
                    childPaths.push(fsPath);
                }
            }
            
            // Sort by depth (deepest first) to ensure proper deletion order
            childPaths.sort((a, b) => {
                const depthA = a.split('/').length;
                const depthB = b.split('/').length;
                return depthB - depthA;
            });
            
            // Remove all children
            childPaths.forEach(childPath => {
                proc.fileSystem.delete(childPath);
                if (verbose) {
                    stdout(`removed '${childPath}'`);
                }
            });
        }
        
        // Remove the item itself
        proc.fileSystem.delete(path);
        if (verbose) {
            stdout(`removed '${path}'`);
        }
    }
    
    let removedCount = 0;
    let errorCount = 0;
    
    targets.forEach(target => {
        try {
            const resolvedPath = processor.resolvePath(target);
            
            if (!processor.pathExists(resolvedPath)) {
                if (!forceFlag) {
                    stdout(`rm: cannot remove '${target}': No such file or directory`, 'error');
                    errorCount++;
                }
                return;
            }
            
            const entry = processor.fileSystem.get(resolvedPath);
            
            if (entry.type === 'directory' && !recursiveFlag) {
                stdout(`rm: cannot remove '${target}': Is a directory`, 'error');
                stdout('Use -r or --recursive to remove directories.');
                errorCount++;
                return;
            }
            
            // Prevent removal of system directories
            if (resolvedPath.startsWith('/sys/') || resolvedPath.startsWith('/bin/') || 
                resolvedPath === '/' || resolvedPath === '/home' || resolvedPath === '/usr' || resolvedPath === '/tmp') {
                stdout(`rm: cannot remove '${target}': Operation not permitted`, 'error');
                errorCount++;
                return;
            }
            
            // Remove the file or directory
            if (entry.type === 'directory') {
                removeRecursively(resolvedPath, processor, verboseFlag);
            } else {
                processor.fileSystem.delete(resolvedPath);
                if (verboseFlag) {
                    stdout(`removed '${target}'`);
                }
            }
            
            removedCount++;
            
        } catch (error) {
            stdout(`rm: cannot remove '${target}': ${error.message}`, 'error');
            errorCount++;
        }
    });
    
    if (removedCount > 0) {
        processor.saveFileSystem();
    }
    
    if (verboseFlag && removedCount > 0) {
        stdout(`Successfully removed ${removedCount} item${removedCount > 1 ? 's' : ''}`);
    }
}