/**
 * Loads Gemini credentials from Supabase Edge Function secrets.
 * GEMINI_API_KEY is primary; GEMINI_API_KEY_2 is a backup and may belong to
 * a separate Google Cloud project. Duplicate values are removed to avoid
 * retrying the exact same credential.
 */
export function getGeminiApiKeys(): string[] {
  const candidates = [
    Deno.env.get("GEMINI_API_KEY"),
    Deno.env.get("GEMINI_API_KEY_2"),
  ];
  const keys: string[] = [];
  for (const candidate of candidates) {
    const key = candidate?.trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
