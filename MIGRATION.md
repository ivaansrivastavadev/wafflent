# Migrating Existing Commands to the Enhanced API

This guide helps you upgrade existing Wafflent commands to use the new enhanced API for better maintainability and functionality.

## Quick Migration Steps

### 1. Add Enhanced Context
Replace the basic context destructuring with the enhanced CommandContext:

**Before:**
```javascript
function mycommand(context) {
    const { args = [], stdout, processor } = context;
}
```

**After:**
```javascript
function mycommand(context) {
    const ctx = new CommandContext(context);
    // You can still access raw context via ctx.raw if needed
}
```

### 2. Replace Help Handling
Use the automatic help handler:

**Before:**
```javascript
if (args.includes('-h') || args.includes('--help')) {
    stdout('Usage: mycommand [options]');
    stdout('Description here');
    return;
}
```

**After:**
```javascript
if (ctx.showHelpIf([
    'Usage: mycommand [options]',
    'Description here',
    '',
    'Options:',
    '  -h, --help     Show this help'
])) {
    return;
}
```

### 3. Replace Flag Checking
Use the enhanced flag checking:

**Before:**
```javascript
const verbose = args.includes('-v') || args.includes('--verbose');
const force = args.includes('-f');
```

**After:**
```javascript
const verbose = ctx.hasFlag('-v', '--verbose');
const force = ctx.hasFlag('-f');
```

### 4. Replace Parameter Handling
Use parameter filtering and validation:

**Before:**
```javascript
const files = args.filter(arg => !arg.startsWith('-'));
if (files.length === 0) {
    stdout('Error: No files specified', 'error');
    return;
}
```

**After:**
```javascript
if (!ctx.requireParams(1, 'Error: No files specified')) {
    return;
}
const files = ctx.parameters;
```

### 5. Replace Output Calls
Use the enhanced output methods:

**Before:**
```javascript
stdout('Success message', 'success');
stdout('Error message', 'error');
stdout('Regular message');
```

**After:**
```javascript
ctx.output.success('Success message');
ctx.output.error('Error message');
ctx.output.print('Regular message');
```

### 6. Replace File Operations
Use the enhanced filesystem API:

**Before:**
```javascript
if (processor.pathExists(filename)) {
    const content = processor.getFileContent(filename);
    stdout(content);
}
```

**After:**
```javascript
if (ctx.fs.exists(filename)) {
    const content = ctx.fs.readFile(filename);
    ctx.output.print(content);
}
```

## Example Migration

### Before (ls.js):
```javascript
// List files and directories
// fas fa-list
function ls(context) {
    const { args = [], stdout, processor } = context;
    
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: ls [OPTION]... [FILE]...');
        stdout('List information about the FILEs (the current directory by default).');
        stdout('  -a, --all      do not ignore entries starting with .');
        stdout('  -l             use a long listing format');
        stdout('  -h, --help     display this help and exit');
        return;
    }
    
    const showAll = args.includes('-a') || args.includes('--all');
    const longFormat = args.includes('-l');
    
    // Complex file listing logic...
}
```

### After (ls.js):
```javascript
// List files and directories
// fas fa-list
function ls(context) {
    const ctx = new CommandContext(context);
    
    if (ctx.showHelpIf([
        'Usage: ls [OPTION]... [FILE]...',
        'List information about the FILEs (the current directory by default).',
        '',
        'Options:',
        '  -a, --all      do not ignore entries starting with .',
        '  -l             use a long listing format',
        '  -h, --help     display this help and exit'
    ])) {
        return;
    }
    
    const showAll = ctx.hasFlag('-a', '--all');
    const longFormat = ctx.hasFlag('-l');
    const targetPath = ctx.parameters[0] || '.';
    
    try {
        const entries = ctx.fs.listDir(targetPath);
        const filteredEntries = showAll ? entries : entries.filter(e => !e.name.startsWith('.'));
        
        if (longFormat) {
            filteredEntries.forEach(entry => {
                const type = entry.type === 'directory' ? 'd' : '-';
                const size = entry.size.toString().padStart(8);
                const date = new Date(entry.modified).toLocaleDateString();
                ctx.output.print(`${type}${entry.permissions} ${entry.owner} ${size} ${date} ${entry.name}`);
            });
        } else {
            const names = filteredEntries.map(e => e.name);
            ctx.output.print(names.join('  '));
        }
    } catch (error) {
        ctx.output.error(`ls: ${error.message}`);
    }
}
```

## Benefits of Migration

1. **Cleaner Code**: Less boilerplate, more readable
2. **Better Error Handling**: Automatic validation and error messages
3. **Consistent API**: Same patterns across all commands
4. **Enhanced Features**: Table output, multi-line help, etc.
5. **Future-Proof**: New features added to the API automatically available

## Backward Compatibility

The enhanced API is designed to be backward compatible. Existing commands will continue to work without modification, but migrating provides access to new features and better development experience.