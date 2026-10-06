export interface ClassificationResult {
  category: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  rawText?: string;
  rawResponse?: any;
}

export interface ModelAdapter {
  id: string; // e.g. 'jev', 'openai', 'deepseek'
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
