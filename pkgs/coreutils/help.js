// Show available commands
// fas fa-question-circle
function help(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: help [OPTION]...');
        stdout('Show a list of all available commands.');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    stdout('Available commands:', 'info');
    stdout('');
    
    const commands = processor.getAvailableCommands();
    for (const cmd of commands) {
        stdout(`  ${cmd.name.padEnd(12)} - ${cmd.description}`);
    }
    
    stdout('');
    stdout('Use [command] -h or --help for command-specific help', 'info');
}