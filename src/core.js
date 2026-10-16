'use strict';
const Core = (() => {
  const ENDPOINT = 'https://mrr.readoor.cn/api/3.1/stat/v1/b/stat31/stat/pStatIf';
  const SECRET = '8c1ef35c1a24f94ce6422f3c4b77e19bec2aaec9c0d72251b82ccf40b22561a84c876c19d2cb9a';
  const encoder = new TextEncoder();
  let keyPromise;
  const clone = value => JSON.parse(JSON.stringify(value));
  const isEndpoint = value => {
    try { const u = new URL(value, 'https://byyxt.pupedu.cn'); return u.origin + u.pathname === ENDPOINT; }
    catch { return false; }
  };
  const toBase64 = bytes => {
    let binary = '';
    for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
    return btoa(binary);
  };
  const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const key = () => keyPromise ||= crypto.subtle.digest('SHA-256', encoder.encode(SECRET))
    .then(raw => crypto.subtle.importKey('raw', raw, {name: 'AES-CBC'}, false, ['encrypt', 'decrypt']));
  const doneKey = timestamp => btoa(String(timestamp)).slice(2, 8);
  async function encrypt(payload, fixedIv) {
    const iv = fixedIv ? new Uint8Array(fixedIv) : crypto.getRandomValues(new Uint8Array(16));
    if (iv.length !== 16) throw new Error('IV 长度必须是 16 字节');
    const encrypted = await crypto.subtle.encrypt({name: 'AES-CBC', iv}, await key(), encoder.encode(JSON.stringify(payload)));
    return {data: toBase64(encrypted), jfug: toBase64(iv)};
  }
  async function decrypt(form) {
    const iv = fromBase64(form.jfug);
    if (iv.length !== 16) throw new Error('上报 IV 格式不兼容');
    const plain = await crypto.subtle.decrypt({name: 'AES-CBC', iv}, await key(), fromBase64(form.data));
    const value = JSON.parse(new TextDecoder().decode(plain));
    if (!value?.base_data || !Array.isArray(value.lesson_data) || !value.lesson_data.length)
      throw new Error('上报结构不兼容：缺少 base_data 或 lesson_data');
    return value;
  }
  async function parseBody(body, contentType = '') {
    if (typeof Blob !== 'undefined' && body instanceof Blob) return parseBody(await body.text(), body.type || contentType);
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return parseBody(new TextDecoder().decode(body), contentType);
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      if (typeof body.get('data') !== 'string' || typeof body.get('jfug') !== 'string') throw new Error('表单缺少 data/jfug');
      return {form: {data: body.get('data'), jfug: body.get('jfug')}, replace(next) {
        const copy = new FormData();
        for (const [k, v] of body.entries()) copy.append(k, v);
        copy.set('data', next.data); copy.set('jfug', next.jfug); return copy;
      }};
    }
    if (body instanceof URLSearchParams || typeof body === 'string') {
      const text = String(body);
      if (contentType.includes('application/json') || text.trim().startsWith('{')) {
        const value = JSON.parse(text);
        if (typeof value.data !== 'string' || typeof value.jfug !== 'string') throw new Error('JSON 缺少 data/jfug');
        return {form: value, replace: next => JSON.stringify({...value, ...next})};
      }
      const params = new URLSearchParams(text);
      if (!params.get('data') || !params.get('jfug')) throw new Error('表单缺少 data/jfug');
      return {form: {data: params.get('data'), jfug: params.get('jfug')}, replace(next) {
        const copy = new URLSearchParams(params); copy.set('data', next.data); copy.set('jfug', next.jfug);
        return body instanceof URLSearchParams ? copy : copy.toString();
      }};
    }
    throw new Error('不支持的上报请求体');
  }
  function number(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (value === '' || value === null || typeof value === 'boolean') throw new Error(`${name}必须是有效数字`);
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name}必须在 ${min} 到 ${max} 之间`);
    return n;
  }
  function findLesson(payload, section) {
    const lessons = payload.lesson_data;
    const hits = section ? lessons.map((l, i) => String(l.section_guid) === String(section) ? i : -1).filter(i => i >= 0) : [];
    if (hits.length === 1) return hits[0];
    if (!section && lessons.length === 1) return 0;
    throw new Error(section ? '本次上报不属于当前章节，已保留原请求' : '无法确定当前章节，请在章节地址中打开视频');
  }
  function patch(payload, index, settings, now = Date.now()) {
    const output = clone(payload);
    const lesson = output.lesson_data[index];
    if (!lesson) throw new Error('未找到当前章节');
    const duration = number(lesson.media_theory_length, '视频总时长', 0.001);
    const position = number(settings.position, '虚拟进度', 0, duration);
    const study = Math.floor(number(settings.studyTime, '学习时长', 0, 86400));
    const sequence = Math.floor(number(settings.sequence ?? lesson.sequence_id, '上报序号', 0));
    const oldKey = doneKey(output.base_data.time_stamp);
    const nextKey = doneKey(now);
    // Changing base_data.time_stamp also changes completion keys in untouched lessons.
    for (const row of output.lesson_data) {
      if (Object.hasOwn(row, oldKey)) { const value = row[oldKey]; delete row[oldKey]; row[nextKey] = value; }
    }
    output.base_data.time_stamp = now;
    lesson.position = settings.complete ? duration : position;
    lesson.max_position = Math.max(Number(lesson.max_position) || 0, lesson.position);
    lesson.max_position = Math.min(duration, lesson.max_position);
    lesson.study_time = study;
    lesson.end_time = Math.floor(now / 1000);
    lesson.start_time = lesson.end_time - study;
    lesson.sequence_id = sequence;
    lesson[nextKey] = settings.complete ? '1' : 0;
    return output;
  }
  function responseResult(http, text) {
    let value;
    try { value = JSON.parse(text); } catch { return {success: false, message: `HTTP ${http}，响应不是 JSON，无法确认业务结果`}; }
    const success = http >= 200 && http < 300 && [1, '1', true].includes(value?.status);
    return {success, message: success ? '接口已接受，请到课程页面核对记录' : `提交未确认（HTTP ${http}，status=${String(value?.status ?? '缺失').slice(0, 20)}）`};
  }
  return {ENDPOINT, clone, isEndpoint, encrypt, decrypt, doneKey, parseBody, number, findLesson, patch, responseResult};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
