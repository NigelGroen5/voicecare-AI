/**
 * Local backend for the extension. Keeps API keys server-side.
 * Run: npm run server
 * - POST /summarize: page content → Gemini → summary
 * - POST /speak: text → Gradium TTS → base64 WAV
 */

import 'dotenv/config';
import http from 'http';
import { generateText, isConfigured, buildSummaryPrompt, buildGuidePrompt, buildQuestionPrompt } from './src/index.js';
import { textToSpeech, isGradiumConfigured } from './src/lib/gradium.js';

const PORT = 3000;

if (!isConfigured()) {
  console.error('Set GEMINI_API_KEY or GOOGLE_API_KEY in .env');
  process.exit(1);
}

function pathname(req) {
  const u = req.url || '/';
  const i = u.indexOf('?');
  return i === -1 ? u : u.slice(0, i);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const path = pathname(req);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && (path === '/speak' || path === '/speak/')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    if (!isGradiumConfigured()) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'Gradium TTS not configured. Set GRADIUM_API_KEY in .env' }));
      return;
    }
    try {
      const audio = await textToSpeech(data.text || '');
      res.writeHead(200);
      res.end(JSON.stringify({ audio }));
    } catch (err) {
      console.error('Gradium TTS:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message || 'Gradium TTS failed' }));
    }
    return;
  }

  if (req.method === 'POST' && (path === '/ask' || path === '/ask/')) {
    let body = '';
    for await (const chunk of req) body += chunk;

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    try {
      const prompt = buildQuestionPrompt(
        {
          title: payload.title || 'Unknown',
          url: payload.url || 'Unknown',
          text: payload.text || '',
          language: payload.language || 'en',
        },
        payload.question || ''
      );
      const answer = await generateText(prompt);
      res.writeHead(200);
      res.end(JSON.stringify({ answer }));
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Gemini request failed';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        msg =
          'Gemini rate limit reached. Wait a minute or check your quota at https://ai.google.dev/gemini-api/docs/rate-limits';
      }
      res.writeHead(500);
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }

  if (req.method !== 'POST' || (path !== '/summarize' && path !== '/summarize/')) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  try {
    let prompt;
    if (payload.guide) {
      prompt = buildGuidePrompt(payload.guide);
    } else {
      prompt = buildSummaryPrompt(
        {
          title: payload.title || 'Unknown',
          url: payload.url || 'Unknown',
          text: payload.text || '',
          language: payload.language || 'en',
        },
        'readaloud'
      );
    }
    const summary = await generateText(prompt);
    res.writeHead(200);
    res.end(JSON.stringify({ summary }));
  } catch (err) {
    console.error(err);
    let msg = err.message || 'Gemini request failed';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      msg =
        'Gemini rate limit reached. Wait a minute or check your quota at https://ai.google.dev/gemini-api/docs/rate-limits';
    }
    res.writeHead(500);
    res.end(JSON.stringify({ error: msg }));
  }
});

server.listen(PORT, () => {
  console.log(`VoiceCare backend running at http://localhost:${PORT}`);
  console.log('Endpoints: POST /ask, POST /summarize, POST /speak');
  console.log('Extension ready! Click the microphone or a suggestion chip to start.');
});
