# Contributing to Wafflent

Brief guide for developers who want to understand or extend wafflent.

## Overview

Wafflent is a browser-based Unix-like terminal system. The core functionality is implemented in JavaScript and runs entirely in the browser.

## Project Structure

```
wafflent/
├── app/
│   ├── index.html         # Terminal interface
│   └── processor.js       # Command processor engine
├── lib/
│   └── command-api.js     # Command development API
├── pkgs/coreutils/        # Core Unix commands
├── documentation/         # User documentation
└── examples/             # Example implementations
```

## Development Setup

1. **Local web server required** (browser security restrictions):
   ```bash
   python3 -m http.server 8000
   # or
   npx serve .
   ```

2. **Open**: `http://localhost:8000/app/`

3. **Test**: Use `help` command to verify system works

## Command Development

### Basic Command Structure

Commands are JavaScript functions stored in `/pkgs/coreutils/`:

```javascript
// Command description
// fas fa-icon-name
function commandName(context) {
    const { args = [], stdout, processor } = context;
    
    // Handle help
    if (args.includes('--help') || args.includes('-h')) {
        stdout('Usage: commandName [options]');
        stdout('Description of what this command does.');
        return;
    }
    
    // Command logic
    const result = doSomething(args);
    stdout(`Result: ${result}`);
}
```

### Context Object

Commands receive a context object with:
- `args`: Array of command arguments
- `stdout`: Function to output text (`stdout(text, type)`)
- `processor`: Reference to main processor
- `currentDir`: Current working directory  
- `fileSystem`: Access to virtual filesystem

### Enhanced API (Optional)

For more complex commands, use the enhanced CommandContext API:

```javascript
function modernCommand(context) {
    const ctx = new CommandContext(context);
    
    if (ctx.showHelpIf(['Usage: command [options]', 'Description here.'])) {
        return;
    }
    
    const verbose = ctx.hasFlag('-v', '--verbose');
    if (!ctx.requireParams(1, 'Error: Please specify a file')) {
        return;
    }
    
    ctx.output.success('Operation completed');
}
```

## File System

Wafflent implements a virtual filesystem:

- **Files stored in**: Browser localStorage
- **Structure**: Unix-like (`/usr`, `/pkgs`, `/sys`, `/tmp`)
- **Persistence**: Automatic via localStorage
- **Limitations**: ~5-10MB total storage

### Protected Directories
- `/sys/` - System files (read-only)
- `/pkgs/` - System executables (read-only)
- `/usr/` - User home directory (writable)
- `/tmp/` - Temporary files (writable)

## Testing

Test commands in the terminal:

```bash
# Test basic functionality
help                    # Should list your new command
commandName --help      # Test help output
commandName args        # Test with arguments
```

## Code Guidelines

### Minimal Requirements
1. **Include help**: Always handle `--help` and `-h` flags
2. **Error handling**: Provide clear error messages
3. **Follow conventions**: Use standard Unix-style options when possible
4. **Comment first lines**: Description and icon for help system

### File Naming
- **Filename**: `commandname.js` (lowercase, no hyphens)
- **Function**: `commandname` (must match filename without .js)
- **Location**: `/pkgs/coreutils/`

## Architecture Notes

### Core Components

**`processor.js`**: 
- Command execution engine
- Filesystem management
- Command loading and discovery

**`command-api.js`**: 
- Enhanced API for command development
- Utilities for common operations
- Backward compatible with simple commands

**Virtual Filesystem**:
- Map-based storage in memory
- localStorage persistence
- Unix-like path resolution

### Browser Limitations

**No Support For**:
- Background processes
- Pipes (`|`) or complex redirection
- Network requests (CORS restrictions)
- Binary file operations
- Process management

**Available Features**:
- Synchronous file operations
- Command chaining with `&&`
- Pattern matching (limited)
- Standard Unix command conventions

## Quick Start for New Commands

1. **Create file**: `pkgs/coreutils/mycommand.js`
2. **Basic template**:
   ```javascript
   // Brief description of command
   // fas fa-icon-name
   function mycommand(context) {
       const { args = [], stdout } = context;
       
       if (args.includes('--help') || args.includes('-h')) {
           stdout('Usage: mycommand [options]');
           return;
       }
       
       stdout('Hello from mycommand!');
   }
   ```
3. **Test**: Refresh browser, type `help`, then `mycommand`
4. **Iterate**: Add functionality, test, repeat

## Submitting Changes

1. Test thoroughly in browser
2. Verify command appears in `help`
3. Ensure `--help` works correctly
4. Check that command follows Unix conventions
5. Submit pull request with clear description

---

This covers the essentials for contributing to wafflent. For detailed user information, see the [main documentation](documentation/main.md).