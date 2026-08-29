/* The guard that was missing.

   package.json has no "type":"module", so Vercel compiles every file under
   api/ from ESM to CommonJS before it ever runs. Its build log says so:
     Warning: Node.js functions are compiled from ESM to CommonJS.
   Almost everything survives. `import.meta` does not: there is no import.meta
   in CommonJS, so a file that uses it dies at load with
     SyntaxError: Cannot use 'import.meta' outside a module
   and every path through that route 500s, including paths that never touch the
   line in question. api/card.js shipped exactly that and took the whole card
   route down in production, while Node printed a warning about it on every
   local run that was filtered out as noise.

   So this compiles each route the way Vercel does and then LOADS the result.
   A file that cannot be required after the rewrite fails here, on a laptop.
*/
import { build } from 'esbuild';
import fs from 'fs'; import path from 'path'; import os from 'os';
import { createRequire } from 'module';


/* Comments and strings taken out with a real scanner rather than a regex.
   The regex version of this looked right, ran green, and was worthless: one
   unbalanced quote and it swallowed the very line it was meant to find. A
   guard that passes while proving nothing is worse than no guard. */
function codeOnly(src) {
  let out = "", i = 0, n = src.length;
  const isRegexPos = () => {          /* a slash after these is a regex, not division */
    for (let j = out.length - 1; j >= 0; j--) {
      const c = out[j];
      if (/\s/.test(c)) continue;
      return !/[\w$)\]]/.test(c);
    }
    return true;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; out += " "; continue; }
    if (c === "/" && d === "/") { const e = src.indexOf("\n", i); i = e < 0 ? n : e; out += " "; continue; }
    if (c === '"' || c === "'") {
      i++; while (i < n && src[i] !== c) { if (src[i] === "\\") i++; i++; }
      i++; out += '""'; continue;
    }
    if (c === "`") {
      i++; let depth = 0;
      while (i < n) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "$" && src[i + 1] === "{") { depth++; i += 2; continue; }
        if (src[i] === "}" && depth) { depth--; i++; continue; }
        if (src[i] === "`" && !depth) break;
        i++;
      }
      i++; out += "``"; continue;
    }
    if (c === "/" && isRegexPos()) {   /* a regex literal can contain anything */
      i++; let cls = false;
      while (i < n) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "[") cls = true;
        else if (src[i] === "]") cls = false;
        else if (src[i] === "/" && !cls) break;
        else if (src[i] === "\n") break;
        i++;
      }
      i++; out += "//"; continue;
    }
    out += c; i++;
  }
  return out;
}

function hasImportMeta(src) { return /\bimport\s*\.\s*meta\b/.test(codeOnly(src)); }

const API = process.argv[2] || 'api';
const files = fs.readdirSync(API).filter(f => f.endsWith('.js')).sort();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'esmcjs-'));
const req = createRequire(path.join(tmp, 'x.js'));
let pass = 0, fail = 0;

/* the package.json Vercel would see: no "type", so CommonJS is the default */
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const isModule = pkg.type === 'module';
console.log('package.json "type" is ' + JSON.stringify(pkg.type || '(unset)') +
            ' -> Vercel ' + (isModule ? 'leaves routes as ESM' : 'rewrites every route to CommonJS'));
if (isModule) { console.log('\nNothing to check: routes stay ESM.'); process.exit(0); }
fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"t","version":"1.0.0"}');

for (const f of files) {
  const out = path.join(tmp, f);
  try {
    await build({ entryPoints: [path.join(API, f)], outfile: out, format: 'cjs',
                  platform: 'node', target: 'node20', bundle: false, logLevel: 'silent' });
  } catch (e) {
    console.log('  FAIL ' + f + ' will not even compile: ' + String(e.message).split('\n')[0]);
    fail++; continue;
  }
  /* THE CHECK THAT MATTERS, and it is done on the SOURCE, not on esbuild's
     output. esbuild is kinder than Vercel: asked for CommonJS it quietly
     shims import.meta into something that works, so a file that would die in
     production compiles and loads here perfectly. Vercel's own rewrite is
     Babel shaped -- the production stack trace read
         const req = (0, _module.createRequire)(import.meta.url);
         SyntaxError: Cannot use 'import.meta' outside a module
     -- it rewrote the import statement and left import.meta standing.
     So the honest test is: does the SOURCE contain import.meta at all, once
     comments and strings are taken out of it. */
  if (hasImportMeta(fs.readFileSync(path.join(API, f), 'utf8'))) {
    console.log('  FAIL ' + f + ' uses import.meta, which Vercel cannot rewrite: it will 500 at load');
    fail++; continue;
  }
  try { req(out); pass++; console.log('  PASS ' + f); }
  catch (e) {
    const m = String(e && e.message || e);
    /* a route that needs an env var or a missing optional dep at load time is
       not what this guard is about; a syntax or module-shape failure is */
    if (e instanceof SyntaxError || /import\.meta|Unexpected token|outside a module/.test(m)) {
      console.log('  FAIL ' + f + ' cannot load as CommonJS: ' + m.split('\n')[0]); fail++;
    } else { pass++; console.log('  PASS ' + f + '  (loaded; runtime note: ' + m.slice(0, 60) + ')'); }
  }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
