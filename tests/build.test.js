// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build, ENTRY_POINTS } from '../scripts/build.js';

const tempDirs = [];
const tmpDir = () => {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'siga-build-'));
  tempDirs.push(p);
  return p;
};

function listFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))],
    )
    .sort();
}

afterEach(() => {
  for (const p of tempDirs.splice(0)) fs.rmSync(p, { recursive: true, force: true });
});

describe('build', () => {
  it('produces the three bundles, the manifest, the icons and the licenses', async () => {
    const out = path.join(tmpDir(), 'dist');
    const { version } = await build({ out });
    expect(listFiles(out)).toEqual([
      'background.js',
      'background.js.map',
      'bridge.js',
      'bridge.js.map',
      'content.js',
      'content.js.map',
      'icons/icon128.png',
      'icons/icon16.png',
      'icons/icon32.png',
      'icons/icon48.png',
      'licenses/jsQR.LICENSE',
      'manifest.json',
    ]);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('produces classic scripts (no import/export), as Chrome requires for content scripts', async () => {
    const out = path.join(tmpDir(), 'dist');
    await build({ out });
    for (const name of ['content.js', 'bridge.js', 'background.js']) {
      const code = fs.readFileSync(path.join(out, name), 'utf8');
      expect(() => new vm.Script(code), name).not.toThrow();
      expect(code, name).not.toMatch(/^\s*(import|export)\s/m);
    }
  });

  it('embeds jsQR in the content script', async () => {
    const out = path.join(tmpDir(), 'dist');
    await build({ out });
    expect(fs.readFileSync(path.join(out, 'content.js'), 'utf8')).toContain('alignmentPattern');
  });

  it('clears the previous output folder contents', async () => {
    const out = path.join(tmpDir(), 'dist');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'velho.txt'), 'x');
    await build({ out });
    expect(fs.existsSync(path.join(out, 'velho.txt'))).toBe(false);
  });

  it('fails when the manifest references a missing file', async () => {
    const root = tmpDir();
    fs.mkdirSync(path.join(root, 'icons'));
    for (const f of Object.values(ENTRY_POINTS)) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), '');
    }
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify({ manifest_version: 3, version: '1.0.0', background: { service_worker: 'sumiu.js' } }),
    );
    await expect(build({ root, out: path.join(root, 'dist') })).rejects.toThrow('sumiu.js');
  });
});
