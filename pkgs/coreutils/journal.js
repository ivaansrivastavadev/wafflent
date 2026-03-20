// View system journal
// fas fa-book
function journal(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: journal [OPTION]...');
        stdout('View system journal entries (similar to journalctl).');
        stdout('  -n, --lines=NUM       show NUM most recent entries (default: 20)');
        stdout('  -f, --follow          follow journal entries (not implemented in web version)');
        stdout('  -u, --unit=UNIT       show entries for specific unit');
        stdout('      --since=TIME      show entries since specified time');
        stdout('  -p, --priority=LEVEL  show entries with priority LEVEL and above');
        stdout('  -x, --explanations    add explanation texts to entries');
        stdout('  -h, --help            display this help and exit');
        return;
    }

    let numLines = 20;
    let unit = null;
    let priority = null;
    let since = null;
    let explanations = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-n' && i + 1 < args.length) {
            numLines = parseInt(args[++i]) || 20;
        } else if (args[i].startsWith('--lines=')) {
            numLines = parseInt(args[i].split('=')[1]) || 20;
        } else if (args[i] === '-u' && i + 1 < args.length) {
            unit = args[++i];
        } else if (args[i].startsWith('--unit=')) {
            unit = args[i].split('=')[1];
        } else if (args[i] === '-p' && i + 1 < args.length) {
            priority = args[++i];
        } else if (args[i].startsWith('--priority=')) {
            priority = args[i].split('=')[1];
        } else if (args[i].startsWith('--since=')) {
            since = args[i].split('=')[1];
        } else if (args[i] === '-x' || args[i] === '--explanations') {
            explanations = true;
        }
    }

    let journalEntries = processor.getJournalEntries();

    if (unit) {
        journalEntries = journalEntries.filter(entry => entry.unit === unit);
    }

    if (priority) {
        const priorityLevels = { 'emerg': 0, 'alert': 1, 'crit': 2, 'err': 3, 'warning': 4, 'notice': 5, 'info': 6, 'debug': 7 };
        const targetLevel = priorityLevels[priority.toLowerCase()] || 6;
        journalEntries = journalEntries.filter(entry => entry.priority <= targetLevel);
    }

    if (since) {
        const sinceTime = new Date(since);
        if (!isNaN(sinceTime)) {
            journalEntries = journalEntries.filter(entry => new Date(entry.timestamp) >= sinceTime);
        }
    }

    const recentEntries = journalEntries.slice(-numLines);

    if (recentEntries.length === 0) {
        stdout('-- No journal entries found --', 'info');
        return;
    }

    recentEntries.forEach(entry => {
        const timestamp = new Date(entry.timestamp).toISOString().replace('T', ' ').substring(0, 19);
        const unit = entry.unit || 'system';
        const message = entry.message || '';

        stdout(`${timestamp} ${unit}[${entry.pid}]: ${message}`, 
               entry.priority <= 3 ? 'error' : entry.priority <= 4 ? 'warning' : 'normal');

        if (explanations && entry.explanation) {
            stdout(`-- ${entry.explanation}`, 'info');
        }
    });

    if (recentEntries.length === numLines) {
        stdout('');
        stdout(`-- Showing ${numLines} most recent entries. Use -n to show more --`, 'info');
    }
}