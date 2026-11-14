from pathlib import Path
import os,shutil,subprocess,json,time,concurrent.futures,sys
root=Path('/Volumes/Eva U disk/伊娃东方舞-开发工程')
out=root/'app开发/共享资料/同步更新/20261113-profile-concept-v2'
cache=Path.home()/'Library/Caches/SWOD'
android=cache/'Android/profile-concept-v2-20261113'
harmony=cache/'HarmonyOS/profile-concept-v2-20261113'
ignore=shutil.ignore_patterns('._*','.DS_Store','build','.gradle','.hvigor','oh_modules','node_modules','.git','.build')
for platform,dest in [('Android',android),('HarmonyOS',harmony)]:
 shutil.copytree(root/'app开发'/platform/'EvaDance',dest,dirs_exist_ok=True,ignore=ignore)
oldAndroid=cache/'Android/player-20261112'
if not (android/'local.properties').exists():shutil.copy2(oldAndroid/'local.properties',android/'local.properties')
if not (harmony/'oh_modules').exists():(harmony/'oh_modules').symlink_to(cache/'HarmonyOS/release/EvaDance/oh_modules',target_is_directory=True)
if not (harmony/'entry/oh_modules').exists():(harmony/'entry/oh_modules').symlink_to(cache/'HarmonyOS/release/EvaDance/entry/oh_modules',target_is_directory=True)
subprocess.run(['python3',str(root/'app开发/HarmonyOS/EvaDance/scripts/prepare_login_config.py'),str(harmony)],check=True,stdout=subprocess.DEVNULL)
clt=Path.home()/'Library/Huawei/CommandLineTools/6.1.1.418/command-line-tools'
java=Path.home()/'Library/Developer/EvaToolchains/jdk-17.0.20.1+1/Contents/Home'
env=os.environ.copy();env.update(JAVA_HOME=str(java),DEVECO_CLI_CLT_PATH=str(clt),DEVECO_SDK_HOME=str(clt/'sdk'),DEVECO_NODE_HOME=str(clt/'tool/node'))
env['PATH']=str(clt/'tool/node/bin')+os.pathsep+str(java/'bin')+os.pathsep+env.get('PATH','')
jobs=[('ios-build',['xcodebuild','-project','EvaDance.xcodeproj','-scheme','EvaDance','-configuration','Debug','-destination','generic/platform=iOS Simulator','-derivedDataPath','/tmp/swod-profile-v2-build','CODE_SIGN_IDENTITY=-','CODE_SIGNING_ALLOWED=YES','build'],root/'app开发/iOS/EvaDance',None),('ios-core-checks',['swift','run','--scratch-path','/tmp/swod-profile-v2-core','EvaCoreChecks'],root/'app开发/iOS/EvaDance',None),('android-checks',['./gradlew','assembleDebug','testDebugUnitTest','lintDebug','--console=plain'],android,env),('harmony-build',[str(clt/'bin/hvigorw'),'assembleHap','-p','product=default','-p','buildMode=debug','--no-daemon'],harmony,env),('harmony-checks',['node','--test','scripts/platform-api.test.cjs','scripts/course-media.test.cjs','scripts/event-presentation.test.cjs'],root/'app开发/HarmonyOS/EvaDance',None)]
if len(sys.argv)>1:jobs=[job for job in jobs if job[0] in sys.argv[1:]]
def run(job):
 name,cmd,cwd,environ=job;t=time.time();print('START '+name,flush=True)
 with (out/(name+'.log')).open('w') as log:
  result=subprocess.run(cmd,cwd=cwd,env=environ,stdout=log,stderr=subprocess.STDOUT)
 record={'name':name,'returncode':result.returncode,'seconds':round(time.time()-t,1),'command':cmd,'cwd':str(cwd)}
 print('END '+name+' '+str(result.returncode),flush=True);return record
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(run,jobs))
previous=json.loads((out/'build-results.json').read_text()) if (out/'build-results.json').exists() else []
results=[item for item in previous if item['name'] not in {job[0] for job in jobs}]+results
(out/'build-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
