import { vi } from 'vitest';

// Minimal response compatible with what the code uses from fetch().
export function response(body, { status = 200, type = 'text/html; charset=utf-8' } = {}) {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? type : null) },
    text: async () => new TextDecoder().decode(bytes),
    json: async () => JSON.parse(new TextDecoder().decode(bytes)),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

// fake fetch: each route is [regex or fn(url, options), response | fn].
export function fakeFetch(routes) {
  return vi.fn(async (url, options = {}) => {
    const u = String(url);
    for (const [sample, out] of routes) {
      const matches = typeof sample === 'function' ? sample(u, options) : sample.test(u);
      if (matches) {
        const r = typeof out === 'function' ? await out(u, options) : out;
        if (r instanceof Error) throw r;
        return r;
      }
    }
    throw new Error(`fetch não esperado: ${u}`);
  });
}

// minimal chrome.*: in-memory storage.local/session and configurable runtime.sendMessage.
export function fakeChrome({ respond } = {}) {
  const local = new Map();
  const session = new Map();
  const listeners = [];
  const area = (lookup) => ({
    get: vi.fn(async (query) => {
      if (query == null) return Object.fromEntries(lookup);
      if (typeof query === 'string') return lookup.has(query) ? { [query]: lookup.get(query) } : {};
      if (Array.isArray(query))
        return Object.fromEntries(query.filter((k) => lookup.has(k)).map((k) => [k, lookup.get(k)]));
      return Object.fromEntries(
        Object.entries(query).map(([k, defaults]) => [k, lookup.has(k) ? lookup.get(k) : defaults]),
      );
    }),
    set: vi.fn(async (obj) => {
      for (const [k, v] of Object.entries(obj)) lookup.set(k, v);
    }),
    remove: vi.fn(async (accessKeys) => {
      for (const k of [].concat(accessKeys)) lookup.delete(k);
    }),
  });
  const chrome = {
    _local: local,
    _session: session,
    _listeners: listeners,
    storage: { local: area(local), session: area(session) },
    runtime: {
      lastError: null,
      sendMessage: vi.fn((msg, cb) => {
        Promise.resolve(respond ? respond(msg) : { ok: false, error: 'sem resposta' }).then(cb);
      }),
      onMessage: { addListener: vi.fn((f) => listeners.push(f)) },
    },
    action: { onClicked: { addListener: vi.fn() } },
    tabs: { sendMessage: vi.fn(), create: vi.fn() },
  };
  return chrome;
}

// Builds a minimal PDF with JPEG images in /DCTDecode, like scanner output.
export function pdfWithJpegs(jpegs, { lineBreak = '\n' } = {}) {
  const parts = [];
  const enc = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff));
  parts.push(enc(`%PDF-1.4${lineBreak}`));
  jpegs.forEach((jpg, i) => {
    parts.push(
      enc(
        `${i + 3} 0 obj${lineBreak}<< /Type /XObject /Subtype /Image /Width 10 /Height 10 /Filter /DCTDecode /Length ${jpg.length} >>${lineBreak}stream${lineBreak}`,
      ),
    );
    parts.push(jpg);
    parts.push(enc(`${lineBreak}endstream${lineBreak}endobj${lineBreak}`));
  });
  parts.push(enc(`trailer${lineBreak}<< /Producer (Epson Scan 2) >>${lineBreak}%%EOF`));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// fake "JPEG": only the start/end markers and a few bytes in between.
export function fakeJpeg(id = 1) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, id, id, id, 0x0a, 0x0d, id, 0xff, 0xd9]);
}
