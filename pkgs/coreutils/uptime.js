// Show system uptime and load
// fas fa-chart-line
function uptime(context) {
    const { args = [], stdout } = context;
    
    // Check for help flags
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: uptime [OPTION]');
        stdout('Tell how long the system has been running');
        stdout('');
        stdout('Options:');
        stdout('  -h, --help    display this help and exit');
        stdout('');
        stdout('Shows the current time, how long the system has been running,');
        stdout('the number of users currently on the system, and the system');
        stdout('load averages for the past 1, 5, and 15 minutes.');
        stdout('');
        stdout('Example:');
        stdout('  uptime        show system uptime and load');
        return;
    }
    
    // Calculate uptime since system installation
    const installTime = localStorage.getItem('wafflent_install_time');
    const currentTime = Date.now();
    
    if (installTime) {
        const uptimeMs = currentTime - parseInt(installTime);
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const uptimeMin = Math.floor(uptimeSec / 60);
        const uptimeHour = Math.floor(uptimeMin / 60);
        const uptimeDay = Math.floor(uptimeHour / 24);
        
        const hours = uptimeHour % 24;
        const minutes = uptimeMin % 60;
        
        let uptimeStr = '';
        if (uptimeDay > 0) uptimeStr += `${uptimeDay} day${uptimeDay > 1 ? 's' : ''}, `;
        if (hours > 0) uptimeStr += `${hours}:${minutes.toString().padStart(2, '0')}`;
        else uptimeStr += `${minutes} min`;
        
        const now = new Date().toLocaleTimeString();
        stdout(`${now} up ${uptimeStr}, 1 user, load average: 0.00, 0.00, 0.00`);
    } else {
        // First boot
        localStorage.setItem('wafflent_install_time', currentTime.toString());
        stdout(`${new Date().toLocaleTimeString()} up 0 min, 1 user, load average: 0.00, 0.00, 0.00`);
    }
}