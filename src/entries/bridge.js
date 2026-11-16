// Runs in the page "world" (MAIN) to read SIGA's DataTables data,
// which holds every entry of the month (including other grid pages).
// Only answers requests from its own window; changes nothing on the page.
(() => {
  if (window.__sigaValidadorBridge) return;
  window.__sigaValidadorBridge = true;

  function readRows() {
    const $ = window.jQuery;
    const allTables = ($ && $.fn && $.fn.dataTableSettings) || [];
    const cfg =
      allTables.find((s) => s.sTableId === 'grid1') ||
      allTables.find((s) => (s.aoData || []).some((r) => /data-codigo=/.test(String((r._aData || []).join(' ')))));
    if (!cfg) return null;
    return cfg.aoData.map((r) => (r._aData || []).map((c) => (c == null ? '' : String(c))));
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.__sigaValidador !== 'requestRows') return;
    let rows;
    try {
      rows = readRows();
    } catch {
      rows = null;
    }
    window.postMessage({ __sigaValidador: 'rows', id: e.data.id, rows }, '*');
  });
})();
