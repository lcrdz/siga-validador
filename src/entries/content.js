// Content script entry point: creates the real dependencies and mounts the panel.
import { createPanel } from '../ui/panel.js';
import { initPanel } from '../content/init.js';
import { createValidator } from '../app/validate-entry.js';
import { createSigaClient } from '../infra/siga/client.js';
import { workMonth } from '../infra/siga/parsers.js';
import { createSefazClient } from '../infra/sefaz/client.js';
import { createConfigStorage } from '../infra/storage/config.js';
import { imagesFromFile } from '../infra/pdf/images.js';
import { readQr } from '../infra/qr/reader.js';

const siga = createSigaClient();

initPanel({
  ui: createPanel(),
  siga,
  validate: createValidator({ siga, imagesFromFile, readQr, sefaz: createSefazClient() }),
  config: createConfigStorage(),
  workMonth: () => workMonth(document.body.innerText),
});
