// Display system information
// fas fa-info-circle
function uname(context) {
    const { args = [], stdout } = context;
    
    // Check for help flags
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: uname [OPTION]');
        stdout('Print certain system information');
        stdout('');
        stdout('Options:');
        stdout('  -a, --all             print all information');
        stdout('  -s, --kernel-name     print the kernel name');
        stdout('  -r, --kernel-release  print the kernel release');
        stdout('  -v, --kernel-version  print the kernel version');
        stdout('  -m, --machine         print the machine hardware name');
        stdout('  -h, --help            display this help and exit');
        stdout('');
        stdout('Examples:');
        stdout('  uname         show kernel name (default)');
        stdout('  uname -a      show all system information');
        stdout('  uname -m      show machine architecture');
        return;
    }
    
    if (args.includes('-a') || args.includes('--all')) {
        stdout('Wafflent 1.0.0 wafflent-terminal x86_64 JavaScript');
    } else if (args.includes('-s') || args.includes('--kernel-name')) {
        stdout('Wafflent');
    } else if (args.includes('-r') || args.includes('--kernel-release')) {
        stdout('1.0.0');
    } else if (args.includes('-v') || args.includes('--kernel-version')) {
        stdout('Wafflent Terminal v1.0');
    } else if (args.includes('-m') || args.includes('--machine')) {
        stdout('x86_64');
    } else {
        stdout('Wafflent');
    }
}