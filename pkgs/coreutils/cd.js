// Change directory
// fas fa-folder-open
function cd(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: cd [DIRECTORY]');
        stdout('Change the current working directory to DIRECTORY.');
        stdout('With no DIRECTORY, change to the home directory.');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    if (args.length === 0) {
        processor.currentDir = '/home/user';
        return;
    }

    const target = args[0];
    const newPath = processor.resolvePath(target);
    
    if (processor.fileSystem.has(newPath) && processor.fileSystem.get(newPath).type === 'directory') {
        processor.currentDir = newPath;
    } else {
        stdout(`cd: ${target}: No such file or directory`, 'error');
    }
}