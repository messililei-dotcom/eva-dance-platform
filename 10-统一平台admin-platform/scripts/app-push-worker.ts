import { openAdminDb } from '../src/lib/server/admin-db';
import { ensureAppSchema } from '../src/lib/server/app-session';
import { deliverPushOutbox, ensurePushSchema } from '../src/lib/server/app-push';
import { sendAliyunPush } from '../src/lib/server/aliyun-push';

const db = openAdminDb();
ensureAppSchema(db); ensurePushSchema(db);
let running = false;
let stopping = false;
async function tick() {
  if (running || stopping || process.env.APP_PUSH_ENABLED !== 'true') return;
  running = true;
  try {
    const result = await deliverPushOutbox(db, sendAliyunPush);
    if (result.sent || result.skipped || result.uncertain) console.log(JSON.stringify(result));
  } catch { console.error('Push worker failed; inspect configuration without logging credentials.'); }
  finally { running = false; if (stopping) { db.close(); process.exit(0); } }
}
const timer = setInterval(tick, 5000);
process.on('SIGTERM', () => { stopping = true; clearInterval(timer); if (!running) { db.close(); process.exit(0); } });
process.on('SIGINT', () => { stopping = true; clearInterval(timer); if (!running) { db.close(); process.exit(0); } });
console.log(process.env.APP_PUSH_ENABLED === 'true' ? 'Push worker started' : 'Push worker started with delivery disabled');
tick();
