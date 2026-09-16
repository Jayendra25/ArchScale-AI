/**
 * LLM abstraction layer — Gemini primary, Groq fallback.
 *
 * Uses @google/genai (new unified SDK, supports AQ.* key format).
 * Both providers have AbortController-based timeouts so they always
 * fail fast and hand off to the next tier.
 */

import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export type LLMResult = {
  text: string;
  provider: "gemini" | "groq" | "none";
};

export type LLMJsonResult<T> = {
  data: T | null;
  provider: "gemini" | "groq" | "none";
  /** Safe, user-displayable explanation when no AI response passed validation. */
  error?: string;
};

/** Wrap any promise with a hard timeout. Rejects with the given message after ms. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const ai = new GoogleGenAI({ apiKey: key });

  const call = ai.models.generateContent({
    model: "gemini-3.6-flash",
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.2,
      // A structured project state can contain many independently supported
      // events. Do not let a tiny provider default cut JSON off mid-array.
      maxOutputTokens: 8192,
    },
    contents: userPrompt,
  });

  const response = await withTimeout(call, 20_000, "Gemini");
  const text = (response as { text?: string }).text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const groq = new Groq({ apiKey: key });

  const call = groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  }) as Promise<{ choices: Array<{ message: { content: string | null } }> }>;

  const completion = await withTimeout(call, 25_000, "Groq");
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

/**
 * Main entry point — tries Gemini first, falls back to Groq.
 * Returns { text, provider } so callers can log which provider served.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResult> {
  // --- Attempt 1: Gemini ---
  try {
    console.log("[LLM] Attempting Gemini (gemini-3.6-flash)...");
    const text = await callGemini(systemPrompt, userPrompt);
    console.log("[LLM] ✓ Gemini responded successfully");
    return { text, provider: "gemini" };
  } catch (geminiErr) {
    console.warn(
      "[LLM] Gemini failed:",
      geminiErr instanceof Error ? geminiErr.message : geminiErr
    );
  }

  // --- Attempt 2: Groq fallback ---
  try {
    console.log("[LLM] Falling back to Groq (qwen3.8-27b)...");
    const text = await callGroq(systemPrompt, userPrompt);
    console.log("[LLM] ✓ Groq responded successfully");
    return { text, provider: "groq" };
  } catch (groqErr) {
    console.warn(
      "[LLM] Groq also failed:",
      groqErr instanceof Error ? groqErr.message : groqErr
    );
  }

  // --- Both failed: rule-based fallback ---
  return { text: "", provider: "none" };
}

/**
 * Parse JSON from LLM text, stripping markdown fences if present.
 */
export function parseLLMJson<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Call the provider chain for a structured response. A syntactically valid but
 * incomplete response is treated as a failed attempt, so Gemini's malformed
 * JSON can still fall through to Groq rather than silently losing categories.
 */
export async function callLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  isValid: (value: unknown) => value is T
): Promise<LLMJsonResult<T>> {
  const attempts: Array<{
    provider: "gemini" | "groq";
    call: () => Promise<string>;
  }> = [
    { provider: "gemini", call: () => callGemini(systemPrompt, userPrompt) },
    { provider: "groq", call: () => callGroq(systemPrompt, userPrompt) },
  ];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      console.log(`[LLM] Attempting ${attempt.provider} structured extraction...`);
      const text = await attempt.call();
      const parsed = parseLLMJson<unknown>(text);
      if (!isValid(parsed)) {
        throw new Error("returned JSON that did not contain the complete extraction schema");
      }
      console.log(`[LLM] ✓ ${attempt.provider} returned a complete structured response`);
      return { data: parsed, provider: attempt.provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${attempt.provider}: ${message}`);
      console.warn(`[LLM] ${attempt.provider} structured extraction failed: ${message}`);
    }
  }

  return {
    data: null,
    provider: "none",
    error: `AI extraction was unavailable or invalid (${errors.join("; ")})`,
  };
}
