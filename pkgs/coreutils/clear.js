// Clear the terminal screen
// fas fa-broom
function clear(context) {
    const { args = [], stdout } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: clear [OPTION]...');
        stdout('Clear the terminal screen.');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    document.getElementById('terminal-output').innerHTML = '';
}