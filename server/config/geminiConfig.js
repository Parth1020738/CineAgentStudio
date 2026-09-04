import dotenv from 'dotenv';
import { InMemoryRunner } from '@google/adk';

dotenv.config();

// Ensure API key is configured from GEMINI_API_KEY or GOOGLE_GENAI_API_KEY
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_GENAI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
}

/**
 * Returns configured primary Gemini model identifier.
 * Defaults to gemini-3.6-flash.
 */
export function getGeminiModel() {
  return (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
}

/**
 * Returns optional fallback Gemini model identifier.
 */
export function getGeminiFallbackModel() {
  return process.env.GEMINI_FALLBACK_MODEL ? process.env.GEMINI_FALLBACK_MODEL.trim() : null;
}

/**
 * Log model configuration on server startup (never exposing API keys).
 */
export function logGeminiConfig() {
  console.log(`[Gemini] Primary Model: ${getGeminiModel()}`);
  if (getGeminiFallbackModel()) {
    console.log(`[Gemini] Fallback Model: ${getGeminiFallbackModel()}`);
  }
}

/**
 * Custom error class representing Gemini 429 rate limit errors.
 */
export class GeminiRateLimitError extends Error {
  constructor(message = 'Gemini is temporarily rate-limited. Please wait a short time and try again.') {
    super(message);
    this.name = 'GeminiRateLimitError';
    this.code = 'GEMINI_RATE_LIMITED';
  }
}

/**
 * Detects whether an error or message represents a 429 / Quota Exceeded error.
 * @param {any} err Error object, string, or ADK event
 * @returns {boolean} True if 429 rate limit
 */
export function is429RateLimitError(err) {
  if (!err) return false;
  const str = (typeof err === 'string'
    ? err
    : (err.message || err.errorMessage || JSON.stringify(err))).toLowerCase();

  return (
    str.includes('429') ||
    str.includes('quota') ||
    str.includes('resource_exhausted') ||
    str.includes('rate limit') ||
    str.includes('rate-limit') ||
    str.includes('gemini_rate_limited')
  );
}

/**
 * Extracts Retry-After delay in milliseconds if present in the error string.
 * Defaults to defaultMs (e.g., 3000ms).
 * @param {any} err Error object or message
 * @param {number} defaultMs Default delay in ms
 * @returns {number} Delay in milliseconds
 */
export function parseRetryAfterMs(err, defaultMs = 3000) {
  if (!err) return defaultMs;
  const str = typeof err === 'string'
    ? err
    : (err.message || err.errorMessage || String(err));

  const match = str.match(/retry in ([0-9]+(?:\.[0-9]+)?)s/i);
  if (match && match[1]) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.min(Math.round(sec * 1000), 10000); // Bounded max 10s backoff for UI responsiveness
    }
  }
  return defaultMs;
}

/**
 * Robust JSON extractor for LLM output strings.
 * Handles markdown fences, surrounding prose, and whitespace.
 * @param {string} text Raw LLM output
 * @returns {object|null} Parsed JSON object or null
 */
export function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Try stripping markdown code fences
  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    // Continue to regex extraction
  }

  // 2. Find outermost balanced { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1).trim();
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      // ignore
    }
  }

  return null;
}

/**
 * Shared execution helper enforcing centralized Gemini rate-limit & format retry policy.
 * Policy:
 * - Maximum 1 automatic retry for HTTP 429 rate limits with short bounded delay.
 * - Maximum 2 total attempts for output formatting.
 * - Never converts 429 into a JSON format error.
 * - Throws GeminiRateLimitError immediately when rate limited beyond allowed retry.
 *
 * @param {object} options Options for execution
 * @param {string} options.agentName Agent identifier for logging
 * @param {object} options.agent ADK LlmAgent instance
 * @param {string} options.userPrompt User prompt text
 * @param {function} options.parseAndValidate Function taking extracted JSON and returning validated object
 * @returns {Promise<object>} Validated agent result payload
 */
export async function executeAgentWithPolicy({ agentName, agent, userPrompt: initialPrompt, parseAndValidate }) {
  if (!agent) {
    throw new Error('agent must be provided in runner constructor (or via app.rootAgent)');
  }

  let fullResponseText = '';
  let lastErrorMessage = '';
  let rateLimitRetried = false;
  const maxFormatAttempts = 2;
  let currentPrompt = initialPrompt;

  for (let attempt = 1; attempt <= maxFormatAttempts; attempt++) {
    fullResponseText = '';

    try {
      const runner = new InMemoryRunner({ agent });
      const session = await runner.sessionService.createSession({ appName: runner.appName, userId: 'default' });

      for await (const event of runner.runAsync({
        sessionId: session.id,
        userId: 'default',
        newMessage: {
          role: 'user',
          parts: [{ text: currentPrompt }]
        }
      })) {
        if (event.errorMessage) {
          lastErrorMessage = event.errorMessage;
        }
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if (part.text) {
              fullResponseText += part.text;
            }
          }
        }
      }

      if (!fullResponseText) {
        const updatedSession = await runner.sessionService.getSession({ appName: runner.appName, userId: 'default', sessionId: session.id });
        const modelEvents = updatedSession.events ? updatedSession.events.filter(e => e.author !== 'user' && e.content && e.content.parts) : [];
        for (const event of modelEvents) {
          for (const part of event.content.parts) {
            if (part.text) {
              fullResponseText += part.text;
            }
          }
        }
      }
    } catch (err) {
      lastErrorMessage = err.message || String(err);
    }

    // Check if current attempt failed due to 429
    if (is429RateLimitError(lastErrorMessage)) {
      if (!rateLimitRetried) {
        rateLimitRetried = true;
        const delayMs = parseRetryAfterMs(lastErrorMessage, 3000);
        console.warn(`[${agentName}] Rate limit (429) encountered. Retrying once in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
        attempt--; 
        continue;
      } else {
        console.error(`[${agentName}] Rate limit (429) persisted after retry. Fast failing with GeminiRateLimitError.`);
        throw new GeminiRateLimitError('Gemini is temporarily rate-limited. Please wait a short time and try again.');
      }
    }

    // Attempt to extract and validate JSON response
    if (fullResponseText && fullResponseText.includes('{')) {
      const extracted = extractJsonFromText(fullResponseText);
      if (extracted) {
        try {
          return parseAndValidate(extracted);
        } catch (schemaErr) {
          lastErrorMessage = schemaErr.message;
          console.warn(`[${agentName}] Format attempt ${attempt} validation error: ${schemaErr.message}`);
        }
      }
    }

    if (attempt < maxFormatAttempts) {
      console.warn(`[${agentName}] Preparing targeted format repair pass for attempt ${attempt + 1}/${maxFormatAttempts}...`);
      currentPrompt = `${initialPrompt}\n\nCRITICAL FORMAT REPAIR REQUIRED:\nYour previous response failed validation with error: "${lastErrorMessage || 'Invalid JSON format'}".\nPlease fix this error and respond ONLY with the corrected raw JSON object matching the exact schema.`;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Final error classification
  if (is429RateLimitError(lastErrorMessage)) {
    throw new GeminiRateLimitError('Gemini is temporarily rate-limited. Please wait a short time and try again.');
  }

  throw new Error(`${agentName} failed to return a valid JSON structure. ${lastErrorMessage ? lastErrorMessage : ''}`);
}
