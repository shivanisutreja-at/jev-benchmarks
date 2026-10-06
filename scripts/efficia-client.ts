import * as dotenv from 'dotenv';
dotenv.config();

export interface EfficiaClassificationResult {
  category: string;
  rawText: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface EfficiaModelConfig {
  deploymentId: string;
  apiKey: string;
  baseUrl?: string;
  modelName: string;
  // Per 1M tokens pricing
  inputTokenPricePerMillion?: number;
  outputTokenPricePerMillion?: number;
}

// Approximate default prices per million tokens if not explicitly known:
// GPT-6 Luna / GPT-class: ~$2.50 input / $10.00 output
// DeepSeek V3: ~$0.14 input / $0.28 output
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  gpt: { input: 2.50, output: 10.00 },
  deepseek: { input: 0.14, output: 0.28 },
};

/**
 * Parses JSON category output from the LLM text.
 * Expects `{"category": "DTE"}` or markdown fenced code block, or standalone category code.
 */
export function extractCategoryFromResponse(text: string): string {
  const cleaned = text.trim();

  // 1. Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.category) return String(parsed.category).toUpperCase();
  } catch {
    // ignore
  }

  // 2. Try regex for {"category": "..."}
  const match = cleaned.match(/"category"\s*:\s*"([A-Z]{3})"/i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }

  // 3. Look for explicit 3-letter category code
  const codeMatch = cleaned.match(/\b(PYC|DTE|EMP|ONB|ASR|PMS|TAL)\b/);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1].toUpperCase();
  }

  return 'UNC';
}

/**
 * Calls an Efficia Agent Deployment via its REST streaming API
 */
export async function classifyWithEfficia(
  conversationText: string,
  config: EfficiaModelConfig
): Promise<EfficiaClassificationResult> {
  const baseUrl = config.baseUrl || process.env.EFFICIA_API_BASE_URL || 'https://platform.efficia.io';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat/agent/deployments/${config.deploymentId}`;

  const pricing = config.modelName.toLowerCase().includes('deepseek')
    ? DEFAULT_PRICING.deepseek
    : DEFAULT_PRICING.gpt;

  const inputPrice = (config.inputTokenPricePerMillion ?? pricing.input) / 1_000_000;
  const outputPrice = (config.outputTokenPricePerMillion ?? pricing.output) / 1_000_000;

  const startTime = performance.now();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      message: conversationText,
      externalUserId: 'benchmark-eval-user',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Efficia API error (${response.status}) on deployment ${config.deploymentId}: ${errorText}`);
  }

  // Efficia streams SSE response (text/event-stream)
  let accumulatedText = '';
  let reportedPromptTokens = 0;
  let reportedCompletionTokens = 0;

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const rawData = trimmed.slice(6);
          if (rawData === '[DONE]') continue;

          try {
            const parsed = JSON.parse(rawData);
            // Handle different event formats (Vercel AI SDK or Efficia events)
            if (typeof parsed === 'string') {
              accumulatedText += parsed;
            } else if (parsed.content) {
              accumulatedText += parsed.content;
            } else if (parsed.text) {
              accumulatedText += parsed.text;
            } else if (parsed.type === 'chunk' && parsed.chunk) {
              accumulatedText += parsed.chunk;
            }

            // Extract usage if reported
            if (parsed.usage) {
              reportedPromptTokens = parsed.usage.promptTokens ?? parsed.usage.prompt_tokens ?? 0;
              reportedCompletionTokens = parsed.usage.completionTokens ?? parsed.usage.completion_tokens ?? 0;
            }
          } catch {
            // Raw text chunk
            accumulatedText += rawData;
          }
        }
      }
    }
  } else {
    accumulatedText = await response.text();
  }

  const endTime = performance.now();
  const latencyMs = Math.round((endTime - startTime) * 100) / 100;

  // Fallback token estimation if provider did not stream token stats
  const promptTokens = reportedPromptTokens || Math.ceil(conversationText.length / 4);
  const completionTokens = reportedCompletionTokens || Math.ceil(accumulatedText.length / 4);
  const totalTokens = promptTokens + completionTokens;

  const costUsd = Number((promptTokens * inputPrice + completionTokens * outputPrice).toFixed(8));
  const category = extractCategoryFromResponse(accumulatedText);

  return {
    category,
    rawText: accumulatedText,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
  };
}
