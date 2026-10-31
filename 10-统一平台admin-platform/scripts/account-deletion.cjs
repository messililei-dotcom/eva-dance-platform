// Server-side operator queue. Read-only unless one reviewed request and a new
// private SQLite backup are supplied. Never prints receipt tokens or personal data.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Database=require('better-sqlite3');
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
const root=path.resolve(__dirname,'..');
function load(name){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/server',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='./app-session'?load('app-session'):require(n),m,m.exports);return m.exports;}
async function main(){
 if(!args.includes('--db'))throw Error('Required --db PATH; optionally --request ID. Apply requires --apply --request ID --plan-hash HASH --backup-file NEW_PATH.');
 const apply=args.includes('--apply'),db=new Database(value('--db'),{readonly:!apply,fileMustExist:true});
 try{
  if(args.includes('--purge-expired')){
   const count=Number(db.prepare('SELECT count(*) n FROM AppDeletionRetention WHERE expires_at<=?').get(Date.now()).n);
   if(!apply){console.log(JSON.stringify({dryRun:true,expiredArchives:count}));return;}
   if(!args.includes('--backup-file')||fs.existsSync(value('--backup-file')))throw Error('A new private backup is required');
   await db.backup(value('--backup-file'));fs.chmodSync(value('--backup-file'),0o600);
   db.pragma('secure_delete=ON');
   const result=db.prepare('DELETE FROM AppDeletionRetention WHERE expires_at<=?').run(Date.now());
   console.log(JSON.stringify({expiredArchivesRemoved:result.changes}));return;
  }
  if(!args.includes('--request')){
   if(apply)throw Error('An individual request is required');
   console.log(JSON.stringify(db.prepare("SELECT id,status,requested_at,requested_at+604800000 due_at FROM AppDeletionRequest WHERE status='pending' ORDER BY requested_at").all().map(r=>({...r,overdue:Date.now()>r.due_at})),null,2));return;
  }
  const api=load('app-account-deletion'),plan=api.planAccountDeletion(db,value('--request'));
  if(!apply){console.log(JSON.stringify({...plan,operations:plan.operations.map(({values,where,rowsHash,...r})=>r)},null,2));return;}
  if(!args.includes('--plan-hash')||!args.includes('--backup-file')||plan.planHash!==value('--plan-hash')||(!args.includes('--case-file')&&plan.blockers.length))throw Error('A current matching plan without blockers and a new backup are required');
  const backup=path.resolve(value('--backup-file'));if(fs.existsSync(backup))throw Error('Backup already exists');
  fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});
  await db.backup(backup);fs.chmodSync(backup,0o600);
  if(args.includes('--case-file')){
   const caseFile=value('--case-file'),st=fs.statSync(caseFile);
   if(!st.isFile()||(st.mode&0o077)!==0||st.size>65536)throw Error('Case manifest must be private and bounded');
   const manifest=JSON.parse(fs.readFileSync(caseFile,'utf8'));
   if(manifest.requestId!==plan.requestId||manifest.planHash!==plan.planHash)throw Error('Manifest does not match reviewed request');
   let key='';
   if(manifest.decisions?.some(x=>x.action==='retain')){
    if(!args.includes('--retention-key-file'))throw Error('Private retention key file required');
    const keyFile=value('--retention-key-file'),ks=fs.statSync(keyFile);
    if(!ks.isFile()||(ks.mode&0o077)!==0||ks.size>128)throw Error('Retention key file must be private');
    key=fs.readFileSync(keyFile,'utf8').trim();
   }
   console.log(JSON.stringify(api.fulfillReviewedDeletionRecords(db,plan.requestId,plan.planHash,String(manifest.confirmedBy||''),manifest.decisions,key)));
   console.log('Records fulfilled; re-run read-only planning and review the new hash before completion.');
  }else {
   const dir=path.join(path.dirname(path.resolve(value('--db'))),'private','account-deletion');fs.mkdirSync(dir,{recursive:true,mode:0o700});
   const ledger=path.join(dir,'completed.jsonl'),fd=fs.openSync(ledger,'a',0o600);fs.closeSync(fd);
   const result=api.completeAccountDeletion(db,plan.requestId,plan.planHash);
   fs.appendFileSync(ledger,JSON.stringify({requestId:plan.requestId,memberIds:plan.memberIds,completedAt:result.completedAt})+'\n',{mode:0o600});
   console.log(JSON.stringify(result));
  }
 }finally{db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
