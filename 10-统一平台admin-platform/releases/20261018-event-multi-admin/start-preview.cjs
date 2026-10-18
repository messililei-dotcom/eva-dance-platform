const fs=require('fs'),{spawn}=require('child_process');
const stage='/www/wwwroot/dongfangwuquan/event-multi-stage-20261018';
const app='/www/wwwroot/dongfangwuquan/admin-platform';
const env=require(app+'/ecosystem.config.js').apps[0].env;
fs.copyFileSync('/www/backups/dongfangwuquan/event-multi-20261018/admin.db',stage+'/acceptance.db');
const log=fs.openSync(stage+'/preview.log','a');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3005','-H','127.0.0.1'],{cwd:stage,env:{...process.env,...env,PORT:'3005',ADMIN_DB_PATH:stage+'/acceptance.db',NEXT_DIST_DIR:'.next-build'},detached:true,stdio:['ignore',log,log]});
fs.writeFileSync(stage+'/preview.pid',String(child.pid));child.unref();console.log('isolated preview started');
