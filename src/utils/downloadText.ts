// Build a plain-text document from a title + sections, and trigger a browser download.

interface Section {
  heading: string | null
  paragraphs: string[]
}

export function sectionsToPlainText(title: string, sections: Section[]): string {
  const body = sections
    .map(s => [s.heading, ...s.paragraphs].filter(Boolean).join('\n\n'))
    .join('\n\n')
  return [title, body].filter(Boolean).join('\n\n')
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Make a safe filename from a title.
export function safeFilename(title: string, ext = 'txt'): string {
  const base = (title || 'document').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'document'
  return `${base}.${ext}`
}
