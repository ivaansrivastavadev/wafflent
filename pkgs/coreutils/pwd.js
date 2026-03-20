// Show current working directory
// fas fa-folder
function pwd(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: pwd [OPTION]...');
        stdout('Print the full pathname of the current working directory.');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    stdout(processor.currentDir);
}