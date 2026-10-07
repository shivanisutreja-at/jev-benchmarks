// Client-side renderer for the benchmark report. Inlined into the HTML by
// html-report-generator.ts; reads its payload from <script id="report-data">.
(function () {
  'use strict';

  const CATEGORY_LABELS = {
    PYC: 'Payroll',
    DTE: 'Data & Tools',
    EMP: 'Employment',
    ONB: 'Onboarding',
    ASR: 'Reviews & Comp',
    PMS: 'Performance',
    TAL: 'Talent',
  };
  const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
  const PAGE_SIZE = 40;
  const SERIES_SLOTS = 6;
  const LOW_CONFIDENCE = 0.8;
  const THEME_KEY = 'jev-report-theme';

  const ICON_PATHS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    tilde: '<path d="M5 12h14"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    equal: '<path d="M5 9h14M5 15h14"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.5A6 6 0 1 1 9.5 15.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function num(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined) return null;
    const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const fmt = {
    pct(v) { return v === null ? '—' : v.toFixed(1) + '%'; },
    ms(v) { return v === null ? '—' : Math.round(v).toLocaleString() + ' ms'; },
    int(v) { return v === null ? '—' : Math.round(v).toLocaleString(); },
    usd(v, digits) { return v === null ? '—' : '$' + v.toFixed(digits === undefined ? 4 : digits); },
    tinyUsd(v) {
      if (v === null || v === undefined) return '—';
      if (v === 0) return '$0';
      return '$' + (v < 0.001 ? v.toFixed(6) : v.toFixed(4));
    },
    ratio(r) { return (r >= 10 ? r.toFixed(0) : r.toFixed(1)) + '×'; },
  };

  function categoryLabel(code) {
    return CATEGORY_LABELS[code] || code || '—';
  }

  // ---------- State ----------

  let report = null;
  let models = [];
  let sort = { key: null, dir: 'desc' };
  let visibleCount = PAGE_SIZE;
  let dialoguesOpen = false;

  const $ = (id) => document.getElementById(id);

  function buildModels(data) {
    const configured = Array.isArray(data.configuredModels) && data.configuredModels.length
      ? data.configuredModels
      : inferModels(data.details || []);
    const summary = data.summary || [];

    return configured.map((cfg, i) => {
      const row = summary.find((s) => s.Model === cfg.name) || summary[i] || {};
      // Exact spend from per-scenario results; the summary row is rounded to 4 decimals.
      let runCost = null;
      (data.details || []).forEach((d) => {
        const r = (d.results || {})[cfg.id];
        const c = r && !r.error ? num(r.totalCostUsd !== undefined ? r.totalCostUsd : r.costUsd) : null;
        if (c !== null) runCost = (runCost || 0) + c;
      });
      return {
        id: cfg.id,
        name: cfg.name,
        short: String(cfg.name || cfg.id).split(' (')[0],
        color: i < SERIES_SLOTS ? 'var(--series-' + (i + 1) + ')' : 'var(--ink-3)',
        strict: num(row['Strict Acc %']),
        relaxed: num(row['Relaxed Acc %']),
        conf: num(row['Avg Conf %']),
        single: num(row['Single-Intent Acc']),
        multi: num(row['Multi-Intent Acc']),
        avgLat: num(row['Avg Latency']),
        p95: num(row['P95 Latency']),
        avgIn: num(row['Avg In Tokens']),
        avgOut: num(row['Avg Out Tokens']),
        totalTokens: num(row['Total Tokens']),
        totalCost: num(row['Total Cost ($)']),
        cost10k: num(row['Cost / 10k Decisions']),
        runCost: runCost !== null ? runCost : num(row['Total Cost ($)']),
        errors: num(row.Errors) || 0,
      };
    });
  }

  function inferModels(details) {
    const seen = new Map();
    details.forEach((d) => Object.entries(d.results || {}).forEach(([id, r]) => {
      if (!seen.has(id)) seen.set(id, { id, name: r.modelName || id });
    }));
    return [...seen.values()];
  }

  function modelById(id) {
    return models.find((m) => m.id === id);
  }

  function swatch(m) {
    return '<span class="swatch" style="--c:' + m.color + '" aria-hidden="true"></span>';
  }

  // Indices of models holding the best value; ties all win.
  function bestIds(key, better) {
    const vals = models.map((m) => m[key]).filter((v) => v !== null);
    if (!vals.length) return new Set();
    const target = better === 'low' ? Math.min(...vals) : Math.max(...vals);
    return new Set(models.filter((m) => m[key] === target).map((m) => m.id));
  }

  // ---------- Verdict ----------

  function renderVerdict() {
    const el = $('verdict');
    const focus = models[0];
    const n = report.totalScenarios || (report.details || []).length;
    if (!focus) { el.innerHTML = ''; return; }

    const others = models.slice(1);
    let title;
    if (!others.length) {
      title = esc(focus.short) + ' scored ' + fmt.pct(focus.strict) + ' strict accuracy';
    } else {
      const wins = [];
      const losses = [];
      [['accuracy', 'strict', 'high'], ['speed', 'avgLat', 'low'], ['cost', 'runCost', 'low']].forEach(([label, key, better]) => {
        (bestIds(key, better).has(focus.id) ? wins : losses).push(label);
      });
      const join = (arr) => arr.length > 1 ? arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1] : arr[0];
      title = wins.length
        ? esc(focus.short) + ' leads on ' + join(wins) + (losses.length ? ', trails on ' + join(losses) : '')
        : esc(focus.short) + ' trails on ' + join(losses);
    }

    const h2h = others.map((o) => {
      const accDiff = focus.strict !== null && o.strict !== null ? focus.strict - o.strict : null;
      return '<div class="h2h-row">' +
        '<div class="h2h-vs"><span class="muted">vs</span>' + swatch(o) + '<span title="' + esc(o.name) + '">' + esc(o.short) + '</span></div>' +
        deltaPoints(accDiff) +
        deltaRatio(focus.avgLat, o.avgLat, 'faster', 'slower', 'latency') +
        deltaRatio(focus.runCost, o.runCost, 'cheaper', 'pricier', 'cost') +
        '</div>';
    }).join('');

    el.innerHTML =
      '<div>' +
        '<div class="eyebrow">Result</div>' +
        '<h2 class="verdict-title">' + title + '</h2>' +
        '<p class="verdict-sub">' + fmt.int(n) + ' scenarios · ' + models.length + ' model' + (models.length === 1 ? '' : 's') +
        '. Strict accuracy counts only the primary category; relaxed also accepts the listed secondary categories.</p>' +
      '</div>' +
      (others.length ? '<div class="h2h" aria-label="' + esc(focus.short) + ' head-to-head">' + h2h + '</div>' : '');
  }

  function deltaPoints(diff) {
    if (diff === null) return '<div class="delta even"><span class="delta-val">—</span><span class="delta-lbl">strict accuracy</span></div>';
    const cls = Math.abs(diff) < 0.05 ? 'even' : diff > 0 ? 'good' : 'bad';
    const ic = cls === 'even' ? 'equal' : diff > 0 ? 'up' : 'down';
    const text = cls === 'even' ? 'Even' : (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + ' pts';
    return '<div class="delta ' + cls + '"><span class="delta-val">' + icon(ic, 'icon-sm') + text + '</span><span class="delta-lbl">strict accuracy</span></div>';
  }

  // Lower-is-better metrics: ratio of the competitor's value to the focus model's.
  function deltaRatio(mine, theirs, betterWord, worseWord, label) {
    if (!mine || !theirs) return '<div class="delta even"><span class="delta-val">—</span><span class="delta-lbl">' + label + '</span></div>';
    const r = theirs / mine;
    if (Math.abs(r - 1) < 0.05) {
      return '<div class="delta even"><span class="delta-val">' + icon('equal', 'icon-sm') + 'Even</span><span class="delta-lbl">' + label + '</span></div>';
    }
    const good = r > 1;
    const text = fmt.ratio(good ? r : 1 / r) + ' ' + (good ? betterWord : worseWord);
    return '<div class="delta ' + (good ? 'good' : 'bad') + '"><span class="delta-val">' + icon(good ? 'up' : 'down', 'icon-sm') + text + '</span><span class="delta-lbl">' + label + '</span></div>';
  }

  // ---------- KPIs ----------

  function renderKPIs() {
    const details = report.details || [];
    const n = report.totalScenarios || details.length;
    const multi = details.filter((d) => d.isMultiIntent).length;
    const cats = new Set(details.map((d) => d.groundTruth).filter(Boolean)).size;

    const tile = (iconName, label, value, footHtml) =>
      '<div class="card kpi">' +
        '<div class="kpi-label">' + icon(iconName, 'icon-sm') + label + '</div>' +
        '<div class="kpi-value num">' + value + '</div>' +
        '<div class="kpi-foot">' + footHtml + '</div>' +
      '</div>';

    const winner = (key, better, formatter, suffix) => {
      const ids = bestIds(key, better);
      const ms = models.filter((m) => ids.has(m.id));
      if (!ms.length) return { value: '—', foot: '<span class="muted">Not reported</span>' };
      return {
        value: formatter(ms[0][key]),
        foot: ms.map(swatch).join('') + '<span>' + esc(ms.map((m) => m.short).join(', ')) + (suffix ? ' · ' + suffix : '') + '</span>',
      };
    };

    const acc = winner('strict', 'high', fmt.pct, 'strict');
    const lat = winner('avgLat', 'low', fmt.ms, 'avg');
    const cost = winner('runCost', 'low', fmt.tinyUsd, 'this run (' + fmt.int(n) + ' scenarios)');

    $('kpis').innerHTML =
      tile('list', 'Scenarios', fmt.int(n), '<span>' + multi + ' multi-intent · ' + cats + ' categor' + (cats === 1 ? 'y' : 'ies') + '</span>') +
      tile('target', 'Best accuracy', acc.value, acc.foot) +
      tile('clock', 'Fastest', lat.value, lat.foot) +
      tile('coins', 'Lowest cost', cost.value, cost.foot);
  }

  // ---------- Bar charts ----------

  function renderCharts() {
    renderBarChart('chartAccuracy', {
      key: 'strict', ghostKey: 'relaxed', better: 'high', max: 100,
      value: (m) => fmt.pct(m.strict),
      sub: (m) => m.relaxed !== null && m.relaxed !== m.strict ? 'relaxed ' + fmt.pct(m.relaxed) : '',
      legend: [['Strict', false], ['Relaxed', true]],
    });
    renderBarChart('chartLatency', {
      key: 'avgLat', ghostKey: 'p95', better: 'low',
      value: (m) => fmt.ms(m.avgLat),
      sub: (m) => m.p95 !== null ? 'p95 ' + fmt.ms(m.p95) : '',
      legend: [['Average', false], ['P95', true]],
    });
    renderBarChart('chartCost', {
      key: 'runCost', better: 'low',
      value: (m) => fmt.tinyUsd(m.runCost),
      sub: () => '',
    });
  }

  function renderBarChart(id, opts) {
    const el = $(id);
    const best = bestIds(opts.key, opts.better);
    const max = opts.max || Math.max(1e-9, ...models.map((m) => Math.max(m[opts.key] || 0, opts.ghostKey ? (m[opts.ghostKey] || 0) : 0)));

    const rows = models.map((m) => {
      const v = m[opts.key];
      const g = opts.ghostKey ? m[opts.ghostKey] : null;
      const w = v === null ? 0 : (v / max) * 100;
      const gw = g === null ? 0 : (g / max) * 100;
      const sub = opts.sub(m);
      return '<div class="bar-row" tabindex="0" data-model="' + esc(m.id) + '" aria-label="' + esc(m.name + ': ' + opts.value(m) + (sub ? ', ' + sub : '')) + '">' +
        '<div class="bar-top">' +
          '<span class="bar-name">' + swatch(m) + '<span>' + esc(m.short) + '</span>' +
            (best.has(m.id) && models.length > 1 ? '<span class="bar-best">' + icon('check', 'icon-sm') + 'Best</span>' : '') +
          '</span>' +
          '<span class="bar-value num">' + opts.value(m) + (sub ? ' <span class="muted" style="font-weight:400">· ' + sub + '</span>' : '') + '</span>' +
        '</div>' +
        '<div class="bar-track">' +
          (opts.ghostKey ? '<div class="bar-fill ghost" style="--c:' + m.color + ';width:' + gw.toFixed(2) + '%"></div>' : '') +
          '<div class="bar-fill" style="--c:' + m.color + ';width:' + w.toFixed(2) + '%"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    const legend = opts.legend
      ? '<div class="legend" aria-hidden="true">' + opts.legend.map(([label, ghost]) =>
          '<span class="legend-item"><span class="legend-key' + (ghost ? ' ghost' : '') + '"></span>' + label + '</span>').join('') + '</div>'
      : '';

    el.innerHTML = '<div class="bars">' + rows + '</div>' + legend;
    el.querySelectorAll('.bar-row').forEach((row) => attachTooltip(row, () => modelTooltip(modelById(row.dataset.model))));
  }

  function modelTooltip(m) {
    if (!m) return '';
    const rows = [
      ['Strict acc.', fmt.pct(m.strict)],
      ['Relaxed acc.', fmt.pct(m.relaxed)],
      ['Avg confidence', fmt.pct(m.conf)],
      ['Avg latency', fmt.ms(m.avgLat)],
      ['P95 latency', fmt.ms(m.p95)],
      ['Run cost', fmt.tinyUsd(m.runCost)],
    ];
    return '<strong>' + esc(m.name) + '</strong><dl>' + rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>';
  }

  // ---------- Tooltip ----------

  const tooltip = () => $('tooltip');

  function attachTooltip(el, html) {
    const show = (x, y) => {
      const t = tooltip();
      t.innerHTML = html();
      t.classList.add('show');
      const r = t.getBoundingClientRect();
      const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
      const top = y + 14 + r.height > window.innerHeight ? y - r.height - 10 : y + 14;
      t.style.left = left + 'px';
      t.style.top = Math.max(8, top) + 'px';
    };
    const hide = () => tooltip().classList.remove('show');
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') show(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', hide);
    el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); show(r.left + r.width / 2, r.bottom - 6); });
    el.addEventListener('blur', hide);
  }

  // ---------- Summary table ----------

  const COLUMNS = [
    { key: 'strict', label: 'Strict', group: 'Accuracy', better: 'high', fmt: fmt.pct, sep: true },
    { key: 'relaxed', label: 'Relaxed', group: 'Accuracy', better: 'high', fmt: fmt.pct },
    { key: 'single', label: 'Single-intent', group: 'Accuracy', better: 'high', fmt: fmt.pct },
    { key: 'multi', label: 'Multi-intent', group: 'Accuracy', better: 'high', fmt: fmt.pct },
    { key: 'conf', label: 'Avg conf.', group: 'Accuracy', fmt: fmt.pct },
    { key: 'avgLat', label: 'Avg', group: 'Latency', better: 'low', fmt: fmt.ms, sep: true },
    { key: 'p95', label: 'P95', group: 'Latency', better: 'low', fmt: fmt.ms },
    { key: 'avgIn', label: 'Avg in', group: 'Tokens', fmt: fmt.int, sep: true },
    { key: 'avgOut', label: 'Avg out', group: 'Tokens', fmt: fmt.int },
    { key: 'totalTokens', label: 'Total', group: 'Tokens', fmt: fmt.int },
    { key: 'runCost', label: 'Run total', group: 'Cost', better: 'low', fmt: fmt.tinyUsd, sep: true },
    { key: 'cost10k', label: 'Per 10k', group: 'Cost', better: 'low', fmt: (v) => fmt.usd(v, 3) },
    { key: 'errors', label: 'Errors', group: '', fmt: fmt.int, sep: true },
  ];

  function renderSummaryTable() {
    const groups = [];
    COLUMNS.forEach((c) => {
      const last = groups[groups.length - 1];
      if (last && last.name === c.group) last.span++;
      else groups.push({ name: c.group, span: 1 });
    });

    const head =
      '<tr class="group"><th class="model-cell"></th>' +
        groups.map((g) => '<th class="c sep" colspan="' + g.span + '">' + esc(g.name) + '</th>').join('') +
      '</tr>' +
      '<tr><th class="model-cell" scope="col">Model</th>' +
        COLUMNS.map((c) => {
          const active = sort.key === c.key;
          const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
          const ind = active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼';
          return '<th class="r' + (c.sep ? ' sep' : '') + '" scope="col" aria-sort="' + ariaSort + '">' +
            '<button class="sort-btn" data-sort="' + c.key + '">' + esc(c.label) + '<span class="sort-ind" aria-hidden="true">' + ind + '</span></button></th>';
        }).join('') +
      '</tr>';

    const best = {};
    COLUMNS.forEach((c) => { if (c.better && models.length > 1) best[c.key] = bestIds(c.key, c.better); });

    const rows = [...models];
    if (sort.key) {
      rows.sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        if (av === null) return 1;
        if (bv === null) return -1;
        return sort.dir === 'asc' ? av - bv : bv - av;
      });
    }

    const body = rows.map((m) =>
      '<tr><th class="model-cell" scope="row"><span class="model-label">' + swatch(m) + esc(m.name) + '</span></th>' +
        COLUMNS.map((c) => {
          const v = m[c.key];
          let text = c.fmt(v);
          let cls = 'r num' + (c.sep ? ' sep' : '');
          if (c.key === 'errors' && v > 0) text = '<span class="chip chip-bad">' + icon('alert', 'icon-sm') + v + '</span>';
          else if (best[c.key] && best[c.key].has(m.id)) cls += ' best-cell';
          return '<td class="' + cls + '">' + text + '</td>';
        }).join('') +
      '</tr>').join('');

    $('summaryTable').innerHTML = '<thead>' + head + '</thead><tbody>' + body + '</tbody>';
    $('summaryTable').querySelectorAll('.sort-btn').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      const col = COLUMNS.find((c) => c.key === key);
      if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
      else sort = { key, dir: col.better === 'low' ? 'asc' : 'desc' };
      renderSummaryTable();
      const again = $('summaryTable').querySelector('[data-sort="' + key + '"]');
      if (again) again.focus();
    }));
  }

  // ---------- Breakdown matrix ----------

  function renderBreakdown() {
    const details = report.details || [];
    const tally = (filter) => models.map((m) => {
      let total = 0, ok = 0;
      details.forEach((d) => {
        if (!filter(d)) return;
        const r = (d.results || {})[m.id];
        if (!r || r.error) return;
        total++;
        if (r.strictMatch) ok++;
      });
      return { ok, total };
    });

    const catCounts = new Map();
    details.forEach((d) => catCounts.set(d.groundTruth, (catCounts.get(d.groundTruth) || 0) + 1));
    const cats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
    const diffs = DIFFICULTY_ORDER.filter((lvl) => details.some((d) => d.difficulty === lvl));

    const cell = ({ ok, total }) => {
      if (!total) return '<td class="cell"><span class="muted">—</span></td>';
      const pct = (ok / total) * 100;
      const fill = pct >= 90 ? 'var(--good)' : pct >= 70 ? 'var(--warn)' : 'var(--bad)';
      return '<td class="cell"><div class="cell-bar">' +
        '<div class="bar-track"><div class="bar-fill" style="--fill:' + fill + ';width:' + pct.toFixed(1) + '%"></div></div>' +
        '<span class="cell-text num">' + ok + '/' + total + ' · <strong>' + Math.round(pct) + '%</strong></span>' +
      '</div></td>';
    };

    const groupRow = (label) => '<tr><th colspan="' + (models.length + 1) + '" class="muted" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:var(--surface-2)">' + label + '</th></tr>';

    let body = groupRow('By category');
    body += cats.map(([code, count]) =>
      '<tr><th scope="row" class="model-cell"><span class="cat-name"><span><span class="mono">' + esc(code) + '</span> ' + esc(categoryLabel(code)) + '</span><small>' + count + ' scenario' + (count === 1 ? '' : 's') + '</small></span></th>' +
      tally((d) => d.groundTruth === code).map(cell).join('') + '</tr>').join('');

    if (diffs.length) {
      body += groupRow('By difficulty');
      body += diffs.map((lvl) => '<tr><th scope="row" class="model-cell" style="text-transform:capitalize">' + lvl + '</th>' + tally((d) => d.difficulty === lvl).map(cell).join('') + '</tr>').join('');
    }
    body += groupRow('By intent');
    body += '<tr><th scope="row" class="model-cell">Single-intent</th>' + tally((d) => !d.isMultiIntent).map(cell).join('') + '</tr>';
    body += '<tr><th scope="row" class="model-cell">Multi-intent</th>' + tally((d) => d.isMultiIntent).map(cell).join('') + '</tr>';

    $('breakdownTable').innerHTML =
      '<thead><tr><th class="model-cell" scope="col">Segment</th>' +
        models.map((m) => '<th scope="col"><span class="model-label">' + swatch(m) + esc(m.short) + '</span></th>').join('') +
      '</tr></thead><tbody>' + body + '</tbody>';
  }

  // ---------- Scenario explorer ----------

  function populateFilters() {
    const details = report.details || [];
    const cats = [...new Set(details.map((d) => d.groundTruth).filter(Boolean))].sort();
    $('categoryFilter').innerHTML = '<option value="ALL">All categories</option>' +
      cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + ' · ' + esc(categoryLabel(c)) + '</option>').join('');

    const diffs = DIFFICULTY_ORDER.filter((lvl) => details.some((d) => d.difficulty === lvl));
    $('difficultyFilter').innerHTML = '<option value="ALL">All difficulties</option>' +
      diffs.map((lvl) => '<option value="' + lvl + '">' + lvl.charAt(0).toUpperCase() + lvl.slice(1) + '</option>').join('');

    $('modelFilter').innerHTML = '<option value="ALL">Any model</option>' +
      models.map((m) => '<option value="' + esc(m.id) + '">' + esc(m.short) + '</option>').join('');
  }

  function resultFlags(r) {
    if (!r) return {};
    return {
      error: Boolean(r.error),
      wrongStrict: !r.error && r.strictMatch === false,
      wrongRelaxed: !r.error && r.relaxedMatch === false,
      lowConf: !r.error && typeof r.confidence === 'number' && r.confidence < LOW_CONFIDENCE,
    };
  }

  function filteredScenarios() {
    const q = $('searchInput').value.trim().toLowerCase();
    const cat = $('categoryFilter').value;
    const diff = $('difficultyFilter').value;
    const outcome = $('outcomeFilter').value;
    const modelId = $('modelFilter').value;

    return (report.details || []).filter((d) => {
      if (cat !== 'ALL' && d.groundTruth !== cat) return false;
      if (diff !== 'ALL' && d.difficulty !== diff) return false;

      const results = d.results || {};
      const scoped = modelId === 'ALL' ? Object.values(results) : [results[modelId]].filter(Boolean);
      const flags = scoped.map(resultFlags);
      const any = (k) => flags.some((f) => f[k]);

      switch (outcome) {
        case 'WRONG_STRICT': if (!any('wrongStrict')) return false; break;
        case 'WRONG_RELAXED': if (!any('wrongRelaxed')) return false; break;
        case 'LOW_CONF': if (!any('lowConf')) return false; break;
        case 'ERROR': if (!any('error')) return false; break;
        case 'DISAGREE': {
          const preds = new Set(Object.values(results).filter((r) => !r.error).map((r) => r.category));
          if (preds.size < 2) return false;
          break;
        }
        case 'MULTI': if (!d.isMultiIntent) return false; break;
      }

      if (q) {
        const hay = [d.scenarioId, d.groundTruth, categoryLabel(d.groundTruth), d.dialogue, d.rationale]
          .concat(Object.values(results).map((r) => r.category))
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderScenarios(resetPaging) {
    if (resetPaging) visibleCount = PAGE_SIZE;
    const all = report.details || [];
    const list = filteredScenarios();
    const shown = list.slice(0, visibleCount);

    $('scenarioCount').textContent = 'Showing ' + shown.length + ' of ' + list.length + ' matching' +
      (list.length !== all.length ? ' (' + all.length + ' total)' : '');

    if (!list.length) {
      $('scenarioList').innerHTML = '<div class="empty">' + icon('search') +
        '<div>No scenarios match these filters.</div><button class="btn" type="button" data-action="reset">Clear filters</button></div>';
      $('moreWrap').hidden = true;
      return;
    }

    $('scenarioList').innerHTML = shown.map(scenarioHtml).join('');
    $('moreWrap').hidden = shown.length >= list.length;
    $('moreBtn').textContent = 'Show ' + Math.min(PAGE_SIZE, list.length - shown.length) + ' more';
  }

  function difficultyChip(lvl) {
    if (!lvl) return '';
    const cls = lvl === 'hard' ? 'chip-bad' : lvl === 'medium' ? 'chip-warn' : 'chip-good';
    return '<span class="chip ' + cls + '" style="text-transform:capitalize">' + esc(lvl) + '</span>';
  }

  function scenarioHtml(d) {
    const results = d.results || {};
    const ordered = models.map((m) => [m, results[m.id]]).filter(([, r]) => r);
    Object.entries(results).forEach(([id, r]) => {
      if (!modelById(id)) ordered.push([{ id, name: r.modelName || id, short: r.modelName || id, color: 'var(--ink-3)' }, r]);
    });

    const secondary = Array.isArray(d.secondaryCategories) && d.secondaryCategories.length
      ? '<span class="chip">Also accepted: <span class="mono">' + esc(d.secondaryCategories.join(', ')) + '</span></span>'
      : '';

    return '<article class="scenario" aria-label="Scenario ' + esc(d.scenarioId) + '">' +
      '<div class="scenario-head">' +
        '<span class="chip chip-id">' + esc(d.scenarioId) + '</span>' +
        '<span class="chip">Truth: <strong class="mono">' + esc(d.groundTruth) + '</strong>&nbsp;' + esc(categoryLabel(d.groundTruth)) + '</span>' +
        difficultyChip(d.difficulty) +
        (d.isMultiIntent ? '<span class="chip chip-warn">Multi-intent</span>' : '') +
        secondary +
      '</div>' +
      '<div class="preds">' + ordered.map(([m, r]) => predHtml(m, r)).join('') + '</div>' +
      dialogueHtml(d) +
    '</article>';
  }

  function predHtml(m, r) {
    const name = '<div class="pred-model">' + swatch(m) + '<span title="' + esc(m.name) + '">' + esc(m.short) + '</span></div>';
    if (r.error) {
      return '<div class="pred is-bad">' + name +
        '<div class="pred-verdict"><span class="chip chip-bad">' + icon('alert', 'icon-sm') + 'Error</span></div>' +
        '<div class="pred-error">' + esc(r.error) + '</div></div>';
    }

    let verdict, rowCls = '';
    if (r.strictMatch) verdict = '<span class="chip chip-good">' + icon('check', 'icon-sm') + 'Correct</span>';
    else if (r.relaxedMatch) { verdict = '<span class="chip chip-warn">' + icon('tilde', 'icon-sm') + 'Secondary</span>'; rowCls = ' is-warn'; }
    else { verdict = '<span class="chip chip-bad">' + icon('x', 'icon-sm') + 'Wrong</span>'; rowCls = ' is-bad'; }

    let conf = '<div class="conf muted">No confidence</div>';
    if (typeof r.confidence === 'number') {
      const pct = Math.max(0, Math.min(100, r.confidence * 100));
      const fill = pct < 65 ? 'var(--bad)' : pct < 85 ? 'var(--warn)' : 'var(--good)';
      conf = '<div class="conf" title="Confidence ' + pct.toFixed(1) + '%">' +
        '<span class="muted" style="font-size:12px">Conf.</span>' +
        '<div class="bar-track"><div class="bar-fill" style="--fill:' + fill + ';width:' + pct.toFixed(1) + '%"></div></div>' +
        '<span class="conf-val num">' + Math.round(pct) + '%</span></div>';
    }

    return '<div class="pred' + rowCls + '">' + name +
      '<div class="pred-verdict">' + verdict + '<span class="pred-cat">' + esc(r.category || '—') + '</span></div>' +
      conf +
      '<div class="pred-stat num"><small>Latency</small>' + fmt.ms(num(r.latencyMs)) + '</div>' +
      '<div class="pred-stat num" title="Input / output tokens"><small>Tokens</small>' + fmt.int(num(r.inputTokens)) + ' / ' + fmt.int(num(r.outputTokens)) + '</div>' +
      '<div class="pred-stat num"><small>Cost</small>' + fmt.tinyUsd(num(r.totalCostUsd !== undefined ? r.totalCostUsd : r.costUsd)) + '</div>' +
    '</div>';
  }

  function parseTurns(text) {
    const turns = [];
    String(text).split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Za-z][\w .'-]{0,30}):\s?(.*)$/);
      if (m) turns.push({ who: m[1].trim(), text: m[2] });
      else if (turns.length) turns[turns.length - 1].text += '\n' + line;
      else if (line.trim()) turns.push({ who: '', text: line });
    });
    return turns;
  }

  function dialogueHtml(d) {
    if (!d.dialogue && !d.rationale) return '';
    const turns = d.dialogue ? parseTurns(d.dialogue) : [];
    const turnsHtml = turns.map((t) => {
      const isEmployee = /employee|user|caller|customer/i.test(t.who);
      const label = /agent/i.test(t.who) ? 'Agent' : t.who;
      return '<div class="turn' + (isEmployee ? ' employee' : '') + '"><div class="turn-who">' + esc(label) + '</div><div class="turn-text">' + esc(t.text) + '</div></div>';
    }).join('');

    return '<details class="dialogue"' + (dialoguesOpen ? ' open' : '') + '>' +
      '<summary>' + icon('chevron', 'icon-sm chev') + 'Dialogue' + (turns.length ? ' <span class="muted">· ' + turns.length + ' turns</span>' : '') + (d.rationale ? ' <span class="muted">· routing rationale</span>' : '') + '</summary>' +
      '<div class="dialogue-body">' +
        (d.rationale ? '<div class="rationale"><strong>Routing rationale:</strong> ' + esc(d.rationale) + '</div>' : '') +
        (turnsHtml ? '<div class="turns">' + turnsHtml + '</div>' : '') +
      '</div></details>';
  }

  function resetFilters() {
    $('searchInput').value = '';
    ['categoryFilter', 'difficultyFilter', 'outcomeFilter', 'modelFilter'].forEach((id) => { $(id).value = 'ALL'; });
    renderScenarios(true);
  }

  // ---------- Theme ----------

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { return 'system'; }
  }

  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    const btn = $('themeBtn');
    const label = { system: 'System', light: 'Light', dark: 'Dark' }[mode];
    btn.innerHTML = icon(mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor');
    btn.setAttribute('aria-label', 'Theme: ' + label + '. Click to change.');
    btn.title = 'Theme: ' + label;
    btn.dataset.mode = mode;
  }

  // ---------- Bootstrap ----------

  function renderAll() {
    models = buildModels(report);
    sort = { key: null, dir: 'desc' };
    const n = report.totalScenarios || (report.details || []).length;
    const when = report.timestamp ? new Date(report.timestamp) : null;
    $('reportMeta').innerHTML = icon('clock', 'icon-sm') + '<span>' + (when && !isNaN(when) ? esc(when.toLocaleString()) : 'Unknown date') + ' · ' + fmt.int(n) + ' scenarios</span>';
    $('headerModels').textContent = models.map((m) => m.short).join(' vs ');

    renderVerdict();
    renderKPIs();
    renderCharts();
    renderSummaryTable();
    renderBreakdown();
    populateFilters();
    renderScenarios(true);
  }

  function showError(message) {
    const el = $('loadError');
    el.querySelector('span').textContent = message;
    el.hidden = false;
  }

  function init() {
    applyTheme(readTheme());
    $('themeBtn').addEventListener('click', () => {
      const order = ['system', 'light', 'dark'];
      const next = order[(order.indexOf($('themeBtn').dataset.mode) + 1) % order.length];
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
      applyTheme(next);
    });

    try {
      report = JSON.parse($('report-data').textContent);
    } catch (e) {
      showError('Embedded report data could not be parsed: ' + e.message);
      return;
    }

    let searchTimer;
    $('searchInput').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderScenarios(true), 150);
    });
    ['categoryFilter', 'difficultyFilter', 'outcomeFilter', 'modelFilter'].forEach((id) =>
      $(id).addEventListener('change', () => renderScenarios(true)));
    $('resetBtn').addEventListener('click', resetFilters);
    $('scenarioList').addEventListener('click', (e) => {
      if (e.target.closest('[data-action="reset"]')) resetFilters();
    });
    $('moreBtn').addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      renderScenarios(false);
    });
    $('toggleDialogues').addEventListener('click', () => {
      dialoguesOpen = !dialoguesOpen;
      document.querySelectorAll('details.dialogue').forEach((el) => { el.open = dialoguesOpen; });
      $('toggleDialogues').textContent = dialoguesOpen ? 'Collapse all dialogues' : 'Expand all dialogues';
    });

    $('loadBtn').addEventListener('click', () => $('jsonFileInput').click());
    $('jsonFileInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || !Array.isArray(parsed.summary) || !Array.isArray(parsed.details)) {
            throw new Error('expected "summary" and "details" arrays');
          }
          report = parsed;
          $('loadError').hidden = true;
          $('searchInput').value = '';
          renderAll();
        } catch (err) {
          showError('Could not load ' + file.name + ': ' + err.message);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    $('dismissError').addEventListener('click', () => { $('loadError').hidden = true; });

    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
