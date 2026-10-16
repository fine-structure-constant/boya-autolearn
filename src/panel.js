function createPanel() {
  const host = document.createElement('div'); host.id = 'readoor-study-panel';
  host.style.cssText = 'position:fixed;right:20px;top:90px;z-index:2147483647;width:340px;max-width:calc(100vw - 24px);color-scheme:light;';
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.5;color:#20342e;color-scheme:light}
    *{box-sizing:border-box}::selection{background:#bde9da;color:#173e31}
    .panel{background:#fff;border-radius:14px;box-shadow:0 12px 48px #132f332e;overflow:hidden;max-height:calc(100dvh - 32px);display:flex;flex-direction:column}
    header{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid #e0e8e3;cursor:move;touch-action:none;flex-shrink:0}
    h2{font-size:17px;font-weight:650;margin:0}button,input,select{font:inherit;color:inherit;accent-color:#08775d;caret-color:#08775d}
    button{cursor:pointer;border:1px solid #cbd8d0;border-radius:7px;background:#fff;min-height:36px;padding:6px 12px;font-weight:550;transition:background 150ms ease-out}
    button:hover{background:#eef5f1}button:active{background:#e0eee6}button:disabled{opacity:.5;cursor:default}
    :focus-visible{outline:3px solid #1d8971;outline-offset:3px}.quiet{font-size:12px;color:#4f665c;border:0;padding:4px 6px;min-height:30px}
    main{padding:16px 18px 12px;overflow:auto;scrollbar-color:#a5b8ad #f4f7f5;scrollbar-width:thin}
    .status{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#4f665c;margin-bottom:15px}.dot{width:7px;height:7px;background:#788980;border-radius:50%;flex-shrink:0;margin-top:5px}.dot.ready{background:#08775d}
    .meta{display:flex;justify-content:space-between;font-size:12px;color:#4f665c;margin:6px 0}.num{font-variant-numeric:tabular-nums}
    .section{overflow-wrap:anywhere;font-size:11px;color:#597065;margin:0 0 12px}
    .progress-head{display:flex;justify-content:space-between;align-items:center;margin-top:17px;margin-bottom:6px;font-weight:600}.percent{color:#08775d;font-size:20px;font-variant-numeric:tabular-nums}
    input[type=range]{width:100%;height:24px;margin:0;cursor:pointer}input[type=number],select{border:1px solid #cbd8d0;border-radius:6px;background:#fff;min-height:34px;padding:5px 8px;min-width:0}
    .field{display:grid;grid-template-columns:1fr 108px;gap:12px;align-items:center;margin-top:12px}.field label{font-size:12px;color:#4f665c}.field input{width:100%}
    .row{display:flex;gap:8px;align-items:center;margin-top:10px}.row>*{flex:1}.row select{max-width:100px}.row button{font-size:12px}
    .check{display:flex;gap:8px;align-items:flex-start;margin-top:13px;font-size:12px;cursor:pointer}.check input{margin:3px 0 0;width:15px;height:15px;flex-shrink:0}
    .hint{font-size:11px;color:#597065;margin:5px 0 12px;line-height:1.6}.primary{width:100%;background:#08775d;color:#fff;border-color:#08775d;margin-top:13px;min-height:40px}.primary:hover{background:#075f4b}.primary:active{background:#064e3e}
    .divider{border:0;border-top:1px solid #e0e8e3;margin:16px 0 12px}details{font-size:11px;color:#4f665c}summary{cursor:pointer;min-height:28px}ol{padding:0;list-style:none;margin:5px 0}li{margin:8px 0;overflow-wrap:anywhere}time{color:#597065;margin-right:7px;font-variant-numeric:tabular-nums}
    footer{padding:8px 18px;display:flex;align-items:center;justify-content:space-between;background:#f4f7f5;font-size:10px;color:#597065}.mini{display:none;width:100%;background:#fff;border-radius:12px;box-shadow:0 6px 24px #132f332e;color:#20342e}
    :host(.collapsed){width:142px!important}.collapsed .panel{display:none}.collapsed .mini{display:block}
    @media(max-width:480px){header{padding:12px 16px}main{padding:12px 16px}.hint{margin-bottom:8px}.field{margin-top:9px}}
    @media(prefers-reduced-motion:reduce){button{transition:none}}
  </style>
  <div class="wrap"><section class="panel" aria-label="学习控制浮窗"><header><h2>学习控制</h2><button class="quiet" id="collapse" aria-label="收起学习控制面板">收起</button></header>
  <main><div class="status"><span class="dot" id="dot"></span><span id="status" role="status" aria-live="polite">等待视频首次上报</span></div>
  <p class="section" id="section">播放视频后自动识别当前章节</p>
  <div class="meta"><span>实际播放 <span id="playing"></span></span><span class="num" id="actual">00:00 / 00:00</span></div>
  <div class="progress-head"><label for="progress">虚拟进度</label><span class="percent" id="percent">0%</span></div>
  <input id="progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="调整虚拟进度百分比">
  <div class="meta"><span>仅改变上报设置</span><span class="num" id="virtual">00:00 / 00:00</span></div>
  <div class="field"><label for="position">虚拟位置（秒）</label><input id="position" type="number" min="0" step="0.1" value="0"></div>
  <div class="field"><label for="study">单次学习时长（秒）</label><input id="study" type="number" min="0" max="86400" step="1" value="40"></div>
  <div class="row"><button id="sync">跟随实际进度</button><button id="end">设为完整进度</button></div>
  <div class="row"><button id="timer" aria-pressed="false">开始虚拟增长</button><select id="rate" aria-label="虚拟增长速度"><option value="1">1 倍增长</option><option value="2">2 倍增长</option><option value="5">5 倍增长</option><option value="10">10 倍增长</option><option value="30">30 倍增长</option></select></div>
  <p class="hint">虚拟增长同时增加位置和单次学习时长，不改变视频播放速度；后台节流时不补算停顿。</p>
  <label class="check"><input id="complete" type="checkbox">提交时标记当前章节完成</label>
  <button class="primary" id="submit" disabled>提交当前设置</button>
  <p class="hint">等待首次上报后可提交。单次学习时长沿用原脚本的 study_time，不表示平台累计时长。</p>
  <hr class="divider"><label class="check"><input id="override" type="checkbox">改写网站后续上报</label>
  <p class="hint">开启后，每次捕获当前章节上报都会应用以上设置。切换章节自动关闭。</p>
  <details><summary>最近反馈</summary><ol id="logs"></ol></details></main>
  <footer><span>设置仅保留在当前页面</span><button id="disable" class="quiet">停用</button></footer></section>
  <button class="mini" id="expand" aria-label="展开学习控制面板">展开学习控制</button></div>`;
  const $ = id => root.getElementById(id);
  let runtime, latest = {}, dragging, disposed = false;
  function append() { if (!disposed && !host.isConnected) (document.fullscreenElement || document.body || document.documentElement)?.append(host); }
  const format = value => {
    const seconds = Math.max(0, Math.floor(value || 0)), h = Math.floor(seconds / 3600);
    return (h ? `${h}:` : '') + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  };
  function update(state) {
    latest = state; append();
    const percent = state.duration ? state.position / state.duration * 100 : 0;
    const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
    text('status', state.status); $('dot').classList.toggle('ready', state.ready);
    text('section', state.section ? `章节 ${state.section}` : '播放视频后自动识别当前章节');
    text('playing', state.playing ? '· 播放中' : '· 未播放');
    text('actual', `${format(state.actual)} / ${format(state.duration)}`);
    text('virtual', `${format(state.position)} / ${format(state.duration)}`);
    text('percent', `${percent.toFixed(1)}%`);
    if (root.activeElement !== $('progress')) $('progress').value = percent;
    if (root.activeElement !== $('position')) $('position').value = state.position.toFixed(1);
    if (root.activeElement !== $('study')) $('study').value = Math.floor(state.studyTime);
    $('position').max = state.duration;
    for (const id of ['progress', 'position', 'sync', 'end', 'timer', 'complete']) $(id).disabled = state.duration <= 0;
    $('submit').disabled = !state.ready || state.busy;
    $('override').disabled = !state.ready;
    $('complete').checked = state.complete; $('override').checked = state.override;
    text('submit', state.busy ? '正在提交…' : '提交当前设置');
    text('timer', state.running ? '暂停虚拟增长' : '开始虚拟增长'); $('timer').setAttribute('aria-pressed', String(state.running));
    if ($('logs').dataset.latest !== state.logs[0]?.time + state.logs[0]?.message) {
      $('logs').replaceChildren(...state.logs.map(entry => {
        const li = document.createElement('li'), time = document.createElement('time'); time.textContent = entry.time;
        li.append(time, document.createTextNode(entry.message)); return li;
      }));
      $('logs').dataset.latest = state.logs[0]?.time + state.logs[0]?.message;
    }
  }
  runtime = createRuntime(update);
  $('progress').addEventListener('input', e => runtime.set('position', Number(e.target.value) / 100 * latest.duration));
  $('position').addEventListener('change', e => runtime.set('position', e.target.value));
  $('study').addEventListener('change', e => runtime.set('studyTime', e.target.value));
  $('rate').addEventListener('change', e => runtime.set('rate', e.target.value));
  $('complete').addEventListener('change', e => runtime.set('complete', e.target.checked));
  $('override').addEventListener('change', e => runtime.set('override', e.target.checked));
  $('sync').addEventListener('click', () => runtime.sync()); $('end').addEventListener('click', () => runtime.end());
  $('timer').addEventListener('click', () => runtime.set('running', !latest.running));
  $('submit').addEventListener('click', () => runtime.submit());
  const collapsed = value => { host.classList.toggle('collapsed', value); root.querySelector('.wrap').classList.toggle('collapsed', value); clamp(); };
  $('collapse').addEventListener('click', () => collapsed(true)); $('expand').addEventListener('click', () => collapsed(false));
  function clamp() {
    const rect = host.getBoundingClientRect();
    host.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12))}px`;
    host.style.top = `${Math.max(12, Math.min(rect.top, Math.max(12, innerHeight - rect.height - 12)))}px`;
    host.style.right = 'auto';
  }
  const header = root.querySelector('header');
  header.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.button !== 0) return;
    const rect = host.getBoundingClientRect(); dragging = {x: e.clientX - rect.left, y: e.clientY - rect.top};
    header.setPointerCapture(e.pointerId);
  });
  header.addEventListener('pointermove', e => {
    if (!dragging) return;
    host.style.left = `${e.clientX - dragging.x}px`; host.style.top = `${e.clientY - dragging.y}px`; host.style.right = 'auto'; clamp();
  });
  header.addEventListener('pointerup', () => dragging = null);
  header.addEventListener('pointercancel', () => dragging = null);
  const fullscreen = () => { (document.fullscreenElement || document.body)?.append(host); clamp(); };
  window.addEventListener('resize', clamp); document.addEventListener('fullscreenchange', fullscreen);
  function dispose() {
    disposed = true; runtime.dispose(); host.remove();
    window.removeEventListener('resize', clamp); document.removeEventListener('fullscreenchange', fullscreen);
  }
  $('disable').addEventListener('click', dispose);
  append(); runtime.refresh();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { append(); clamp(); }, {once: true});
  else clamp();
  return {dispose};
}
