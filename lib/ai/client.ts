/**
 * LLM abstraction layer — Gemini primary, Groq fallback.
 * All callers use callLLM(); they never know which provider responded.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type LLMResult = {
  text: string;
  provider: "gemini" | "groq" | "none";
};

async function callGemini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
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
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

/**
 * Main entry point — tries Gemini first, falls back to Groq.
 * Returns { text, provider } so callers can log which provider served the request.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResult> {
  // --- Attempt 1: Gemini ---
  try {
    console.log("[LLM] Attempting Gemini (gemini-1.5-flash)...");
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
    console.log("[LLM] Falling back to Groq (llama-3.1-8b-instant)...");
    const text = await callGroq(systemPrompt, userPrompt);
    console.log("[LLM] ✓ Groq responded successfully");
    return { text, provider: "groq" };
  } catch (groqErr) {
    console.warn(
      "[LLM] Groq also failed:",
      groqErr instanceof Error ? groqErr.message : groqErr
    );
  }

  // --- Both failed: signal caller to use rule-based fallback ---
  return { text: "", provider: "none" };
}

/**
 * Parse JSON from LLM text, stripping markdown fences if present.
 */
export function parseLLMJson<T>(text: string): T | null {
  try {
    // Strip ```json ... ``` fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
