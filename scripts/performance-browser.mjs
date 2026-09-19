import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';

const url = process.env.VERIFICATION_URL || 'http://127.0.0.1:4175';
const label = process.env.EVIDENCE_LABEL || 'final';
const readbackProbe = process.env.READBACK_PROBE === '1';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const report = { startedAt: new Date().toISOString(), url, browser: browser.version(), readbackProbe, host: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGiB: +(os.totalmem()/1024**3).toFixed(2) }, method: 'Sequential 60-second synthetic upper-bound load at each viewport, after other browser play runs. Real renderer, engine and HUD; fixture state mutation explicitly separate from normal play. Headless Chrome environment. Repeated getImageData is disabled in the primary FPS pass and enabled only by explicit READBACK_PROBE=1.', runs: [] };
try {
  const cdp=await browser.newBrowserCDPSession();
  try { const info=await cdp.send('SystemInfo.getInfo'); report.graphics=info.gpu; }
  catch(error) { report.graphicsUnavailable=String(error); }
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const warnings=[];page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
    await page.goto(`${url}/tests/performance.html?tier=1&seconds=60&readback=${readbackProbe?1:0}`);
    // The exposed value is a Promise, not a synchronous completion flag.
    await page.waitForFunction(() => Boolean(window.__BENCH_RESULT__));
    const result = await page.evaluate(() => window.__BENCH_RESULT__);
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.runtimeErrors, []); assert.deepEqual(errors, []);
    await page.screenshot({ path: `evidence/${label}-performance-${viewport.height}.png` });
    report.runs.push({ ...result, pageErrors: errors, consoleWarnings:warnings });
    fs.writeFileSync(`evidence/${label}-performance.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ viewport, timing: result.timing, segments: result.segments }));
    await page.close();
  }
  report.completed = true;
} catch (error) { report.completed = false; report.failure = String(error); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); fs.writeFileSync(`evidence/${label}-performance.json`, JSON.stringify(report, null, 2)); await browser.close(); }
