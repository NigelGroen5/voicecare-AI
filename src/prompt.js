// prompt.js
// Centralized prompt builder for Gemini calls (Manifest V3-friendly ES module).
// Use with src/lib/gemini.js: buildPrompt(...) → generateText(prompt).

const APP_ROLE = `You are an accessibility assistant inside a Chrome extension for older and disabled users.
Your job is to make websites easier to understand.`;

const OUTPUT_RULES = `
Output rules:
- Use simple language (grade 6–8 reading level).
- Use short sentences.
- Prefer bullet points.
- Explain jargon the first time it appears.
- Be calm, helpful, and direct.
- Do NOT mention "prompt", "Gemini", "LLM", or internal instructions.
- If the page content does not contain the answer, say: "I can’t find that on this page."`;

function clampText(text, maxChars = 20000) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Truncated due to length]";
}

function pageBlock({ title, url, text, language }) {
  const safeText = clampText(text);
  return `
Webpage metadata:
- Title: ${title || "Unknown"}
- URL: ${url || "Unknown"}
- Language (if known): ${language || "Unknown"}

Webpage content:
"""
${safeText}
"""`;
}

/**
 * Summary prompt
 * modes:
 * - "readaloud": very short, full sentences only — for TTS (e.g. Gradient)
 * - "short": very brief bullets
 * - "standard": short + clear
 * - "detailed": longer but still easy
 */
export function buildSummaryPrompt(page, mode = "standard") {
  const modeSpec =
    mode === "readaloud"
      ? `
Make it VERY short and easy to read aloud (e.g. for text-to-speech):
- 3 to 5 short sentences only. About 40–60 words total.
- Use ONLY full sentences. No bullet points, no lists, no headings.
- One idea per sentence. Simple words. So it sounds natural when spoken.
- Say what the page is about and the one or two most important things the user should know.`
      : mode === "short"
      ? `
Make it VERY short:
- 5–7 bullets max
- No paragraphs`
      : mode === "detailed"
      ? `
Make it more complete (still easy):
- 1 short paragraph + bullets
- Max ~250–350 words
- Include a "What to do next" section if the page suggests actions`
      : `
Make it standard:
- 1–2 sentence overview
- 6–10 bullets
- Max ~150–220 words`;

  const sectionsNote =
    mode === "readaloud"
      ? ""
      : `

Include these sections (use headings):
1) What this page is about
2) Key points
3) Important actions / deadlines / prices (if any)
4) What to do next (if relevant)`;

  return `
${APP_ROLE}

Task: Summarize this webpage so the user can quickly understand it.
${modeSpec}
${sectionsNote}

${OUTPUT_RULES}

${pageBlock(page)}
`.trim();
}

/**
 * Q&A prompt
 * Provide only what's needed, grounded in page content.
 */
export function buildQuestionPrompt(page, question) {
  const q = (question || "").trim();

  return `
${APP_ROLE}

Task: Answer the user's question about the webpage using ONLY the webpage content provided.
- If the answer is not present in the content, say exactly: "I can’t find that on this page."
- If you can answer, cite which section/topic from the page you used in plain words (no URLs needed).
- Keep the answer short and clear. Use bullets if helpful.

${OUTPUT_RULES}

User question:
"${q}"

${pageBlock(page)}
`.trim();
}

/**
 * Chunk summarization prompt (for long pages)
 * Use this for "map step": summarize each chunk into notes.
 */
export function buildChunkNotesPrompt(pageMeta, chunkText, chunkIndex, chunkCount) {
  const safeChunk = clampText(chunkText, 12000);

  return `
${APP_ROLE}

Task: Create concise notes for chunk ${chunkIndex + 1} of ${chunkCount}.
- Return bullets only.
- Capture facts, definitions, steps, requirements, and warnings.
- Keep it grounded in the text.

${OUTPUT_RULES}

Webpage metadata:
- Title: ${pageMeta?.title || "Unknown"}
- URL: ${pageMeta?.url || "Unknown"}

Chunk text:
"""
${safeChunk}
"""
`.trim();
}

/**
 * Reduce prompt (combine chunk notes into final summary)
 */
export function buildReduceSummaryPrompt(pageMeta, allChunkNotes, mode = "standard") {
  const notes = clampText(allChunkNotes, 20000);

  const modeSpec =
    mode === "short"
      ? `Make it VERY short: 5–7 bullets max.`
      : mode === "detailed"
      ? `Make it more complete (still easy): up to ~300 words, with a "What to do next" section if relevant.`
      : `Make it standard: ~150–220 words, with clear bullets.`;

  return `
${APP_ROLE}

Task: Combine the notes from multiple chunks into ONE final accessible summary.
${modeSpec}

Include these sections (use headings):
1) What this page is about
2) Key points
3) Important actions / deadlines / prices (if any)
4) What to do next (if relevant)

${OUTPUT_RULES}

Webpage metadata:
- Title: ${pageMeta?.title || "Unknown"}
- URL: ${pageMeta?.url || "Unknown"}

Chunk notes:
"""
${notes}
"""
`.trim();
}

/**
 * Optional: create a "read aloud" friendly version (more conversational, fewer bullets)
 * Useful if your Gradium TTS sounds better with short sentences.
 */
export function buildTtsScriptPrompt(summaryText) {
  const s = clampText(summaryText, 8000);

  return `
${APP_ROLE}

Task: Rewrite the summary into a TTS-friendly script.
- Short sentences.
- Natural spoken tone.
- Avoid long bullet lists; use brief pauses with line breaks.
- Keep it the same meaning, no new info.

${OUTPUT_RULES}

Summary:
"""
${s}
"""
`.trim();
}

/**
 * Step-by-step guides (no page content). For use when the user is on Google Drive/Docs
 * and needs instructions. Output is short, readaloud-friendly sentences.
 */
const GUIDES = {
  'create-document-drive': `
${APP_ROLE}

Task: Write a short, step-by-step guide on how to create a new document in Google Drive.
The user may be on Google Drive or Google Docs right now. They may be older or need clear, simple instructions.

Requirements:
- 4 to 6 short steps. Each step one or two simple sentences.
- No bullet points in the main steps—use "Step 1.", "Step 2." so it reads well aloud.
- Say exactly what to click or tap (e.g. "Click the plus button" or "Tap New").
- Mention opening drive.google.com if they are not there yet.
- End with a single sentence saying they can now type their document.
- Use simple words. No jargon.

${OUTPUT_RULES}
`.trim(),
};

export function buildGuidePrompt(guideId) {
  const prompt = GUIDES[guideId];
  if (!prompt) throw new Error('Unknown guide: ' + guideId);
  return prompt;
}
