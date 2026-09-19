import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const baseline = process.env.BASELINE_URL || 'http://127.0.0.1:4181';
const candidate = process.env.CANDIDATE_URL || 'http://127.0.0.1:4175';
const label = process.env.EVIDENCE_LABEL || 'vignette';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const report = { observedAt: new Date().toISOString(), baseline, candidate, fixture: true, normalPlayEvidence: false, method: 'Frozen real-engine boss scenes; identical viewport and DPR. Pixel readback only for visual comparison, separate from FPS measurements.', comparisons: [], errors: [] };
try {
  for (const dpr of [1, 1.25, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: dpr });
    const pages = [];
    for (const url of [baseline, candidate]) {
      const page = await context.newPage(); pages.push(page);
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(`${url}/tests/boss-preview.html`);
      await page.waitForFunction(() => window.__BOSS_PREVIEW__?.ready);
      await page.evaluate(() => document.fonts.ready);
    }
    for (const width of [1440, 1000]) {
      const shots = [];
      for (const page of pages) {
        await page.setViewportSize({ width, height: 1080 });
        await page.waitForTimeout(100);
        shots.push(await page.locator('canvas').evaluateAll(canvases => canvases.map(c => ({ width: c.width, height: c.height, data: c.toDataURL() }))));
      }
      const differences = await pages[1].evaluate(async ([oldImages, newImages]) => {
        async function pixels(source) {
          const img = new Image(); img.src = source.data; await img.decode();
          const c = document.createElement('canvas'); c.width = source.width; c.height = source.height;
          const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, c.width, c.height).data;
        }
        const result = [];
        for (let i = 0; i < oldImages.length; i++) {
          const a = oldImages[i], b = newImages[i];
          if (a.width !== b.width || a.height !== b.height) throw new Error('Canvas backing dimensions changed');
          const aa = await pixels(a), bb = await pixels(b);
          let sum = 0, max = 0, pixelsOver4 = 0, nonOpaque = 0;
          for (let p = 0; p < aa.length; p += 4) {
            let localMax = 0;
            for (let c = 0; c < 3; c++) { const delta = Math.abs(aa[p+c] - bb[p+c]); sum += delta; max = Math.max(max, delta); localMax = Math.max(localMax, delta); }
            if (localMax > 4) pixelsOver4++;
            if (bb[p+3] !== 255) nonOpaque++;
          }
          result.push({ canvas: i, width: a.width, height: a.height, maxChannelDifference: max, meanChannelDifference: sum / (aa.length / 4 * 3), pixelsOver4, nonOpaque });
        }
        return result;
      }, shots);
      assert.equal(differences.length, 4);
      for (const diff of differences) { assert.equal(diff.nonOpaque, 0); assert(diff.meanChannelDifference < 1, JSON.stringify(diff)); assert(diff.pixelsOver4 / (diff.width * diff.height) < 0.01, JSON.stringify(diff)); }
      report.comparisons.push({ viewport: { width, height: 1080 }, dpr, differences });
      if (dpr === 1 && width === 1440) await pages[1].screenshot({ path: `evidence/${label}-boss-pattern-preview.png`, fullPage: true });
    }
    await context.close();
  }
  const gameContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.25 });
  const game = await gameContext.newPage();
  game.on('pageerror', e => report.errors.push(e.message));
  await game.goto(process.env.GAME_URL || 'http://127.0.0.1:4174');
  await game.waitForFunction(() => window.__LRG__);
  await game.evaluate(() => document.fonts.ready);
  await game.screenshot({ path: `evidence/${label}-title.png` });
  await game.getByTestId('start-normal').click();
  await game.keyboard.down('ArrowRight'); await game.waitForTimeout(300); await game.keyboard.press('Space'); await game.waitForTimeout(250); await game.keyboard.up('ArrowRight');
  const beforePause = await game.evaluate(() => window.__LRG__.getState());
  assert.equal(beforePause.player.dashCharges, 1);
  assert(beforePause.player.x > 0);
  await game.keyboard.press('Escape'); await game.waitForFunction(() => window.__LRG__.getState().phase === 'paused');
  const elapsed = await game.evaluate(() => window.__LRG__.getState().elapsed);
  report.uiChecks = [];
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 960, height: 540 }, { width: 1280, height: 720 }]) {
    await game.setViewportSize(viewport); await game.waitForTimeout(120);
    const dimensions = await game.locator('#game-canvas').evaluate(c => ({ width: c.width, height: c.height, attributes: c.getContext('2d').getContextAttributes() }));
    assert.equal(dimensions.width, Math.round(viewport.width * 1.25));
    assert.equal(dimensions.height, Math.round(viewport.height * 1.25));
    assert.equal(dimensions.attributes.alpha, false);
    assert.equal(await game.evaluate(() => window.__LRG__.getState().elapsed), elapsed);
    report.uiChecks.push({ viewport, dpr: 1.25, dimensions, pausedElapsed: elapsed });
  }
  await game.keyboard.press('Escape'); await game.waitForTimeout(350);
  await game.screenshot({ path: `evidence/${label}-playing.png` });
  await game.keyboard.press('Escape'); await game.getByTestId('return-title-pause').click();
  await game.waitForFunction(() => window.__LRG__.getState().phase === 'title');
  report.uiChecks.push({ name: 'title, movement, dash, pause, resize, resume, return-title', passed: true });
  await gameContext.close();
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.passed = false; report.failure = String(error); process.exitCode = 1; console.error(error); }
finally { fs.writeFileSync(`evidence/${label}-render-comparison.json`, JSON.stringify(report, null, 2)); await browser.close(); }
