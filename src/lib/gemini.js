/**
 * Google Gemini API service for VoiceCare AI.
 * Uses the official @google/genai SDK. Keep your API key server-side only.
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.warn(
    'Gemini API: No GEMINI_API_KEY or GOOGLE_API_KEY in environment. Set one in .env or your shell.'
  );
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Generate a single text response from Gemini.
 * @param {string} prompt - User message or prompt
 * @param {Object} options - Optional config
 * @param {string} [options.model] - Model name (default: gemini-2.0-flash)
 * @param {string} [options.systemInstruction] - System instruction for the model
 * @returns {Promise<string>} Generated text
 */
export async function generateText(prompt, options = {}) {
  if (!ai) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY or GOOGLE_API_KEY.');
  }

  const model = options.model ?? DEFAULT_MODEL;
  const config = {};

  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: Object.keys(config).length ? config : undefined,
  });

  return response?.text ?? '';
}

/**
 * Stream generated text from Gemini (for real-time UI).
 * @param {string} prompt - User message
 * @param {Object} options - Optional config
 * @param {string} [options.model] - Model name
 * @returns {AsyncGenerator<string>} Chunks of text
 */
export async function* generateTextStream(prompt, options = {}) {
  if (!ai) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY or GOOGLE_API_KEY.');
  }

  const model = options.model ?? DEFAULT_MODEL;
  const stream = await ai.models.generateContentStream({
    model,
    contents: prompt,
  });

  for await (const chunk of stream) {
    if (chunk?.text) yield chunk.text;
  }
}

/**
 * Check if the Gemini client is configured and ready.
 */
export function isConfigured() {
  return Boolean(ai);
}
