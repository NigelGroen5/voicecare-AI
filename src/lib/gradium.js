/**
 * Gradium TTS via WebSocket. Returns WAV audio as base64.
 * API: https://gradium.ai/api_docs.html
 * Protocol from rust-gradium (setup → text → end_of_stream; receive ready, audio, end_of_stream).
 */

import WebSocket from 'ws';

const TTS_ENDPOINT = process.env.GRADIUM_TTS_URL || 'wss://us.api.gradium.ai/api/speech/tts';
const DEFAULT_VOICE_ID = 'YTpq7expH9539ERJ'; // Emma - pleasant US female

/**
 * Build a 44-byte WAV header for PCM 48kHz 16-bit mono.
 * @param {number} numSamples - Total number of samples (bytes / 2)
 */
function wavHeader(numSamples) {
  const sampleRate = 48000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buf = Buffer.alloc(44);
  let off = 0;
  buf.write('RIFF', off); off += 4;
  buf.writeUInt32LE(fileSize, off); off += 4;
  buf.write('WAVE', off); off += 4;
  buf.write('fmt ', off); off += 4;
  buf.writeUInt32LE(16, off); off += 4; // chunk size
  buf.writeUInt16LE(1, off); off += 2;  // PCM
  buf.writeUInt16LE(numChannels, off); off += 2;
  buf.writeUInt32LE(sampleRate, off); off += 4;
  buf.writeUInt32LE(byteRate, off); off += 4;
  buf.writeUInt16LE((numChannels * bitsPerSample) / 8, off); off += 2;
  buf.writeUInt16LE(bitsPerSample, off); off += 2;
  buf.write('data', off); off += 4;
  buf.writeUInt32LE(dataSize, off);
  return buf;
}

/**
 * Convert text to speech using Gradium. Returns base64-encoded WAV.
 * @param {string} text - Text to speak
 * @param {Object} options - { voiceId, apiKey }
 * @returns {Promise<string>} Base64 WAV
 */
export function textToSpeech(text, options = {}) {
  const apiKey = options.apiKey || process.env.GRADIUM_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('GRADIUM_API_KEY not set'));
  }

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TTS_ENDPOINT, {
      headers: { 'x-api-key': apiKey },
    });

    const chunks = [];
    let resolved = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'setup',
        voice_id: voiceId,
        model_name: 'default',
        output_format: 'pcm',
      }));
    });

    ws.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString();
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') {
        ws.send(JSON.stringify({ type: 'text', text }));
        ws.send(JSON.stringify({ type: 'end_of_stream' }));
        return;
      }
      if (msg.type === 'audio' && msg.audio) {
        chunks.push(Buffer.from(msg.audio, 'base64'));
        return;
      }
      if (msg.type === 'end_of_stream') {
        if (resolved) return;
        resolved = true;
        const pcm = Buffer.concat(chunks);
        const numSamples = Math.floor(pcm.length / 2);
        const header = wavHeader(numSamples);
        const wav = Buffer.concat([header, pcm.slice(0, numSamples * 2)]);
        ws.close();
        resolve(wav.toString('base64'));
        return;
      }
      if (msg.type === 'error') {
        ws.close();
        reject(new Error(msg.message || 'Gradium TTS error'));
      }
    });

    ws.on('error', (err) => reject(err));
    ws.on('close', () => {
      if (!resolved && chunks.length > 0) {
        resolved = true;
        const pcm = Buffer.concat(chunks);
        const numSamples = Math.floor(pcm.length / 2);
        const header = wavHeader(numSamples);
        const wav = Buffer.concat([header, pcm.slice(0, numSamples * 2)]);
        resolve(wav.toString('base64'));
      }
    });
  });
}

export function isGradiumConfigured() {
  return Boolean(process.env.GRADIUM_API_KEY);
}
