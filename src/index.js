/**
 * VoiceCare AI entry point.
 * Gemini: generateText, generateTextStream, isConfigured
 * Prompts: buildSummaryPrompt, buildQuestionPrompt, buildChunkNotesPrompt, buildReduceSummaryPrompt, buildTtsScriptPrompt
 */

export { generateText, generateTextStream, isConfigured } from './lib/gemini.js';
export {
  buildSummaryPrompt,
  buildQuestionPrompt,
  buildGuidedActionPrompt,
  buildChunkNotesPrompt,
  buildReduceSummaryPrompt,
  buildTtsScriptPrompt,
  buildGuidePrompt,
} from './prompt.js';
