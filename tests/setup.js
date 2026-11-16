// jsdom additions for features Chrome has and jsdom does not implement
// (or implements differently). They only affect the test environment.

// innerText: jsdom doesn't compute layout; textContent is enough for what the code reads.
if (typeof window !== 'undefined' && !('innerText' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
}

// postMessage: in Chrome, a message sent by the window itself arrives with
// event.source === window (the bridge checks this). jsdom doesn't fill in source.
if (typeof window !== 'undefined') {
  window.postMessage = (data) => {
    setTimeout(
      () => window.dispatchEvent(new MessageEvent('message', { data, source: window, origin: location.origin })),
      0,
    );
  };
}

// URL.createObjectURL / revokeObjectURL don't exist in jsdom.
if (typeof URL.createObjectURL !== 'function') {
  let n = 0;
  URL.createObjectURL = () => `blob:teste/${++n}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
