import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ModelAdapter } from './types.js';
import { jevAdapter } from './jev-client.js';
import { openAIAdapter } from './openai-client.js';
import { deepSeekAdapter } from './deepseek-client.js';
import { getBenchmarkConfig } from './config.js';
import { Scenario, generateScenarios } from './generate-dataset.js';

dotenv.config();

interface ModelMetrics {
  adapter: ModelAdapter;
  totalRun: number;
  strictCorrect: number;
  relaxedCorrect: number;
  singleIntentTotal: number;
  singleIntentCorrect: number;
  multiIntentTotal: number;
  multiIntentCorrect: number;
  latencies: number[];
  totalCostUsd: number;
  totalTokens: number;
  errors: number;
}

function initMetrics(adapter: ModelAdapter): ModelMetrics {
  return {
    adapter,
    totalRun: 0,
    strictCorrect: 0,
    relaxedCorrect: 0,
    singleIntentTotal: 0,
    singleIntentCorrect: 0,
    multiIntentTotal: 0,
    multiIntentCorrect: 0,
    latencies: [],
    totalCostUsd: 0,
    totalTokens: 0,
    errors: 0,
  };
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

const REGISTERED_ADAPTERS: Record<string, ModelAdapter> = {
  jev: jevAdapter,
  openai: openAIAdapter,
  deepseek: deepSeekAdapter,
};

async function main() {
  console.log('================================================================');
  console.log('  HELPDESK ROUTING INTENT CLASSIFICATION BENCHMARK');
  console.log('================================================================\n');

  // 1. Resolve Configuration
  const config = getBenchmarkConfig();

  // 2. Load dataset
  const dataPath = config.dataPath
    ? path.resolve(process.cwd(), config.dataPath)
    : path.resolve(process.cwd(), 'data', 'helpdesk-routing-250.json');

  let scenarios: Scenario[] = [];

  if (fs.existsSync(dataPath)) {
    console.log(`📁 Loading scenarios from ${dataPath}...`);
    scenarios = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } else {
    console.log('ℹ️ Scenarios file not found, generating in-memory 250 scenarios...');
    scenarios = generateScenarios();
  }

  if (config.limit && config.limit > 0) {
    scenarios = scenarios.slice(0, config.limit);
    console.log(`⚡ Running subset of ${scenarios.length} scenarios (--limit flag)`);
  } else {
    console.log(`⚡ Running full benchmark across ${scenarios.length} scenarios`);
  }

  // 3. Resolve Active Models based on Config
  const selectedModelIds = config.models.length > 0
    ? config.models
    : Object.keys(REGISTERED_ADAPTERS);

  const activeAdapters: ModelAdapter[] = [];

  for (const id of selectedModelIds) {
    const adapter = REGISTERED_ADAPTERS[id];
    if (!adapter) {
      console.warn(`⚠️ Unknown model ID requested: "${id}". Available: ${Object.keys(REGISTERED_ADAPTERS).join(', ')}`);
      continue;
    }

    if (!adapter.isConfigured()) {
      if (config.models.length > 0) {
        console.error(`❌ Error: Requested model "${id}" (${adapter.name}) is missing required credentials in .env.`);
        process.exit(1);
      }
      // If no explicit models were passed, silently skip unconfigured ones
      continue;
    }

    activeAdapters.push(adapter);
  }

  console.log('\nActive Evaluation Targets:');
  for (const [id, adapter] of Object.entries(REGISTERED_ADAPTERS)) {
    const isSelected = activeAdapters.includes(adapter);
    const isConfigured = adapter.isConfigured();
    const status = isSelected ? '🟢 ENABLED' : (isConfigured ? '⚪ SKIPPED (Not in config)' : '🔴 DISABLED (Missing env keys)');
    console.log(`• ${adapter.name.padEnd(35)}: ${status}`);
  }
  console.log('');

  if (activeAdapters.length === 0) {
    console.error('❌ Error: No models are active. Check your .env or --models configuration.');
    process.exit(1);
  }

  // Initialize metrics per active adapter
  const metricsMap = new Map<string, ModelMetrics>();
  for (const adapter of activeAdapters) {
    metricsMap.set(adapter.id, initMetrics(adapter));
  }

  const detailedResults: any[] = [];

  // 4. Run Benchmark Loop
  let completed = 0;
  for (const s of scenarios) {
    completed++;

    const scenarioResult: any = {
      scenarioId: s.id,
      groundTruth: s.primary_category,
      secondaryCategories: s.secondary_categories,
      isMultiIntent: s.is_multi_intent,
      results: {},
    };

    const statusParts: string[] = [];

    for (const adapter of activeAdapters) {
      const metrics = metricsMap.get(adapter.id)!;

      try {
        const res = await adapter.classify(s.formatted_dialogue);
        const isStrict = res.category === s.primary_category;
        const isRelaxed = isStrict || s.secondary_categories.includes(res.category);

        metrics.totalRun++;
        if (isStrict) metrics.strictCorrect++;
        if (isRelaxed) metrics.relaxedCorrect++;

        if (s.is_multi_intent) {
          metrics.multiIntentTotal++;
          if (isStrict) metrics.multiIntentCorrect++;
        } else {
          metrics.singleIntentTotal++;
          if (isStrict) metrics.singleIntentCorrect++;
        }

        metrics.latencies.push(res.latencyMs);
        metrics.totalCostUsd += res.costUsd;
        metrics.totalTokens += res.totalTokens;

        scenarioResult.results[adapter.id] = {
          category: res.category,
          strictMatch: isStrict,
          relaxedMatch: isRelaxed,
          confidence: res.confidence,
          latencyMs: res.latencyMs,
          costUsd: res.costUsd,
          totalTokens: res.totalTokens,
        };

        const icon = isStrict ? '✅' : (isRelaxed ? '🟡' : '❌');
        const confStr = typeof res.confidence === 'number' ? ` (${(res.confidence * 100).toFixed(0)}%)` : '';
        statusParts.push(`${adapter.id}: ${res.category}${confStr} ${icon} [${res.latencyMs}ms]`);
      } catch (err: any) {
        metrics.errors++;
        scenarioResult.results[adapter.id] = { error: err.message };
        statusParts.push(`${adapter.id}: ❌ Err (${err.message})`);
      }
    }

    console.log(`[${completed}/${scenarios.length}] ${s.id} (Truth: ${s.primary_category}) -> ${statusParts.join(' | ')}`);
    detailedResults.push(scenarioResult);
  }

  console.log('\n✅ Benchmark Run Complete!\n');

  // 5. Summarize and Print Table
  const summaryRows = activeAdapters
    .map(adapter => metricsMap.get(adapter.id)!)
    .filter(m => m.totalRun > 0)
    .map(m => {
      const avgLatency = m.latencies.length > 0
        ? Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length)
        : 0;
      const p50 = percentile(m.latencies, 50);
      const p95 = percentile(m.latencies, 95);
      const costPer10k = m.totalRun > 0 ? (m.totalCostUsd / m.totalRun) * 10_000 : 0;

      return {
        'Model': m.adapter.name,
        'Strict Acc %': `${((m.strictCorrect / m.totalRun) * 100).toFixed(1)}%`,
        'Relaxed Acc %': `${((m.relaxedCorrect / m.totalRun) * 100).toFixed(1)}%`,
        'Single-Intent Acc': `${m.singleIntentTotal > 0 ? ((m.singleIntentCorrect / m.singleIntentTotal) * 100).toFixed(1) : 0}%`,
        'Multi-Intent Acc': `${m.multiIntentTotal > 0 ? ((m.multiIntentCorrect / m.multiIntentTotal) * 100).toFixed(1) : 0}%`,
        'Avg Latency': `${avgLatency} ms`,
        'P95 Latency': `${p95} ms`,
        'Total Cost ($)': `$${m.totalCostUsd.toFixed(4)}`,
        'Cost / 10k Decisions': `$${costPer10k.toFixed(3)}`,
        'Errors': m.errors,
      };
    });

  console.table(summaryRows);

  // 6. Save JSON Report
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportsDir, `benchmark-results-${timestamp}.json`);

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalScenarios: scenarios.length,
        configuredModels: activeAdapters.map(a => a.id),
        summary: summaryRows,
        details: detailedResults,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\n📄 Detailed JSON report saved to: ${reportPath}`);
}

main().catch(err => {
  console.error('\nFatal Benchmark Error:', err);
  process.exit(1);
});
