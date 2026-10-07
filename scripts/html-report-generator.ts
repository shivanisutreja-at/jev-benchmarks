import fs from 'fs';
import { fileURLToPath } from 'url';

export interface ReportPayload {
  timestamp: string;
  totalScenarios: number;
  configuredModels: { id: string; name: string }[];
  summary: any[];
  details: any[];
}

// Styles and client script live beside this file so they can be edited as
// plain CSS/JS; they are inlined so the report stays a single offline file.
function readAsset(name: string): string {
  return fs.readFileSync(fileURLToPath(new URL(`./report/${name}`, import.meta.url)), 'utf-8');
}

export function generateHtmlReport(data: ReportPayload): string {
  const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');
  const css = readAsset('report.css');
  const js = readAsset('report.client.js');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Helpdesk Routing Benchmark</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
${css}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="container topbar-inner">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
        </div>
        <div>
          <h1>Helpdesk Routing Benchmark</h1>
          <p id="headerModels">Intent classification, head to head</p>
        </div>
      </div>
      <div class="toolbar">
        <span class="meta-chip" id="reportMeta"></span>
        <button class="btn" type="button" id="loadBtn">
          <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M16 8l-4-4-4 4M12 4v12"/></svg>
          Load JSON
        </button>
        <input type="file" id="jsonFileInput" accept=".json,application/json" class="sr-only" tabindex="-1" aria-hidden="true">
        <button class="btn btn-icon" type="button" id="themeBtn"></button>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="alert" id="loadError" role="alert" hidden>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      <span></span>
      <button class="btn btn-ghost" type="button" id="dismissError" style="margin-left:auto;min-height:28px">Dismiss</button>
    </div>

    <section class="card verdict" id="verdict" aria-label="Headline result"></section>

    <section class="kpis" id="kpis" aria-label="Key metrics"></section>

    <section class="charts" aria-label="Model comparison charts">
      <div class="card chart-card">
        <div class="card-head"><div><h2>Accuracy</h2><p>Share of scenarios routed correctly · higher is better</p></div></div>
        <div class="card-body" id="chartAccuracy"></div>
      </div>
      <div class="card chart-card">
        <div class="card-head"><div><h2>Latency</h2><p>Per decision · lower is better</p></div></div>
        <div class="card-body" id="chartLatency"></div>
      </div>
      <div class="card chart-card">
        <div class="card-head"><div><h2>Run cost</h2><p>Actual USD spent in this run · lower is better</p></div></div>
        <div class="card-body" id="chartCost"></div>
      </div>
    </section>

    <section class="card" aria-labelledby="summaryTitle">
      <div class="card-head">
        <div>
          <h2 id="summaryTitle">Model summary</h2>
          <p>Click a column to sort. <span class="best-cell" style="font-weight:500">Green</span> marks the best value in each column.</p>
        </div>
      </div>
      <div class="table-wrap"><table id="summaryTable"></table></div>
    </section>

    <section class="card" aria-labelledby="breakdownTitle">
      <div class="card-head">
        <div>
          <h2 id="breakdownTitle">Where models miss</h2>
          <p>Strict accuracy by ground-truth category, difficulty and intent type</p>
        </div>
      </div>
      <div class="table-wrap"><table class="matrix" id="breakdownTable"></table></div>
    </section>

    <section class="card" aria-labelledby="explorerTitle">
      <div class="card-head">
        <div>
          <h2 id="explorerTitle">Scenario explorer</h2>
          <p>Ground truth, each model's prediction, confidence and cost per conversation</p>
        </div>
      </div>

      <div class="filters" role="search">
        <div class="field">
          <label for="searchInput">Search</label>
          <div class="search">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input class="input" type="search" id="searchInput" placeholder="ID, category, dialogue text…" autocomplete="off">
          </div>
        </div>
        <div class="field">
          <label for="categoryFilter">Ground truth</label>
          <select class="select" id="categoryFilter"></select>
        </div>
        <div class="field">
          <label for="difficultyFilter">Difficulty</label>
          <select class="select" id="difficultyFilter"></select>
        </div>
        <div class="field">
          <label for="outcomeFilter">Outcome</label>
          <select class="select" id="outcomeFilter">
            <option value="ALL">All outcomes</option>
            <option value="WRONG_STRICT">Not primary category</option>
            <option value="WRONG_RELAXED">Wrong (not even secondary)</option>
            <option value="DISAGREE">Models disagree</option>
            <option value="LOW_CONF">Confidence below 80%</option>
            <option value="MULTI">Multi-intent only</option>
            <option value="ERROR">Errors</option>
          </select>
        </div>
        <div class="field">
          <label for="modelFilter">Outcome applies to</label>
          <select class="select" id="modelFilter"></select>
        </div>
        <button class="btn" type="button" id="resetBtn">Reset</button>
      </div>

      <div class="list-bar">
        <span id="scenarioCount" aria-live="polite"></span>
        <button class="btn btn-ghost" type="button" id="toggleDialogues">Expand all dialogues</button>
      </div>

      <div class="scenarios" id="scenarioList"></div>
      <div class="more" id="moreWrap" hidden><button class="btn" type="button" id="moreBtn">Show more</button></div>
    </section>
  </main>

  <footer class="container">Helpdesk Intent Routing Benchmark · generated by jev-benchmarks</footer>

  <div class="tooltip" id="tooltip" role="tooltip"></div>

  <script type="application/json" id="report-data">${dataJson}</script>
  <script>
${js}
  </script>
</body>
</html>`;
}
