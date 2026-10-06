import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BenchmarkConfig } from './types.js';

dotenv.config();

export const ALL_SUPPORTED_MODELS = ['jev', 'openai', 'deepseek'];

/**
 * Normalizes user model names (e.g. 'gpt' -> 'openai')
 */
export function normalizeModelName(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower === 'gpt' || lower === 'gpt-6-luna' || lower === 'gpt6') return 'openai';
  return lower;
}

/**
 * Loads configuration from CLI arguments, config file, or environment variables
 */
export function getBenchmarkConfig(): BenchmarkConfig {
  const args = process.argv.slice(2);

  let selectedModels: string[] = [];
  let limit: number | undefined = undefined;
  let dataPath: string | undefined = undefined;
  let verbose = false;

  // 1. Check for external config file flag: --config path/to/config.json
  const configIndex = args.indexOf('--config');
  if (configIndex !== -1 && args[configIndex + 1]) {
    const customConfigPath = path.resolve(process.cwd(), args[configIndex + 1]);
    if (fs.existsSync(customConfigPath)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(customConfigPath, 'utf-8'));
        if (Array.isArray(fileContent.models)) {
          selectedModels = fileContent.models.map(normalizeModelName);
        }
        if (typeof fileContent.limit === 'number') limit = fileContent.limit;
        if (typeof fileContent.dataPath === 'string') dataPath = fileContent.dataPath;
        if (typeof fileContent.verbose === 'boolean') verbose = fileContent.verbose;
      } catch (err: any) {
        console.warn(`⚠️ Warning: Could not parse config file ${customConfigPath}: ${err.message}`);
      }
    }
  }

  // 2. Parse CLI flags: --models jev,openai OR --model jev OR --only deepseek
  const modelsIndex = args.findIndex(arg => arg === '--models' || arg === '--model' || arg === '--only');
  if (modelsIndex !== -1 && args[modelsIndex + 1]) {
    const modelsList = args[modelsIndex + 1].split(',').map(normalizeModelName);
    selectedModels = modelsList;
  }

  // 3. Boolean model toggles: --jev, --openai, --gpt, --deepseek
  const toggleModels: string[] = [];
  if (args.includes('--jev')) toggleModels.push('jev');
  if (args.includes('--openai') || args.includes('--gpt')) toggleModels.push('openai');
  if (args.includes('--deepseek')) toggleModels.push('deepseek');
  if (toggleModels.length > 0) {
    selectedModels = toggleModels;
  }

  // 4. Fallback to BENCHMARK_MODELS env variable if no CLI model was specified
  if (selectedModels.length === 0 && process.env.BENCHMARK_MODELS) {
    selectedModels = process.env.BENCHMARK_MODELS.split(',').map(normalizeModelName);
  }

  // 5. Parse limit flag: --limit 10 or --limit=10
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    const parsedLimit = parseInt(limitArg.split('=')[1], 10);
    if (!isNaN(parsedLimit)) {
      limit = parsedLimit;
    }
  } else {
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
      const parsedLimit = parseInt(args[limitIndex + 1], 10);
      if (!isNaN(parsedLimit)) {
        limit = parsedLimit;
      }
    }
  }

  // 6. Parse data flag: --data path
  const dataIndex = args.indexOf('--data');
  if (dataIndex !== -1 && args[dataIndex + 1]) {
    dataPath = args[dataIndex + 1];
  }

  // 7. Parse verbose flag: --verbose or -v
  if (args.includes('--verbose') || args.includes('-v')) {
    verbose = true;
  }

  return {
    models: selectedModels,
    limit,
    dataPath,
    verbose,
  };
}
