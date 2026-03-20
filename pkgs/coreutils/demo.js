// Demonstration of the enhanced Wafflent API
// fas fa-star
function demo(context) {
    const ctx = new CommandContext(context);
    
    // Enhanced help system with automatic formatting
    if (ctx.showHelpIf([
        'Usage: demo [OPTIONS] <command>',
        'Demonstrates the enhanced Wafflent command API features.',
        '',
        'Commands:',
        '  hello <name>     Greet someone',
        '  files            Show file operations',
        '  output           Show output formatting',
        '  flags            Show flag handling',
        '',
        'Options:',
        '  -v, --verbose    Enable verbose output',
        '  -q, --quiet      Suppress non-essential output',
        '  -h, --help       Show this help message',
        '',
        'Examples:',
        '  demo hello Alice         # Greet Alice',
        '  demo files               # Demonstrate file operations',
        '  demo output              # Show output formatting'
    ])) {
        return;
    }
    
    // Enhanced flag handling
    const verbose = ctx.hasFlag('-v', '--verbose');
    const quiet = ctx.hasFlag('-q', '--quiet');
    
    // Parameter validation with automatic error messages
    if (!ctx.requireParams(1, 'Error: Please specify a command (hello, files, output, or flags)')) {
        return;
    }
    
    const command = ctx.parameters[0];
    const additionalArgs = ctx.parameters.slice(1);
    
    if (verbose && !quiet) {
        ctx.output.info(`Running demo command: ${command}`);
        ctx.output.info(`Flags detected: verbose=${verbose}, quiet=${quiet}`);
    }
    
    try {
        switch (command) {
            case 'hello':
                demoHello(ctx, additionalArgs, verbose, quiet);
                break;
                
            case 'files':
                demoFiles(ctx, verbose, quiet);
                break;
                
            case 'output':
                demoOutput(ctx, verbose, quiet);
                break;
                
            case 'flags':
                demoFlags(ctx, verbose, quiet);
                break;
                
            default:
                ctx.output.error(`Unknown command: ${command}`);
                ctx.output.info('Use "demo --help" to see available commands');
        }
    } catch (error) {
        ctx.output.error(`Demo failed: ${error.message}`);
        if (verbose) {
            ctx.output.error(`Stack trace: ${error.stack}`);
        }
    }
}

function demoHello(ctx, args, verbose, quiet) {
    if (args.length === 0) {
        ctx.output.error('Error: Please provide a name to greet');
        return;
    }
    
    const name = args[0];
    const greeting = `Hello, ${name}! Welcome to Wafflent! 🧇`;
    
    if (quiet) {
        ctx.output.print(greeting);
    } else {
        ctx.output.success(greeting);
        ctx.output.info('This greeting was generated using the enhanced API');
        
        if (verbose) {
            ctx.output.info('Command details:');
            ctx.output.info(`- Name parameter: "${name}"`);
            ctx.output.info(`- Greeting length: ${greeting.length} characters`);
            ctx.output.info(`- Current time: ${new Date().toLocaleTimeString()}`);
        }
    }
}

function demoFiles(ctx, verbose, quiet) {
    if (!quiet) {
        ctx.output.info('=== File System Operations Demo ===');
    }
    
    // Create a demo file
    const demoFile = '/tmp/demo.txt';
    const content = `This is a demo file created at ${new Date().toISOString()}`;
    
    try {
        ctx.fs.writeFile(demoFile, content);
        ctx.output.success(`Created demo file: ${demoFile}`);
        
        if (verbose) {
            ctx.output.info(`File content: "${content}"`);
        }
        
        // Check if file exists
        if (ctx.fs.exists(demoFile)) {
            ctx.output.success('File existence confirmed');
            
            // Read the file back
            const readContent = ctx.fs.readFile(demoFile);
            ctx.output.info(`Read ${readContent.length} characters from file`);
            
            // Get file stats
            const stats = ctx.fs.stat(demoFile);
            ctx.output.info(`File stats: ${stats.size} bytes, modified ${new Date(stats.modified).toLocaleString()}`);
        }
        
        // List directory
        if (!quiet) {
            ctx.output.info('Contents of /tmp:');
            const entries = ctx.fs.listDir('/tmp');
            if (entries.length === 0) {
                ctx.output.info('  (empty)');
            } else {
                entries.forEach(entry => {
                    ctx.output.print(`  ${entry.name} (${entry.type}, ${entry.size} bytes)`);
                });
            }
        }
        
    } catch (error) {
        ctx.output.error(`File operation failed: ${error.message}`);
    }
}

function demoOutput(ctx, verbose, quiet) {
    if (!quiet) {
        ctx.output.info('=== Output Formatting Demo ===');
    }
    
    ctx.output.print('This is normal text output');
    ctx.output.success('This is a success message (green)');
    ctx.output.warning('This is a warning message (yellow)');
    ctx.output.error('This is an error message (red)');
    ctx.output.info('This is an info message (blue)');
    
    ctx.output.newline();
    ctx.output.info('Multi-line output:');
    ctx.output.lines([
        '  Line 1 of multi-line output',
        '  Line 2 of multi-line output',
        '  Line 3 of multi-line output'
    ]);
    
    ctx.output.newline();
    ctx.output.info('Table output:');
    ctx.output.table([
        ['Name', 'Type', 'Size'],
        ['file1.txt', 'file', '1024'],
        ['directory', 'dir', '0'],
        ['script.js', 'file', '2048']
    ]);
    
    if (verbose) {
        ctx.output.newline();
        ctx.output.info('All output methods demonstrated successfully');
    }
}

function demoFlags(ctx, verbose, quiet) {
    if (!quiet) {
        ctx.output.info('=== Flag Handling Demo ===');
    }
    
    ctx.output.info('Current flag status:');
    ctx.output.print(`  --verbose: ${verbose ? 'enabled' : 'disabled'}`);
    ctx.output.print(`  --quiet: ${quiet ? 'enabled' : 'disabled'}`);
    
    ctx.output.newline();
    ctx.output.info('All detected flags:');
    if (ctx.flags.length === 0) {
        ctx.output.print('  (no flags detected)');
    } else {
        ctx.flags.forEach(flag => {
            ctx.output.print(`  ${flag}`);
        });
    }
    
    ctx.output.newline();
    ctx.output.info('All parameters:');
    if (ctx.parameters.length === 0) {
        ctx.output.print('  (no parameters)');
    } else {
        ctx.parameters.forEach((param, index) => {
            ctx.output.print(`  [${index}]: ${param}`);
        });
    }
    
    if (verbose) {
        ctx.output.newline();
        ctx.output.info('Raw arguments:');
        ctx.args.forEach((arg, index) => {
            ctx.output.print(`  [${index}]: ${arg}`);
        });
    }
}