const puppeteer = require('puppeteer');

async function startBot(id, url, proxy, onLog, headless = true) {
    const log = (msg) => {
        if (onLog) onLog(`[Bot-${id}] ${msg}`);
        else console.log(`[Bot-${id}] ${msg}`);
    };

    log(`Starting... Target: ${url}, Proxy: ${proxy || 'None'}, Headless: ${headless}`);

    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
    ];

    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: headless ? "new" : false,
            defaultViewport: { width: 1920, height: 1080 },
            args: args
        });

        const page = await browser.newPage();

        // Set a realistic user agent
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        });

        // Optimize: Block heavy resources
        await page.setRequestInterception(true);
        page.on('request', async (req) => {
            if (req.isInterceptResolutionHandled()) return;

            const resourceType = req.resourceType();
            if (['image', 'media', 'font'].includes(resourceType)) {
                try { await req.abort(); } catch (e) { }
            } else if (resourceType === 'stylesheet') {
                try { await req.continue(); } catch (e) { }
            } else {
                try { await req.continue(); } catch (e) { }
            }
        });

        log(`Navigating to ${url}...`);

        let navigationSuccess = false;
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            navigationSuccess = true;
            log(`Page loaded.`);
        } catch (navError) {
            log(`Navigation FAILED: ${navError.message}.`);
            if (headless) {
                try {
                    const errorScreenshotPath = `error_bot_${id}_${Date.now()}.png`;
                    await page.screenshot({ path: errorScreenshotPath });
                } catch (e) { /* ignore */ }
            }
        }

        if (!navigationSuccess) {
            await browser.close();
            return;
        }

        // --- Single Session Actions ---

        // 0. Initial Wait
        log(`Waiting 3s before actions...`);
        await new Promise(r => setTimeout(r, 3000));

        // 1. Random Scroll
        try {
            const scrollAmount = Math.floor(Math.random() * 1000) + 200;
            await page.evaluate((y) => { window.scrollBy(0, y); }, scrollAmount);
            log(`Scrolled ${scrollAmount}px.`);
        } catch (e) { log(`Scroll error: ${e.message}`); }

        await new Promise(r => setTimeout(r, 2000));

        // 2. Click Random Coordinate
        try {
            const viewport = page.viewport();
            const x = Math.floor(Math.random() * viewport.width);
            const y = Math.floor(Math.random() * viewport.height);

            log(`Clicking random coordinate (${x}, ${y})...`);

            await page.mouse.move(x, y);
            await page.mouse.click(x, y);

            await new Promise(r => setTimeout(r, 2000));

        } catch (e) { log(`Click error: ${e.message}`); }

        // 3. Wait before closing
        const waitTime = Math.floor(Math.random() * 5000) + 5000;
        log(`Waiting ${waitTime}ms before finishing session...`);
        await new Promise(r => setTimeout(r, waitTime));

        log(`Session finished. Closing.`);
        await browser.close();

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        if (browser) await browser.close();
    }
}

module.exports = { startBot };
