// LLM summarization (SPEC 7) — Groq (OpenAI-compatible) chat completions.
// Falls back to the raw transcript on missing key / HTTP error / network
// failure, so voice input never blocks saving (passthrough philosophy).
const KEY = import.meta.env.VITE_LLM_API_KEY as string | undefined
const MODEL = 'llama-3.3-70b-versatile'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const SUMMARY_PROMPT = (transcript: string) =>
  `Summarize the following text in 1-2 concise sentences.\n` +
  `Keep the same language as the input. Do not translate.\n` +
  `Text: "${transcript}"`

export async function summarize(transcript: string): Promise<string> {
  if (!KEY) return transcript
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: SUMMARY_PROMPT(transcript) }],
        temperature: 0.3,
      }),
    })
    if (!res.ok) return transcript
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === 'string' && text.trim() ? text.trim() : transcript
  } catch {
    return transcript
  }
}
