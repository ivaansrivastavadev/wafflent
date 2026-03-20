# Wafflent - Web-based Unix Terminal

A powerful Unix-like terminal system that runs entirely in your web browser, featuring the "wash" (wafflent shell) command system and comprehensive coreutils.

## Quick Start

1. Open `app/index.html` in a web browser
2. You'll be greeted with a terminal at `/usr` (your home directory)
3. Type `help` to see all available commands
4. Start using Unix commands immediately!

## Getting Started

### First Steps
```bash
# See where you are
pwd

# List files and directories
ls

# Get system information
neofetch

# See all available commands
help

# Get help for any specific command
ls --help
```

## The Wash Command System

Wafflent uses "wash" (Wafflent Shell), a bash-like command system that provides:

- **Unix-style command syntax**: Standard flags (`-h`, `--help`) and arguments
- **Persistent filesystem**: Files and directories persist across browser sessions  
- **Modern filesystem layout**: `/usr` as home, `/pkgs` as system executables
- **Real-time execution**: Commands execute instantly in your browser

### Filesystem Structure
```
/
├── usr/              # Home directory (start here)
├── pkgs/             # System executables and packages
│   └── coreutils/    # Core Unix commands
├── sys/              # System files
├── tmp/              # Temporary files
└── lib/              # Library files
```

## Core Commands (Coreutils)

### File and Directory Operations

#### `ls` - List Directory Contents
```bash
ls                    # List current directory
ls -l                 # Long format with details
ls -a                 # Show hidden files
ls -la                # Long format with hidden files
ls /pkgs              # List specific directory
```

#### `cd` - Change Directory
```bash
cd                    # Go to home directory (/usr)
cd /pkgs              # Go to packages directory
cd ..                 # Go up one directory
cd coreutils          # Go to subdirectory
```

#### `pwd` - Print Working Directory
```bash
pwd                   # Show current directory path
```

#### `mkdir` - Create Directories
```bash
mkdir mydir           # Create single directory
mkdir -p path/to/dir  # Create directory tree
mkdir dir1 dir2 dir3  # Create multiple directories
```

#### `touch` - Create Files
```bash
touch file.txt        # Create empty file
touch file1 file2     # Create multiple files
```

### File Content Operations

#### `cat` - Display File Contents
```bash
cat file.txt          # Display entire file
cat file1 file2       # Display multiple files
```

#### `head` - Display Beginning of File
```bash
head file.txt         # Show first 10 lines
head -n 5 file.txt    # Show first 5 lines
```

#### `tail` - Display End of File
```bash
tail file.txt         # Show last 10 lines
tail -n 5 file.txt    # Show last 5 lines
```

#### `echo` - Display Text
```bash
echo "Hello World"    # Print text
echo $USER            # Print variables (limited support)
```

### File Management

#### `cp` - Copy Files and Directories
```bash
cp file.txt backup.txt        # Copy file
cp -r directory copy/         # Copy directory recursively
cp file1 file2 /tmp/         # Copy multiple files to directory
```

#### `mv` - Move and Rename
```bash
mv old.txt new.txt           # Rename file
mv file.txt /tmp/            # Move file to directory
mv directory /tmp/           # Move entire directory
```

#### `rm` - Remove Files and Directories
```bash
rm file.txt                  # Remove file
rm -r directory/             # Remove directory recursively
rm -f file.txt              # Force remove (no confirmation)
rm -rf directory/            # Force remove directory
```

### Search and Find

#### `find` - Search for Files and Directories
```bash
find . -name "*.txt"         # Find all .txt files
find /usr -type f            # Find all files in /usr
find . -type d               # Find all directories
```

### System Information

#### `neofetch` - System Information Display
```bash
neofetch                     # Show system information with ASCII art
```

#### `uname` - System Name
```bash
uname                        # Show system name
uname -a                     # Show all system information
```

#### `whoami` - Current User
```bash
whoami                       # Show current username
```

