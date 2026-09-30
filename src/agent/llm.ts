import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";
import { z } from "zod";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const genAI = new GoogleGenerativeAI(apiKey);

export const MODEL = {
  draft: "gemini-2.5-flash",
  verify: "gemini-2.5-flash",
  embedding: "text-embedding-004",
} as const;

/** Call an LLM with retry + exponential backoff (Gemini free tier 429s). */
export async function callLLM(opts: {
  model: string;
  prompt: string;
  retries?: number;
}): Promise<string> {
  const { model, prompt, retries = 3 } = opts;
  let delay = 1000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const m = genAI.getGenerativeModel({ model });
      const res = await m.generateContent(prompt);
      return res.response.text();
    } catch (err) {
      const msg = String(err);
      if (msg.includes("429") && attempt < retries) {
        logger.warn({ model, attempt, delay }, "rate limited, backing off");
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

/** JSON-mode LLM call with zod validation. */
export async function callLLMJson<T>(opts: {
  model: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const raw = await callLLM({
    model: opts.model,
    prompt: `${opts.prompt}\n\nأجب بـ JSON صالح فقط، بدون أي نص إضافي.`,
  });
  // extract first {...} block
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("LLM did not return JSON");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  return opts.schema.parse(parsed);
}

export async function embed(text: string): Promise<number[]> {
  const m = genAI.getGenerativeModel({ model: MODEL.embedding });
  const res = await m.embedContent(text);
  return res.embedding.values;
}
