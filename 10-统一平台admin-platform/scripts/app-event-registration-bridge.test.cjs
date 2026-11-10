const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { File } = require('node:buffer');
const ts = require('typescript');

function load(file, resolve = require) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  new Function('require', 'module', 'exports', 'File', outputText)(resolve, module, module.exports, File);
  return module.exports;
}

function fixture() {
  const calls = [];
  const music = load('src/lib/server/event-music-upload.ts');
  async function receive(request, { params }) {
    const form = request.method === 'POST' ? await music.normalizedMusicForm(request, {
      musicOptional: !new URL(request.url).pathname.endsWith('/music'),
    }) : undefined;
    calls.push({
      id: (await params).id,
      auth: request.headers.get('authorization'),
      query: new URL(request.url).search,
      body: form ? Object.fromEntries(form) : request.method === 'PUT' ? await request.json() : undefined,
    });
    return Response.json({ success: true });
  }
  const routes = load('src/lib/server/app-route-map.ts', name => {
    assert.match(name, /mini\/(events\/\[id\]\/register|member\/event-registrations\/\[id\](\/music)?)\/route$/);
    return { GET: receive, PUT: receive, POST: receive };
  });
  class AppError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  const handler = load('src/app/api/app/v1/[...path]/route.ts', name => {
    if (name.endsWith('app-route-map')) return routes;
    if (name.endsWith('event-music-upload')) return music;
    if (name.endsWith('app-platform')) return { appPlatform: () => 'ios' };
    if (name.endsWith('mini/_helpers')) return { withDb: fn => fn({}), memberToken: member => 'member-' + member.id };
    if (name.endsWith('app-session')) return {
      AppError, ensureAppSchema() {},
      authenticateApp(_, token) {
        if (token !== 'fixture-token') throw new AppError('请先登录', 401);
        return { member_id: 42, member: { phone: '13800000000' } };
      },
    };
    return {};
  });
  function call(path, method, data, auth = true) {
    const headers = auth ? { authorization: 'Bearer fixture-token' } : {};
    if (data && !(data instanceof FormData)) headers['content-type'] = 'application/json';
    const request = new Request('https://app.test/api/app/v1/' + path + '?member_id=999', {
      method, headers, body: data instanceof FormData || data === undefined ? data : JSON.stringify(data),
    });
    return handler[method](request, { params: Promise.resolve({ path: path.split('/') }) });
  }
  return { call, calls };
}

test('native registration forwards an international contact without requiring audio', async () => {
  const { call, calls } = fixture();
  const response = await call('events/7/register', 'POST', {
    groupId: '3', name: '选手', phone: '91234567', countryCode: '+852',
    performanceTitle: '曲目', member_id: 999,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(calls, [{
    id: '7', auth: 'Bearer member-42', query: '',
    body: { groupId: '3', name: '选手', phone: '91234567', countryCode: '+852', performanceTitle: '曲目' },
  }]);
});

test('registration management requires authentication and forwards the server identity', async () => {
  const { call, calls } = fixture();
  const path = 'member/event-registrations/12';
  assert.equal((await call(path, 'GET', undefined, false)).status, 401);
  assert.equal((await call(path + '/music', 'POST', new FormData(), false)).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await call(path, 'PUT', { name: '选手', memberId: 999 })).status, 200);
  assert.deepEqual(calls[0], { id: '12', auth: 'Bearer member-42', query: '', body: { name: '选手' } });
  assert.equal((await call(path + '/music', 'POST', new FormData())).status, 400);
  const form = new FormData();
  form.set('performanceTitle', '曲目');
  form.set('musicFile', new Blob(['fixture']), 'demo.mp3');
  assert.equal((await call(path + '/music', 'POST', form)).status, 200);
  assert.equal(calls[1].id, '12');
  assert.equal(calls[1].auth, 'Bearer member-42');
  assert.equal(calls[1].body.musicFile.name, 'demo.mp3');
});
