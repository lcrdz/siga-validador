// Mounts the panel on the expenses page and wires the buttons to the use cases.
// Dependencies come from outside (src/entries/content.js), which lets us test
// the panel flow with SIGA and validation mocked.
import { SIGA } from '../config.js';
import { MESSAGE } from '../infra/messages.js';
import { validateBatch } from '../app/validate-batch.js';

/**
 * @param {Object} deps
 * @param {import('../ui/panel.js').Panel} deps.ui
 * @param {{ getEntries: () => Promise<import('../domain/types.js').Entry[]> }} deps.siga
 * @param {(entry: any, cfg: any) => Promise<import('../domain/types.js').Result>} deps.validate
 * @param {import('../infra/storage/config.js').ConfigStorage} deps.config
 * @param {() => string} deps.workMonth
 * @param {Location} [deps.local]
 * @returns {Promise<boolean>} true if the panel was mounted
 */
export async function initPanel({ ui, siga, validate, config, workMonth, local = location }) {
  if (!SIGA.EXPENSES_ROUTE.test(local.pathname)) return false;
  if (document.getElementById('siga-validador')) return false;

  async function validateEntries(entries, cfg) {
    await validateBatch(entries, { validate, cfg, onValidate: (r) => ui.record(r) });
    ui.finish();
  }

  async function run() {
    if (ui.isRunning()) return;
    const cfg = ui.readConfig();
    await config.save(cfg);

    let entries;
    try {
      entries = await siga.getEntries();
    } catch (e) {
      ui.reportFailure(`Não consegui ler a lista de lançamentos: ${e.message}`);
      return;
    }

    ui.start(entries);
    await validateEntries(entries, cfg);
  }

  // Re-checks only the entries that failed; the other results stay as they are.
  async function revalidateErrors() {
    if (ui.isRunning()) return;
    const withError = ui.entriesWithError();
    if (!withError.length) return;
    const cfg = ui.readConfig();
    await config.save(cfg);
    ui.startPartial(withError);
    await validateEntries(withError, cfg);
  }

  ui.mount({ validate: run, revalidateErrors, saveConfig: config.save, workMonth });
  ui.setConfig(await config.load());

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === MESSAGE.OPEN_PANEL) ui.open();
  });
  return true;
}