#### `date` - Date and Time
```bash
date                         # Show current date and time
date -I                      # ISO format date
```

#### `uptime` - System Uptime
```bash
uptime                       # Show how long system has been running
```

### Utilities

#### `clear` - Clear Terminal
```bash
clear                        # Clear terminal screen
```

#### `exit` - Exit Terminal
```bash
exit                         # Close terminal session
```

#### `journal` - System Log Viewer
```bash
journal                      # View system logs
journal -f                   # Follow log in real-time
```

#### `log` - Application Logging
```bash
log                          # Show application logs
log --storage                # Show storage information
```

## Command Syntax

All commands follow standard Unix conventions:

### Help System
```bash
command --help               # Show detailed help for any command
command -h                   # Short help flag
help                        # List all available commands
```

### Common Flags
- `-h, --help`: Show help information
- `-v, --verbose`: Enable verbose output (where applicable)
- `-r, --recursive`: Recursive operation (for cp, rm, etc.)
- `-f, --force`: Force operation without confirmation
- `-a, --all`: Include hidden/all items
- `-l`: Long format (for ls)

### Paths
- `/`: Root directory
- `/usr`: Home directory (default starting location)
- `/pkgs/coreutils`: Location of core commands
- `./`: Current directory
- `../`: Parent directory
- `~`: Home directory (alias for `/usr`)

## Advanced Usage

### Combining Commands
While wash doesn't support pipes (|) like traditional shells, you can chain commands:

```bash
# Create a directory and navigate to it
mkdir projects && cd projects

# Create multiple files and list them
touch file1.txt file2.txt && ls -l
```

### Working with Files
```bash
# Create a directory structure for a project
mkdir -p project/src project/docs project/tests

# Create some files
touch project/README.md project/src/main.js project/docs/guide.md

# Navigate and explore
cd project && ls -la && pwd
```

### System Exploration
```bash
# Explore the system
ls /                         # See root directory structure
ls /pkgs/coreutils          # See available commands
cat /sys/core/init.js       # View system initialization
neofetch                    # Get system overview
```

## Data Persistence

Wafflent uses your browser's localStorage to persist:
- Files and directories you create
- Current working directory
- Command history
- System logs

Your data persists between browser sessions on the same domain.

## Troubleshooting

### Common Issues

**Command not found**
```bash
help                         # Check if command exists
ls /pkgs/coreutils          # See available commands
```

**Permission denied**
- System directories (`/sys`, `/pkgs`) are protected
- Cannot remove or modify core system files

**File not found**
```bash
pwd                         # Check current directory
ls                          # See what files exist
find . -name "filename"     # Search for file
```

## Examples and Tutorials

### Basic File Operations
```bash
# Create a project structure
mkdir my-project
cd my-project
mkdir src docs tests
touch src/main.js docs/README.md tests/test.js

# View what you created
ls -la
find . -type f

# Make a backup
cd ..
cp -r my-project my-project-backup
ls -l
```

### System Exploration
```bash
# Learn about your system
whoami                      # Your username
pwd                         # Where you are
neofetch                    # System information
date                        # Current date/time
uptime                      # How long system is running

# Explore directories
ls /                        # Root directory
ls /pkgs                    # Packages
ls /pkgs/coreutils          # Available commands
cat /sys/extra/ascii.txt    # System ASCII art
```

### File Content Management
```bash
# Create and edit content
echo "Hello World" > greeting.txt
cat greeting.txt

# Work with multiple files
echo "Line 1" > file1.txt
echo "Line 2" >> file1.txt
echo "Another file" > file2.txt
cat file1.txt file2.txt

# View file parts
head -n 1 file1.txt         # First line
tail -n 1 file1.txt         # Last line
```

---

**Note**: This is a browser-based terminal emulator. Some advanced Unix features (pipes, background processes, etc.) are not available, but all core file operations and utilities work as expected.

For technical details about extending wafflent with custom commands, see [CONTRIBUTING.md](CONTRIBUTING.md).