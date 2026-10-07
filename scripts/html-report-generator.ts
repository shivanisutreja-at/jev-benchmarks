export interface ReportPayload {
  timestamp: string;
  totalScenarios: number;
  configuredModels: { id: string; name: string }[];
  summary: any[];
  details: any[];
}

export function generateHtmlReport(data: ReportPayload): string {
  const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Helpdesk Intent Routing Benchmark - Jev vs LLMs</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f0f9ff',
              500: '#0ea5e9',
              600: '#0284c7',
              700: '#0369a1',
            }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .badge-strict { background-color: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-relaxed { background-color: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
    .badge-error { background-color: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #020617; }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #334155; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-sky-500/30">

  <!-- Header -->
  <header class="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur sticky top-0 z-30 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <span class="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold uppercase tracking-wider">Evaluation Report</span>
          <h1 class="text-lg sm:text-xl font-bold tracking-tight text-white">Helpdesk Routing Intent Benchmark</h1>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Head-to-head decision evaluation: <span class="text-sky-400 font-medium">Jev (~typesafe)</span> vs <span class="text-emerald-400 font-medium">GPT-6 Luna</span> vs <span class="text-indigo-400 font-medium">DeepSeek</span>
        </p>
      </div>

      <div class="flex items-center gap-3">
        <label class="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Load Custom JSON
          <input type="file" id="jsonFileInput" accept=".json" class="hidden">
        </label>
        <div id="reportTimestamp" class="text-xs text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 font-mono"></div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">

    <!-- KPI Metric Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpiCards"></section>

    <!-- Charts Row -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-200 mb-1 flex items-center justify-between">
          <span>Latency Comparison</span>
          <span class="text-xs text-slate-400 font-normal">Average ms (Lower is better)</span>
        </h3>
        <div class="h-60 mt-3 relative">
          <canvas id="latencyChart"></canvas>
        </div>
      </div>

      <div class="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-200 mb-1 flex items-center justify-between">
          <span>Cost per 10k Decisions</span>
          <span class="text-xs text-slate-400 font-normal">USD $ (Lower is better)</span>
        </h3>
        <div class="h-60 mt-3 relative">
          <canvas id="costChart"></canvas>
        </div>
      </div>

      <div class="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-200 mb-1 flex items-center justify-between">
          <span>Accuracy Comparison</span>
          <span class="text-xs text-slate-400 font-normal">Strict vs Relaxed</span>
        </h3>
        <div class="h-60 mt-3 relative">
          <canvas id="accuracyChart"></canvas>
        </div>
      </div>
    </section>

    <!-- Detailed Summary Table -->
    <section class="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
      <div class="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <div>
          <h2 class="text-sm sm:text-base font-semibold text-white">Benchmark Summary Table</h2>
          <p class="text-xs text-slate-400 mt-0.5">Comprehensive performance, decision confidence, accuracy, and cost breakdown per model</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs" id="summaryTable">
          <thead class="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800 tracking-wider">
            <tr>
              <th class="py-3 px-4">Model</th>
              <th class="py-3 px-3">Strict Acc %</th>
              <th class="py-3 px-3">Relaxed Acc %</th>
              <th class="py-3 px-3 text-center">Avg Conf %</th>
              <th class="py-3 px-3">Single-Intent</th>
              <th class="py-3 px-3">Multi-Intent</th>
              <th class="py-3 px-3 text-right">Avg Latency</th>
              <th class="py-3 px-3 text-right">P95 Latency</th>
              <th class="py-3 px-3 text-right">Avg In / Out</th>
              <th class="py-3 px-3 text-right">Total Tokens</th>
              <th class="py-3 px-3 text-right">Total Cost ($)</th>
              <th class="py-3 px-4 text-right">Cost / 10k</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/80 text-slate-200" id="summaryTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- Scenario Explorer -->
    <section class="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm p-5 space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 class="text-sm sm:text-base font-semibold text-white">Scenario-by-Scenario Drilldown</h2>
          <p class="text-xs text-slate-400 mt-0.5">Inspect ground truth, decision confidences, and model classifications</p>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-2.5">
          <input type="text" id="searchInput" placeholder="Search ID, text, category..."
            class="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 w-52 transition placeholder-slate-500">

          <select id="categoryFilter" class="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500">
            <option value="ALL">All Categories</option>
            <option value="PYC">PYC (Payroll)</option>
            <option value="DTE">DTE (Data & Tools)</option>
            <option value="EMP">EMP (Employment)</option>
            <option value="ONB">ONB (Onboarding)</option>
            <option value="ASR">ASR (Reviews & Comp)</option>
            <option value="PMS">PMS (Performance)</option>
            <option value="TAL">TAL (Talent)</option>
          </select>

          <select id="outcomeFilter" class="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500">
            <option value="ALL">All Outcomes</option>
            <option value="MISMATCH">Mismatches Only (❌)</option>
            <option value="MULTI_INTENT">Multi-Intent Only</option>
            <option value="LOW_CONFIDENCE">Low Confidence (&lt;80%)</option>
          </select>
        </div>
      </div>

      <div class="text-xs text-slate-400 flex items-center justify-between">
        <span id="scenariosCountText" class="font-medium">Showing 0 scenarios</span>
        <button id="toggleAllDialogueBtn" class="text-2xs text-sky-400 hover:text-sky-300 transition">Expand All Dialogues</button>
      </div>

      <div class="space-y-3 max-h-[750px] overflow-y-auto pr-2" id="scenariosList"></div>
    </section>

  </main>

  <footer class="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
    Helpdesk Intent Routing Benchmark &bull; Generated from jev-benchmarks
  </footer>

  <script>
    let reportData = ${dataJson};
    let allExpanded = false;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function renderAll() {
      if (!reportData || !reportData.summary) return;

      const dateStr = reportData.timestamp ? new Date(reportData.timestamp).toLocaleString() : 'N/A';
      document.getElementById('reportTimestamp').textContent = \`Evaluated: \${dateStr}\`;

      renderKPIs();
      renderCharts();
      renderSummaryTable();
      renderScenarios();
    }

    function renderKPIs() {
      const summary = reportData.summary;
      const kpiContainer = document.getElementById('kpiCards');
      if (!summary || summary.length === 0) return;

      const lowestLatency = [...summary].sort((a,b) => parseFloat(a['Avg Latency']) - parseFloat(b['Avg Latency']))[0];
      const lowestCost = [...summary].sort((a,b) => parseFloat((a['Total Cost ($)']||'0').replace('$','')) - parseFloat((b['Total Cost ($)']||'0').replace('$','')))[0];
      const highestAcc = [...summary].sort((a,b) => parseFloat(b['Strict Acc %']) - parseFloat(a['Strict Acc %']))[0];

      // Find average confidence if reported
      const confReported = summary.find(s => s['Avg Conf %'] && s['Avg Conf %'] !== '—');

      kpiContainer.innerHTML = \`
        <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div class="text-xs font-medium text-slate-400">Total Scenarios Tested</div>
          <div class="text-2xl font-bold text-white mt-1">\${reportData.totalScenarios || reportData.details?.length || 0}</div>
          <div class="text-xs text-slate-400 mt-1">Across 7 Support Categories</div>
        </div>

        <div class="bg-slate-900/80 border border-sky-500/30 rounded-xl p-4 bg-gradient-to-br from-sky-500/5 to-transparent shadow-sm">
          <div class="text-xs font-medium text-sky-400">Speed Champion</div>
          <div class="text-2xl font-bold text-white mt-1 font-mono">\${lowestLatency['Avg Latency']}</div>
          <div class="text-xs text-slate-300 mt-1 truncate font-medium">\${lowestLatency['Model']}</div>
        </div>

        <div class="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 bg-gradient-to-br from-emerald-500/5 to-transparent shadow-sm">
          <div class="text-xs font-medium text-emerald-400">Cost Efficiency Champion</div>
          <div class="text-2xl font-bold text-white mt-1 font-mono">\${lowestCost['Cost / 10k Decisions']}</div>
          <div class="text-xs text-slate-300 mt-1 truncate font-medium">\${lowestCost['Model']} (per 10k)</div>
        </div>

        <div class="bg-slate-900/80 border border-purple-500/30 rounded-xl p-4 bg-gradient-to-br from-purple-500/5 to-transparent shadow-sm">
          <div class="text-xs font-medium text-purple-400">Highest Accuracy</div>
          <div class="text-2xl font-bold text-white mt-1 font-mono">\${highestAcc['Strict Acc %']}</div>
          <div class="text-xs text-slate-300 mt-1 truncate font-medium">\${highestAcc['Model']} (Strict)</div>
        </div>
      \`;
    }

    let latChart, costChartInst, accChart;

    function renderCharts() {
      const summary = reportData.summary;
      if (!summary || summary.length === 0) return;

      const labels = summary.map(s => s['Model'].split(' ')[0]);
      const latencies = summary.map(s => parseFloat(s['Avg Latency']));
      const costsPer10k = summary.map(s => parseFloat((s['Cost / 10k Decisions']||'0').replace('$', '')));
      const strictAcc = summary.map(s => parseFloat(s['Strict Acc %']));
      const relaxedAcc = summary.map(s => parseFloat(s['Relaxed Acc %']));

      if (latChart) latChart.destroy();
      if (costChartInst) costChartInst.destroy();
      if (accChart) accChart.destroy();

      // Latency Chart
      latChart = new Chart(document.getElementById('latencyChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Avg Latency (ms)',
            data: latencies,
            backgroundColor: ['#0ea5e9', '#10b981', '#6366f1'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      });

      // Cost Chart
      costChartInst = new Chart(document.getElementById('costChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Cost per 10k ($)',
            data: costsPer10k,
            backgroundColor: ['#0ea5e9', '#10b981', '#6366f1'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      });

      // Accuracy Chart
      accChart = new Chart(document.getElementById('accuracyChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Strict %', data: strictAcc, backgroundColor: '#0ea5e9', borderRadius: 4 },
            { label: 'Relaxed %', data: relaxedAcc, backgroundColor: '#38bdf8', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12 } } },
          scales: {
            y: { max: 100, min: 0, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    function renderSummaryTable() {
      const summary = reportData.summary;
      const tbody = document.getElementById('summaryTableBody');
      tbody.innerHTML = '';

      summary.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition';

        const confVal = row['Avg Conf %'];
        const confHtml = confVal && confVal !== '—'
          ? \`<span class="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">\${confVal}</span>\`
          : \`<span class="text-slate-500">—</span>\`;

        tr.innerHTML = \`
          <td class="py-3 px-4 font-semibold text-white">\${row['Model']}</td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-xs font-semibold badge-strict">\${row['Strict Acc %']}</span></td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-xs font-semibold badge-relaxed">\${row['Relaxed Acc %']}</span></td>
          <td class="py-3 px-3 text-center">\${confHtml}</td>
          <td class="py-3 px-3 text-slate-300 font-mono">\${row['Single-Intent Acc']}</td>
          <td class="py-3 px-3 text-slate-300 font-mono">\${row['Multi-Intent Acc']}</td>
          <td class="py-3 px-3 text-right font-mono text-sky-400 font-semibold">\${row['Avg Latency']}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-400">\${row['P95 Latency']}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300">\${row['Avg In Tokens'] || '—'} / \${row['Avg Out Tokens'] || '—'}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300 font-semibold">\${row['Total Tokens'] || '—'}</td>
          <td class="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">\${row['Total Cost ($)']}</td>
          <td class="py-3 px-4 text-right font-mono text-emerald-300 font-bold">\${row['Cost / 10k Decisions']}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function renderScenarios() {
      const details = reportData.details || [];
      const list = document.getElementById('scenariosList');
      const search = (document.getElementById('searchInput').value || '').toLowerCase();
      const catFilter = document.getElementById('categoryFilter').value;
      const outcomeFilter = document.getElementById('outcomeFilter').value;

      list.innerHTML = '';

      const filtered = details.filter(item => {
        if (catFilter !== 'ALL' && item.groundTruth !== catFilter) return false;

        const results = item.results || {};
        const hasMismatch = Object.values(results).some(r => r.strictMatch === false);
        const hasLowConf = Object.values(results).some(r => typeof r.confidence === 'number' && r.confidence < 0.80);

        if (outcomeFilter === 'MISMATCH' && !hasMismatch) return false;
        if (outcomeFilter === 'MULTI_INTENT' && !item.isMultiIntent) return false;
        if (outcomeFilter === 'LOW_CONFIDENCE' && !hasLowConf) return false;

        if (search) {
          const matchId = (item.scenarioId || '').toLowerCase().includes(search);
          const matchCat = (item.groundTruth || '').toLowerCase().includes(search);
          const matchDiag = (item.dialogue || '').toLowerCase().includes(search);
          if (!matchId && !matchCat && !matchDiag) return false;
        }

        return true;
      });

      document.getElementById('scenariosCountText').textContent = \`Showing \${filtered.length} of \${details.length} scenarios\`;

      if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center py-8 text-slate-500 text-sm">No scenarios match the selected filters.</div>';
        return;
      }

      filtered.forEach(s => {
        const card = document.createElement('div');
        card.className = 'bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-3 hover:border-slate-700/80 transition';

        let modelPredictionsHtml = '';
        const results = s.results || {};

        for (const [key, res] of Object.entries(results)) {
          const isStrict = res.strictMatch;
          const isRelaxed = res.relaxedMatch;
          const badgeClass = isStrict ? 'badge-strict' : (isRelaxed ? 'badge-relaxed' : 'badge-error');
          const badgeIcon = isStrict ? '✅' : (isRelaxed ? '🟡' : '❌');

          // Confidence formatting
          let confHtml = '';
          if (typeof res.confidence === 'number') {
            const confPct = Math.round(res.confidence * 100);
            let confPillClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            let barColor = 'bg-emerald-400';

            if (confPct < 65) {
              confPillClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
              barColor = 'bg-rose-400';
            } else if (confPct < 85) {
              confPillClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
              barColor = 'bg-amber-400';
            }

            confHtml = \`
              <div class="flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-mono font-semibold border \${confPillClass}" title="Confidence: \${(res.confidence * 100).toFixed(1)}%">
                <span>🎯 \${confPct}%</span>
                <div class="w-8 bg-slate-800 rounded-full h-1 overflow-hidden inline-block">
                  <div class="\${barColor} h-1 rounded-full" style="width: \${Math.min(100, Math.max(0, confPct))}%"></div>
                </div>
              </div>
            \`;
          }

          modelPredictionsHtml += \`
            <div class="bg-slate-900/90 border border-slate-800/90 rounded-md p-2.5 flex flex-col justify-between space-y-2">
              <div class="flex items-center justify-between gap-1.5">
                <span class="font-medium text-slate-200 text-xs truncate">\${res.modelName || key}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                  \${confHtml}
                  <span class="px-2 py-0.5 rounded font-mono font-bold text-2xs \${badgeClass}">\${res.category || 'N/A'} \${badgeIcon}</span>
                </div>
              </div>
              <div class="flex items-center justify-between text-2xs font-mono text-slate-400 pt-1 border-t border-slate-800/70">
                <span>⏱️ \${res.latencyMs || 0}ms</span>
                <span>🎟️ In:\${res.inputTokens || 0} / Out:\${res.outputTokens || 0}</span>
                <span class="text-emerald-400 font-semibold">\$\${(res.totalCostUsd || res.costUsd || 0).toFixed(6)}</span>
              </div>
            </div>
          \`;
        }

        const diffBadge = s.difficulty
          ? \`<span class="px-2 py-0.5 rounded text-2xs font-bold uppercase \${s.difficulty === 'hard' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : s.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">\${s.difficulty}</span>\`
          : '';

        const hasDialogue = Boolean(s.dialogue);

        card.innerHTML = \`
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">\${s.scenarioId}</span>
              <span class="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">Truth: \${s.groundTruth}</span>
              \${diffBadge}
              \${s.isMultiIntent ? '<span class="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Multi-Intent</span>' : ''}
              \${s.secondaryCategories && s.secondaryCategories.length > 0 ? \`<span class="text-2xs text-slate-400">Acceptable: [\${s.secondaryCategories.join(', ')}]</span>\` : ''}
            </div>

            \${hasDialogue ? \`
              <button class="toggle-dialogue-btn text-2xs text-slate-400 hover:text-sky-400 transition flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                <span>View Dialogue</span>
              </button>
            \` : ''}
          </div>

          \${hasDialogue ? \`
            <div class="dialogue-panel \${allExpanded ? '' : 'hidden'} mt-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300 space-y-2">
              <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 font-sans whitespace-pre-wrap leading-relaxed text-slate-200">\${escapeHtml(s.dialogue)}</div>
              \${s.rationale ? \`<div class="text-2xs text-slate-400 bg-sky-950/20 p-2 rounded border border-sky-900/30"><strong class="text-sky-400">Routing Rationale:</strong> \${escapeHtml(s.rationale)}</div>\` : ''}
            </div>
          \` : ''}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-2">
            \${modelPredictionsHtml}
          </div>
        \`;

        // Attach toggle listener
        if (hasDialogue) {
          const btn = card.querySelector('.toggle-dialogue-btn');
          const panel = card.querySelector('.dialogue-panel');
          btn?.addEventListener('click', () => {
            panel?.classList.toggle('hidden');
          });
        }

        list.appendChild(card);
      });
    }

    // Toggle All Dialogue Listener
    document.getElementById('toggleAllDialogueBtn')?.addEventListener('click', () => {
      allExpanded = !allExpanded;
      document.querySelectorAll('.dialogue-panel').forEach(p => {
        if (allExpanded) p.classList.remove('hidden');
        else p.classList.add('hidden');
      });
      document.getElementById('toggleAllDialogueBtn').textContent = allExpanded ? 'Collapse All Dialogues' : 'Expand All Dialogues';
    });

    // Filter listeners
    document.getElementById('searchInput').addEventListener('input', renderScenarios);
    document.getElementById('categoryFilter').addEventListener('change', renderScenarios);
    document.getElementById('outcomeFilter').addEventListener('change', renderScenarios);

    // Custom JSON upload
    document.getElementById('jsonFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          reportData = JSON.parse(event.target.result);
          renderAll();
        } catch (err) {
          alert('Invalid JSON benchmark file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Initial render
    window.addEventListener('DOMContentLoaded', renderAll);
  </script>
</body>
</html>`;
}
