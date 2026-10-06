import * as dotenv from 'dotenv';
import { ClassificationResult, ModelAdapter } from './types.js';
import { classifyWithEfficia } from './efficia-client.js';

dotenv.config();

export interface DeepSeekClientConfig {
  deploymentId?: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

/**
 * Classifies helpdesk conversation using DeepSeek (via Efficia)
 */
export async function classifyWithDeepSeek(
  conversationText: string,
  config: DeepSeekClientConfig = {}
): Promise<ClassificationResult> {
  const deploymentId = config.deploymentId || process.env.EFFICIA_DEEPSEEK_DEPLOYMENT_ID;
  const apiKey = config.apiKey || process.env.EFFICIA_DEEPSEEK_API_KEY;
  const baseUrl = config.baseUrl || process.env.EFFICIA_API_BASE_URL;
  const modelName = config.modelName || 'DeepSeek';

  if (!deploymentId || !apiKey) {
    throw new Error(
      'Missing DeepSeek credentials. Please set EFFICIA_DEEPSEEK_DEPLOYMENT_ID and EFFICIA_DEEPSEEK_API_KEY in .env'
    );
  }

  return classifyWithEfficia(conversationText, {
    deploymentId,
    apiKey,
    baseUrl,
    modelName,
  });
}

export const deepSeekAdapter: ModelAdapter = {
  id: 'deepseek',
  name: 'DeepSeek (via Efficia)',
  isConfigured: () => Boolean(process.env.EFFICIA_DEEPSEEK_DEPLOYMENT_ID && process.env.EFFICIA_DEEPSEEK_API_KEY),
  classify: (text: string) => classifyWithDeepSeek(text),
};
