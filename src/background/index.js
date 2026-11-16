// Service worker: routes fetch requests from the content script and handles clicks
// on the extension icon.
import { SIGA } from '../config.js';
import { MESSAGE, isFetchRequest, blockedResponse, errorResponse } from '../infra/messages.js';
import { createSefazBlock, blockMessage } from './sefaz-block.js';
import { createSefazQueue } from './sefaz-queue.js';
import { createFetcher, isAllowed, isSefaz } from './fetch.js';

const block = createSefazBlock();
const queue = createSefazQueue();
const fetchUrl = createFetcher({ block });

/**
 * SEFAZ queries go through the queue (one at a time, spaced out). During the
 * block pause they answer right away without querying.
 * @param {import('../infra/messages.js').FetchRequest} req
 */
function fetchFromSefaz(req) {
  return queue.run(
    async () => ((await block.active()) ? blockedResponse(blockMessage(await block.until())) : fetchUrl(req)),
    async () => !(await block.active()),
  );
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (!isFetchRequest(msg)) return false;

  if (!isAllowed(msg.url)) {
    respond(errorResponse('Endereço não permitido pela extensão'));
    return false;
  }

  (isSefaz(msg.url) ? fetchFromSefaz(msg) : fetchUrl(msg))
    .then(respond)
    .catch((e) => respond(errorResponse(String(e?.message || e))));

  return true; // async response
});

// Icon click: opens the panel if already on SIGA; otherwise opens the expenses page.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(/** @type {number} */ (tab.id), { type: MESSAGE.OPEN_PANEL });
  } catch {
    chrome.tabs.create({ url: SIGA.EXPENSES_PAGE });
  }
});
