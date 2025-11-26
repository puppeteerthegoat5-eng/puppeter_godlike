const express = require('express');
const cors = require('cors');
const { startBot } = require('./bot');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- CONFIGURATION ---
const TARGET_URLS = [
    "https://www.effectivegatecpm.com/r725te76uw?key=04f8b841f68182f53ad37684de3aa371",
    "https://www.effectivegatecpm.com/ikugmsducv?key=c88a7fa11759afeb0762e807be2a733b",
    "https://www.effectivegatecpm.com/nd95vv26?key=bdc924640082af3bd9415bb455c45377",
    "https://www.effectivegatecpm.com/vwg0n0rh?key=7c8a5936a39f21ff9056f968c5e9937c"
];

let bots = [];
let logs = [];
let isRunning = false;
let currentBatchTimeout = null;
let currentBotLimit = 2; // Default start
let currentUrlIndex = 0; // Track URL rotation across batches

function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${msg}`;
    logs.push(logEntry);
    if (logs.length > 1000) logs.shift();

    fs.appendFile(path.join(__dirname, 'bot_activity.log'), logEntry + '\n', (err) => {
        if (err) console.error('Log write error:', err);
    });
}

app.get('/api/logs', (req, res) => {
    res.json(logs);
});

// --- MEMORY MONITORING ---
function getMemoryUsageMB() {
    try {
        // Try reading Docker/Cgroup memory usage (Standard for Render/Linux Containers)
        const usage = fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8');
        return parseInt(usage) / 1024 / 1024;
    } catch (e) {
        // Fallback for Windows/Local Dev
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        return used / 1024 / 1024;
    }
}

function checkMemoryAndScale() {
    const usedMB = getMemoryUsageMB();
    // addLog(`Memory Usage: ${Math.round(usedMB)} MB`);

    if (usedMB > 500) {
        if (currentBotLimit !== 1) {
            addLog(`⚠️ High Memory (${Math.round(usedMB)}MB). Scaling down to 1 bot.`);
            currentBotLimit = 1;
        }
    } else if (usedMB < 230) {
        if (currentBotLimit !== 2) {
            addLog(`✅ Low Memory (${Math.round(usedMB)}MB). Scaling up to 2 bots.`);
            currentBotLimit = 2;
        }
    }
}

// Check memory every 5 seconds
setInterval(checkMemoryAndScale, 5000);


async function runBatchLoop(urls, botCount, proxies, isHeadless) {
    if (!isRunning) return;

    // Use the dynamic limit, but don't exceed user request if they manually started (though we are auto-starting now)
    // For auto-start, we just use currentBotLimit.
    const effectiveCount = currentBotLimit;

    addLog(`--- Starting New Batch (${effectiveCount} Bots) ---`);
    bots = [];

    const batchPromises = [];
    const proxyList = proxies ? proxies.split('\n').map(p => p.trim()).filter(p => p) : [];

    for (let i = 0; i < effectiveCount; i++) {
        if (!isRunning) break;

        const url = urls[currentUrlIndex % urls.length];
        currentUrlIndex++; // Rotate to next URL for next bot
        const proxy = proxyList.length > 0 ? proxyList[i % proxyList.length] : null;
        const botId = i + 1;

        const botPromise = startBot(botId, url, proxy, addLog, isHeadless)
            .then(() => { })
            .catch(err => {
                addLog(`Bot-${botId} Error: ${err.message}`);
            });

        batchPromises.push(botPromise);
        await new Promise(r => setTimeout(r, 500));
    }

    await Promise.all(batchPromises);

    if (isRunning) {
        addLog(`Batch finished. Waiting 5s before next batch...`);
        currentBatchTimeout = setTimeout(() => {
            runBatchLoop(urls, effectiveCount, proxies, isHeadless);
        }, 5000);
    }
}

app.post('/api/start', async (req, res) => {
    // Manual start still works, but overrides are limited by auto-scaling logic in the loop
    const { urls, botCount, proxies, headless } = req.body;

    // If user provides URLs, use them, otherwise use hardcoded
    const targetUrls = (urls && urls.length > 0) ? urls : TARGET_URLS;

    if (isRunning) return res.status(400).json({ error: 'Already running' });

    isRunning = true;
    const count = parseInt(botCount) || 2;
    const isHeadless = headless !== false;

    addLog(`Starting Loop: Initial target ${count} bots.`);
    runBatchLoop(targetUrls, count, proxies, isHeadless);

    res.json({ message: `Started loop` });
});

app.post('/api/stop', async (req, res) => {
    addLog('Stopping loop...');
    isRunning = false;
    if (currentBatchTimeout) {
        clearTimeout(currentBatchTimeout);
        currentBatchTimeout = null;
    }
    addLog('Loop stopped. Active bots will finish their session shortly.');
    res.json({ message: 'Loop stopped' });
});

app.get('/api/status', (req, res) => {
    res.json({ activeBots: isRunning ? `Running (${currentBotLimit} active)` : 'Stopped' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    addLog(`Server started on port ${PORT}`);

    // --- AUTO START ---
    addLog(`Auto-starting bots with hardcoded URLs...`);
    isRunning = true;
    runBatchLoop(TARGET_URLS, 2, null, true); // Start with 2 bots, headless
});
