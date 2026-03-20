// Copy files and directories
// fas fa-copy
function cp(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: cp [OPTION]... SOURCE... DIRECTORY');
        stdout('       cp [OPTION]... SOURCE DEST');
        stdout('Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.');
        stdout('');
        stdout('Options:');
        stdout('  -r, -R, --recursive   copy directories recursively');
        stdout('  -v, --verbose         explain what is being done');
        stdout('  -f, --force           do not prompt before overwriting');
        stdout('  -h, --help            display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  cp file.txt backup.txt    copy file.txt to backup.txt');
        stdout('  cp -r dir/ newdir/        copy directory recursively');
        stdout('  cp *.txt /tmp/           copy all .txt files to /tmp/');
        return;
    }
    
    if (args.length < 2) {
        stdout('cp: missing destination file operand', 'error');
        stdout("Try 'cp --help' for more information.");
        return;
    }
    
    const recursive = args.includes('-r') || args.includes('-R') || args.includes('--recursive');
    const verbose = args.includes('-v') || args.includes('--verbose');
    const force = args.includes('-f') || args.includes('--force');
    
    // Filter out options
    const paths = args.filter(arg => !arg.startsWith('-'));
    
    if (paths.length < 2) {
        stdout('cp: missing destination file operand', 'error');
        stdout("Try 'cp --help' for more information.");
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
    
    // Helper function to copy recursively
    function copyRecursively(fromPath, toPath, proc, verbose) {
        const entry = proc.fileSystem.get(fromPath);
        if (!entry) return false;
        
        if (entry.type === 'file') {
            // Ensure parent directory exists
            ensureParentDir(toPath, proc);
            
            // Copy file
            proc.createFile(toPath, entry.content || '');
            
            if (verbose) {
                stdout(`'${fromPath}' -> '${toPath}'`);
            }
            return true;
        } else if (entry.type === 'directory') {
            // Create target directory
            proc.createDirectory(toPath);
            
            if (verbose) {
                stdout(`'${fromPath}' -> '${toPath}'`);
            }
            
            // Find all files and subdirectories under the source path
            const children = [];
            for (const [fsPath, fsEntry] of proc.fileSystem.entries()) {
                if (fsPath.startsWith(fromPath + '/')) {
                    const relativePath = fsPath.substring(fromPath.length + 1);
                    // Only include direct children, not nested ones for this iteration
                    if (!relativePath.includes('/')) {
                        children.push({path: fsPath, name: relativePath, entry: fsEntry});
                    }
                }
            }
            
            // Copy each child
            for (const child of children) {
                const childToPath = toPath + '/' + child.name;
                copyRecursively(child.path, childToPath, proc, verbose);
            }
            
            return true;
        }
        return false;
    }
    
    let copiedCount = 0;
    let errorCount = 0;
    
    sources.forEach(source => {
        try {
            const sourcePath = processor.resolvePath(source);
            
            if (!processor.pathExists(sourcePath)) {
                stdout(`cp: cannot stat '${source}': No such file or directory`, 'error');
                errorCount++;
                return;
            }
            
            const sourceEntry = processor.fileSystem.get(sourcePath);
            
            if (sourceEntry.type === 'directory' && !recursive) {
                stdout(`cp: -r not specified; omitting directory '${source}'`, 'error');
                errorCount++;
                return;
            }
            
            let targetPath = destPath;
            
            // If destination is a directory, copy into it
            if (destExists && destEntry.type === 'directory') {
                const basename = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
                targetPath = destPath + '/' + basename;
            }
            
            // Check if target exists
            if (processor.pathExists(targetPath)) {
                if (!force) {
                    stdout(`cp: '${targetPath}' already exists (use -f to force overwrite)`, 'error');
                    errorCount++;
                    return;
                } else {
                    // Force overwrite - remove existing target first
                    if (verbose) {
                        stdout(`cp: overwriting '${targetPath}'`);
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
            
            if (copyRecursively(sourcePath, targetPath, processor, verbose)) {
                copiedCount++;
            }
            
        } catch (error) {
            stdout(`cp: cannot copy '${source}': ${error.message}`, 'error');
            errorCount++;
        }
    });
    
    if (copiedCount > 0) {
        processor.saveFileSystem();
    }
    
    if (verbose && copiedCount > 0) {
        stdout(`Successfully copied ${copiedCount} item${copiedCount > 1 ? 's' : ''}`);
    }
}