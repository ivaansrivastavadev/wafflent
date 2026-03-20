// Display last lines of file
// fas fa-file-import
function tail(context) {
    const { args = [], stdout, processor } = context;
    
    const lines = 10;
    let numLines = lines;
    let files = args.slice();
    
    const nIndex = args.findIndex(arg => arg === '-n');
    if (nIndex !== -1 && nIndex + 1 < args.length) {
        numLines = parseInt(args[nIndex + 1]);
        files = args.filter((arg, index) => index !== nIndex && index !== nIndex + 1);
    }
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: tail [OPTION]... [FILE]...');
        stdout('Print the last 10 lines of each FILE to standard output.');
        stdout('  -n NUM        print the last NUM lines instead of the last 10');
        stdout('  -h, --help    display this help and exit');
        return;
    }

    if (files.length === 0) {
        stdout('tail: missing file operand', 'error');
        return;
    }

    for (const filename of files) {
        const filepath = processor.resolvePath(filename);
        const entry = processor.fileSystem.get(filepath);
        
        if (!entry) {
            stdout(`tail: ${filename}: No such file or directory`, 'error');
            continue;
        }
        
        if (entry.type !== 'file') {
            stdout(`tail: ${filename}: Is a directory`, 'error');
            continue;
        }
        
        const contentLines = entry.content.split('\n');
        const outputLines = contentLines.slice(-numLines);
        
        if (files.length > 1) {
            stdout(`==> ${filename} <==`);
        }
        
        outputLines.forEach(line => stdout(line));
        
        if (files.length > 1) {
            stdout('');
        }
    }
}