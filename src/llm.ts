// LLM summarization abstraction (SPEC 7).
// Provider TBD. Until one is chosen, runs in passthrough mode and returns the
// raw transcript unchanged, so the app is fully usable with manual editing.

const SUMMARY_PROMPT = (transcript: string) =>
  `Summarize the following text in 1-2 concise sentences.\n` +
  `Keep the same language as the input. Do not translate.\n` +
  `Text: "${transcript}"`

export async function summarize(transcript: string): Promise<string> {
  // Passthrough until a provider is wired up. Reference the prompt builder so
  // it is ready for the real implementation without tripping unused checks.
  void SUMMARY_PROMPT
  return transcript
}
