import * as dotenv from 'dotenv';
import { classifyWithEfficia } from './efficia-client.js';

dotenv.config();

async function main() {
  console.log('--- Testing Efficia Agent API ---');

  const modelChoice = process.argv[2] || 'deepseek'; // 'deepseek' or 'gpt'
  const isDeepSeek = modelChoice.toLowerCase() === 'deepseek';

  const deploymentId = isDeepSeek
    ? process.env.EFFICIA_DEEPSEEK_DEPLOYMENT_ID
    : process.env.EFFICIA_GPT_DEPLOYMENT_ID;

  const apiKey = isDeepSeek
    ? process.env.EFFICIA_DEEPSEEK_API_KEY
    : process.env.EFFICIA_GPT_API_KEY;

  const modelName = isDeepSeek ? 'DeepSeek' : 'GPT-6 Luna';

  if (!deploymentId || !apiKey) {
    console.error(`❌ Missing ${modelName} credentials in benchmarks/.env`);
    console.log(`Please ensure:`);
    console.log(`• ${isDeepSeek ? 'EFFICIA_DEEPSEEK_DEPLOYMENT_ID' : 'EFFICIA_GPT_DEPLOYMENT_ID'}`);
    console.log(`• ${isDeepSeek ? 'EFFICIA_DEEPSEEK_API_KEY' : 'EFFICIA_GPT_API_KEY'}`);
    process.exit(1);
  }

  const testConversation = `Employee: Hello, my June salary has not been credited yet. It has been 3 days since the usual pay date.
Helpdesk Agent: I understand your concern. Did you receive any notification from your manager or finance about a processing delay?
Employee: No notification at all. My teammates in the same department got theirs on Friday.`;

  console.log(`\nTesting ${modelName} on deployment: ${deploymentId}`);
  console.log('Sending message...');

  try {
    const result = await classifyWithEfficia(testConversation, {
      deploymentId,
      apiKey,
      modelName,
    });

    console.log('\n✅ Result Received:');
    console.log(`• Extracted Category: ${result.category}`);
    console.log(`• Latency: ${result.latencyMs} ms`);
    console.log(`• Prompt Tokens: ${result.promptTokens}`);
    console.log(`• Completion Tokens: ${result.completionTokens}`);
    console.log(`• Total Cost: $${result.costUsd.toFixed(6)}`);
    console.log(`\n• Raw Model Response:\n${result.rawText}`);
  } catch (error: any) {
    console.error('\n❌ Test Failed:', error.message);
  }
}

main();
