const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const dir = path.resolve(".shop-worker");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "package.json"), '{"type":"commonjs"}');
for (const name of ["event-online", "admin-db", "shop-core", "shop-payments", "shop-service", "exclusive-orders", "exclusive-refunds"]) {
  const source = fs.readFileSync(`src/lib/server/${name}.ts`, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  fs.writeFileSync(path.join(dir, `${name}.js`), output);
}
fs.copyFileSync("scripts/shop-order-worker.cjs", path.join(dir, "worker.cjs"));
console.log("Shop order worker built");
