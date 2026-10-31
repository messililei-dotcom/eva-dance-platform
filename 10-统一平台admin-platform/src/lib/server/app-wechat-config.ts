import 'server-only';
import { readFileSync, lstatSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';

export type MobileWechatCredentials = Readonly<{ appId: string; appSecret: string }>;

/** Credentials only, not a login-readiness flag. Never fall back to website or mini-program keys. */
export function loadMobileWechatCredentials(
  env: NodeJS.ProcessEnv = process.env,
): MobileWechatCredentials | null {
  let appId: unknown;
  let appSecret: unknown;
  // If either variable is supplied, require the complete pair from that source.
  // Mixing an old file secret with a new AppID can bind identities to the wrong app.
  if (env.WECHAT_MOBILE_APP_ID !== undefined || env.WECHAT_MOBILE_APP_SECRET !== undefined) {
    appId = env.WECHAT_MOBILE_APP_ID;
    appSecret = env.WECHAT_MOBILE_APP_SECRET;
  } else {
    // Production must explicitly select its own private file; never use a developer home fallback.
    const file = env.WECHAT_MOBILE_CONFIG_FILE ||
      (env.NODE_ENV !== 'production' ? join(homedir(), '.config/eva-app/wechat-mobile.json') : '');
    if (!file || !isAbsolute(file)) return null;
    try {
      const stat = lstatSync(file);
      if (!stat.isFile() || (stat.mode & 0o077) !== 0) return null;
      const config = JSON.parse(readFileSync(file, 'utf8'));
      if (config.applicationType !== 'mobile') return null;
      appId = config.appId;
      appSecret = config.appSecret;
    } catch {
      // Do not log file content, parse errors, paths or the secret.
      return null;
    }
  }
  if (typeof appId !== 'string' || !/^wx[0-9a-f]{16}$/.test(appId) ||
      typeof appSecret !== 'string' || !/^[0-9a-f]{32}$/.test(appSecret)) return null;
  return Object.freeze({ appId, appSecret });
}
