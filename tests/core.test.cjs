const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash, createCipheriv, createDecipheriv} = require('node:crypto');
const Core = require('../src/core.js');
const secret = '8c1ef35c1a24f94ce6422f3c4b77e19bec2aaec9c0d72251b82ccf40b22561a84c876c19d2cb9a';
const key = createHash('sha256').update(secret, 'utf8').digest();
const fixture = () => ({base_data: {time_stamp: 1792100000000, app_id: 123, company_id: 456, item_id: '90071992547409931'},
  lesson_data: [{media_theory_length: 1009.36, max_position: 30, position: 30, study_time: 40, start_time: 100, end_time: 140,
    session_id: 'test-session', sequence_id: 7, section_guid: '90071992547409932', courseware_type: 104, section_type: 403,
    task_guid: '90071992547409933', [Core.doneKey(1792100000000)]: 0, extra: {preserve: '中文'}}]});
test('WebCrypto encryption matches AES-256-CBC + SHA256 + PKCS7 independently', async () => {
  const input = fixture(), iv = Buffer.from(Array.from({length: 16}, (_, i) => i));
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const expected = Buffer.concat([cipher.update(JSON.stringify(input), 'utf8'), cipher.final()]).toString('base64');
  const encrypted = await Core.encrypt(input, iv);
  assert.equal(encrypted.data, expected); assert.equal(encrypted.jfug, iv.toString('base64'));
  assert.deepEqual(await Core.decrypt(encrypted), input);
});
test('roundtrip with random IVs and an independent decoder', async () => {
  const a = await Core.encrypt(fixture()), b = await Core.encrypt(fixture()); assert.notEqual(a.jfug, b.jfug);
  const decoder = createDecipheriv('aes-256-cbc', key, Buffer.from(a.jfug, 'base64'));
  assert.deepEqual(JSON.parse(Buffer.concat([decoder.update(Buffer.from(a.data, 'base64')), decoder.final()])), fixture());
});
test('precise endpoint match excludes other origins and paths', () => {
  assert.equal(Core.isEndpoint(Core.ENDPOINT + '?v=1'), true);
  for (const url of [Core.ENDPOINT + '/other', Core.ENDPOINT.replace('mrr.readoor.cn', 'evil.example'), 'bad url']) assert.equal(Core.isEndpoint(url), false);
});
test('patch changes current lesson only, updates dynamic keys, preserves identifiers', () => {
  const original = fixture(), old = Core.doneKey(original.base_data.time_stamp), now = 1892100000000;
  original.lesson_data.push({...original.lesson_data[0], section_guid: 'other', [old]: '1'});
  const result = Core.patch(original, 0, {position: 5, studyTime: 99.8, sequence: 8, complete: false}, now);
  assert.equal(original.lesson_data[0].position, 30); assert.equal(result.lesson_data[0].position, 5);
  assert.equal(result.lesson_data[0].max_position, 30); assert.equal(result.lesson_data[0].study_time, 99);
  assert.equal(result.lesson_data[0].end_time - result.lesson_data[0].start_time, 99);
  assert.equal(result.lesson_data[0].sequence_id, 8); assert.equal(result.base_data.item_id, original.base_data.item_id);
  assert.equal(result.lesson_data[0].task_guid, original.lesson_data[0].task_guid);
  assert.deepEqual(result.lesson_data[0].extra, {preserve: '中文'});
  assert.equal(result.lesson_data[1].position, 30); assert.equal(result.lesson_data[1][Core.doneKey(now)], '1');
  if (old !== Core.doneKey(now)) assert.equal(Object.hasOwn(result.lesson_data[0], old), false);
});
test('complete forces end position and string completion marker', () => {
  const result = Core.patch(fixture(), 0, {position: 0, studyTime: 40, complete: true}, 1792100000000);
  assert.equal(result.lesson_data[0].position, 1009.36); assert.equal(result.lesson_data[0].max_position, 1009.36);
  assert.equal(result.lesson_data[0][Core.doneKey(1792100000000)], '1');
});
test('reject invalid or non-finite settings', () => {
  for (const settings of [{position: -1, studyTime: 40}, {position: 1010, studyTime: 40}, {position: NaN, studyTime: 40},
    {position: 1, studyTime: Infinity}, {position: 1, studyTime: ''}, {position: 1, studyTime: 86401}])
    assert.throws(() => Core.patch(fixture(), 0, settings));
});
test('only unambiguous selected lesson may be modified', () => {
  const input = fixture(); assert.equal(Core.findLesson(input, input.lesson_data[0].section_guid), 0);
  assert.throws(() => Core.findLesson(input, 'missing'));
  input.lesson_data.push({...input.lesson_data[0]}); assert.throws(() => Core.findLesson(input, null));
  assert.throws(() => Core.findLesson(input, input.lesson_data[0].section_guid));
});
test('parse and replace urlencoded text and URLSearchParams while retaining extras', async () => {
  for (const body of ['data=YWJj&jfug=ZGVm&extra=hello%20world', new URLSearchParams({data: 'YWJj', jfug: 'ZGVm', extra: 'hello world'})]) {
    const parsed = await Core.parseBody(body); const next = new URLSearchParams(parsed.replace({data: 'new+/', jfug: 'iv=='}));
    assert.equal(next.get('extra'), 'hello world'); assert.equal(next.get('data'), 'new+/'); assert.equal(next.get('jfug'), 'iv==');
  }
});
test('parse JSON, FormData, Blob and typed-array bodies', async () => {
  const json = JSON.stringify({data: 'old', jfug: 'iv', extra: 123});
  for (const body of [json, new Blob([json], {type: 'application/json'}), new TextEncoder().encode(json)]) {
    const parsed = await Core.parseBody(body, 'application/json'); assert.equal(JSON.parse(parsed.replace({data: 'new', jfug: 'newiv'})).extra, 123);
  }
  const form = new FormData(); form.set('data', 'old'); form.set('jfug', 'iv'); form.set('extra', 'preserved');
  const parsed = await Core.parseBody(form), updated = parsed.replace({data: 'new', jfug: 'newiv'});
  assert.equal(updated.get('extra'), 'preserved'); assert.equal(form.get('data'), 'old');
});
test('bad encryption and bodies fail closed', async () => {
  await assert.rejects(Core.decrypt({data: 'abc', jfug: 'bad'})); await assert.rejects(Core.parseBody('unrelated=value'));
  await assert.rejects(Core.encrypt(fixture(), new Uint8Array(8)));
});
test('HTTP success alone is not business success', () => {
  assert.equal(Core.responseResult(200, '{"status":1}').success, true);
  for (const [http, text] of [[200, '{"status":0}'], [500, '{"status":1}'], [200, '<html>login</html>'], [200, '{"code":0}']])
    assert.equal(Core.responseResult(http, text).success, false);
});
module.exports = {fixture};
