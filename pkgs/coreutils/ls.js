// List files and directories
// fas fa-list
function ls(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: ls [OPTION]... [FILE]...');
        stdout('List information about the FILEs (the current directory by default).');
        stdout('  -a, --all      do not ignore entries starting with .');
        stdout('  -l             use a long listing format');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    const showAll = args.includes('-a') || args.includes('--all');
    const longFormat = args.includes('-l');
    
    const files = [];
    for (const [path, entry] of processor.fileSystem.entries()) {
        if (path.startsWith(processor.currentDir + '/') && !path.substring(processor.currentDir.length + 1).includes('/')) {
            const name = path.substring(processor.currentDir.length + 1);
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
            stdout(`${type}${perms} ${entry.owner || 'user'} ${size} ${date} ${name}`);
        }
    } else {
        const names = files.map(f => f.name);
        stdout(names.join('  '));
    }
}