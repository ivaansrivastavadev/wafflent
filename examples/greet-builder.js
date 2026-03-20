// Example of using the CommandBuilder fluent API
// fas fa-plus

// Load the API (this would be handled automatically in the real system)
// For now, we'll define the command using the builder pattern manually

const greet = createCommand('greet')
    .desc('Greet users with customizable messages')
    .setIcon('fas fa-hand-wave')
    .help([
        'Usage: greet [OPTIONS] [NAME]',
        'Greet users with a friendly message.',
        '',
        'Options:',
        '  -f, --formal     use formal greeting',
        '  -t, --time       include current time',
        '  -c, --color      colorize output',
        '  -h, --help       show this help message',
        '',
        'Examples:',
        '  greet Alice      # Hello, Alice!',
        '  greet -f Bob     # Good day, Bob.',
        '  greet -t         # Hello! Current time: ...'
    ])
    .action((ctx) => {
        const name = ctx.parameters[0] || 'World';
        const formal = ctx.hasFlag('-f', '--formal');
        const showTime = ctx.hasFlag('-t', '--time');
        const colorize = ctx.hasFlag('-c', '--color');
        
        let greeting;
        if (formal) {
            greeting = `Good day, ${name}.`;
        } else {
            greeting = `Hello, ${name}!`;
        }
        
        if (showTime) {
            const time = new Date().toLocaleTimeString();
            greeting += ` Current time: ${time}`;
        }
        
        if (colorize) {
            ctx.output.success(greeting);
        } else {
            ctx.output.print(greeting);
        }
    });

// For now, we need to create the function manually since the builder isn't integrated yet
function greet(context) {
    const ctx = new CommandContext(context);
    
    if (ctx.showHelpIf([
        'Usage: greet [OPTIONS] [NAME]',
        'Greet users with a friendly message.',
        '',
        'Options:',
        '  -f, --formal     use formal greeting',
        '  -t, --time       include current time',
        '  -c, --color      colorize output',
        '  -h, --help       show this help message',
        '',
        'Examples:',
        '  greet Alice      # Hello, Alice!',
        '  greet -f Bob     # Good day, Bob.',
        '  greet -t         # Hello! Current time: ...'
    ])) {
        return;
    }
    
    const name = ctx.parameters[0] || 'World';
    const formal = ctx.hasFlag('-f', '--formal');
    const showTime = ctx.hasFlag('-t', '--time');
    const colorize = ctx.hasFlag('-c', '--color');
    
    let greeting;
    if (formal) {
        greeting = `Good day, ${name}.`;
    } else {
        greeting = `Hello, ${name}!`;
    }
    
    if (showTime) {
        const time = new Date().toLocaleTimeString();
        greeting += ` Current time: ${time}`;
    }
    
    if (colorize) {
        ctx.output.success(greeting);
    } else {
        ctx.output.print(greeting);
    }
}