import { test } from 'node:test'
import assert from 'node:assert/strict'
import { editorSnapshot, sameEditorSnapshot, mergeEditorResponse, initialEditorPreview } from '../src/components/content/editorState.ts'

const saved = { id: 'creative', title: 'Título', caption: 'Legenda', brief: null, hook: null, cta: null, scheduledAt: null, status: 'DRAFT', platforms: [{ platform: 'INSTAGRAM' }] }

test('immediate media/platform/status refreshes preserve local copy and schedule', () => {
  const draft = { ...saved, caption: 'Legenda em edição', scheduledAt: '2026-11-07T12:00:00.000Z' }
  const incoming = { ...saved, status: 'IN_PRODUCTION', assets: [{ id: 'new-media' }], platforms: [{ platform: 'FACEBOOK' }] }
  const merged = mergeEditorResponse(draft, incoming, editorSnapshot(saved))
  assert.equal(merged.caption, draft.caption)
  assert.equal(merged.scheduledAt, draft.scheduledAt)
  assert.equal(merged.status, incoming.status)
  assert.deepEqual(merged.assets, incoming.assets)
  assert.deepEqual(merged.platforms, incoming.platforms)
  assert.equal(sameEditorSnapshot(editorSnapshot(merged), editorSnapshot(incoming)), false)
  assert.equal(saved.caption, 'Legenda')
})

test('save acknowledgements clear dirty state only for the acknowledged draft', () => {
  const submitted = { ...saved, caption: 'Primeira alteração' }
  const acknowledged = mergeEditorResponse(submitted, submitted, editorSnapshot(saved))
  assert.equal(sameEditorSnapshot(editorSnapshot(acknowledged), editorSnapshot(submitted)), true)
  const stillTyping = { ...submitted, caption: 'Alteração durante a gravação' }
  const merged = mergeEditorResponse(stillTyping, submitted, editorSnapshot(saved))
  assert.equal(merged.caption, stillTyping.caption)
  assert.equal(sameEditorSnapshot(editorSnapshot(merged), editorSnapshot(submitted)), false)
})

test('unsaved empty values normalize consistently, while unacknowledged schedule removal remains dirty', () => {
  assert.equal(sameEditorSnapshot(editorSnapshot(saved), editorSnapshot({ ...saved, brief: '', hook: '', cta: '' })), true)
  const scheduled = { ...saved, scheduledAt: '2026-11-07T12:00:00.000Z' }
  const cleared = { ...scheduled, scheduledAt: null }
  const merged = mergeEditorResponse(cleared, scheduled, editorSnapshot(scheduled))
  assert.equal(merged.scheduledAt, null)
  assert.equal(sameEditorSnapshot(editorSnapshot(merged), editorSnapshot(scheduled)), false)
})

test('switching creatives never carries text from another creative', () => {
  const incoming = { ...saved, id: 'another-creative', caption: 'Outro conteúdo' }
  assert.deepEqual(mergeEditorResponse({ ...saved, caption: 'Rascunho local' }, incoming, editorSnapshot(saved)), incoming)
})

test('preview respects format, selected networks and existing explicit shortcuts', () => {
  assert.equal(initialEditorPreview({ ...saved, contentType: 'STORY' }), 'STORY')
  assert.equal(initialEditorPreview({ ...saved, contentType: 'REEL' }), 'INSTAGRAM')
  assert.equal(initialEditorPreview(saved, 'INSTAGRAM_STORY'), 'STORY')
  assert.equal(initialEditorPreview({ ...saved, platforms: [{ platform: 'WHATSAPP' }] }, 'FACEBOOK'), 'WHATSAPP')
  assert.equal(initialEditorPreview({ ...saved, platforms: [{ platform: 'FACEBOOK' }, { platform: 'INSTAGRAM' }] }, 'INSTAGRAM'), 'INSTAGRAM')
})
