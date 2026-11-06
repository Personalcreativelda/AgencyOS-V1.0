import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCreativeMedia, selectLibraryContents, type LibraryContent } from '../src/components/content/libraryUtils.ts'

const content = (id: string, overrides: Partial<LibraryContent> = {}): LibraryContent => ({ id, title: id, status: 'DRAFT', contentType: 'IMAGE', ...overrides })
test('media preview uses the current primary set, preserves carousel order and includes original videos', () => {
  const creative = content('carousel', { assets: [
    { id: 'old', role: 'REFERENCE', sortOrder: 0, asset: { id: 'old', mimeType: 'image/png', publicUrl: 'https://media.example/old.png' } },
    { id: 'video', role: 'PRIMARY', sortOrder: 1, asset: { id: 'video', mimeType: 'video/mp4', publicUrl: 'https://media.example/video.mp4' } },
    { id: 'first', role: 'PRIMARY', sortOrder: 0, asset: { id: 'first', mimeType: 'image/png', publicUrl: 'https://media.example/first.png' } },
    { id: 'missing', role: 'PRIMARY', asset: null },
  ] })
  assert.deepEqual(getCreativeMedia(creative).map(item => item.id), ['first', 'video'])
  assert.equal(creative.assets![0].id, 'old')
  assert.deepEqual(getCreativeMedia(content('empty')), [])
})

test('search finds titles, clients and captions without requiring accents or exact word order', () => {
  const contents = [content('1', { title: 'Nutrição diária', client: { id: 'client', name: 'Natur-erva' }, caption: 'Ómega para todos' }), content('2', { title: 'Logística' })]
  assert.deepEqual(selectLibraryContents(contents, 'natur nutricao', 'recent').map(item => item.id), ['1'])
  assert.deepEqual(selectLibraryContents(contents, 'omega', 'recent').map(item => item.id), ['1'])
  assert.deepEqual(selectLibraryContents(contents, 'inexistente', 'recent'), [])
})

test('schedule sorting retains undated contents at the end and never mutates the source collection', () => {
  const contents = [content('undated'), content('later', { scheduledAt: '2026-11-07T12:00:00Z' }), content('invalid', { scheduledAt: 'invalid' }), content('first', { scheduledAt: '2026-11-06T12:00:00Z' })]
  assert.deepEqual(selectLibraryContents(contents, '', 'scheduled').map(item => item.id), ['first', 'later', 'invalid', 'undated'])
  assert.equal(contents[0].id, 'undated')
})

test('recent and updated ordering use real timestamps while title ordering remains available', () => {
  const contents = [content('a', { title: 'Zinco', createdAt: '2026-10-01', updatedAt: '2026-11-02' }), content('b', { title: 'Ácido', createdAt: '2026-11-01', updatedAt: '2026-11-01' })]
  assert.deepEqual(selectLibraryContents(contents, '', 'recent').map(item => item.id), ['b', 'a'])
  assert.deepEqual(selectLibraryContents(contents, '', 'updated').map(item => item.id), ['a', 'b'])
  assert.deepEqual(selectLibraryContents(contents, '', 'title').map(item => item.id), ['b', 'a'])
})
