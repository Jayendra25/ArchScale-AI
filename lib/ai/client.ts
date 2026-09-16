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
