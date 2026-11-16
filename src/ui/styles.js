// Panel styles (applied inside the Shadow DOM, isolated from SIGA's CSS).
//
// Own tokens (--sv-* variables), with SIGA's blue and typography so the
// panel looks part of the system. No component library: content
// scripts run in an "isolated world" without customElements, so
// Web Components libraries (Shoelace/Web Awesome, Lit...) don't work without a polyfill.
export const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; }

  .root {
    /* colors */
    --sv-bg: #ffffff;
    --sv-bg-2: #f4f6f9;
    --sv-border: #e1e5eb;
    --sv-text: #2b3440;
    --sv-muted: #6b7684;
    --sv-primary: #428bca;          /* SIGA buttons (Bootstrap/Ace) */
    --sv-primary-strong: #3071a9;
    --sv-ok: #1b8a4e;        --sv-ok-bg: #e7f5ed;
    --sv-divergent: #c23b32; --sv-divergent-bg: #fcecea;
    --sv-manual: #a86a00;    --sv-manual-bg: #fdf4e1;
    --sv-error: #6b4fb8;      --sv-error-bg: #f0ecfa;
    /* spacing, radius and typography */
    --sv-space-1: 4px; --sv-space-2: 8px; --sv-space-3: 12px; --sv-space-4: 16px;
    --sv-radius: 6px;
    --sv-font: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font: 13px/1.4 var(--sv-font);
    color: var(--sv-text);
  }
  @media (prefers-color-scheme: dark) {
    .root {
      --sv-bg: #1c2128; --sv-bg-2: #242b33; --sv-border: #353e49;
      --sv-text: #e6eaef; --sv-muted: #9aa6b4;
      --sv-primary: #5b9be0; --sv-primary-strong: #7cb0ea;
      --sv-ok: #4cc183; --sv-ok-bg: #173527;
      --sv-divergent: #ef7a71; --sv-divergent-bg: #3d1f1d;
      --sv-manual: #e7b453; --sv-manual-bg: #3a2f17;
      --sv-error: #a993ec; --sv-error-bg: #2c2541;
    }
  }
  [hidden] { display: none !important; }
  button { font: inherit; cursor: pointer; }
  svg { width: 14px; height: 14px; flex: none; }

  /* floating button */
  .fab {
    position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
    display: flex; align-items: center; gap: var(--sv-space-2); padding: 9px 14px;
    border: 0; border-radius: 999px; background: var(--sv-primary); color: #fff; font-weight: 600;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }
  .fab:hover { background: var(--sv-primary-strong); }

  /* panel */
  .panel {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483001; width: min(720px, 100vw);
    display: flex; flex-direction: column; background: var(--sv-bg);
    border-left: 1px solid var(--sv-border); box-shadow: -8px 0 28px rgba(0,0,0,.18);
  }
  header { display: flex; align-items: center; gap: var(--sv-space-3); padding: var(--sv-space-3) var(--sv-space-4); border-bottom: 1px solid var(--sv-border); }
  h1 { margin: 0; font-size: 15px; font-weight: 700; }
  .sub { margin: 0; color: var(--sv-muted); flex: 1; }
  .x { border: 0; background: none; color: var(--sv-muted); font-size: 22px; line-height: 1; padding: 0 var(--sv-space-1); }

  /* action bar */
  .top-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sv-space-2); padding: var(--sv-space-3) var(--sv-space-4) 0; }
  .primary, .secondary {
    display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sv-radius); padding: 6px 12px; font-weight: 600;
  }
  .primary { border: 1px solid var(--sv-primary); background: var(--sv-primary); color: #fff; }
  .primary:hover:not(:disabled) { background: var(--sv-primary-strong); }
  .secondary { border: 1px solid var(--sv-border); background: var(--sv-bg); color: var(--sv-text); font-weight: 500; }
  .primary:disabled, .secondary:disabled { opacity: .55; cursor: default; }

  /* settings (collapsed) */
  .config { margin-left: auto; position: relative; }
  .config summary { list-style: none; cursor: pointer; color: var(--sv-muted); display: inline-flex; align-items: center; gap: 6px; padding: 6px 4px; }
  .config summary::-webkit-details-marker { display: none; }
  .config[open] summary { color: var(--sv-text); }
  .config .fields {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 2; width: 260px; padding: var(--sv-space-3);
    display: grid; gap: var(--sv-space-2); background: var(--sv-bg); border: 1px solid var(--sv-border);
    border-radius: var(--sv-radius); box-shadow: 0 6px 18px rgba(0,0,0,.12);
  }
  .config label { display: grid; gap: 3px; color: var(--sv-muted); font-size: 12px; }
  .config input { font: inherit; color: var(--sv-text); background: var(--sv-bg); border: 1px solid var(--sv-border); border-radius: var(--sv-radius); padding: 5px 8px; }

  /* progress and summary */
  .progress { display: flex; align-items: center; gap: var(--sv-space-2); padding: var(--sv-space-2) var(--sv-space-4) 0; color: var(--sv-muted); font-size: 12px; }
  .bar { flex: 1; height: 4px; border-radius: 2px; background: var(--sv-bg-2); overflow: hidden; }
  .bar span { display: block; height: 100%; width: 0; background: var(--sv-primary); transition: width .2s; }
  .summary { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--sv-space-2) var(--sv-space-4) 0; }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px;
    border: 1px solid transparent; font-weight: 600; font-size: 12px; background: var(--sv-bg-2); color: var(--sv-text);
  }
  .chip b { font-variant-numeric: tabular-nums; }
  .chip.active { border-color: currentColor; }
  .chip.ok, .status.ok { background: var(--sv-ok-bg); color: var(--sv-ok); }
  .chip.divergent, .status.divergent { background: var(--sv-divergent-bg); color: var(--sv-divergent); }
  .chip.manual, .status.manual { background: var(--sv-manual-bg); color: var(--sv-manual); }
  .chip.error, .status.error { background: var(--sv-error-bg); color: var(--sv-error); }
  .alert { flex-basis: 100%; margin: 2px 0 0; padding: 6px 10px; border-radius: var(--sv-radius); background: var(--sv-error-bg); color: var(--sv-error); font-size: 12px; }

  /* table */
  .table-wrap { flex: 1; overflow: auto; padding: var(--sv-space-2) var(--sv-space-4) var(--sv-space-3); }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th {
    position: sticky; top: 0; z-index: 1; background: var(--sv-bg); text-align: left; font-size: 11px;
    text-transform: uppercase; letter-spacing: .03em; color: var(--sv-muted); padding: 6px; border-bottom: 1px solid var(--sv-border); white-space: nowrap;
  }
  td { padding: 6px; border-bottom: 1px solid var(--sv-border); vertical-align: middle; }
  th.n, td.n { text-align: right; white-space: nowrap; }
  td.supplier { max-width: 0; width: 100%; }
  td.supplier span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  td.supplier small { display: block; color: var(--sv-muted); font-size: 11px; }
  tr.main.has-detail td { border-bottom: 0; }
  tr.detail td { padding: 0 6px 7px 6px; color: var(--sv-muted); font-size: 12px; }
  tr.detail ul { margin: 0; padding-left: 16px; }
  tr.detail .mismatch { color: var(--sv-divergent); }
  tr.detail .warning { color: var(--sv-manual); }
  tr.detail .passed { list-style: none; margin-left: -16px; color: var(--sv-text); display: flex; align-items: center; gap: 5px; }
  tr.detail .passed svg { width: 12px; height: 12px; color: var(--sv-ok); flex: none; }
  tr.expandable { cursor: pointer; }
  tr.expandable:hover td { background: var(--sv-bg-2); }
  .status.expand { border: 0; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 3px; }
  .status.expand svg { width: 10px; height: 10px; stroke-width: 2.4; transition: transform .15s; }
  .status.expand[aria-expanded="true"] svg { transform: rotate(180deg); }
  .status.expand:focus-visible { outline: 2px solid var(--sv-primary); outline-offset: 1px; }
  .status {
    display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .02em; white-space: nowrap;
  }
  .status.pending { background: var(--sv-bg-2); color: var(--sv-muted); }
  .actions { display: flex; gap: 2px; justify-content: flex-end; }
  .actions button, .actions a {
    display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
    border: 1px solid transparent; border-radius: var(--sv-radius); background: none; color: var(--sv-primary); text-decoration: none;
  }
  .actions button:hover, .actions a:hover { border-color: var(--sv-border); background: var(--sv-bg-2); }
  .empty { color: var(--sv-muted); text-align: center; padding: 40px 20px; }

  footer { display: flex; align-items: center; justify-content: space-between; gap: var(--sv-space-3); padding: var(--sv-space-2) var(--sv-space-4); border-top: 1px solid var(--sv-border); color: var(--sv-muted); }
  footer label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

  /* invoice viewer */
  .viewer { position: fixed; inset: 0; z-index: 2147483002; background: rgba(10,14,20,.82); display: flex; flex-direction: column; }
  .viewer .viewer-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; color: #fff; }
  .viewer .viewer-bar button { border: 0; background: none; color: #fff; font-size: 26px; line-height: 1; }
  .viewer .area { flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 0 16px 16px; }
  .viewer img { max-height: calc(100vh - 70px); max-width: 100%; background: #fff; cursor: zoom-in; }
  .viewer img.zoom { max-height: none; max-width: none; width: 1400px; cursor: zoom-out; }
`;

// Row highlight in the SIGA grid (applied to the page).
export const GRID_STYLES = `
  tr.sv-ok > td:first-child { box-shadow: inset 4px 0 #1b8a4e; }
  tr.sv-divergent > td { background: #fbeaea !important; }
  tr.sv-divergent > td:first-child { box-shadow: inset 4px 0 #c23b32; }
  tr.sv-manual > td:first-child { box-shadow: inset 4px 0 #d18a00; }
  tr.sv-error > td:first-child { box-shadow: inset 4px 0 #6b4fb8; }
`;
