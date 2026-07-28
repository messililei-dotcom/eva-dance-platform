const INTERVAL_MS = Math.max(5 * 60_000, Number(process.env.INBOX_JOB_INTERVAL_MS || 30 * 60_000));
const endpoint = process.env.INBOX_JOB_URL || 'http://127.0.0.1:3003/api/inbox/jobs/run';
const secret = process.env.INBOX_JOB_SECRET || process.env.ADMIN_SESSION_SECRET || '';

async function run() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-inbox-job-secret': secret } : {}),
      },
      body: '{}',
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload.slice(0, 300)}`);
    console.log(`[inbox-reminder-worker] ${new Date().toISOString()} ${payload}`);
  } catch (error) {
    console.error(`[inbox-reminder-worker] ${new Date().toISOString()} ${error?.message || error}`);
  }
}

setTimeout(run, 15_000);
setInterval(run, INTERVAL_MS);
