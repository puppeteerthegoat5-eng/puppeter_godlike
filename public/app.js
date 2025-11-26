const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const logsDiv = document.getElementById('logs');
const activeCountSpan = document.getElementById('activeCount');

let logInterval;

function updateLogs() {
    fetch('/api/logs')
        .then(res => res.json())
        .then(data => {
            logsDiv.innerHTML = data.map(log => `<div class="log-entry">${log}</div>`).join('');
            logsDiv.scrollTop = logsDiv.scrollHeight;
        });

    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            activeCountSpan.textContent = data.activeBots;
            if (data.activeBots === 'Running') {
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        });
}

startBtn.addEventListener('click', async () => {
    const urlsText = document.getElementById('urls').value;
    const botCount = document.getElementById('botCount').value;
    const proxies = document.getElementById('proxies').value;
    const headless = document.getElementById('headless').checked;

    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
        alert('Please enter at least one URL');
        return;
    }

    startBtn.disabled = true;

    try {
        const res = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, botCount, proxies, headless })
        });
        const data = await res.json();
        if (data.error) alert(data.error);
    } catch (e) {
        alert('Error starting bots');
        startBtn.disabled = false;
    }
});

stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    try {
        await fetch('/api/stop', { method: 'POST' });
    } catch (e) {
        alert('Error stopping bots');
    }
});

// Poll for logs every second
setInterval(updateLogs, 1000);
updateLogs();
