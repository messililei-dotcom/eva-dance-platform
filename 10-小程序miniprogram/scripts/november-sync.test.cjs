const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function pageAt(name, api, hooks = {}) {
  let page;
  const storage = { token: 'account-a', memberId: 7 };
  const actions = [];
  const wx = {
    getStorageSync: key => storage[key], setStorageSync: (key, value) => { storage[key] = value; },
    setNavigationBarTitle: () => {}, pageScrollTo: args => actions.push(args.selector),
    navigateTo: args => actions.push(args.url), showToast: () => {},
    ...hooks
  };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../pages/${name}/${name}.js`, 'utf8'), {
    Page: value => { page = value; },
    getApp: () => ({ globalData: {} }),
    require: key => key.endsWith('/api') ? api : key.endsWith('/video-feature')
      ? { withVideoFeature: value => value, navigateTo: wx.navigateTo }
      : require(key.replace('../../shared/', '../shared/')),
    wx
  });
  page.setData = next => Object.assign(page.data, next);
  return { page, storage, actions };
}

const profileApi = overrides => ({
  getMemberProfile: async () => ({ member: { id: 7, phone: '13800001234' }, stats: { offline_course_count: 3 } }),
  getAuthorizedSeries: async () => [1, 2, 3, 4, 5].map(series_id => ({ id: 99, series_id, series_name: '已购买课' })),
  getSeriesList: async () => { throw Error('图册加载失败'); },
  getRecentCourses: async () => [], getPayments: async () => [], getCertificates: async () => [],
  getEventRegistrations: async () => [],
  ...overrides
});

test('valid server rights remain usable without the public catalogue; list expands and enters canonical series', async () => {
  const { page, actions } = pageAt('profile', profileApi());
  await page.loadProfile();
  assert.equal(page.data.maskedPhone, '138****1234');
  assert.equal(page.data.counts.offline, 3);
  assert.equal(page.data.counts.courses, 5);
  assert.equal(page.data.previewCourses.length, 4);
  assert.equal(page.data.previewCourses[0].id, 1);
  page.toggleCourseList();
  assert.equal(page.data.previewCourses.length, 5);
  page.openProfileCourse({ currentTarget: { dataset: { id: 99 } } });
  page.openProfileCourse({ currentTarget: { dataset: { id: 5 } } });
  assert.deepEqual(actions, ['/pages/player/player?seriesId=5']);
});

test('failed rights lookup replaces old entitlements with a retry state', async () => {
  const api = profileApi();
  const { page } = pageAt('profile', api);
  await page.loadProfile();
  api.getAuthorizedSeries = async () => { throw Error('network'); };
  await page.loadProfile();
  assert.equal(page.data.previewCourses.length, 0);
  assert.equal(page.data.counts.courses, '—');
  assert.match(page.data.coursesError, /重试/);
});

test('learning records stay private and a late response from the old account is ignored', async () => {
  let resolve;
  const { page, storage } = pageAt('learning-records', {
    getAllNotes: () => new Promise(done => { resolve = done; })
  });
  page.onLoad({ kind: 'notes' });
  const pending = page.onShow();
  storage.token = 'account-b';
  storage.memberId = 8;
  resolve([{ id: 1, video_name: 'PRIVATE', content: 'PRIVATE NOTE' }]);
  await pending;
  assert.equal(page.data.rows.length, 0);
  assert.match(page.data.error, /登录状态/);
  assert.equal(page.onShareAppMessage().path, '/pages/profile/profile');
  assert.doesNotMatch(JSON.stringify(page.onShareAppMessage()), /PRIVATE|account-a/);
});

test('growth page reads server experience, and a guest does not request private records', async () => {
  let calls = 0;
  const { page, storage } = pageAt('learning-records', {
    getMemberGrowth: async () => {
      calls++;
      return { growth: { level_display: 'Lv. 2', experience_total: 325, level_progress_percent: 65 }, ledger: [{ id: 1, points_delta: -5 }] };
    }
  });
  page.onLoad({ kind: 'growth' });
  await page.onShow();
  assert.equal(page.data.growth.points, 325);
  assert.equal(page.data.growth.progress, 65);
  assert.equal(page.data.rows[0].points, '-5');
  page.onHide();
  assert.equal(page.data.growth, null);
  delete storage.token;
  await page.onShow();
  assert.equal(calls, 1);
  assert.equal(page.data.loginRequired, true);
});

test('event programme title is shared by details and music, and sharing omits the private registration ID', async () => {
  const requests = [], uploads = [];
  const { page } = pageAt('event-music', {
    request: async (url, options) => {
      if (options?.method === 'PUT') {
        requests.push(options.data);
        return options.data;
      }
      return url.endsWith('/music') ? { canEdit: true, fileName: 'previous.mp3' }
        : { performanceTitle: '原节目', fee: 999, playerId: 'secret-id' };
    },
    replaceEventMusic: async (...args) => {
      uploads.push(args);
      return { fileName: 'new.mp3', performanceTitle: args[2].performanceTitle };
    }
  });
  await page.onLoad({ id: 'secret-id' });
  page.onDetailsInput({ currentTarget: { dataset: { field: 'performanceTitle' } }, detail: { value: '新节目' } });
  await page.saveDetails();
  assert.equal(requests[0].performanceTitle, '新节目');
  assert.equal(requests[0].fee, undefined);
  assert.equal(uploads.length, 0);
  page.setData({ filePath: 'temp.mp3', fileName: 'new.mp3' });
  await page.save();
  assert.equal(uploads[0][2].performanceTitle, '新节目');
  assert.equal(page.onShareAppMessage().path, '/pages/events/events');
  assert.doesNotMatch(JSON.stringify(page.onShareTimeline()), /secret-id/);
});

test('editing a judge score retains its criterion key and submits the entered decimal', async () => {
  let submitted;
  const { page } = pageAt('event-judge', {
    request: async (_url, options) => { submitted = options.data.scores; }
  });
  page.load = async () => {};
  page.setData({
    id: '1', groupId: '2', playerId: '3',
    criteria: [{ key: 'total', name: '总评', maxScore: 10, value: '' }]
  });
  page.onScore({ currentTarget: { dataset: { index: 0 } }, detail: { value: '8.75' } });
  assert.equal(page.data.criteria[0].key, 'total');
  assert.equal(page.data.criteria[0].maxScore, 10);
  assert.equal(page.data.total, '8.75');
  await page.submit();
  assert.deepEqual(Object.entries(submitted), [['total', 8.75]]);
});

test('a late 401 from a prior account cannot refresh or replace the current account', async () => {
  const storage = { token: 'old-token', memberId: 7 };
  let send;
  let renewals = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../utils/api.js', 'utf8'), {
    module,
    require: name => name.includes('runtime-config') ? { apiBase: 'https://example.test/api' } : {},
    getApp: () => ({ ensureSilentLogin: async () => { renewals++; } }),
    wx: { getStorageSync: key => storage[key], request: request => { send = request; } },
  });
  const response = module.exports.request('/member/profile');
  assert.equal(send.header.Authorization, 'Bearer old-token');
  storage.token = 'new-token';
  storage.memberId = 8;
  send.success({ statusCode: 401 });
  await assert.rejects(response, { code: 'SESSION_CHANGED' });
  assert.equal(renewals, 0);
  assert.equal(storage.token, 'new-token');
});
