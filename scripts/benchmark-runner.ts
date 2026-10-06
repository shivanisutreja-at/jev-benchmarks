import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { classifyWithJev, JevClassificationResult } from './jev-client.js';
import { classifyWithEfficia, EfficiaClassificationResult } from './efficia-client.js';
import { Scenario, generateScenarios } from './generate-dataset.js';

dotenv.config();

interface ModelMetrics {
  name: string;
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

function initMetrics(name: string): ModelMetrics {
  return {
    name,
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

async function main() {
  console.log('================================================================');
  console.log('  HELPDESK ROUTING INTENT CLASSIFICATION BENCHMARK');
  console.log('  Comparing: Jev (System 1) vs GPT-6 Luna vs DeepSeek');
  console.log('================================================================\n');

  // 1. Load dataset
  const dataPath = path.resolve(process.cwd(), 'data', 'helpdesk-routing-250.json');
  let scenarios: Scenario[] = [];

  if (fs.existsSync(dataPath)) {
    console.log(`📁 Loading scenarios from ${dataPath}...`);
    scenarios = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } else {
    console.log('ℹ️ Scenarios file not found, generating in-memory 250 scenarios...');
    scenarios = generateScenarios();
  }

  // Parse optional CLI arguments: e.g. --limit 10
  const limitArgIndex = process.argv.indexOf('--limit');
  if (limitArgIndex !== -1 && process.argv[limitArgIndex + 1]) {
    const limit = parseInt(process.argv[limitArgIndex + 1], 10);
    if (!isNaN(limit)) {
      scenarios = scenarios.slice(0, limit);
      console.log(`⚡ Running on a subset of ${limit} scenarios (--limit flag)\n`);
    }
  } else {
    console.log(`⚡ Running full benchmark across ${scenarios.length} scenarios\n`);
  }

  // 2. Detect configured models
  const enableJev = Boolean(process.env.OPENROUTER_API_KEY);
  const enableGpt = Boolean(process.env.EFFICIA_GPT_DEPLOYMENT_ID && process.env.EFFICIA_GPT_API_KEY);
  const enableDeepSeek = Boolean(process.env.EFFICIA_DEEPSEEK_DEPLOYMENT_ID && process.env.EFFICIA_DEEPSEEK_API_KEY);

  console.log('Active Targets:');
  console.log(`• Jev (~typesafe/jev-latest via OpenRouter): ${enableJev ? '🟢 ENABLED' : '🔴 DISABLED (Missing OPENROUTER_API_KEY)'}`);
  console.log(`• GPT-6 Luna (Efficia Agent 1):             ${enableGpt ? '🟢 ENABLED' : '🔴 DISABLED (Missing deployment ID / key)'}`);
  console.log(`• DeepSeek (Efficia Agent 2):               ${enableDeepSeek ? '🟢 ENABLED' : '🔴 DISABLED (Missing deployment ID / key)'}\n`);

  if (!enableJev && !enableGpt && !enableDeepSeek) {
    console.error('❌ Error: No models are enabled. Please check benchmarks/.env configuration.');
    process.exit(1);
  }

  const jevMetrics = initMetrics('Jev (~typesafe/jev-latest)');
  const gptMetrics = initMetrics('GPT-6 Luna (Efficia)');
  const deepSeekMetrics = initMetrics('DeepSeek (Efficia)');

  const detailedResults: any[] = [];

  // 3. Run Benchmark Loop
  let completed = 0;
  for (const s of scenarios) {
    completed++;
    process.stdout.write(`\r[${completed}/${scenarios.length}] Running scenario ${s.id} (Ground truth: ${s.primary_category})...`);

    const scenarioResult: any = {
      scenarioId: s.id,
      groundTruth: s.primary_category,
      secondaryCategories: s.secondary_categories,
      isMultiIntent: s.is_multi_intent,
    };

    // --- Run Jev ---
    if (enableJev) {
      try {
        const res = await classifyWithJev(s.formatted_dialogue);
        const isStrict = res.category === s.primary_category;
        const isRelaxed = isStrict || s.secondary_categories.includes(res.category);

        jevMetrics.totalRun++;
        if (isStrict) jevMetrics.strictCorrect++;
        if (isRelaxed) jevMetrics.relaxedCorrect++;
        if (s.is_multi_intent) {
          jevMetrics.multiIntentTotal++;
          if (isStrict) jevMetrics.multiIntentCorrect++;
        } else {
          jevMetrics.singleIntentTotal++;
          if (isStrict) jevMetrics.singleIntentCorrect++;
        }

        jevMetrics.latencies.push(res.latencyMs);
        jevMetrics.totalCostUsd += res.costUsd;
        jevMetrics.totalTokens += res.inputTokens;

        scenarioResult.jev = {
          category: res.category,
          strictMatch: isStrict,
          relaxedMatch: isRelaxed,
          confidence: res.confidence,
          latencyMs: res.latencyMs,
          costUsd: res.costUsd,
        };
      } catch (err: any) {
        jevMetrics.errors++;
        scenarioResult.jev = { error: err.message };
      }
    }

    // --- Run GPT-6 Luna via Efficia ---
    if (enableGpt) {
      try {
        const res = await classifyWithEfficia(s.formatted_dialogue, {
          deploymentId: process.env.EFFICIA_GPT_DEPLOYMENT_ID!,
          apiKey: process.env.EFFICIA_GPT_API_KEY!,
          baseUrl: process.env.EFFICIA_API_BASE_URL,
          modelName: 'gpt-6-luna',
        });
        const isStrict = res.category === s.primary_category;
        const isRelaxed = isStrict || s.secondary_categories.includes(res.category);

        gptMetrics.totalRun++;
        if (isStrict) gptMetrics.strictCorrect++;
        if (isRelaxed) gptMetrics.relaxedCorrect++;
        if (s.is_multi_intent) {
          gptMetrics.multiIntentTotal++;
          if (isStrict) gptMetrics.multiIntentCorrect++;
        } else {
          gptMetrics.singleIntentTotal++;
          if (isStrict) gptMetrics.singleIntentCorrect++;
        }

        gptMetrics.latencies.push(res.latencyMs);
        gptMetrics.totalCostUsd += res.costUsd;
        gptMetrics.totalTokens += res.totalTokens;

        scenarioResult.gpt = {
          category: res.category,
          strictMatch: isStrict,
          relaxedMatch: isRelaxed,
          latencyMs: res.latencyMs,
          costUsd: res.costUsd,
        };
      } catch (err: any) {
        gptMetrics.errors++;
        scenarioResult.gpt = { error: err.message };
      }
    }

    // --- Run DeepSeek via Efficia ---
    if (enableDeepSeek) {
      try {
        const res = await classifyWithEfficia(s.formatted_dialogue, {
          deploymentId: process.env.EFFICIA_DEEPSEEK_DEPLOYMENT_ID!,
          apiKey: process.env.EFFICIA_DEEPSEEK_API_KEY!,
          baseUrl: process.env.EFFICIA_API_BASE_URL,
          modelName: 'deepseek',
        });
        const isStrict = res.category === s.primary_category;
        const isRelaxed = isStrict || s.secondary_categories.includes(res.category);

        deepSeekMetrics.totalRun++;
        if (isStrict) deepSeekMetrics.strictCorrect++;
        if (isRelaxed) deepSeekMetrics.relaxedCorrect++;
        if (s.is_multi_intent) {
          deepSeekMetrics.multiIntentTotal++;
          if (isStrict) deepSeekMetrics.multiIntentCorrect++;
        } else {
          deepSeekMetrics.singleIntentTotal++;
          if (isStrict) deepSeekMetrics.singleIntentCorrect++;
        }

        deepSeekMetrics.latencies.push(res.latencyMs);
        deepSeekMetrics.totalCostUsd += res.costUsd;
        deepSeekMetrics.totalTokens += res.totalTokens;

        scenarioResult.deepseek = {
          category: res.category,
          strictMatch: isStrict,
          relaxedMatch: isRelaxed,
          latencyMs: res.latencyMs,
          costUsd: res.costUsd,
        };
      } catch (err: any) {
        deepSeekMetrics.errors++;
        scenarioResult.deepseek = { error: err.message };
      }
    }

    detailedResults.push(scenarioResult);
  }

  console.log('\n\n✅ Benchmark Run Complete!\n');

  // 4. Summarize and Print Table
  const activeMetrics = [jevMetrics, gptMetrics, deepSeekMetrics].filter(m => m.totalRun > 0);

  const summaryRows = activeMetrics.map(m => {
    const avgLatency = m.latencies.length > 0 ? Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length) : 0;
    const p50 = percentile(m.latencies, 50);
    const p95 = percentile(m.latencies, 95);
    const costPer10k = (m.totalCostUsd / m.totalRun) * 10_000;

    return {
      'Model': m.name,
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

  // 5. Save Report
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
