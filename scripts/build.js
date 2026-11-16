// Builds the extension into dist/, the folder loaded in chrome://extensions:
//   - bundles (esbuild) the src/ entry points into single scripts:
//       content.js     content script (panel and validation)
//       bridge.js      bridge running in the page context (world MAIN)
//       background.js  service worker
//   - copies manifest.json, icons/ and third-party licenses.
//
// Usage:
//   node scripts/build.js            builds dist/
//   node scripts/build.js --watch    builds dist/ and rebuilds on every change
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ENTRY_POINTS = {
  content: 'src/entries/content.js',
  bridge: 'src/entries/bridge.js',
  background: 'src/background/index.js',
};
export const STATIC_FILES = ['manifest.json', 'icons'];
// Licenses of the dependencies bundled inside.
export const LICENSES = { 'jsQR.LICENSE': 'jsqr/LICENSE' };

export function esbuildOptions({ root = ROOT, out = path.join(root, 'dist') } = {}) {
  return {
    absWorkingDir: root,
    entryPoints: Object.fromEntries(Object.entries(ENTRY_POINTS).map(([name, file]) => [name, path.join(root, file)])),
    outdir: out,
    bundle: true,
    // content scripts don't accept ES modules; IIFE isolates each script
    format: 'iife',
    target: 'chrome120',
    sourcemap: 'linked',
    legalComments: 'eof',
    logLevel: 'silent',
  };
}

// Simple recursive copy (mkdir + copyFileSync). Avoids fs.cpSync, which fails
// on some mounted file systems (e.g. folders shared with VMs).
function copy(source, dest) {
  if (fs.statSync(source).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      if (name === '.DS_Store') continue;
      copy(path.join(source, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
  }
}

// Files the manifest references, which must exist in the build.
function referenced(manifest) {
  return [
    manifest.background?.service_worker,
    ...(manifest.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter(Boolean);
}

export function copyStaticFiles({ root = ROOT, out = path.join(root, 'dist') } = {}) {
  for (const input of STATIC_FILES) copy(path.join(root, input), path.join(out, input));
  const requireFrom = createRequire(path.join(root, 'package.json'));
  for (const [dest, source] of Object.entries(LICENSES)) {
    let file;
    try {
      file = requireFrom.resolve(source);
    } catch {
      continue; // dependency not installed in this root (e.g. build tests)
    }
    copy(file, path.join(out, 'licenses', dest));
  }
}

export function checkManifest({ out }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  const missing = referenced(manifest).filter((f) => !fs.existsSync(path.join(out, f)));
  if (missing.length) throw new Error(`Arquivos citados no manifest.json não encontrados: ${missing.join(', ')}`);
  return manifest.version;
}

export async function build({ root = ROOT, out = path.join(root, 'dist') } = {}) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build(esbuildOptions({ root, out }));
  copyStaticFiles({ root, out });
  return { out, version: checkManifest({ out }) };
}

const time = () => new Date().toLocaleTimeString('pt-BR');

async function observe() {
  const out = path.join(ROOT, 'dist');
  const notify = {
    name: 'avisar',
    setup(b) {
      b.onEnd((r) => {
        if (r.errors.length)
          console.error(`[${time()}] erro no build:\n${r.errors.map((e) => `  ${e.text}`).join('\n')}`);
        else console.log(`[${time()}] dist/ atualizado. Recarregue a extensão no Chrome.`);
      });
    },
  };
  const ctx = await esbuild.context({ ...esbuildOptions({ out }), plugins: [notify] });
  await ctx.watch();

  let scheduled = null;
  for (const input of STATIC_FILES) {
    const watched = path.join(ROOT, input);
    fs.watch(watched, { recursive: fs.statSync(watched).isDirectory() }, () => {
      clearTimeout(scheduled);
      scheduled = setTimeout(() => {
        try {
          copyStaticFiles({ out });
          checkManifest({ out });
          console.log(`[${time()}] ${input} copiado. Recarregue a extensão no Chrome.`);
        } catch (e) {
          console.error(`[build] ${e.message}`);
        }
      }, 150);
    });
  }
  console.log('Observando src/, manifest.json e icons/... (Ctrl+C para sair)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { out, version } = await build();
    console.log(`Extensão ${version} gerada em ${path.relative(process.cwd(), out) || '.'}/`);
    if (process.argv.includes('--watch')) await observe();
  } catch (e) {
    console.error(e.errors?.map((x) => x.text).join('\n') || e.message);
    process.exit(1);
  }
}
