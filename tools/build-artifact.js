/* Bundle the multi-file game into one self-contained page.
   The published Artifact is wrapped in <!doctype><head></head><body> for
   us, so we emit only <title>, <style> and the body content - no document
   scaffolding of our own. Run: node tools/build-artifact.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const head = html.slice(html.indexOf('<title>'), html.indexOf('</style>') + 8);
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));

// Swap each <script src> for the file's actual contents, in load order.
const inlined = body.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  return `<script>\n/* ---- ${src} ---- */\n${code}</script>`;
});

const out = `${head}\n${inlined.trim()}\n`;
const dest = path.join(root, 'dist', 'deep-water-duo.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);

const remaining = (out.match(/<script src=/g) || []).length;
if (remaining) throw new Error(`${remaining} script tag(s) were not inlined`);
for (const tag of ['<!DOCTYPE', '<html', '<head>', '<body>']) {
  if (out.includes(tag)) throw new Error(`bundle still contains ${tag}`);
}
console.log(`wrote ${path.relative(root, dest)} (${(out.length / 1024).toFixed(0)} KB)`);
