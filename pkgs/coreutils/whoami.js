// Display current username
// fas fa-user
function whoami(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: whoami [OPTION]...');
        stdout('Print the user name associated with the current effective user ID.');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    stdout(processor.currentUser);
}