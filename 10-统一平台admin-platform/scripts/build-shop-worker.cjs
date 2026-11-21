const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const dir = path.resolve(".shop-worker");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "package.json"), '{"type":"commonjs"}');
for (const name of ["event-online", "event-phone-member", "member-phone-sql", "../event-phone", "course-promotion", "admin-db", "shop-core", "shop-payments", "shop-service", "exclusive-orders", "exclusive-refunds"]) {
  const source = fs.readFileSync(`src/lib/server/${name}.ts`, "utf8").replace(
    /(['"])@\/lib\/event-phone\1/g, "$1./event-phone$1",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  fs.writeFileSync(path.join(dir, `${path.basename(name)}.js`), output);
}
fs.copyFileSync("scripts/shop-order-worker.cjs", path.join(dir, "worker.cjs"));
console.log("Shop order worker built");
