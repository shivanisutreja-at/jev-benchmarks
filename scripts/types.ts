export interface ClassificationResult {
  category: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  latencyMs: number;
  promptTokens: number; // input tokens
  completionTokens: number; // output tokens
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  costUsd: number; // alias for totalCostUsd
  rawText?: string;
  rawResponse?: any;
}

export interface ModelAdapter {
  id: string; // e.g. 'jev', 'openai', 'deepseek', 'claude'
  name: string; // e.g. 'Jev (~typesafe/jev-latest)', 'OpenAI (GPT-6 Luna)', 'DeepSeek'
  isConfigured(): boolean;
  classify(conversationText: string): Promise<ClassificationResult>;
}

export interface BenchmarkConfig {
  models: string[]; // ['jev'], ['openai'], ['deepseek'], or combinations like ['jev', 'deepseek']
  limit?: number;
  dataPath?: string;
  verbose?: boolean;
}
