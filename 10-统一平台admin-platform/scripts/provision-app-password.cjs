// Offline operator tool; passwords never appear in arguments or output.
const fs = require('node:fs'), path = require('node:path');
const Database = require('better-sqlite3'), ts = require('typescript');
const args = process.argv.slice(2);
const value = name => args[args.indexOf(name) + 1];
async function main() {
  if (!args.includes('--db') || !args.includes('--member-id')) throw Error('Required: --db PATH --member-id ID; default is read-only. Apply additionally requires --apply --password-file PATH --backup-file NEW_PATH.');
  const id = Number(value('--member-id')), days = Number(args.includes('--expires-days') ? value('--expires-days') : 30);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isInteger(days) || days < 1 || days > 90) throw Error('Invalid member or expiry');
  const apply = args.includes('--apply'), revoke = args.includes('--revoke');
  const db = new Database(value('--db'), { readonly: !apply, fileMustExist: true });
  try {
    const member = db.prepare('SELECT id,phone,status,merged_to_member_id FROM Member WHERE id=?').get(id);
    if (!member) throw Error('Member required');
    if (!revoke) {
      const localPhone = String(member.phone || '').replace(/^\+86(?=1[3-9]\d{9}$)/, '');
      if (member.merged_to_member_id || !['active','正常','enabled'].includes(member.status) || !/^1[3-9]\d{9}$/.test(localPhone)) throw Error('Active, unmerged phone member required');
      if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AppDeletionRequest'").get() && db.prepare("SELECT id FROM AppDeletionRequest WHERE member_id=? AND status='pending'").get(id)) throw Error('Deletion pending');
      if (db.prepare('SELECT count(*) n FROM Member WHERE phone IN (?,?,?)').get(localPhone, `+86${localPhone}`, `86${localPhone}`).n !== 1) throw Error('Ambiguous phone identity');
    }
    if (!apply) { console.log(JSON.stringify({ dryRun: true, revoke, memberId: id, phoneSuffix: String(member.phone || '').slice(-4), expiresDays: revoke ? null : days, grantsCourseRights: false, revokesExistingAppSessionsOnApply: true })); return; }
    if ((!revoke && !args.includes('--password-file')) || !args.includes('--backup-file')) throw Error('Password file and new backup path required');
    const backupPath = value('--backup-file');
    if (fs.existsSync(backupPath)) throw Error('Backup path already exists');
    let secret = '';
    if (!revoke) {
      const secretPath = value('--password-file'), stat = fs.statSync(secretPath);
      if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 512) throw Error('Password file must be private (0600) and bounded');
      secret = fs.readFileSync(secretPath, 'utf8').replace(/\r?\n$/, '');
      if (secret.length < 16 || secret.length > 128) throw Error('Password must be 16-128 characters');
    }
    await db.backup(backupPath); fs.chmodSync(backupPath, 0o600);
    const mod = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname,'../src/lib/server/app-session.ts'), 'utf8');
    new Function('require','module','exports', ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,mod,mod.exports);
    mod.exports.ensureAppSchema(db);
    if (revoke) mod.exports.revokeAppPassword(db,id);
    else mod.exports.setAppPassword(db,id,secret,Date.now()+days*86400000);
    console.log(JSON.stringify({ applied: true, revoked: revoke, memberId: id, expiresDays: revoke ? null : days, grantsCourseRights: false, existingAppSessionsRevoked: true }));
  } finally { db.close(); }
}
main().catch(() => { console.error('Credential provisioning failed; verify arguments, private password file, member state and backup location. No password is printed.'); process.exitCode=1; });
