const fs = require('node:fs');
const path = require('node:path');
const Core = require('./src/core.js');
const {output} = require('./settings.cjs');
(async () => {
  const now = Date.now();
  const payload = {base_data: {app_id: 123, company_id: 456, time_stamp: now, class_id: 'demo-class', train_id: 'demo-training', project_id: 'demo-project', platform_code: 'pweb', item_id: 'demo-course', spu_type: 302},
    lesson_data: [{section_guid: 'demo-section', task_guid: 'demo-task', courseware_type: 104, section_type: 403, media_theory_length: 1009.36,
      position: 128, max_position: 128, study_time: 40, session_id: 'demo-session', sequence_id: 7, start_time: Math.floor(now / 1000) - 40, end_time: Math.floor(now / 1000), [Core.doneKey(now)]: 0}]};
  const form = await Core.encrypt(payload);
  const core = fs.readFileSync(path.join(__dirname, 'src/core.js'), 'utf8').replace(/^if \(typeof module.*$/m, '');
  const bundle = fs.readFileSync(path.join(output, '博雅学习浮窗.user.js'), 'utf8');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'"><title>学习浮窗 · 本地演示</title>
<style>body{margin:0;background:#eaf0ec;color:#20342e;font:16px/1.7 system-ui,sans-serif}main{padding:40px;max-width:850px}h1{font-size:28px;margin-bottom:12px}button{font:inherit;padding:8px 14px;border:1px solid #9fb5a8;border-radius:6px;background:#fff;cursor:pointer}.screen{aspect-ratio:16/9;background:#213c32;color:#fff;display:grid;place-content:center;border-radius:8px}pre{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#08775d}@media(max-width:700px){main{padding:24px}}</style></head><body><main><h1>学习浮窗 · 本地演示</h1><p>此页面使用模拟视频信息与模拟接口。所有按钮都不会向学习平台发送请求。</p><div class="screen">模拟视频 · 时长 16:49</div><p><button id="heartbeat">模拟网站再次上报</button></p><pre id="received">等待操作</pre><p>正式使用：将旁边的 .user.js 文件安装到 Tampermonkey，打开博雅网站并播放视频。</p></main>
<script>${core}
window.fetch = async function(input, init) {
 const request = new Request(input, init);
 if (!Core.isEndpoint(request.url)) throw new Error('演示页禁止网络请求');
 if (request.signal.aborted) throw new DOMException('已取消','AbortError');
 const parsed = await Core.parseBody(await request.text(), request.headers.get('content-type') || '');
 const data = await Core.decrypt(parsed.form), lesson = data.lesson_data[0];
 document.getElementById('received').textContent = '模拟接口收到：\\n' + JSON.stringify({虚拟位置:lesson.position,最远位置:lesson.max_position,单次学习时长:lesson.study_time,完成标记:lesson[Core.doneKey(data.base_data.time_stamp)],上报序号:lesson.sequence_id},null,2);
 return new Response(JSON.stringify({status:1}), {status:200,headers:{'content-type':'application/json'}});
};
</script><script>${bundle}</script><script>
const demoForm = ${JSON.stringify(form)};
async function heartbeat() { await fetch(Core.ENDPOINT, {method:'POST',headers:{authorization:'Bearer demo-only-token','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(demoForm)}); }
document.getElementById('heartbeat').addEventListener('click', heartbeat); heartbeat();
</script></body></html>`;
  fs.writeFileSync(path.join(output, '本地演示.html'), html);
  console.log('Built offline preview');
})();
