const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {output, playwrightModule, browserExecutable} = require('../settings.cjs');
const {chromium} = require(playwrightModule);
const Core = require('../src/core.js');
const {fixture} = require('./core.test.cjs');
const bundle = fs.readFileSync(path.join(output, '博雅学习浮窗.user.js'), 'utf8');
(async () => {
  const watchdog = setTimeout(() => { console.error('Browser test exceeded 45 seconds'); process.exit(1); }, 45000);
  const browser = await chromium.launch({executablePath: browserExecutable, headless: true});
  const context = await browser.newContext({viewport: {width: 1366, height: 1000}});
  const page = await context.newPage(), sent = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}});
    if (Core.isEndpoint(route.request().url())) {
      let parsed;
      if ((route.request().headers()['content-type'] || '').includes('multipart/form-data')) {
        const request = new Request(route.request().url(), {method: 'POST', headers: route.request().headers(), body: route.request().postDataBuffer()});
        parsed = await Core.parseBody(await request.formData());
      } else parsed = await Core.parseBody(route.request().postData() || '');
      sent.push({payload: await Core.decrypt(parsed.form), headers: route.request().headers()});
      return route.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*', 'content-type': 'application/json'}, body: '{"status":1}'});
    }
    return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eaf0ec;font:16px system-ui;color:#20342e}main{padding:50px;max-width:850px}h1{font-size:30px}video{width:100%;aspect-ratio:16/9;background:#213c32;border-radius:6px}p{line-height:1.8}</style><main><h1>课程视频 · 本地模拟页面</h1><video controls></video><p>测试页面使用模拟课程与模拟接口，不连接学习平台。</p></main>'});
  });
  await page.addInitScript({content: bundle});
  await page.goto('https://byyxt.pupedu.cn/demo/c/pc/viewer?spu_guid=90071992547409931&section_guid=90071992547409932');
  const panel = page.locator('#readoor-study-panel'), submit = panel.locator('#submit');
  await panel.waitFor(); assert.equal(await submit.isDisabled(), true);
  const heartbeat = async (transport = 'fetch', bodyType = 'form', payload = fixture()) => {
    const form = await Core.encrypt(payload);
    await page.evaluate(async ({form, endpoint, transport, bodyType}) => {
      let body = new URLSearchParams(form), contentType = 'application/x-www-form-urlencoded';
      if (bodyType === 'json') { body = JSON.stringify({...form, extra: 'retained'}); contentType = 'application/json'; }
      if (bodyType === 'multipart') { body = new FormData(); body.set('data', form.data); body.set('jfug', form.jfug); contentType = null; }
      if (transport === 'fetch') {
        const headers = {authorization: 'Bearer test-only-token'}; if (contentType) headers['content-type'] = contentType;
        const req = new Request(endpoint, {method: 'POST', headers, body}); await fetch(req);
      } else {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest(); xhr.open('POST', endpoint);
          xhr.setRequestHeader('authorization', 'Bearer test-only-token'); if (contentType) xhr.setRequestHeader('content-type', contentType);
          xhr.onload = resolve; xhr.onerror = reject; xhr.send(body);
        });
      }
    }, {form, endpoint: Core.ENDPOINT, transport, bodyType});
  };
  await heartbeat(); assert.equal(await submit.isDisabled(), false);
  console.log('Initial capture passed');
  assert.deepEqual(sent[0].payload, fixture());
  await panel.locator('#position').fill('250'); await panel.locator('#position').press('Tab');
  await panel.locator('#study').fill('88'); await panel.locator('#study').press('Tab');
  await panel.locator('#override').check(); await heartbeat('fetch', 'json');
  assert.equal(sent.at(-1).payload.lesson_data[0].position, 250); assert.equal(sent.at(-1).payload.lesson_data[0].study_time, 88);
  await heartbeat('fetch', 'multipart'); assert.equal(sent.at(-1).payload.lesson_data[0].position, 250);
  await heartbeat('xhr'); assert.equal(sent.at(-1).payload.lesson_data[0].position, 250);
  await heartbeat('xhr', 'multipart'); assert.equal(sent.at(-1).payload.lesson_data[0].position, 250);
  console.log('Transport checks passed');
  await panel.locator('#override').uncheck();
  const count = sent.length;
  await submit.click(); await page.waitForFunction(() => document.querySelector('#readoor-study-panel').shadowRoot.getElementById('status').textContent.includes('接口已接受'));
  assert.equal(sent.length, count + 1); assert.equal(sent.at(-1).payload.lesson_data[0].position, 250);
  assert.notEqual(sent.at(-1).payload.lesson_data[0].session_id, 'test-session');
  assert.equal(sent.at(-1).headers.authorization, 'Bearer test-only-token');
  await panel.locator('#end').click(); assert.equal(await panel.locator('#complete').isChecked(), true);
  await submit.click(); await page.waitForTimeout(250); assert.equal(sent.at(-1).payload.lesson_data[0].position, 1009.36);
  const last = sent.at(-1).payload; assert.equal(last.lesson_data[0][Core.doneKey(last.base_data.time_stamp)], '1');
  await panel.locator('#position').fill('500'); await panel.locator('#position').press('Tab');
  await page.screenshot({path: path.join(output, '桌面预览.png')});
  await panel.locator('#collapse').click(); assert.equal(await panel.locator('#expand').isVisible(), true);
  await panel.locator('#expand').click(); assert.equal(await panel.locator('#submit').isVisible(), true);
  await page.setViewportSize({width: 390, height: 844}); await page.waitForTimeout(100);
  const rect = await panel.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 390);
  await page.screenshot({path: path.join(output, '窄屏预览.png')});
  // XHR cancelled while its body is being decrypted must never reach the mock endpoint.
  const form = await Core.encrypt(fixture()), beforeAbort = sent.length;
  await page.evaluate(({form, endpoint}) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', endpoint); xhr.send(new URLSearchParams(form)); xhr.abort();
  }, {form, endpoint: Core.ENDPOINT});
  await page.waitForTimeout(250); assert.equal(sent.length, beforeAbort);
  // Route change clears both override and submission context.
  await panel.locator('#override').check();
  await page.evaluate(() => history.pushState({}, '', '?spu_guid=90071992547409931&section_guid=other'));
  await page.waitForTimeout(500); assert.equal(await submit.isDisabled(), true); assert.equal(await panel.locator('#override').isChecked(), false);
  const beforeWrong = sent.length; await heartbeat(); assert.equal(sent.length, beforeWrong + 1); assert.equal(await submit.isDisabled(), true);
  await panel.locator('#disable').click(); assert.equal(await panel.count(), 0);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: fetch/Request/JSON/multipart/XHR, manual submit, completion, abort, route reset, desktop/narrow layout.');
  await browser.close();
  clearTimeout(watchdog);
})().catch(error => { console.error(error); process.exitCode = 1; });
