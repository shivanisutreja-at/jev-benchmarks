import * as dotenv from 'dotenv';
import { ClassificationResult, ModelAdapter } from './types.js';
import { classifyWithEfficia } from './efficia-client.js';

dotenv.config();

export interface OpenAIClientConfig {
  deploymentId?: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

/**
 * Classifies helpdesk conversation using OpenAI (GPT-6 Luna via Efficia)
 */
export async function classifyWithOpenAI(
  conversationText: string,
  config: OpenAIClientConfig = {}
): Promise<ClassificationResult> {
  const deploymentId = config.deploymentId || process.env.EFFICIA_GPT_DEPLOYMENT_ID;
  const apiKey = config.apiKey || process.env.EFFICIA_GPT_API_KEY;
  const baseUrl = config.baseUrl || process.env.EFFICIA_API_BASE_URL;
  const modelName = config.modelName || 'GPT-6 Luna';

  if (!deploymentId || !apiKey) {
    throw new Error(
      'Missing OpenAI (GPT-6 Luna) credentials. Please set EFFICIA_GPT_DEPLOYMENT_ID and EFFICIA_GPT_API_KEY in .env'
    );
  }

  return classifyWithEfficia(conversationText, {
    deploymentId,
    apiKey,
    baseUrl,
    modelName,
  });
}

export const openAIAdapter: ModelAdapter = {
  id: 'openai',
  name: 'OpenAI (GPT-6 Luna via Efficia)',
  isConfigured: () => Boolean(process.env.EFFICIA_GPT_DEPLOYMENT_ID && process.env.EFFICIA_GPT_API_KEY),
  classify: (text: string) => classifyWithOpenAI(text),
};
