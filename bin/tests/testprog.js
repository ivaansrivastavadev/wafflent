// Program Tester - Tests all programs in /bin/coreutils/
// fas fa-vial
// args: testing
function testprog(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: testprog [OPTION]...');
        stdout('Test all programs in /bin/coreutils/ directory');
        stdout('');
        stdout('  -v, --verbose     show detailed output');
        stdout('  -q, --quiet       minimal output');
        stdout('  --list           list all programs and their metadata');
        stdout('  --skip-tests     only show program info without testing');
        stdout('  -h, --help       display this help and exit');
        return;
    }
    
    const verbose = args.includes('-v') || args.includes('--verbose');
    const quiet = args.includes('-q') || args.includes('--quiet');
    const listOnly = args.includes('--list');
    const skipTests = args.includes('--skip-tests');
    
    if (!quiet) {
        stdout('🧪 Wafflent Program Tester', 'info');
        stdout('━'.repeat(50), 'info');
    }
    
    // Discover all programs
    const programs = [];
    const coreutilsPath = '/bin/coreutils';
    
    // Get all .js files from coreutils directory
    for (const [path, entry] of processor.fileSystem.entries()) {
        if (path.startsWith(coreutilsPath) && path.endsWith('.js')) {
            const filename = path.substring(path.lastIndexOf('/') + 1);
            const programName = filename.replace('.js', '');
            
            if (entry.type === 'file') {
                const metadata = parseProgram(entry.content, programName);
                programs.push({
                    name: programName,
                    path: path,
                    metadata: metadata,
                    content: entry.content
                });
            }
        }
    }
    
    // Sort programs alphabetically
    programs.sort((a, b) => a.name.localeCompare(b.name));
    
    if (!quiet) {
        stdout(`📦 Found ${programs.length} programs`, 'info');
        stdout('');
    }
    
    // Show program list if requested
    if (listOnly) {
        showProgramList(programs, stdout, verbose);
        return;
    }
    
    // Test each program
    let testedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const program of programs) {
        if (!quiet) {
            stdout(`📋 Testing: ${program.name}`, 'info');
        }
        
        try {
            const result = testProgram(program, processor, verbose, quiet, skipTests);
            
            if (result.skipped) {
                skippedCount++;
                if (verbose) {
                    stdout(`   ⏭️  Skipped: ${result.reason}`, 'warning');
                }
            } else if (result.error) {
                errorCount++;
                stdout(`   ❌ Error: ${result.error}`, 'error');
            } else {
                testedCount++;
                if (verbose) {
                    stdout(`   ✅ Tested successfully`, 'success');
                }
            }
            
            if (!quiet && !listOnly) {
                stdout('');
            }
            
        } catch (error) {
            errorCount++;
            stdout(`   ❌ Exception: ${error.message}`, 'error');
            if (!quiet) stdout('');
        }
    }
    
    // Summary
    if (!quiet) {
        stdout('📊 Test Summary', 'info');
        stdout('━'.repeat(30), 'info');
        stdout(`✅ Tested: ${testedCount}`);
        stdout(`⏭️  Skipped: ${skippedCount}`);
        stdout(`❌ Errors: ${errorCount}`);
        stdout(`📦 Total: ${programs.length}`);
    }
}

function parseProgram(content, programName) {
    const lines = content.split('\\n');
    const metadata = {
        description: '',
        icon: '',
        args: [],
        isFullscreen: false,
        hasHelp: false
    };
    
    // Parse first few lines for metadata
    if (lines.length > 0 && lines[0].startsWith('//')) {
        metadata.description = lines[0].substring(2).trim();
    }
    
    if (lines.length > 1 && lines[1].startsWith('//')) {
        const iconLine = lines[1].substring(2).trim();
        if (iconLine.includes('fa-')) {
            metadata.icon = iconLine;
        }
    }
    
    if (lines.length > 2 && lines[2].startsWith('//')) {
        const argsLine = lines[2].substring(2).trim();
        if (argsLine.startsWith('args:')) {
            const argsList = argsLine.substring(5).split(',').map(s => s.trim());
            metadata.args = argsList;
            metadata.isFullscreen = argsList.includes('fullscreen');
        }
    }
    
    // Check if program has help support
    metadata.hasHelp = content.includes('-h') || content.includes('--help');
    
    return metadata;
}

