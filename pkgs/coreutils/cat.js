// Display file content
// fas fa-file-alt
function cat(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: cat [OPTION]... [FILE]...');
        stdout('Concatenate FILE(s) to standard output.');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    const files = args.filter(arg => !arg.startsWith('-'));
    
    if (files.length === 0) {
        stdout('cat: missing file operand', 'error');
        return;
    }

    for (const filename of files) {
        const filepath = processor.resolvePath(filename);
        const entry = processor.fileSystem.get(filepath);
        
        if (!entry) {
            stdout(`cat: ${filename}: No such file or directory`, 'error');
            continue;
        }
        
        if (entry.type !== 'file') {
            stdout(`cat: ${filename}: Is a directory`, 'error');
            continue;
        }
        
        stdout(entry.content);
    }
}