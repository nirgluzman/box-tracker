// LLM summarization (SPEC 7) - Groq (OpenAI-compatible) chat completions.
// Falls back to the raw transcript on missing key / HTTP error / network
// failure, so voice input never blocks saving (passthrough philosophy).
const KEY = import.meta.env.VITE_LLM_API_KEY as string | undefined
const MODEL = 'llama-3.3-70b-versatile'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

// Extract just the box's contents as a tight item list - the spoken transcript
// often has filler, repetition, and background chatter we don't want on the label.
const SYSTEM_PROMPT =
  "You label moving boxes. From the spoken transcript of one box's contents, extract a " +
  'concise, comma-separated list of the physical items only, in Hebrew. If the transcript is ' +
  'in English or German, translate the items into Hebrew. But keep individual English or ' +
  'German words that are normally used as-is in Hebrew - brand names, proper nouns, model ' +
  'names, and common loanwords - in their original form, written in their original Latin ' +
  'letters; do not translate those and do not transliterate them into Hebrew characters. ' +
  'Remove filler words, repetitions, hesitations, side comments, and any background talk or ' +
  'anything that is not an item being packed. Output ONLY the list - no introduction, no ' +
  'explanation, no quotes, no trailing punctuation. If no items can be identified, return the ' +
  'transcript with filler removed.'

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
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0.2,
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
