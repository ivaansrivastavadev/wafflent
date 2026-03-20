// Display system information with ASCII art
// fas fa-desktop
function neofetch(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: neofetch [OPTION]...');
        stdout('A command-line system information tool written in JavaScript');
        stdout('');
        stdout('  --no-ascii               disable ASCII art');
        stdout('  -h, --help               show this help message and exit');
        return;
    }
    
    const noAscii = args.includes('--no-ascii');
    
    // Get system information
    const systemInfo = getSystemInfo(processor);
    
    if (!noAscii) {
        // Show ASCII art with system info side by side
        const asciiArt = `    ╭────────────────╮
    │   WAFFLENT     │
    │                │
    │  ┌─┬─┬─┬─┬─┐   │
    │  ├─┼─┼─┼─┼─┤   │
    │  ├─┼─┼─┼─┼─┤   │
    │  └─┴─┴─┴─┴─┘   │
    │                │
    │ JavaScript OS  │
    ╰────────────────╯`;
        
        const asciiLines = asciiArt.split('\n');
        const infoLines = [
            `${systemInfo.user}@${systemInfo.hostname}`,
            '-'.repeat((systemInfo.user + '@' + systemInfo.hostname).length),
            `OS: ${systemInfo.os}`,
            `Host: ${systemInfo.host}`,
            `Kernel: ${systemInfo.kernel}`,
            `Uptime: ${systemInfo.uptime}`,
            `Packages: ${systemInfo.packages}`,
            `Shell: ${systemInfo.shell}`,
            `Resolution: ${systemInfo.resolution}`,
            `Terminal: ${systemInfo.terminal}`,
            `CPU: ${systemInfo.cpu}`,
            `Memory: ${systemInfo.memory}`
        ];
        
        const maxLines = Math.max(asciiLines.length, infoLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const asciiLine = i < asciiLines.length ? asciiLines[i] : '';
            const infoLine = i < infoLines.length ? infoLines[i] : '';
            const paddedAscii = asciiLine.padEnd(22);
            stdout(`${paddedAscii} ${infoLine}`);
        }
    } else {
        // No ASCII mode - just show info
        stdout(`${systemInfo.user}@${systemInfo.hostname}`);
        stdout('-'.repeat((systemInfo.user + '@' + systemInfo.hostname).length));
        stdout(`OS: ${systemInfo.os}`);
        stdout(`Host: ${systemInfo.host}`);
        stdout(`Kernel: ${systemInfo.kernel}`);
        stdout(`Uptime: ${systemInfo.uptime}`);
        stdout(`Packages: ${systemInfo.packages}`);
        stdout(`Shell: ${systemInfo.shell}`);
        stdout(`Resolution: ${systemInfo.resolution}`);
        stdout(`Terminal: ${systemInfo.terminal}`);
        stdout(`CPU: ${systemInfo.cpu}`);
        stdout(`Memory: ${systemInfo.memory}`);
    }
    
    function getSystemInfo(processor) {
        // Get uptime
        const installTime = localStorage.getItem('wafflent_install_time');
        let uptime = '0 mins';
        if (installTime) {
            const uptimeMs = Date.now() - parseInt(installTime);
            const minutes = Math.floor(uptimeMs / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) {
                uptime = `${days} day${days !== 1 ? 's' : ''}, ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
            } else if (hours > 0) {
                uptime = `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes % 60} min${minutes % 60 !== 1 ? 's' : ''}`;
            } else {
                uptime = `${minutes} min${minutes !== 1 ? 's' : ''}`;
            }
        }
        
        // Count packages (programs in /pkgs/coreutils)
        // First try the new wafflent_data structure
        let programs = 0;
        try {
            const wafflentData = JSON.parse(localStorage.getItem('wafflent_data') || '{}');
            programs = Object.keys(wafflentData).filter(path => 
                path.startsWith('/pkgs/coreutils/') && path.endsWith('.js')
            ).length;
        } catch (e) {
            // Fallback to legacy method
            programs = Object.keys(localStorage).filter(key => 
                key.startsWith('wafflent_file_/pkgs/coreutils/') && key.endsWith('.js')
            ).length;
        }
        
        // Get memory usage (estimate based on localStorage)
        let memoryUsage = 0;
        for (let key in localStorage) {
            const item = localStorage.getItem(key);
            if (item) {
                memoryUsage += item.length;
            }
        }
        const memoryMB = Math.round(memoryUsage / 1024);
        
        return {
            user: processor.currentUser || 'user',
            hostname: 'wafflent-terminal',
            os: 'Wafflent 1.0.0',
            host: 'Web Browser',
            kernel: 'JavaScript v' + (navigator.userAgent.match(/Chrome\/([0-9.]+)/) || ['', 'Unknown'])[1],
            uptime: uptime,
            packages: `${programs} (coreutils)`,
            shell: 'wafflent-sh 1.0.0',
            resolution: `${screen.width}x${screen.height}`,
            terminal: 'Wafflent Terminal',
            cpu: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : 'Unknown',
            memory: `${memoryMB}KB / ∞`
        };
    }
}