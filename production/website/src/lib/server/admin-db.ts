import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

export type AdminStatement = {
  all: <T = any>(...params: unknown[]) => T[];
  get: <T = any>(...params: unknown[]) => T | undefined;
  run: (...params: unknown[]) => any;
};

export type AdminDb = {
  prepare: (source: string) => AdminStatement;
  exec: (source: string) => unknown;
  transaction: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => ((...args: Args) => Result) & { immediate: (...args: Args) => Result };
  close: () => void;
};

type DatabaseConstructor = new (filename: string, options?: Record<string, unknown>) => AdminDb;

export function getAdminDbPath() {
  const configured = process.env.ADMIN_DB_PATH
    || process.env.UNIFIED_DB_PATH
    || process.env.PLATFORM_DB_PATH;

  if (!configured) {
    const platformDir = ['10', '统一平台admin-platform'].join('-');
    const candidates = [
      '/www/wwwroot/dongfangwuquan/admin-platform/admin.db',
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', 'admin-platform', 'admin.db'),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', '..', platformDir, 'admin.db'),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), 'admin.db'),
    ];
    return candidates.find(candidate => fs.existsSync(/* turbopackIgnore: true */ candidate)) || candidates[0];
  }

  if (path.isAbsolute(configured)) return configured;

  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  if (fs.existsSync(/* turbopackIgnore: true */ resolved)) return resolved;

  const workspaceRelative = configured.replace(/^(\.\.\/)+/, '');
  const workspaceResolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', '..', workspaceRelative);
  if (fs.existsSync(/* turbopackIgnore: true */ workspaceResolved)) return workspaceResolved;

  return resolved;
}

export function getBetterSqlite3(): DatabaseConstructor {
  let nativeRequire: NodeRequire | null = null;
  for (const expression of ['module.require.bind(module)', 'require']) {
    try {
      const candidate = eval(expression) as NodeRequire;
      if (typeof candidate === 'function') {
        nativeRequire = candidate;
        break;
      }
    } catch {}
  }
  const fallbackRequire = createRequire(path.join(/* turbopackIgnore: true */ process.cwd(), 'package.json'));
  const loadExternal = (modulePath: string) => {
    if (nativeRequire) return nativeRequire(modulePath) as DatabaseConstructor;
    return fallbackRequire(modulePath) as DatabaseConstructor;
  };

  try {
    return loadExternal('better-sqlite3');
  } catch (error) {
    const sqliteModule = ['better', 'sqlite3'].join('-');
    const platformDir = ['10', '统一平台admin-platform'].join('-');
    const legacyDir = ['03', '学员管理系统'].join('-');
    const candidates = [
      path.resolve(/* turbopackIgnore: true */ process.cwd(), 'node_modules', sqliteModule),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', 'admin-platform', 'node_modules', sqliteModule),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', '..', platformDir, 'node_modules', sqliteModule),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', platformDir, 'node_modules', sqliteModule),
      path.resolve(/* turbopackIgnore: true */ process.cwd(), '..', legacyDir, '学员管理系统', 'server', 'node_modules', sqliteModule),
    ];

    for (const modulePath of candidates) {
      try {
        return loadExternal(modulePath);
      } catch {}
    }

    throw error;
  }
}

export function openAdminDb(options?: Record<string, unknown>): AdminDb {
  const Database = getBetterSqlite3();
  return new Database(getAdminDbPath(), options);
}
