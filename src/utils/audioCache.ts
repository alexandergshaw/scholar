import { get, set, del, keys } from 'idb-keyval'

const k = (itemId: string, voice: string, index: number) => `ttsaudio::${itemId}::${voice}::${index}`

export async function getCachedAudio(itemId: string, voice: string, index: number): Promise<string | null> {
  try {
    return (await get(k(itemId, voice, index))) ?? null
  } catch {
    return null
  }
}

export async function setCachedAudio(itemId: string, voice: string, index: number, base64: string): Promise<void> {
  try {
    await set(k(itemId, voice, index), base64)
  } catch {}
}

export async function cachedCount(itemId: string, voice: string): Promise<number> {
  try {
    const all = await keys()
    const pre = `ttsaudio::${itemId}::${voice}::`
    return (all as string[]).filter(x => typeof x === 'string' && x.startsWith(pre)).length
  } catch {
    return 0
  }
}

export async function clearCachedAudio(itemId: string): Promise<void> {
  try {
    const all = await keys()
    for (const key of all as string[]) {
      if (typeof key === 'string' && key.startsWith(`ttsaudio::${itemId}::`)) {
        await del(key)
      }
    }
  } catch {}
}

// Pre-generate audio for every segment and store it. Calls onProgress(done,total).
export async function cacheAllSegments(
  itemId: string,
  voice: string,
  languageCode: string,
  rate: number,
  pitchMapped: number,
  segments: string[],
  onProgress: (done: number, total: number) => void,
  shouldCancel: () => boolean
): Promise<{ ok: boolean; cached: number; error?: string }> {
  let cached = 0
  for (let i = 0; i < segments.length; i++) {
    if (shouldCancel()) return { ok: false, cached, error: 'cancelled' }
    if (await getCachedAudio(itemId, voice, i)) {
      cached++
      onProgress(i + 1, segments.length)
      continue
    }
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: segments[i],
          voice,
          languageCode,
          rate,
          pitch: pitchMapped
        })
      })
      if (!res.ok) return { ok: false, cached, error: 'Server error ' + res.status }
      const data = await res.json()
      if (data.error || !data.audio) return { ok: false, cached, error: data.error || 'No audio (is the cloud voice configured?)' }
      await setCachedAudio(itemId, voice, i, data.audio)
      cached++
    } catch (e) {
      return { ok: false, cached, error: String(e) }
    }
    onProgress(i + 1, segments.length)
  }
  return { ok: true, cached }
}
