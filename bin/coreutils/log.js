// System logging and debugging utility
// fas fa-list-alt
// args: debug
function log(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: log [OPTION]... [COMMAND]');
        stdout('Debug and log system information');
        stdout('');
        stdout('  --context COMMAND     show context passed to command');
        stdout('  --commands            list all available commands');
        stdout('  --filesystem          show filesystem entries');
        stdout('  --storage             show localStorage contents');
        stdout('  -v, --verbose         verbose output');
        stdout('  -h, --help            display this help and exit');
        return;
    }
    
    const verbose = args.includes('-v') || args.includes('--verbose');
    
    if (args.includes('--context') && args.length > 1) {
        const commandIndex = args.indexOf('--context') + 1;
        const command = args[commandIndex];
        
        stdout(`Debug Context for '${command}':`, 'info');
        stdout(`- Args: ${JSON.stringify(args)}`);
        stdout(`- CurrentDir: ${processor.currentDir}`);
        stdout(`- CurrentUser: ${processor.currentUser}`);
        stdout(`- FileSystem Size: ${processor.fileSystem.size} entries`);
        
        // Test command execution context
        const testContext = {
            args: ['--help'],
            stdout: (msg) => stdout(`  OUTPUT: ${msg}`),
            currentDir: processor.currentDir,
            fileSystem: processor.fileSystem,
            resolvePath: processor.resolvePath.bind(processor),
            processor: processor
        };
        
        stdout('Test Context:', 'info');
        stdout(`- Args type: ${typeof testContext.args}`);
        stdout(`- Args value: ${JSON.stringify(testContext.args)}`);
        stdout(`- Args has includes: ${typeof testContext.args.includes === 'function'}`);
        
    } else if (args.includes('--commands')) {
        stdout('Available Commands:', 'info');
        const commands = processor.getAvailableCommands();
        commands.forEach(cmd => {
            stdout(`- ${cmd.name}: ${cmd.description} (${cmd.icon})`);
        });
        
    } else if (args.includes('--filesystem')) {
        stdout('FileSystem Entries:', 'info');
        let count = 0;
        for (const [path, entry] of processor.fileSystem.entries()) {
            if (count < 20 || verbose) {
                stdout(`- ${path} (${entry.type})`);
            }
            count++;
        }
        if (count > 20 && !verbose) {
            stdout(`... and ${count - 20} more (use --verbose to see all)`);
        }
        
    } else if (args.includes('--storage')) {
        stdout('localStorage Contents:', 'info');
        let count = 0;
        for (let key in localStorage) {
            if (count < 10 || verbose) {
                const value = localStorage.getItem(key);
                const size = value ? value.length : 0;
                stdout(`- ${key}: ${size} chars`);
            }
            count++;
        }
        if (count > 10 && !verbose) {
            stdout(`... and ${count - 10} more (use --verbose to see all)`);
        }
        
    } else {
        stdout('System Log:', 'info');
        stdout(`Current Directory: ${processor.currentDir}`);
        stdout(`Current User: ${processor.currentUser}`);
        stdout(`FileSystem Entries: ${processor.fileSystem.size}`);
        stdout(`Available Commands: ${processor.getAvailableCommands().length}`);
        
        // Show recent errors from console if available
        if (typeof console !== 'undefined' && console.error) {
            stdout('Use --context <command> to debug specific command execution');
        }
    }
}