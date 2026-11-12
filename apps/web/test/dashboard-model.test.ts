import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardAttention, getUpcomingPublications, type DashboardContent, type DashboardOverview, type AttentionItem } from '../src/components/dashboard/dashboardModel.ts'

const overview: DashboardOverview = { activeClients: 4, pendingApprovals: 1, scheduledContents: 0, failedPublications: 3, changesRequested: 0, overdueContents: 0, publishedThisMonth: 0, totalContentsThisMonth: 0 }
const content = (id: string, overrides: Partial<DashboardContent> = {}): DashboardContent => ({ id, title: `Conteúdo ${id}`, status: 'DRAFT', scheduledAt: null, client: { id: 'client-1', name: 'Cliente real' }, platforms: [], ...overrides })
const waiting: AttentionItem = { type: 'APPROVAL_WAITING', priority: 'MEDIUM', clientId: 'client-1', clientName: 'Cliente real', contentId: 'review', message: 'Aprovação de "Título real" aguarda há mais de 3 dias' }

test('groups platform failures by content without counting them as individual contents', () => {
  const result = buildDashboardAttention(overview, [waiting], [content('failed', { platforms: [
    { id: '1', platform: 'INSTAGRAM', status: 'FAILED' }, { id: '2', platform: 'FACEBOOK', status: 'FAILED' },
    { id: '3', platform: 'WHATSAPP', status: 'FAILED' },
  ] }), content('review', { status: 'CLIENT_REVIEW' })])
  assert.deepEqual(result.alerts.map(alert => alert.kind), ['failure', 'approval'])
  assert.equal(result.alerts[0].badge, '3 plataformas')
  assert.equal(result.alerts[0].to, '/app/content/failed')
  assert.deepEqual(result.alerts[0].state, { previewPlatform: 'INSTAGRAM' })
  assert.equal(result.alerts[1].badge, 'Há mais de 3 dias')
})

test('preserves authoritative failures when the associated content is no longer accessible', () => {
  const result = buildDashboardAttention({ ...overview, pendingApprovals: 0 }, [], [])
  assert.equal(result.alerts.length, 1)
  assert.equal(result.alerts[0].id, 'failure-unavailable')
  assert.equal(result.alerts[0].title, '3 publicações falharam')
  assert.equal(result.alerts[0].badge, 'Histórico')
  assert.equal(result.alerts[0].clientName, undefined)
})

test('does not confuse old unanswered approval links with current client-review totals', () => {
  const result = buildDashboardAttention({ ...overview, failedPublications: 0, pendingApprovals: 0 }, [waiting, waiting], [content('review', { status: 'PUBLISHED' })])
  assert.equal(result.alerts.length, 1)
  assert.equal(result.alerts[0].title, 'Link de aprovação sem resposta')
  assert.equal(result.alerts[0].description, 'Conteúdo review')
})

test('groups repeated planning reminders by client and deduplicates repeated alert rows', () => {
  const planning = { ...waiting, type: 'NO_FUTURE_CONTENT', contentId: undefined }
  const overdue = { ...waiting, type: 'OVERDUE' }
  const result = buildDashboardAttention({ ...overview, failedPublications: 0, pendingApprovals: 0 }, [planning, planning, { ...planning, clientId: 'client-2' }, overdue, overdue], [])
  assert.equal(result.planning.length, 2)
  assert.equal(result.alerts.length, 1)
  assert.equal(result.alerts[0].kind, 'overdue')
})

test('upcoming list includes every future content still to go out, in chronological order', () => {
  const now = Date.parse('2026-11-05T12:00:00Z')
  const contents = [
    content('later', { status: 'SCHEDULED', scheduledAt: '2026-11-07T10:00:00Z' }),
    content('published', { status: 'PUBLISHED', scheduledAt: '2026-11-06T10:00:00Z' }),
    content('earlier', { status: 'SCHEDULED', scheduledAt: '2026-11-06T10:00:00Z' }),
    content('old', { status: 'SCHEDULED', scheduledAt: '2026-11-04T10:00:00Z' }),
    content('missing', { status: 'SCHEDULED' }),
    content('invalid', { status: 'SCHEDULED', scheduledAt: 'not-a-date' }),
    content('approved', { status: 'APPROVED', scheduledAt: '2026-11-06T15:00:00Z' }),
    content('failed', { status: 'FAILED', scheduledAt: '2026-11-06T16:00:00Z' }),
  ]
  assert.deepEqual(getUpcomingPublications(contents, now).map(item => item.id), ['earlier', 'approved', 'later'])
  assert.deepEqual(getUpcomingPublications([], now), [])
})
