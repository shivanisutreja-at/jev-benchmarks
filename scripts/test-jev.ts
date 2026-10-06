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
    console.log(`• Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`• Latency: ${result.latencyMs} ms`);
    console.log(`• Estimated Cost: $${result.costUsd.toFixed(6)}`);
    console.log('\nCategory Probabilities:');
    console.dir(result.probabilities, { depth: null });
  } catch (error: any) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.message.includes('OPENROUTER_API_KEY')) {
      console.log('\n👉 Tip: Create benchmarks/.env and set your OPENROUTER_API_KEY.');
    }
  }
}

main();
