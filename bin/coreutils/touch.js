// Create files or update timestamps
// fas fa-plus-circle
function touch(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: touch [OPTION]... FILE...');
        stdout('Update the access and modification times of each FILE to the current time.');
        stdout('A FILE argument that does not exist is created empty.');
        stdout('');
        stdout('Options:');
        stdout('  -c, --no-create    do not create any files');
        stdout('  -h, --help         display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  touch file.txt     create file.txt or update its timestamp');
        stdout('  touch -c file.txt  only update timestamp if file exists');
        return;
    }
    
    const noCreate = args.includes('-c') || args.includes('--no-create');
    const files = args.filter(arg => !arg.startsWith('-'));
    
    if (files.length === 0) {
        stdout('touch: missing file operand', 'error');
        stdout('Try \'touch --help\' for more information.');
        return;
    }
    
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
    
    let fileCount = 0;
    let errorCount = 0;
    
    files.forEach(filename => {
        try {
            const resolvedPath = processor.resolvePath(filename);
            
            if (processor.pathExists(resolvedPath)) {
                // Update timestamp for existing file
                const entry = processor.fileSystem.get(resolvedPath);
                if (entry.type === 'file') {
                    entry.modified = new Date().toISOString();
                    fileCount++;
                } else {
                    stdout(`touch: cannot touch '${filename}': Is a directory`, 'error');
                    errorCount++;
                }
            } else if (!noCreate) {
                // Create new file
                ensureParentDir(resolvedPath, processor);
                processor.createFile(resolvedPath, '');
                fileCount++;
            } else {
                // -c flag: don't create, just report
                stdout(`touch: cannot touch '${filename}': No such file or directory`, 'error');
                errorCount++;
            }
        } catch (error) {
            stdout(`touch: cannot touch '${filename}': ${error.message}`, 'error');
            errorCount++;
        }
    });
    
    if (fileCount > 0) {
        processor.saveFileSystem();
    }
}