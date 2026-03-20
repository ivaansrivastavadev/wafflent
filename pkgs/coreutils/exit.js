// Exit terminal session
// fas fa-sign-out-alt
function exit(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: exit [n]');
        stdout('Exit the shell.');
        stdout('  n             exit with status n (default: 0)');
        return;
    }

    stdout('Goodbye!', 'info');
    
    processor.addJournalEntry('login', 'User session ended', 6, 'info', 'User logged out from terminal session');
    
    setTimeout(() => {
        document.getElementById('terminal-output').innerHTML = '';
        stdout('Terminal session ended. Refresh the page to restart.', 'warning');
    }, 1000);
}