import { classifyWithDeepSeek } from './deepseek-client.js';

async function main() {
  console.log('--- Testing DeepSeek (via Efficia) ---');

  const testConversation = `Employee: Hello, my June salary has not been credited yet. It has been 3 days since the usual pay date.
Helpdesk Agent: I understand your concern. Did you receive any notification from your manager or finance about a processing delay?
Employee: No notification at all. My teammates in the same department got theirs on Friday.`;

  console.log('\nInput Conversation:');
  console.log(testConversation);
  console.log('\nSending classification request...');

  try {
    const result = await classifyWithDeepSeek(testConversation);

    console.log('\n✅ Result Received:');
    console.log(`• Selected Category: ${result.category}`);
    console.log(`• Latency: ${result.latencyMs} ms`);
    console.log(`• Prompt Tokens: ${result.promptTokens}`);
    console.log(`• Completion Tokens: ${result.completionTokens}`);
    console.log(`• Total Cost: $${result.costUsd.toFixed(6)}`);
    if (result.rawText) {
      console.log(`• Raw Response: ${result.rawText}`);
    }
  } catch (error: any) {
    console.error('\n❌ Test Failed:', error.message);
  }
}

main();
