/**
 * Test prompt.js + Gemini together.
 * Run: npm run test:prompt
 * Requires GEMINI_API_KEY or GOOGLE_API_KEY in .env
 */

import 'dotenv/config';
import { generateText, isConfigured, buildSummaryPrompt, buildQuestionPrompt } from './index.js';

const SAMPLE_PAGE = {
  title: 'How to renew your driver\'s licence',
  url: 'https://example.gov/renew-licence',
  text: `
    Renewing your driver's licence can be done online or at a service centre.
    You need: proof of identity, a recent photo, and the renewal fee of $45.
    Processing takes 5–10 business days. If your licence expired more than 12 months ago,
    you must pass the vision test again. Book an appointment online to avoid wait times.
  `.replace(/\s+/g, ' ').trim(),
  language: 'en',
};

async function main() {
  if (!isConfigured()) {
    console.error('Set GEMINI_API_KEY or GOOGLE_API_KEY in .env');
    process.exit(1);
  }

  console.log('Testing: buildSummaryPrompt + generateText\n');

  const prompt = buildSummaryPrompt(SAMPLE_PAGE, 'standard');
  console.log('--- Prompt (first 400 chars) ---');
  console.log(prompt.slice(0, 400) + '...\n');

  console.log('Calling Gemini...');
  const summary = await generateText(prompt);
  console.log('--- Summary ---');
  console.log(summary);

  console.log('\n--- Optional: Q&A test ---');
  const qPrompt = buildQuestionPrompt(SAMPLE_PAGE, 'How much does renewal cost?');
  const answer = await generateText(qPrompt);
  console.log(answer);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
