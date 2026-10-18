const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
class AppError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const m={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/server/app-profile.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({AppError}),m,m.exports);
const {mergeAppProfile}=m.exports;
const saved={id:42,name:'学员',phone:'13800000000',remark:'工作人员备注',wx_account:'saved',level:'existing',birthday:'旧数据'};
test('App profile edit preserves server identity, remarks and WeChat fields',()=>{
 const input={name:' 新姓名 ',city:' 上海 ',id:999,phone:'13900000000',remark:'overwrite',wx_account:'overwrite',level:'vip'};
 assert.deepEqual(mergeAppProfile(saved,input),{...saved,name:'新姓名',city:'上海'});
 assert.equal(saved.name,'学员');assert.equal(input.name,' 新姓名 ');
});
test('Profile rejects empty name, oversized and non-string edits',()=>{
 for(const patch of [{name:' '},{name:'名'.repeat(61)},{address:'a'.repeat(301)},{city:null},{country:[]},{gender:1}])assert.throws(()=>mergeAppProfile(saved,patch),AppError);
});
test('Birthday validates actual calendar dates and rejects future dates',()=>{
 assert.equal(mergeAppProfile(saved,{birthday:'2024-02-29'}).birthday,'2024-02-29');assert.equal(mergeAppProfile(saved,{birthday:''}).birthday,'');
 for(const birthday of ['2025-02-29','2024-04-31','2024-13-01','2024-1-01','tomorrow','2999-01-01'])assert.throws(()=>mergeAppProfile(saved,{birthday}),AppError);
 assert.equal(mergeAppProfile(saved,{city:'北京'}).birthday,'旧数据');
});
function routeFixture(){
 let submitted;
 const memberModule={GET:async()=>Response.json({success:true,data:{member:saved}}),PUT:async r=>{submitted=await r.json();return Response.json({success:true,data:{member:submitted}});}};
 const loaded={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('src/app/api/app/v1/[...path]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',source)(name=>{
  if(name.endsWith('app-profile'))return m.exports;
  if(name.endsWith('app-session'))return{AppError,ensureAppSchema(){},authenticateApp:(_,token)=>{if(token!=='valid')throw new AppError('unauthenticated',401);return{member_id:42,member:{phone:saved.phone}};}};
  if(name.endsWith('app-platform'))return{appPlatform:()=> 'android'};
  if(name.endsWith('app-shop')||name.endsWith('app-carrier-auth')||name.endsWith('mini/_auth'))return{};
  if(name.endsWith('event-music-upload'))return{MusicUploadError:class extends Error{}};
  if(name.endsWith('mini/_helpers'))return{withDb:fn=>fn({}),memberToken:()=> 'internal-42'};
  if(name.endsWith('app-route-map'))return{findAppRoute:()=>({public:false,params:{},load:async()=>memberModule})};
  if(name.endsWith('mini/member/profile/route'))return memberModule;
  throw Error(name);
 },loaded,loaded.exports);
 return {submitted:()=>submitted,call:async(body,token='valid')=>loaded.exports.PUT(new Request('https://admin.test/api/app/v1/member/profile',{method:'PUT',headers:{authorization:'Bearer '+token,'x-client-platform':'android'},body:JSON.stringify(body)}),{params:Promise.resolve({path:['member','profile']})})};
}
test('Authenticated profile route forwards server-owned identity and returns only safe fields',async()=>{
 const fixture=routeFixture();const response=await fixture.call({name:'新姓名',city:'北京',member_id:999,phone:'13900000000',remark:'overwrite',wx_account:'overwrite'});
 assert.equal(response.status,200);assert.deepEqual(fixture.submitted(),{...saved,name:'新姓名',city:'北京'});
 const data=(await response.json()).data;assert.equal(data.id,42);assert.equal(data.phone,saved.phone);assert.equal(data.name,'新姓名');assert.equal(data.remark,undefined);assert.equal(data.wx_account,undefined);
});
test('Invalid or unauthenticated profile writes never reach member mutation',async()=>{
 const fixture=routeFixture();assert.equal((await fixture.call({name:'新姓名'},'bad')).status,401);assert.equal(fixture.submitted(),undefined);
 assert.equal((await fixture.call({birthday:'2025-02-29'})).status,400);assert.equal(fixture.submitted(),undefined);
});
