import fs from 'fs';
import path from 'path';

type Statement = {
  all: <T = any>(...params: unknown[]) => T[];
  get: <T = any>(...params: unknown[]) => T | undefined;
  run: (...params: unknown[]) => any;
};

export type PlatformDb = {
  prepare: (source: string) => Statement;
  close: () => void;
};

type DatabaseConstructor = new (filename: string, options?: Record<string, unknown>) => PlatformDb;

export function jsonError(message: string, status = 500) {
  return Response.json({ success: false, message }, { status });
}

export function toPositiveInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function getPlatformDbPath() {
  const configured = process.env.ADMIN_DB_PATH
    || process.env.UNIFIED_DB_PATH
    || process.env.PLATFORM_DB_PATH;

  if (configured) {
    const configuredPath = path.isAbsolute(configured)
      ? configured
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
    if (fs.existsSync(/* turbopackIgnore: true */ configuredPath)) return configuredPath;
  }

  const candidates = [
    path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', 'admin-platform', 'admin.db'),
    path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', '..', '10-统一平台admin-platform', 'admin.db'),
  ];
  return candidates.find((candidate) => fs.existsSync(/* turbopackIgnore: true */ candidate)) || candidates[0];
}

function getBetterSqlite3(): DatabaseConstructor {
  const nativeRequire = eval('require') as NodeRequire;

  try {
    return nativeRequire('better-sqlite3') as DatabaseConstructor;
  } catch (error) {
    const candidates = [
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', 'admin-platform', 'node_modules', 'better-sqlite3'),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', '..', '10-统一平台admin-platform', 'node_modules', 'better-sqlite3'),
    ];
    for (const modulePath of candidates) {
      try {
        return nativeRequire(modulePath) as DatabaseConstructor;
      } catch {}
    }
    throw error;
  }
}

export function withDb<T>(fn: (db: PlatformDb) => T): T {
  const Database = getBetterSqlite3();
  const db = new Database(getPlatformDbPath(), { readonly: true });

  try {
    const result = fn(db);
    if (result && typeof (result as any).then === 'function') {
      return (result as unknown as Promise<void>).finally(() => db.close()) as unknown as T;
    }
    db.close();
    return result;
  } catch (error) {
    db.close();
    throw error;
  }
}
