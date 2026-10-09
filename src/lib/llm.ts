import OpenAI from "openai";

// xAI's API is OpenAI-compatible, so the official SDK works with a different base URL.
let client: OpenAI | null = null;

export function isLLMConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

export function getLLMClient(): OpenAI {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  client ??= new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
  return client;
}

export const LLM_MODEL = process.env.XAI_MODEL || "grok-4";

/** Optional cheaper/faster model for bulk work (extracting and scoring many jobs). */
export const LLM_FAST_MODEL = process.env.XAI_FAST_MODEL || LLM_MODEL;
