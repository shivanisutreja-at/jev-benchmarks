import * as dotenv from 'dotenv';
import { ClassificationResult, ModelAdapter } from './types.js';
import { classifyWithEfficia } from './efficia-client.js';

dotenv.config();

export interface ClaudeClientConfig {
  deploymentId?: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

/**
 * Classifies helpdesk conversation using Claude Sonnet (via Efficia)
 */
export async function classifyWithClaude(
  conversationText: string,
  config: ClaudeClientConfig = {}
): Promise<ClassificationResult> {
  const deploymentId = config.deploymentId || process.env.EFFICIA_CLAUDE_DEPLOYMENT_ID;
  const apiKey = config.apiKey || process.env.EFFICIA_CLAUDE_API_KEY;
  const baseUrl = config.baseUrl || process.env.EFFICIA_API_BASE_URL;
  const modelName = config.modelName || 'Claude Sonnet';

  if (!deploymentId || !apiKey) {
    throw new Error(
      'Missing Claude Sonnet credentials. Please set EFFICIA_CLAUDE_DEPLOYMENT_ID and EFFICIA_CLAUDE_API_KEY in .env'
    );
  }

  const result = await classifyWithEfficia(conversationText, {
    deploymentId,
    apiKey,
    baseUrl,
    modelName,
    inputTokenPricePerMillion: 2.00,
    outputTokenPricePerMillion: 10.00,
  });

  console.log(
    `\n[Claude Sonnet] Efficia response (${result.latencyMs} ms, in:${result.promptTokens} / out:${result.completionTokens}):\n` +
    `${result.rawText ?? '(empty)'}\n` +
    `[Claude Sonnet] -> category=${result.category}` +
    (typeof result.confidence === 'number' ? ` confidence=${result.confidence}` : '')
  );

  return result;
}

export const claudeAdapter: ModelAdapter = {
  id: 'claude',
  name: 'Claude Sonnet (via Efficia)',
  isConfigured: () => Boolean(process.env.EFFICIA_CLAUDE_DEPLOYMENT_ID && process.env.EFFICIA_CLAUDE_API_KEY),
  classify: (text: string) => classifyWithClaude(text),
};
