import path from 'path';

export type AdminStatement = {
  all: <T = any>(...params: unknown[]) => T[];
  get: <T = any>(...params: unknown[]) => T | undefined;
  run: (...params: unknown[]) => any;
};

export type AdminDb = {
  prepare: (source: string) => AdminStatement;
  exec: (source: string) => unknown;
  transaction: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => (...args: Args) => Result;
  close: () => void;
};

type DatabaseConstructor = new (filename: string, options?: Record<string, unknown>) => AdminDb;

export function getAdminDbPath() {
  const dbPath = process.env.ADMIN_DB_PATH
    || process.env.UNIFIED_DB_PATH
    || 'admin.db';

  return path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
}

export function getBetterSqlite3(): DatabaseConstructor {
  const nativeRequire = eval('require') as NodeRequire;

  try {
    return nativeRequire('better-sqlite3') as DatabaseConstructor;
  } catch {
    const legacyModulePath = path.resolve(
      process.cwd(),
      '../03-学员管理系统/学员管理系统/server/node_modules/better-sqlite3',
    );
    return nativeRequire(legacyModulePath) as DatabaseConstructor;
  }
}

export function openAdminDb(options?: Record<string, unknown>): AdminDb {
  const Database = getBetterSqlite3();
  return new Database(getAdminDbPath(), options);
}
