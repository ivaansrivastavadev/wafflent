// Display text to standard output
// fas fa-comment
function echo(context) {
    const { args = [], stdout } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: echo [SHORT-OPTION]... [STRING]...');
        stdout('Echo the STRINGs to standard output.');
        stdout('');
        stdout('  -n             do not output the trailing newline');
        stdout('  -e             enable interpretation of backslash escapes');
        stdout('  -E             disable interpretation of backslash escapes (default)');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    const noNewline = args.includes('-n');
    const enableEscapes = args.includes('-e');
    
    // Filter out options
    const textArgs = args.filter(arg => !arg.startsWith('-'));
    
    if (textArgs.length === 0) {
        if (!noNewline) stdout('');
        return;
    }
    
    let text = textArgs.join(' ');
    
    if (enableEscapes) {
        // Basic escape sequence support
        text = text
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\');
    }
    
    if (noNewline) {
        // For -n option, we need to output without newline
        const element = document.createElement('span');
        element.innerHTML = text;
        const terminalOutput = document.getElementById('terminal-output');
        terminalOutput.appendChild(element);
    } else {
        stdout(text);
    }
}