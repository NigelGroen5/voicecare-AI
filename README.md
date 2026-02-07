# voicecare-AI

VoiceCare AI with Google Gemini integration.

## Google Gemini API setup

1. **Get an API key**  
   Create a key at [Google AI Studio](https://aistudio.google.com/apikey) (free tier available).

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the key**  
   Copy `.env.example` to `.env` and set your key:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and set:
   ```
   GEMINI_API_KEY=your_api_key_here
   GRADIUM_API_KEY=your_gradium_key_here   # optional; for "Read aloud" with Gradium TTS (get at gradium.ai)
   ```
   You can also use `GOOGLE_API_KEY`; the Gemini SDK accepts either.

4. **Test the integration**
   ```bash
   npm run test:gemini
   ```

## Using Gemini in code

```javascript
import { generateText, generateTextStream, isConfigured } from './src/lib/gemini.js';

// One-shot response
const answer = await generateText('Your prompt here');

// Optional: system instruction and model
const reply = await generateText('User message', {
  model: 'gemini-2.0-flash',
  systemInstruction: 'You are a helpful healthcare assistant.',
});

// Streaming (e.g. for real-time UI)
for await (const chunk of generateTextStream('Your prompt')) {
  process.stdout.write(chunk);
}
```

**Security:** Keep the API key in `.env` and use it only in server-side code. Do not expose it in the browser or in client bundles.
