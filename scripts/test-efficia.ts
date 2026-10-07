import * as dotenv from 'dotenv';
import { classifyWithOpenAI } from './openai-client.js';
import { classifyWithDeepSeek } from './deepseek-client.js';
import { classifyWithClaude } from './claude-client.js';

dotenv.config();

async function main() {
  console.log('--- Testing Efficia Agent API ---');

  const modelChoice = (process.argv[2] || 'deepseek').toLowerCase();
  const isDeepSeek = modelChoice === 'deepseek';
  const isClaude = modelChoice === 'claude' || modelChoice === 'sonnet';

  const testConversation = `Employee: Hello, my June salary has not been credited yet. It has been 3 days since the usual pay date.
Helpdesk Agent: I understand your concern. Did you receive any notification from your manager or finance about a processing delay?
Employee: No notification at all. My teammates in the same department got theirs on Friday.`;

  console.log(`\nTesting ${isDeepSeek ? 'DeepSeek' : isClaude ? 'Claude Sonnet' : 'OpenAI (GPT-6 Luna)'}...`);

  try {
    const result = isDeepSeek
      ? await classifyWithDeepSeek(testConversation)
      : isClaude
        ? await classifyWithClaude(testConversation)
        : await classifyWithOpenAI(testConversation);

    console.log('\n✅ Result Received:');
    console.log(`• Extracted Category: ${result.category}`);
    console.log(`• Latency: ${result.latencyMs} ms`);
    console.log(`• Input Tokens: ${result.promptTokens}`);
    console.log(`• Output Tokens: ${result.completionTokens}`);
    console.log(`• Total Tokens: ${result.totalTokens}`);
    console.log(`• Input Cost: $${result.inputCostUsd.toFixed(6)}`);
    console.log(`• Output Cost: $${result.outputCostUsd.toFixed(6)}`);
    console.log(`• Total Cost: $${result.totalCostUsd.toFixed(6)}`);
    if (result.rawText) {
      console.log(`\n• Raw Model Response:\n${result.rawText}`);
    }
  } catch (error: any) {
    console.error('\n❌ Test Failed:', error.message);
  }
}

main();
