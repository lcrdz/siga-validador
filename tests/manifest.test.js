// @vitest-environment node
// Ensures the manifest points to the bundles produced by the build, that the
// icons exist and that the version matches package.json.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readFile, ROOT } from './helpers/files.js';
import { ENTRY_POINTS } from '../scripts/build.js';

const manifest = JSON.parse(readFile('manifest.json'));
const pkg = JSON.parse(readFile('package.json'));
const bundles = Object.keys(ENTRY_POINTS).map((name) => `${name}.js`);

describe('manifest.json', () => {
  it('is Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('has the same version as package.json', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('uses the bundles produced by the build', () => {
    const scripts = [manifest.background.service_worker, ...manifest.content_scripts.flatMap((c) => c.js)];
    expect(scripts.sort()).toEqual([...bundles].sort());
  });

  it('each build entry point exists in src/', () => {
    for (const file of Object.values(ENTRY_POINTS)) expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
  });

  it('references icons that exist', () => {
    const icons = [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
    for (const f of icons) expect(fs.existsSync(path.join(ROOT, f)), f).toBe(true);
  });

  it('runs the bridge in the page context and the panel in the isolated content script', () => {
    const [bridge, main] = manifest.content_scripts;
    expect(bridge).toMatchObject({ world: 'MAIN', js: ['bridge.js'] });
    expect(main.js).toEqual(['content.js']);
    expect(main.world).toBeUndefined();
  });

  it('only requests access to the required domains', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual([
      'https://siga.congregacao.org.br/*',
      'https://*.blob.core.windows.net/*',
      'https://www.nfce.fazenda.sp.gov.br/*',
    ]);
  });
});
