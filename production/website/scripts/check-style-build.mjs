import fs from 'node:fs';
import path from 'node:path';

// Check the actual deliverable, not just whether Next.js exited successfully.
const args = process.argv.slice(2);
const root = process.cwd();
const dist = path.resolve(root, args.find(a => !a.startsWith('--')) || process.env.NEXT_DIST_DIR || '.next');
for (const name of ['postcss.config.mjs', 'tailwind.config.ts']) {
  if (!fs.existsSync(path.join(root, name))) throw new Error(`Style build config missing: ${name}`);
}
if (!args.includes('--config-only')) {
  const cssDir = path.join(dist, 'static/css');
  // Old hashed assets may be retained for clients with cached HTML. Inspect
  // the current app's CSS references so these compatibility files do not
  // produce a false failure after deployment.
  const referenced = new Set();
  const scan = dir => {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) scan(file);
      else if (item.name.endsWith('client-reference-manifest.js')) {
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/static\/css\/([\w.-]+\.css)/g)) referenced.add(match[1]);
      }
    }
  };
  scan(path.join(dist, 'server/app'));
  const files = referenced.size ? [...referenced] : fs.readdirSync(cssDir).filter(name => name.endsWith('.css'));
  const css = files.map(name => fs.readFileSync(path.join(cssDir, name), 'utf8')).join('\n');
  if (/@tailwind\s+(base|components|utilities)/.test(css)) throw new Error('Uncompiled Tailwind directives in CSS deliverable');
  for (const selector of ['.flex{', '.hidden{', '.fixed{', '.md\\:hidden']) {
    if (!css.includes(selector)) throw new Error(`Missing layout utility: ${selector}`);
  }
  console.log(`Style build passed: ${files.length} CSS files; compiled layout and responsive utilities present.`);
} else console.log('Style configuration preflight passed.');
