// Create directories
// fas fa-folder-plus
function mkdir(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: mkdir [OPTION]... DIRECTORY...');
        stdout('Create the DIRECTORY(ies), if they do not already exist.');
        stdout('');
        stdout('Options:');
        stdout('  -p, --parents     no error if existing, make parent directories as needed');
        stdout('  -v, --verbose     print a message for each created directory');
        stdout('  -h, --help        display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  mkdir mydir           create directory mydir');
        stdout('  mkdir -p a/b/c        create nested directories a/b/c');
        stdout('  mkdir -v newdir       create directory with verbose output');
        return;
    }
    
    if (args.length === 0) {
        stdout('mkdir: missing operand', 'error');
        stdout("Try 'mkdir --help' for more information.");
        return;
    }
    
    const parentFlag = args.includes('-p') || args.includes('--parents');
    const verboseFlag = args.includes('-v') || args.includes('--verbose');
    
    // Get directory names (filter out flags)
    const directories = args.filter(arg => !arg.startsWith('-'));
    
    if (directories.length === 0) {
        stdout('mkdir: missing operand', 'error');
        stdout("Try 'mkdir --help' for more information.");
        return;
    }
    
    let createdCount = 0;
    let errorCount = 0;
    
    directories.forEach(dirName => {
        try {
            const resolvedPath = processor.resolvePath(dirName);
            
            if (processor.pathExists(resolvedPath)) {
                const existing = processor.fileSystem.get(resolvedPath);
                if (existing.type === 'directory') {
                    if (!parentFlag) {
                        stdout(`mkdir: cannot create directory '${dirName}': File exists`, 'error');
                        errorCount++;
                    }
                } else {
                    stdout(`mkdir: cannot create directory '${dirName}': File exists`, 'error');
                    errorCount++;
                }
                return;
            }
            
            // Create parent directories if needed
            if (parentFlag) {
                const pathParts = resolvedPath.split('/').filter(part => part);
                let currentPath = '';
                
                pathParts.forEach(part => {
                    currentPath += '/' + part;
                    if (!processor.pathExists(currentPath)) {
                        processor.createDirectory(currentPath);
                        createdCount++;
                        
                        if (verboseFlag) {
                            stdout(`mkdir: created directory '${currentPath}'`);
                        }
                    }
                });
            } else {
                // Check if parent exists
                const parentPath = resolvedPath.substring(0, resolvedPath.lastIndexOf('/')) || '/';
                if (parentPath !== '/' && !processor.pathExists(parentPath)) {
                    stdout(`mkdir: cannot create directory '${dirName}': No such file or directory`, 'error');
                    errorCount++;
                    return;
                }
                
                // Create directory
                processor.createDirectory(resolvedPath);
                createdCount++;
                
                if (verboseFlag) {
                    stdout(`mkdir: created directory '${dirName}'`);
                }
            }
            
        } catch (error) {
            stdout(`mkdir: cannot create directory '${dirName}': ${error.message}`, 'error');
            errorCount++;
        }
    });
    
    if (createdCount > 0) {
        processor.saveFileSystem();
    }
}