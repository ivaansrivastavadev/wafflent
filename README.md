# Wafflent

A comprehensive Unix-like terminal system that runs in a web browser using JavaScript.

## Features

- **Full Terminal Experience**: Complete command-line interface with bash-like functionality
- **Unix Command Suite**: 14+ core utilities including `ls`, `cat`, `mkdir`, `cp`, `mv`, `rm`, `find`, `grep`, and more
- **Persistent Filesystem**: Files and directories persist across sessions using localStorage
- **Modern Interface**: Clean terminal UI with syntax highlighting and auto-completion
- **Extensible**: Easy to add new commands and functionality

## Quick Start

1. Open `app/index.html` in a web browser
2. Start using Unix commands immediately
3. Type `help` to see available commands
4. Use `<command> --help` for detailed command usage

## Architecture

```
wafflent/
├── app/
│   ├── index.html      # Main terminal interface
│   └── processor.js    # Core terminal processor
├── bin/
│   ├── coreutils/      # Unix command implementations
│   └── tests/          # Testing utilities
└── sys/
    └── core/           # System initialization
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ls` | List directory contents | `ls -la` |
| `cat` | Display file contents | `cat file.txt` |
| `mkdir` | Create directories | `mkdir -p path/to/dir` |
| `touch` | Create/update files | `touch newfile.txt` |
| `cp` | Copy files/directories | `cp -r src/ dest/` |
| `mv` | Move/rename files | `mv old.txt new.txt` |
| `rm` | Remove files/directories | `rm -rf directory/` |
| `find` | Search for files | `find . -name "*.js"` |
| `neofetch` | System information | `neofetch` |
| `date` | Show current date/time | `date -I` |
| `uptime` | Show system uptime | `uptime` |
| And more... | Type `help` for full list | |

## Development

All commands are implemented as JavaScript modules in `/bin/coreutils/`. Each command follows the pattern:

```javascript
function commandName(context) {
    const { args = [], stdout, processor } = context;
    // Command implementation
}
```

The terminal uses a persistent filesystem stored in localStorage with a unified data structure for optimal performance.

## License

Open source project for educational and development purposes.