// Move and rename files and directories
// fas fa-arrows-alt
function mv(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: mv [OPTION]... SOURCE... DIRECTORY');
        stdout('       mv [OPTION]... SOURCE DEST');
        stdout('Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.');
        stdout('');
        stdout('Options:');
        stdout('  -f, --force       do not prompt before overwriting');
        stdout('  -v, --verbose     explain what is being done');
        stdout('  -h, --help        display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  mv file.txt newname.txt    rename file.txt to newname.txt');
        stdout('  mv file.txt /tmp/          move file.txt to /tmp/ directory');
        stdout('  mv *.log logs/             move all .log files to logs/ directory');
        return;
    }
    
    if (args.length < 2) {
        stdout('mv: missing destination file operand', 'error');
        stdout("Try 'mv --help' for more information.");
        return;
    }
    
    const force = args.includes('-f') || args.includes('--force');
    const verbose = args.includes('-v') || args.includes('--verbose');
    
    // Filter out options
    const paths = args.filter(arg => !arg.startsWith('-'));
    
    if (paths.length < 2) {
        stdout('mv: missing destination file operand', 'error');
        stdout("Try 'mv --help' for more information.");
        return;
    }
    
    const destination = paths[paths.length - 1];
    const sources = paths.slice(0, -1);
    
    const destPath = processor.resolvePath(destination);
    const destExists = processor.pathExists(destPath);
    const destEntry = destExists ? processor.fileSystem.get(destPath) : null;
    
    // Helper function to ensure parent directories exist
    function ensureParentDir(filePath, proc) {
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        if (parentPath === '/' || proc.pathExists(parentPath)) {
            return true;
        }
        
        // Create parent directories recursively
        const parts = parentPath.split('/').filter(p => p);
        let currentPath = '';
        
        for (const part of parts) {
            currentPath += '/' + part;
            if (!proc.pathExists(currentPath)) {
                proc.createDirectory(currentPath);
            }
        }
        return true;
    }
    
    // Helper function to move recursively
    function moveRecursively(fromPath, toPath, proc, verbose) {
        const entry = proc.fileSystem.get(fromPath);
        if (!entry) return false;
        
        // Ensure parent directory exists
        ensureParentDir(toPath, proc);
        
        if (entry.type === 'file') {
            // Move file
            proc.fileSystem.set(toPath, {
                ...entry,
                modified: new Date().toISOString()
            });
            proc.fileSystem.delete(fromPath);
            
            if (verbose) {
                stdout(`'${fromPath}' -> '${toPath}'`);
            }
            return true;
        } else if (entry.type === 'directory') {
            // Create new directory
            proc.createDirectory(toPath);
            
            if (verbose) {
                stdout(`'${fromPath}' -> '${toPath}'`);
            }
            
            // Find all files and directories under the source path
            const toMove = [];
            for (const [fsPath, fsEntry] of proc.fileSystem.entries()) {
                if (fsPath.startsWith(fromPath + '/')) {
                    const relativePath = fsPath.substring(fromPath.length + 1);
                    toMove.push({
                        fromPath: fsPath,
                        toPath: toPath + '/' + relativePath,
                        entry: fsEntry
                    });
                }
            }
            
            // Sort by depth (files first, then directories) to avoid conflicts
            toMove.sort((a, b) => {
                const aDepth = a.fromPath.split('/').length;
                const bDepth = b.fromPath.split('/').length;
                return aDepth - bDepth;
            });
            
            // Move all contents
            for (const item of toMove) {
                ensureParentDir(item.toPath, proc);
                proc.fileSystem.set(item.toPath, {
                    ...item.entry,
                    modified: new Date().toISOString()
                });
                proc.fileSystem.delete(item.fromPath);
                
                if (verbose) {
                    stdout(`'${item.fromPath}' -> '${item.toPath}'`);
                }
            }
            
            // Remove the original directory
            proc.fileSystem.delete(fromPath);
            
            return true;
        }
        return false;
    }
    
    let movedCount = 0;
    let errorCount = 0;
    
    sources.forEach(source => {
        try {
            const sourcePath = processor.resolvePath(source);
            
            if (!processor.pathExists(sourcePath)) {
                stdout(`mv: cannot stat '${source}': No such file or directory`, 'error');
                errorCount++;
                return;
            }
            
            // Prevent moving system directories
            if (sourcePath.startsWith('/sys/') || sourcePath.startsWith('/pkgs/') || 
                sourcePath === '/' || sourcePath === '/home' || sourcePath === '/usr' || sourcePath === '/tmp') {
                stdout(`mv: cannot move '${source}': Operation not permitted`, 'error');
                errorCount++;
                return;
            }
            
            const sourceEntry = processor.fileSystem.get(sourcePath);
            let targetPath = destPath;
            
            // If destination is a directory, move into it
            if (destExists && destEntry.type === 'directory') {
                const basename = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
                targetPath = destPath + '/' + basename;
            }
            
            // Check if target exists
            if (processor.pathExists(targetPath)) {
                if (!force) {
                    stdout(`mv: cannot move '${source}' to '${targetPath}': File exists (use -f to force)`, 'error');
                    errorCount++;
                    return;
                } else {
                    // Force overwrite - remove existing target first
                    if (verbose) {
                        stdout(`mv: overwriting '${targetPath}'`);
                    }
                    const targetEntry = processor.fileSystem.get(targetPath);
                    if (targetEntry.type === 'directory') {
                        // Remove directory and all contents
                        const toRemove = [];
                        for (const [fsPath] of processor.fileSystem.entries()) {
                            if (fsPath === targetPath || fsPath.startsWith(targetPath + '/')) {
                                toRemove.push(fsPath);
                            }
                        }
                        toRemove.forEach(path => processor.fileSystem.delete(path));
                    } else {
                        processor.fileSystem.delete(targetPath);
                    }
                }
            }
            
            // Check if trying to move into itself (for directories)
            if (sourceEntry.type === 'directory' && targetPath.startsWith(sourcePath + '/')) {
                stdout(`mv: cannot move '${source}' into itself`, 'error');
                errorCount++;
                return;
            }
            
            if (moveRecursively(sourcePath, targetPath, processor, verbose)) {
                movedCount++;
            }
            
        } catch (error) {
            stdout(`mv: cannot move '${source}': ${error.message}`, 'error');
            errorCount++;
        }
    });
    
    if (movedCount > 0) {
        processor.saveFileSystem();
    }
    
    if (verbose && movedCount > 0) {
        stdout(`Successfully moved ${movedCount} item${movedCount > 1 ? 's' : ''}`);
    }
}