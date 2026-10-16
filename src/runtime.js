function createRuntime(onUpdate) {
  const nativeFetch = window.fetch;
  const proto = window.XMLHttpRequest.prototype;
  const nativeOpen = proto.open, nativeSend = proto.send, nativeHeader = proto.setRequestHeader, nativeAbort = proto.abort;
  const requests = new WeakMap();
  const sequences = new Map();
  let context = null, manualSession = crypto.randomUUID(), manualSequence = 0, route = routeKey();
  let revision = 0, disposed = false, busy = false, queue = Promise.resolve(), timerController = null;
  const state = {position: 0, studyTime: 40, complete: false, override: false, running: false,
    rate: 1, duration: 0, actual: 0, playing: false, ready: false, section: '', status: '等待视频首次上报', logs: []};
  function routeKey() {
    const url = new URL(location.href);
    return [url.pathname, url.searchParams.get('spu_guid') || '', url.searchParams.get('section_guid') || ''].join('|');
  }
  const sectionFromUrl = () => new URL(location.href).searchParams.get('section_guid');
  const notify = () => { if (!disposed) onUpdate({...state, busy, logs: [...state.logs]}); };
  function log(message) {
    state.status = message;
    state.logs.unshift({time: new Date().toLocaleTimeString('zh-CN', {hour12: false}), message});
    state.logs.length = Math.min(state.logs.length, 6); notify();
  }
  function checkRoute() {
    if (routeKey() === route) return false;
    route = routeKey(); revision++; context = null; sequences.clear();
    manualSession = crypto.randomUUID(); manualSequence = 0;
    timerController?.abort(); timerController = null; busy = false;
    Object.assign(state, {position: 0, studyTime: 40, complete: false, override: false, running: false,
      duration: 0, actual: 0, playing: false, ready: false, section: '', logs: []});
    log('已切换章节，请播放视频并等待首次上报'); return true;
  }
  const serialize = fn => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  function observe(payload, meta) {
    const index = Core.findLesson(payload, sectionFromUrl());
    const lesson = payload.lesson_data[index];
    const identity = `${payload.base_data.item_id}|${lesson.section_guid}`;
    if (context && context.identity !== identity) {
      revision++; sequences.clear(); manualSession = crypto.randomUUID(); manualSequence = 0;
      Object.assign(state, {position: 0, studyTime: 40, complete: false, override: false, running: false});
    }
    const first = !context || context.identity !== identity;
    context = {payload, index, identity, meta, route, captured: Date.now()};
    const sequenceKey = `${identity}|${lesson.session_id}`;
    sequences.set(sequenceKey, Math.max(sequences.get(sequenceKey) ?? -1, Number(lesson.sequence_id) || 0));
    state.duration = Core.number(lesson.media_theory_length, '视频总时长', 0.001);
    state.section = String(lesson.section_guid);
    state.ready = true;
    if (first) {
      state.position = Math.max(0, Math.min(state.duration, Number(lesson.position) || 0));
      log('已识别当前章节，可以调整并提交');
    }
    notify(); return {index, sequenceKey};
  }
  async function transform(body, meta, capturedRevision) {
    const parsed = await Core.parseBody(body, meta.headers.get('content-type') || '');
    const payload = await Core.decrypt(parsed.form);
    checkRoute();
    if (disposed || capturedRevision !== revision) return {body, changed: false};
    const {index, sequenceKey} = observe(payload, meta);
    if (!state.override) return {body, changed: false};
    const settings = {...state, sequence: (sequences.get(sequenceKey) || 0) + 1};
    const patched = Core.patch(payload, index, settings);
    const form = await Core.encrypt(patched);
    checkRoute();
    if (disposed || capturedRevision !== revision || !state.override) return {body, changed: false};
    sequences.set(sequenceKey, settings.sequence);
    return {body: parsed.replace(form), changed: true};
  }
  function report(http, text, expectedRevision, prefix) {
    if (disposed || expectedRevision !== revision) return;
    const result = Core.responseResult(http, text);
    log(`${prefix}：${result.message}`);
  }
  async function hookedFetch(input, init) {
    let url;
    try { url = input instanceof Request ? input.url : String(input); } catch { return nativeFetch.call(this, input, init); }
    if (!Core.isEndpoint(url)) return nativeFetch.call(this, input, init);
    checkRoute(); const capturedRevision = revision;
    let request;
    try { request = new Request(input, init); } catch { return nativeFetch.call(this, input, init); }
    if (request.method !== 'POST') return nativeFetch.call(this, request);
    const meta = {url: request.url, headers: new Headers(request.headers), credentials: request.credentials};
    let transformed;
    try {
      transformed = await serialize(async () => {
        const copy = request.clone();
        const body = (request.headers.get('content-type') || '').includes('multipart/form-data') ? await copy.formData() : await copy.text();
        return transform(body, meta, capturedRevision);
      });
    } catch {
      log('上报解析失败，已保留原请求；请检查脚本与平台版本');
      return nativeFetch.call(this, request);
    }
    const nextHeaders = new Headers(request.headers);
    if (transformed.body instanceof FormData) nextHeaders.delete('content-type');
    const response = transformed.changed
      ? await nativeFetch.call(this, new Request(request, {body: transformed.body, headers: nextHeaders}))
      : await nativeFetch.call(this, request);
    if (transformed.changed) response.clone().text().then(text => report(response.status, text, capturedRevision, '改写上报')).catch(() => log('无法读取改写上报的返回结果'));
    return response;
  }
  function hookedOpen(method, url, async = true, ...rest) {
    const result = nativeOpen.call(this, method, url, async, ...rest);
    requests.set(this, {method: String(method).toUpperCase(), url: new URL(String(url), location.href).href,
      async: async !== false, headers: new Headers(), cancelled: false, pending: false});
    return result;
  }
  function hookedHeader(name, value) {
    const result = nativeHeader.call(this, name, value);
    requests.get(this)?.headers.append(name, value); return result;
  }
  function hookedAbort() {
    const meta = requests.get(this); if (meta) meta.cancelled = true;
    return nativeAbort.call(this);
  }
  function hookedSend(body) {
    const meta = requests.get(this);
    if (!meta || !Core.isEndpoint(meta.url) || meta.method !== 'POST' || !meta.async) return nativeSend.call(this, body);
    if (meta.pending) throw new DOMException('请求已发送', 'InvalidStateError');
    checkRoute(); const capturedRevision = revision; meta.pending = true;
    const xhr = this;
    const transport = {...meta, headers: new Headers(meta.headers), credentials: xhr.withCredentials ? 'include' : 'same-origin'};
    const canSend = () => requests.get(xhr) === meta && !meta.cancelled && xhr.readyState === 1;
    // The browser owns all XHR events; only the asynchronous body preparation is intercepted.
    serialize(() => transform(body, transport, capturedRevision)).then(result => {
      if (!canSend()) return;
      if (result.changed) xhr.addEventListener('loadend', () => {
        if (xhr.status === 0) { if (capturedRevision === revision) log('改写上报网络失败或已取消'); return; }
        let text = '';
        try { text = xhr.responseType === 'json' ? JSON.stringify(xhr.response) : xhr.responseText; } catch {}
        report(xhr.status, text, capturedRevision, '改写上报');
      }, {once: true});
      try { nativeSend.call(xhr, result.body); } catch { log('上报发送失败，请刷新页面重试'); }
    }).catch(() => {
      if (!canSend()) return;
      log('上报解析失败，已保留原请求；请检查脚本与平台版本');
      try { nativeSend.call(xhr, body); } catch { log('原始上报发送失败，请刷新页面重试'); }
    });
    return undefined;
  }
  window.fetch = hookedFetch;
  proto.open = hookedOpen; proto.send = hookedSend; proto.setRequestHeader = hookedHeader; proto.abort = hookedAbort;
  async function submit(complete = state.complete) {
    checkRoute();
    if (busy) return;
    if (!context || context.route !== route) { log('尚未捕获当前章节上报，请先播放视频'); return; }
    if (Date.now() - context.captured > 10 * 60 * 1000) { log('上报模板已过期，请继续播放并等待一次新上报'); return; }
    if (!context.meta.headers.get('authorization')) { log('本次上报未携带授权头，暂不能手动提交；可尝试改写后续上报'); return; }
    const capturedRevision = revision, capturedContext = context;
    const settings = {...state, complete};
    busy = true; timerController = new AbortController();
    const controller = timerController;
    const timeout = setTimeout(() => controller.abort(), 20000);
    log('正在提交当前章节…');
    try {
      const payload = Core.patch(capturedContext.payload, capturedContext.index, {...settings, sequence: ++manualSequence});
      // Keep manual requests in their own session so the site's sequence does not collide.
      payload.lesson_data = [payload.lesson_data[capturedContext.index]];
      payload.lesson_data[0].session_id = manualSession;
      const form = await Core.encrypt(payload);
      checkRoute(); if (capturedRevision !== revision || disposed) return;
      const headers = new Headers(capturedContext.meta.headers);
      headers.delete('content-length'); headers.set('content-type', 'application/x-www-form-urlencoded');
      const response = await nativeFetch.call(window, capturedContext.meta.url, {method: 'POST', headers,
        body: new URLSearchParams(form), credentials: capturedContext.meta.credentials, signal: controller.signal});
      report(response.status, await response.text(), capturedRevision, '手动提交');
    } catch (error) {
      if (capturedRevision === revision && !disposed) log(error.name === 'AbortError' ? '提交超时或已取消；请核对平台记录后再操作' : '提交失败，请检查网络或重新登录；未自动重试');
    } finally {
      clearTimeout(timeout);
      if (capturedRevision === revision) { busy = false; timerController = null; notify(); }
    }
  }
  let lastTick = performance.now();
  const tick = setInterval(() => {
    checkRoute();
    const now = performance.now(), elapsed = Math.min((now - lastTick) / 1000, 2); lastTick = now;
    const videos = Array.from(document.querySelectorAll('video'));
    const video = videos.find(v => !v.paused && !v.ended) || videos.find(v => v.duration > 0);
    state.actual = video?.currentTime || 0; state.playing = !!video && !video.paused && !video.ended;
    if (!context && video && Number.isFinite(video.duration)) state.duration = video.duration;
    if (state.running && state.duration > 0) {
      state.position = Math.min(state.duration, state.position + elapsed * state.rate);
      state.studyTime = Math.min(86400, state.studyTime + elapsed * state.rate);
      if (state.position >= state.duration) state.running = false;
    }
    notify();
  }, 400);
  function set(name, value) {
    try {
      if (['override', 'running', 'complete'].includes(name)) state[name] = !!value;
      else if (name === 'position') { state.position = Core.number(value, '虚拟进度', 0, state.duration); if (state.position < state.duration) state.complete = false; }
      else if (name === 'studyTime') state.studyTime = Core.number(value, '学习时长', 0, 86400);
      else if (name === 'rate') state.rate = Core.number(value, '增长速度', 0.1, 60);
      if (name === 'complete' && state.complete) { state.position = state.duration; state.running = false; }
      if (name === 'running' && state.running) state.complete = false;
      if (name === 'override') log(state.override ? '后续上报改写已开启，仅作用于当前章节' : '后续上报改写已关闭');
      notify(); return true;
    } catch (error) { log(error.message); return false; }
  }
  function dispose() {
    disposed = true; revision++; clearInterval(tick); timerController?.abort(); context = null; sequences.clear();
    if (window.fetch === hookedFetch) window.fetch = nativeFetch;
    if (proto.open === hookedOpen) proto.open = nativeOpen;
    if (proto.send === hookedSend) proto.send = nativeSend;
    if (proto.setRequestHeader === hookedHeader) proto.setRequestHeader = nativeHeader;
    if (proto.abort === hookedAbort) proto.abort = nativeAbort;
  }
  return {set, submit, dispose, sync() { state.position = Math.min(state.duration, state.actual); state.complete = false; notify(); },
    end() { state.position = state.duration; state.running = false; state.complete = true; notify(); },
    refresh: notify};
}
