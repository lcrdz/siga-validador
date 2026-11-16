import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function readFile(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

export function fixture(relative) {
  return readFile(path.join('tests/fixtures', relative));
}
