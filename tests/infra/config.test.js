import { describe, it, expect, vi } from 'vitest';
import { createConfigStorage } from '../../src/infra/storage/config.js';
import { fakeChrome } from '../helpers/fakes.js';

const CFG = { consumerCnpj: '61.526.398/0001-99', paymentMethod: 'Dinheiro' };

describe('user settings', () => {
  it('loads the defaults when nothing is saved', async () => {
    vi.stubGlobal('chrome', fakeChrome());
    expect(await createConfigStorage().load()).toEqual(CFG);
  });

  it('saves and reloads the settings', async () => {
    const chrome = fakeChrome();
    vi.stubGlobal('chrome', chrome);
    await createConfigStorage().save({ consumerCnpj: '11.222.333/0001-81', paymentMethod: 'Pix' });
    expect(await createConfigStorage().load()).toEqual({
      consumerCnpj: '11.222.333/0001-81',
      paymentMethod: 'Pix',
    });
  });

  it('uses the defaults when storage fails', async () => {
    const chrome = fakeChrome();
    chrome.storage.local.get.mockRejectedValue(new Error('x'));
    chrome.storage.local.set.mockRejectedValue(new Error('x'));
    vi.stubGlobal('chrome', chrome);
    await expect(createConfigStorage().save(CFG)).resolves.toBeUndefined();
    expect(await createConfigStorage().load()).toEqual(CFG);
  });
});

describe('settings saved by earlier versions', () => {
  it('reads the old Portuguese keys when the new ones are missing', async () => {
    const chrome = fakeChrome();
    chrome._local.set('cnpjConsumidor', '11.222.333/0001-81');
    chrome._local.set('formaPagamento', 'Pix');
    vi.stubGlobal('chrome', chrome);
    expect(await createConfigStorage().load()).toEqual({ consumerCnpj: '11.222.333/0001-81', paymentMethod: 'Pix' });
  });

  it('prefers the new keys', async () => {
    const chrome = fakeChrome();
    chrome._local.set('formaPagamento', 'Pix');
    chrome._local.set('paymentMethod', 'Cartão');
    vi.stubGlobal('chrome', chrome);
    expect((await createConfigStorage().load()).paymentMethod).toBe('Cartão');
  });
});

describe('injected storage area', () => {
  it('uses the given area', async () => {
    const area = { get: vi.fn(async (d) => ({ ...d, paymentMethod: 'Pix' })), set: vi.fn(async () => {}) };
    const config = createConfigStorage({ area: () => area });
    expect(await config.load()).toEqual({ ...CFG, paymentMethod: 'Pix' });
    await config.save(CFG);
    expect(area.set).toHaveBeenCalledWith(CFG);
  });
});