function showProgramList(programs, stdout, verbose) {
    stdout('📋 Program Inventory', 'info');
    stdout('═'.repeat(60), 'info');
    
    for (const program of programs) {
        const meta = program.metadata;
        const status = meta.isFullscreen ? '🖥️ ' : '📄 ';
        const helpStatus = meta.hasHelp ? '❓' : '  ';
        
        stdout(`${status}${helpStatus} ${program.name.padEnd(12)} - ${meta.description}`);
        
        if (verbose) {
            if (meta.icon) stdout(`     Icon: ${meta.icon}`);
            if (meta.args.length > 0) stdout(`     Args: ${meta.args.join(', ')}`);
            if (meta.isFullscreen) stdout(`     Type: Fullscreen Application`);
            stdout('');
        }
    }
}

function testProgram(program, processor, verbose, quiet, skipTests) {
    const meta = program.metadata;
    
    // Display basic info
    if (!quiet) {
        stdout(`   📝 ${meta.description}`);
        if (meta.icon) stdout(`   🎨 Icon: ${meta.icon}`);
        if (meta.args.length > 0) stdout(`   🔧 Args: ${meta.args.join(', ')}`);
    }
    
    // Skip fullscreen programs
    if (meta.isFullscreen) {
        return { skipped: true, reason: 'Fullscreen program (would take over terminal)' };
    }
    
    // Skip testing if requested
    if (skipTests) {
        return { skipped: true, reason: 'Testing skipped by request' };
    }
    
    // Test help function if available
    if (meta.hasHelp && !quiet) {
        stdout(`   📚 Testing help output:`);
        try {
            testProgramHelp(program, processor, verbose);
        } catch (error) {
            return { error: `Help test failed: ${error.message}` };
        }
    }
    
    // Test basic execution for non-interactive programs
    if (!isInteractiveProgram(program.name)) {
        try {
            testProgramExecution(program, processor, verbose, quiet);
        } catch (error) {
            return { error: `Execution test failed: ${error.message}` };
        }
    } else if (verbose) {
        stdout(`   ⚠️  Interactive program - basic execution skipped`);
    }
    
    return { success: true };
}

function testProgramHelp(program, processor, verbose) {
    const output = [];
    const mockStdout = (text, type = 'normal') => {
        output.push({ text, type });
    };
    
    const context = {
        args: ['-h'],
        stdout: mockStdout,
        currentDir: '/',
        fileSystem: processor.fileSystem,
        resolvePath: processor.resolvePath.bind(processor),
        processor: processor
    };
    
    // Execute the program code and get the function
    const wrappedCode = `
        ${program.content}
        return ${program.name};
    `;
    
    const programFunction = new Function(wrappedCode)();
    programFunction(context);
    
    // Show help output (truncated)
    const helpLines = output.slice(0, 3); // Show first 3 lines
    for (const line of helpLines) {
        stdout(`      ${line.text}`);
    }
    if (output.length > 3) {
        stdout(`      ... (${output.length - 3} more lines)`);
    }
}

function testProgramExecution(program, processor, verbose, quiet) {
    // For non-interactive programs, test basic execution
    const testArgs = getTestArgs(program.name);
    
    if (!testArgs || testArgs.length === 0) {
        if (verbose) stdout(`   ℹ️  No safe test arguments defined`);
        return;
    }
    
    const output = [];
    const mockStdout = (text, type = 'normal') => {
        output.push({ text, type });
    };
    
    const context = {
        args: testArgs,
        stdout: mockStdout,
        currentDir: '/',
        fileSystem: processor.fileSystem,
        resolvePath: processor.resolvePath.bind(processor),
        processor: processor
    };
    
    // Execute the program
    const wrappedCode = `
        ${program.content}
        return ${program.name};
    `;
    
    const programFunction = new Function(wrappedCode)();
    programFunction(context);
    
    if (verbose && output.length > 0) {
        stdout(`   📤 Test output (${testArgs.join(' ')}):`);
        const previewLines = output.slice(0, 2);
        for (const line of previewLines) {
            stdout(`      ${line.text}`);
        }
        if (output.length > 2) {
            stdout(`      ... (${output.length - 2} more lines)`);
        }
    }
}

function isInteractiveProgram(programName) {
    // Programs that require user interaction or file arguments
    const interactive = ['nbasic', 'find', 'touch', 'mkdir', 'rm', 'cp', 'mv'];
    return interactive.includes(programName);
}

function getTestArgs(programName) {
    // Safe test arguments for each program
    const testArgs = {
        'echo': ['Hello, World!'],
        'date': [],
        'uname': ['-a'],
        'uptime': [],
        'neofetch': ['--no-ascii'],
        'puter': []
    };
    
    return testArgs[programName] || null;
}