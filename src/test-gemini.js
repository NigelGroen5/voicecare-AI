/**
 * Quick test script for the Gemini API.
 * Run: npm run test:gemini
 * Ensure GEMINI_API_KEY or GOOGLE_API_KEY is set in .env or your environment.
 */

import 'dotenv/config';
import { generateText, isConfigured } from './lib/gemini.js';

async function main() {
  if (!isConfigured()) {
    console.error('Set GEMINI_API_KEY or GOOGLE_API_KEY in .env or your environment.');
    process.exit(1);
  }

  console.log('Calling Gemini API...');
  const answer = await generateText('In one sentence: why is the sky blue?');
  console.log('Response:', answer);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
