const {output, playwrightModule, browserExecutable} = require('../settings.cjs');
const {chromium} = require(playwrightModule);
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: browserExecutable});
  try {
    const page = await browser.newPage();
    const requests = [], errors = [];
    page.on('request', req => requests.push(req.url())); page.on('pageerror', err => errors.push(err.message));
    await page.goto(pathToFileURL(path.join(output, '本地演示.html')).href);
    const panel = page.locator('#readoor-study-panel'); await panel.locator('#submit').waitFor();
    await page.waitForFunction(() => !document.querySelector('#readoor-study-panel').shadowRoot.getElementById('submit').disabled);
    await panel.locator('#position').fill('200'); await panel.locator('#position').press('Tab');
    await panel.locator('#timer').click();
    await page.waitForFunction(() => Number(document.querySelector('#readoor-study-panel').shadowRoot.getElementById('position').value) > 200.5);
    await panel.locator('#timer').click();
    const stopped = Number(await panel.locator('#position').inputValue());
    await page.waitForTimeout(500); assert.equal(Number(await panel.locator('#position').inputValue()), stopped);
    await panel.locator('#submit').click();
    await page.waitForFunction(() => document.getElementById('received').textContent.includes('模拟接口收到'));
    const beforeDrag = await panel.boundingBox();
    await page.mouse.move(beforeDrag.x + 45, beforeDrag.y + 25); await page.mouse.down();
    await page.mouse.move(beforeDrag.x - 100, beforeDrag.y + 15, {steps: 5}); await page.mouse.up();
    const afterDrag = await panel.boundingBox(); assert.ok(afterDrag.x < beforeDrag.x - 100);
    assert.equal(requests.filter(url => /^https?:/.test(url)).length, 0); assert.deepEqual(errors, []);
    console.log('Offline demo passed: capture, virtual growth/pause, manual submission, dragging, zero network requests.');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
