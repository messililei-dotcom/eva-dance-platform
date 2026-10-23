import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeUnusedAvatars } from '../src/lib/server/member-avatar.ts';

test('replaced avatar cleanup preserves referenced files and rejects unmanaged paths', () => {
  const original = process.cwd();
  const temp = mkdtempSync(path.join(tmpdir(), 'member-avatar-'));
  try {
    process.chdir(temp);
    mkdirSync('public/uploads/wechat-avatar', { recursive: true });
    for (const name of ['old.jpg', 'shared.jpg', 'new.jpg']) writeFileSync(`public/uploads/wechat-avatar/${name}`, 'image');
    writeFileSync('public/keep.jpg', 'image');
    const db = { prepare: () => ({ get: value => /\/(shared|new)\.jpg$/.test(value) ? { id: 2 } : undefined }) };
    removeUnusedAvatars(db, ['/uploads/wechat-avatar/old.jpg', '/uploads/wechat-avatar/shared.jpg', '/uploads/wechat-avatar/new.jpg', '/uploads/wechat-avatar/../../keep.jpg', 'https://example.com/a.jpg']);
    assert.equal(existsSync('public/uploads/wechat-avatar/old.jpg'), false);
    for (const name of ['shared.jpg', 'new.jpg']) assert.equal(existsSync(`public/uploads/wechat-avatar/${name}`), true);
    assert.equal(existsSync('public/keep.jpg'), true);
    assert.doesNotThrow(() => removeUnusedAvatars(db, ['/uploads/wechat-avatar/missing.jpg']));
  } finally {
    process.chdir(original);
    rmSync(temp, { recursive: true, force: true });
  }
});
