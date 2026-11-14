const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
function load(file,req=require){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(req,m,m.exports);return m.exports;}
const music=load('src/lib/server/event-music-upload.ts');
// A real 100 ms PCM WAV exercises the production decoder instead of only its signature check.
// Set EVENT_FFMPEG_PATH to a real ffmpeg installation on non-Linux development hosts.
const audio=Buffer.alloc(44+1600);
audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);
audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);
audio.writeUInt32LE(8000,24);audio.writeUInt32LE(16000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);
audio.write('data',36);audio.writeUInt32LE(1600,40);
for(let i=0;i<800;i++)audio.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/8000)*4000),44+i*2);
test('actual audio decoder accepts playable PCM and rejects a spoofed WAV header',async()=>{
 await music.validatePlayableMusic('valid.wav',audio);
 await assert.rejects(music.validatePlayableMusic('spoofed.wav',Buffer.from('RIFF0000WAVEfixture-audio')),e=>e instanceof music.MusicUploadError&&e.status===400);
});
function request(extra={}){const f=new FormData();Object.entries({groupId:'3',name:'学员',phone:'13800000000',performanceTitle:'参赛曲目',...extra}).forEach(([k,v])=>f.set(k,v));f.set('musicFile',new File([audio],'音乐.wav'));return new Request('https://admin.test/api/mini/events/7/register',{method:'POST',body:f});}
test('upload drops client identity and accepts one bounded audio file',async()=>{const f=await music.normalizedMusicForm(request({member_id:'999',musicSource:'admin'}));assert.equal(f.has('member_id'),false);assert.equal(f.has('musicSource'),false);assert.equal(f.get('musicFile').size,audio.length);assert.equal(music.validateMusicBytes('音乐.wav',audio),'.wav');});
test('upload rejects missing, duplicate, oversized files and duplicate fields',async()=>{for(const mode of ['missing','duplicate','oversize','field']){const f=new FormData();if(mode!=='missing')f.append('musicFile',new File([mode==='oversize'?new Uint8Array(music.MAX_EVENT_MUSIC+1):audio],'test.wav'));if(mode==='duplicate')f.append('musicFile',new File([audio],'two.wav'));if(mode==='field'){f.append('name','a');f.append('name','b');}await assert.rejects(music.normalizedMusicForm(new Request('https://admin.test',{method:'POST',body:f})),e=>e instanceof music.MusicUploadError);}assert.throws(()=>music.validateMusicBytes('test.mp3',Buffer.from('<html>unsafe</html>')));});
function fixture(fail=false){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,status TEXT DEFAULT 'active'); INSERT INTO Member(id,name,phone) VALUES(1,'学员','13800000000'); CREATE TABLE event_judges(member_id INTEGER,phone TEXT);
CREATE TABLE event_competitions(id INTEGER PRIMARY KEY,name TEXT,status TEXT,registration_status TEXT,registration_start TEXT,registration_end TEXT,end_date TEXT); INSERT INTO event_competitions(id,name,status,registration_status) VALUES(7,'赛事','published','open');
CREATE TABLE event_groups(id INTEGER PRIMARY KEY,competition_id INTEGER,max_players INTEGER,registration_fee REAL,status TEXT);INSERT INTO event_groups VALUES(3,7,1,299.99,'active');
CREATE TABLE event_players(id INTEGER PRIMARY KEY,competition_id INTEGER,group_id INTEGER,member_id INTEGER,player_no TEXT,name TEXT,phone TEXT,gender TEXT,birthday TEXT,organization TEXT,teacher TEXT,status TEXT,audit_status TEXT,paid_status TEXT,score_status TEXT,remark TEXT,registered_at TEXT,updated_at TEXT,registration_fee REAL);
CREATE TABLE event_music_files(id INTEGER PRIMARY KEY,competition_id INTEGER,group_id INTEGER,player_id INTEGER,file_name TEXT,file_url TEXT,file_size INTEGER,audit_status TEXT,uploaded_at TEXT,updated_at TEXT);
CREATE TABLE event_performances(id INTEGER PRIMARY KEY,competition_id INTEGER,group_id INTEGER,player_id INTEGER,title TEXT,music_file_id INTEGER,status TEXT,updated_at TEXT);`);
if(fail)db.exec("CREATE TRIGGER fail_program BEFORE INSERT ON event_performances BEGIN SELECT RAISE(ABORT,'fixture rollback'); END");
db.transaction=fn=>({immediate:()=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}});
const eventPhone=load('src/lib/event-phone.ts');
const phoneMember=load('src/lib/server/event-phone-member.ts',name=>{if(name==='@/lib/event-phone')return eventPhone;throw Error(name);});
const eventOnline=load('src/lib/server/event-online.ts',name=>{if(name==='./event-phone-member')return phoneMember;throw Error(name);});
const route=load('src/app/api/mini/events/[id]/register/route.ts',name=>{if(name==='node:fs')return fs;if(name==='node:crypto')return require(name);if(name.endsWith('event-online'))return eventOnline;if(name.endsWith('event-phone-member'))return phoneMember;if(name.endsWith('event-phone'))return eventPhone;if(name.endsWith('event-music-upload'))return music;if(name.endsWith('_helpers'))return{getMemberId:(_,r)=>r.headers.get('authorization')==='Bearer fixture'?1:0};if(name.endsWith('/_db'))return{withEventDb:f=>f(db),cleanText:(v,f='')=>String(v||f).trim(),toNumber:v=>Number(v)||0,nowIso:()=>new Date().toISOString()};if(name.endsWith('/inbox'))return{createPersonalMessage(){}};throw Error(name);});return{db,route};}
async function withFixture(fail,fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'eva-music-test-'));const old=process.env.EVENT_MUSIC_UPLOAD_ROOT;process.env.EVENT_MUSIC_UPLOAD_ROOT=root;const f=fixture(fail);try{await fn({...f,root});}finally{f.db.close();if(old===undefined)delete process.env.EVENT_MUSIC_UPLOAD_ROOT;else process.env.EVENT_MUSIC_UPLOAD_ROOT=old;fs.rmSync(root,{recursive:true,force:true});}}
const context={params:Promise.resolve({id:'7'})};function authorized(extra={}){const r=request(extra);r.headers.set('authorization','Bearer fixture');return r;}
test('registration binds authenticated member, programme and private music atomically; duplicate is rejected',()=>withFixture(false,async({db,route,root})=>{assert.equal((await route.POST(request(),context)).status,401);assert.equal((await route.POST(authorized({member_id:'999'}),context)).status,200);const p=db.prepare('SELECT * FROM event_players').get();assert.equal(p.member_id,1);assert.equal(p.registration_fee,299.99);const m=db.prepare('SELECT * FROM event_music_files').get(),program=db.prepare('SELECT * FROM event_performances').get();assert.equal(program.player_id,p.id);assert.equal(program.music_file_id,m.id);assert.equal(program.title,'参赛曲目');const file=path.join(root,path.basename(m.file_url));assert.deepEqual(fs.readFileSync(file),audio);assert.equal(fs.statSync(file).mode&0o777,0o600);assert.equal((await route.POST(authorized(),context)).status,409);assert.equal(fs.readdirSync(root).length,1);}));
test('database failure rolls back player, music and programme and removes only the new file',()=>withFixture(true,async({db,route,root})=>{fs.writeFileSync(path.join(root,'existing.wav'),audio);assert.equal((await route.POST(authorized(),context)).status,500);for(const table of ['event_players','event_music_files','event_performances'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,0);assert.deepEqual(fs.readdirSync(root),['existing.wav']);}));
test('closed or full groups create no records or files',()=>withFixture(false,async({db,route,root})=>{db.exec("UPDATE event_competitions SET registration_status='closed'");assert.equal((await route.POST(authorized(),context)).status,409);db.exec("UPDATE event_competitions SET registration_status='open'; INSERT INTO event_players(id,competition_id,group_id,member_id,phone,status) VALUES(9,7,3,2,'13900000000','approved')");assert.equal((await route.POST(authorized(),context)).status,409);assert.equal(fs.readdirSync(root).length,0);}));
test('registration identifies the entrant by phone and keeps authenticated submitter ownership',()=>withFixture(false,async({db,route})=>{
 const response=await route.POST(authorized({name:'另一名选手',phone:'13900000000',member_id:'999',performanceTitle:'节目名称'}),context);
 assert.equal(response.status,200);const row=db.prepare('SELECT * FROM event_players').get();
 assert.equal(row.submitted_by_member_id,1);assert.notEqual(row.member_id,999);assert.notEqual(row.member_id,1);
 assert.equal(db.prepare('SELECT phone FROM Member WHERE id=?').get(row.member_id).phone,'13900000000');
}));

test('entrant names preserve Chinese, English and internal spaces through registration and storage', async () => {
 for (const name of ['张 三', 'Connie Tse', '张三 Eva  Noor', 'Alexandria Catherine Elizabeth Montgomery', 'A'.repeat(120)]) {
  await withFixture(false, async ({db,route}) => {
   const r = new Request('https://admin.test/api/mini/events/7/register', {method:'POST', headers:{authorization:'Bearer fixture','content-type':'application/json'}, body:JSON.stringify({groupId:3,name:'  '+name+'  ',phone:'13800000000',performanceTitle:'测试'})});
   const response = await route.POST(r, context);
   assert.equal(response.status,200,JSON.stringify(await response.json()));
   assert.equal(db.prepare('SELECT name FROM event_players').get().name,name);
  });
 }
});
test('overlong entrant names are rejected without truncating or creating records', () => withFixture(false, async ({db,route}) => {
 const r = new Request('https://admin.test/api/mini/events/7/register', {method:'POST', headers:{authorization:'Bearer fixture','content-type':'application/json'}, body:JSON.stringify({groupId:3,name:'A'.repeat(121),phone:'13800000000',performanceTitle:'测试'})});
 assert.equal((await route.POST(r,context)).status,400);
 assert.equal(db.prepare('SELECT count(*) n FROM event_players').get().n,0);
}));

test('CSV import and export preserve spaced entrant names as a single field', () => {
 const format=load('src/lib/event-import-format.ts');
 const name='张 三 Connie  Tse';
 const csv='组别名称,选手姓名,手机号,领队机构,领队老师,节目名称\n测试组,'+name+',13800001234,,,测试';
 const parsed=format.parseImportRows(format.parseImportCsv(csv),'players');
 assert.equal(parsed.rows[0]['选手姓名'],name);
 const output=format.eventImportCsv('players',parsed.rows);
 assert.ok(output.includes(name));
});
