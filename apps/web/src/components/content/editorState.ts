export const EDITOR_FIELDS = ['title', 'brief', 'hook', 'caption', 'cta', 'scheduledAt'] as const
export type EditorSnapshot = Record<(typeof EDITOR_FIELDS)[number], string | null>

export function editorSnapshot(content: any): EditorSnapshot {
  return Object.fromEntries(EDITOR_FIELDS.map(field => [field, field === 'scheduledAt' ? content?.[field] || null : content?.[field] || ''])) as EditorSnapshot
}

export function sameEditorSnapshot(left: EditorSnapshot | null, right: EditorSnapshot | null) {
  return Boolean(left && right && EDITOR_FIELDS.every(field => left[field] === right[field]))
}

/** Asset/platform/status requests persist immediately. Refresh their data without losing the text draft. */
export function mergeEditorResponse(current: any, incoming: any, baseline: EditorSnapshot | null) {
  if (!current || current.id !== incoming.id || !baseline) return incoming
  const draft = editorSnapshot(current)
  const merged = { ...incoming }
  for (const field of EDITOR_FIELDS) {
    if (draft[field] !== baseline[field]) merged[field] = current[field]
  }
  return merged
}

/** A new content starts on its format's preview; existing explicit platform shortcuts take precedence. */
export function initialEditorPreview(content: any, requested?: string) {
  const selected: string[] = (content.platforms || []).map((platform: any) => platform.platform)
  const tabs = selected.flatMap(platform => platform === 'INSTAGRAM' ? ['INSTAGRAM', 'STORY'] : ['FACEBOOK', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'WHATSAPP'].includes(platform) ? [platform] : [])
  const normalized = requested === 'INSTAGRAM_STORY' ? 'STORY' : requested
  if (normalized && tabs.includes(normalized)) return normalized
  if (content.contentType === 'STORY' && tabs.includes('STORY')) return 'STORY'
  return tabs[0] || 'INSTAGRAM'
}
