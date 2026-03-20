// Show current date and time
// fas fa-clock
function date(context) {
    const { args = [], stdout } = context;
    
    // Check for help flags
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: date [OPTION]');
        stdout('Display the current date and time');
        stdout('');
        stdout('Options:');
        stdout('  -I, --iso-8601    output date in ISO 8601 format (YYYY-MM-DD)');
        stdout('  -R, --rfc-3339    output date in RFC 3339 format (ISO timestamp)');
        stdout('  -h, --help        display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  date              show current date and time');
        stdout('  date -I           show current date in ISO format');
        stdout('  date -R           show current date in RFC format');
        return;
    }
    
    const now = new Date();
    
    if (args.includes('--iso-8601') || args.includes('-I')) {
        stdout(now.toISOString().split('T')[0]);
    } else if (args.includes('--rfc-3339') || args.includes('-R')) {
        stdout(now.toISOString());
    } else {
        // Default format: Wed Mar 19 2026 12:34:56 GMT+0000 (UTC)
        stdout(now.toString());
    }
}