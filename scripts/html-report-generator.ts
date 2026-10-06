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
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">

  <!-- Header -->
  <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold uppercase tracking-wider">Evaluation Report</span>
          <h1 class="text-xl font-bold tracking-tight text-white">Helpdesk Routing Intent Benchmark</h1>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Head-to-head decision evaluation: <span class="text-sky-400 font-medium">Jev (System 1)</span> vs <span class="text-emerald-400 font-medium">GPT-6 Luna</span> vs <span class="text-indigo-400 font-medium">DeepSeek</span>
        </p>
      </div>

      <div class="flex items-center gap-3">
        <label class="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Load Custom JSON
          <input type="file" id="jsonFileInput" accept=".json" class="hidden">
        </label>
        <div id="reportTimestamp" class="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"></div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">

    <!-- KPI Metric Cards -->
    <section class="grid grid-cols-1 md:grid-cols-4 gap-4" id="kpiCards"></section>

    <!-- Charts Row -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-200 mb-1 flex items-center justify-between">
          <span>Latency Comparison</span>
          <span class="text-xs text-slate-400 font-normal">Average ms (Lower is better)</span>
        </h3>
        <div class="h-64 mt-4 relative">
          <canvas id="latencyChart"></canvas>
        </div>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-200 mb-1 flex items-center justify-between">
          <span>Cost per 10k Decisions</span>
          <span class="text-xs text-slate-400 font-normal">USD $ (Lower is better)</span>
        </h3>
        <div class="h-64 mt-4 relative">
          <canvas id="costChart"></canvas>
        </div>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-slate-200 mb-1 flex items-center justify-between">
          <span>Accuracy Comparison</span>
          <span class="text-xs text-slate-400 font-normal">Strict vs Relaxed</span>
        </h3>
        <div class="h-64 mt-4 relative">
          <canvas id="accuracyChart"></canvas>
        </div>
      </div>
    </section>

    <!-- Detailed Summary Table -->
    <section class="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-white">Benchmark Summary Table</h2>
          <p class="text-xs text-slate-400 mt-0.5">Comprehensive performance, cost, token, and accuracy breakdown per model</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs" id="summaryTable">
          <thead class="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th class="py-3.5 px-4">Model</th>
              <th class="py-3.5 px-3">Strict Acc %</th>
              <th class="py-3.5 px-3">Relaxed Acc %</th>
              <th class="py-3.5 px-3">Single-Intent</th>
              <th class="py-3.5 px-3">Multi-Intent</th>
              <th class="py-3.5 px-3 text-right">Avg Latency</th>
              <th class="py-3.5 px-3 text-right">P95 Latency</th>
              <th class="py-3.5 px-3 text-right">Avg In / Out Tokens</th>
              <th class="py-3.5 px-3 text-right">Total Tokens</th>
              <th class="py-3.5 px-3 text-right">In Cost ($)</th>
              <th class="py-3.5 px-3 text-right">Out Cost ($)</th>
              <th class="py-3.5 px-3 text-right">Total Cost ($)</th>
              <th class="py-3.5 px-4 text-right">Cost / 10k Decisions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800 text-slate-200" id="summaryTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- Scenario Explorer -->
    <section class="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-4 p-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-white">Scenario-by-Scenario Drilldown</h2>
          <p class="text-xs text-slate-400 mt-0.5">Inspect ground truth, dialogue turns, and individual model predictions</p>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-3">
          <input type="text" id="searchInput" placeholder="Search scenario ID or text..."
            class="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 w-56">

          <select id="categoryFilter" class="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500">
            <option value="ALL">All Categories</option>
            <option value="PYC">PYC (Payroll)</option>
            <option value="DTE">DTE (Data & Tools)</option>
            <option value="EMP">EMP (Employment)</option>
            <option value="ONB">ONB (Onboarding)</option>
            <option value="ASR">ASR (Reviews & Comp)</option>
            <option value="PMS">PMS (Performance)</option>
            <option value="TAL">TAL (Talent)</option>
          </select>

          <select id="outcomeFilter" class="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500">
            <option value="ALL">All Outcomes</option>
            <option value="MISMATCH">Mismatches Only</option>
            <option value="MULTI_INTENT">Multi-Intent Only</option>
          </select>
        </div>
      </div>

      <div class="text-xs text-slate-400 flex items-center justify-between pt-2">
        <span id="scenariosCountText">Showing 0 scenarios</span>
      </div>

      <div class="space-y-3 max-h-[700px] overflow-y-auto pr-2" id="scenariosList"></div>
    </section>

  </main>

  <footer class="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
    Helpdesk Intent Routing Benchmark &bull; Generated from jev-benchmarks
  </footer>

  <script>
    let reportData = ${dataJson};

    function renderAll() {
      if (!reportData || !reportData.summary) return;

      // Update timestamp
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

      // Find lowest latency
      const lowestLatency = [...summary].sort((a,b) => parseFloat(a['Avg Latency']) - parseFloat(b['Avg Latency']))[0];
      // Find lowest cost
      const lowestCost = [...summary].sort((a,b) => parseFloat(a['Total Cost ($)'].replace('$','')) - parseFloat(b['Total Cost ($)'].replace('$','')))[0];
      // Find highest accuracy
      const highestAcc = [...summary].sort((a,b) => parseFloat(b['Strict Acc %']) - parseFloat(a['Strict Acc %']))[0];

      kpiContainer.innerHTML = \`
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div class="text-xs font-medium text-slate-400">Total Scenarios Tested</div>
          <div class="text-2xl font-bold text-white mt-1">\${reportData.totalScenarios || reportData.details?.length || 0}</div>
          <div class="text-xs text-slate-400 mt-1">Across 7 Support Categories</div>
        </div>

        <div class="bg-slate-900/90 border border-sky-500/30 rounded-xl p-4 bg-gradient-to-br from-sky-500/5 to-transparent">
          <div class="text-xs font-medium text-sky-400">Speed Champion</div>
          <div class="text-2xl font-bold text-white mt-1">\${lowestLatency['Avg Latency']}</div>
          <div class="text-xs text-slate-300 mt-1 truncate font-medium">\${lowestLatency['Model']}</div>
        </div>

        <div class="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div class="text-xs font-medium text-emerald-400">Cost Efficiency Champion</div>
          <div class="text-2xl font-bold text-white mt-1">\${lowestCost['Cost / 10k Decisions']}</div>
          <div class="text-xs text-slate-300 mt-1 truncate font-medium">\${lowestCost['Model']} (per 10k)</div>
        </div>

        <div class="bg-slate-900/90 border border-purple-500/30 rounded-xl p-4 bg-gradient-to-br from-purple-500/5 to-transparent">
          <div class="text-xs font-medium text-purple-400">Highest Accuracy</div>
          <div class="text-2xl font-bold text-white mt-1">\${highestAcc['Strict Acc %']}</div>
          <div class="text-xs text-slate-300 mt-1 truncate font-medium">\${highestAcc['Model']} (Strict)</div>
        </div>
      \`;
    }

    let latChart, costChartInst, accChart;

    function renderCharts() {
      const summary = reportData.summary;
      if (!summary || summary.length === 0) return;

      const labels = summary.map(s => s['Model'].split(' ')[0]);
      const fullLabels = summary.map(s => s['Model']);

      const latencies = summary.map(s => parseFloat(s['Avg Latency']));
      const costsPer10k = summary.map(s => parseFloat(s['Cost / 10k Decisions'].replace('$', '')));
      const strictAcc = summary.map(s => parseFloat(s['Strict Acc %']));
      const relaxedAcc = summary.map(s => parseFloat(s['Relaxed Acc %']));

      const colors = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b'];

      // Destroy previous charts if re-rendering
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
        tr.className = 'hover:bg-slate-800/50 transition';
        tr.innerHTML = \`
          <td class="py-3 px-4 font-semibold text-white">\${row['Model']}</td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-xs font-semibold badge-strict">\${row['Strict Acc %']}</span></td>
          <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-xs font-semibold badge-relaxed">\${row['Relaxed Acc %']}</span></td>
          <td class="py-3 px-3 text-slate-300">\${row['Single-Intent Acc']}</td>
          <td class="py-3 px-3 text-slate-300">\${row['Multi-Intent Acc']}</td>
          <td class="py-3 px-3 text-right font-mono text-sky-400 font-semibold">\${row['Avg Latency']}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-400">\${row['P95 Latency']}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300">\${row['Avg In Tokens'] || '—'} / \${row['Avg Out Tokens'] || '—'}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300 font-semibold">\${row['Total Tokens'] || '—'}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-400">\${row['Input Cost ($)'] || '—'}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-400">\${row['Output Cost ($)'] || '—'}</td>
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

        const hasMismatch = Object.values(item.results || {}).some(r => r.strictMatch === false);
        if (outcomeFilter === 'MISMATCH' && !hasMismatch) return false;
        if (outcomeFilter === 'MULTI_INTENT' && !item.isMultiIntent) return false;

        if (search) {
          const matchId = (item.scenarioId || '').toLowerCase().includes(search);
          const matchCat = (item.groundTruth || '').toLowerCase().includes(search);
          if (!matchId && !matchCat) return false;
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
        card.className = 'bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition';

        let modelPredictionsHtml = '';
        const results = s.results || {};

        for (const [key, res] of Object.entries(results)) {
          const isStrict = res.strictMatch;
          const isRelaxed = res.relaxedMatch;
          const badgeClass = isStrict ? 'badge-strict' : (isRelaxed ? 'badge-relaxed' : 'badge-error');
          const badgeIcon = isStrict ? '✅' : (isRelaxed ? '🟡' : '❌');

          modelPredictionsHtml += \`
            <div class="bg-slate-900 border border-slate-800 rounded-md p-2.5 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="font-medium text-slate-200">\${res.modelName || key}</span>
                <span class="px-2 py-0.5 rounded font-mono font-semibold text-2xs \${badgeClass}">\${res.category || 'N/A'} \${badgeIcon}</span>
              </div>
              <div class="flex items-center gap-4 text-2xs font-mono text-slate-400">
                <span>⏱️ \${res.latencyMs || 0}ms</span>
                <span>🎟️ In:\${res.inputTokens || 0} / Out:\${res.outputTokens || 0} (Tot:\${res.totalTokens || 0})</span>
                <span class="text-emerald-400 font-semibold">\$\${(res.totalCostUsd || res.costUsd || 0).toFixed(6)}</span>
              </div>
            </div>
          \`;
        }

        card.innerHTML = \`
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs font-bold text-sky-400">\${s.scenarioId}</span>
              <span class="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">Truth: \${s.groundTruth}</span>
              \${s.isMultiIntent ? '<span class="px-2 py-0.5 rounded text-2xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Multi-Intent</span>' : ''}
              \${s.secondaryCategories && s.secondaryCategories.length > 0 ? \`<span class="text-2xs text-slate-400">Acceptable Secondary: [\${s.secondaryCategories.join(', ')}]</span>\` : ''}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            \${modelPredictionsHtml}
          </div>
        \`;

        list.appendChild(card);
      });
    }

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
