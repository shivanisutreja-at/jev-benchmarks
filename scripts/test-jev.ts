import { classifyWithJev } from './jev-client.js';

async function main() {
  console.log('--- Testing Jev (System 1) via OpenRouter ---');

  const testConversation = `Employee: Hello, my June salary has not been credited yet. It has been 3 days since the usual pay date.
Helpdesk Agent: I understand your concern. Did you receive any notification from your manager or finance about a processing delay?
Employee: No notification at all. My teammates in the same department got theirs on Friday.`;

  console.log('\nInput Conversation:');
  console.log(testConversation);
  console.log('\nSending decision request to ~typesafe/jev-latest...');

  try {
    const result = await classifyWithJev(testConversation);

    console.log('\n✅ Result Received:');
    console.log(`• Selected Category: ${result.category}`);
    console.log(`• Confidence: ${(((result.confidence ?? 1)) * 100).toFixed(1)}%`);
    console.log(`• Latency: ${result.latencyMs} ms`);
    console.log(`• Input Tokens: ${result.promptTokens}`);
    console.log(`• Output Tokens: ${result.completionTokens}`);
    console.log(`• Total Tokens: ${result.totalTokens}`);
    console.log(`• Input Cost: $${result.inputCostUsd.toFixed(6)}`);
    console.log(`• Output Cost: $${result.outputCostUsd.toFixed(6)}`);
    console.log(`• Total Cost: $${result.totalCostUsd.toFixed(6)}`);
    if (result.probabilities) {
      console.log('\nCategory Probabilities:');
      console.dir(result.probabilities, { depth: null });
    }
  } catch (error: any) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.message.includes('OPENROUTER_API_KEY')) {
      console.log('\n👉 Tip: Create .env and set your OPENROUTER_API_KEY.');
    }
  }
}

main();
