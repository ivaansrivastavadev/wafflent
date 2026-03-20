// Switch to root user
// fas fa-key
function su(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: su [OPTION]... [-] [USER [ARGUMENT]...]');
        stdout('Change effective user id and group id to that of USER.');
        stdout('  -             provide an environment similar to what the user would expect');
        stdout('  -h, --help    display this help and exit');
        return;
    }
    
    const targetUser = args[0] || 'root';
    
    if (targetUser === 'root') {
        if (processor.currentUser === 'root') {
            stdout('You are already root.', 'info');
            return;
        }
        
        processor.currentUser = 'root';
        processor.addJournalEntry('su', `User switched to ${targetUser}`, 6, 'info', `User elevation to ${targetUser} account`);
        stdout(`Switched to user: ${targetUser}`, 'info');
        
        const promptElement = document.querySelector('.prompt-user');
        if (promptElement) {
            promptElement.textContent = 'root';
        }
    } else if (targetUser === 'user') {
        processor.currentUser = 'user';
        processor.addJournalEntry('su', `User switched to ${targetUser}`, 6, 'info', `User de-elevation to ${targetUser} account`);
        stdout(`Switched to user: ${targetUser}`, 'info');
        
        const promptElement = document.querySelector('.prompt-user');
        if (promptElement) {
            promptElement.textContent = 'user';
        }
    } else {
        stdout(`su: user ${targetUser} does not exist`, 'error');
    }
}