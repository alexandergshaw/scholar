// Split a paragraph into sentences. MUST be used identically for building the
// segments array and for rendering, so indices line up.
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  return parts.map(s => s.trim()).filter(Boolean)
}
