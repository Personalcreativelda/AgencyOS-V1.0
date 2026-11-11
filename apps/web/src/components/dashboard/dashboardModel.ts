export type DashboardOverview = {
  activeClients: number; pendingApprovals: number; scheduledContents: number; failedPublications: number
  changesRequested: number; overdueContents: number; publishedThisMonth: number; totalContentsThisMonth: number
}

export type DashboardContent = {
  id: string; title: string; status: string; scheduledAt: string | null; contentType?: string
  client?: { id: string; name: string; logoUrl?: string | null }
  platforms: { id: string; platform: string; status: string }[]
  assets?: { role: string; sortOrder?: number; asset: { publicUrl: string; mimeType: string } }[]
}

export type AttentionItem = {
  type: string; priority: string; clientId: string; clientName: string; contentId?: string; message: string
}

export type AttentionAlert = {
  id: string; kind: 'failure' | 'approval' | 'overdue' | 'changes' | 'other'
  title: string; description: string; clientName?: string; badge: string
  tone: 'error' | 'warning' | 'default'; action: string; to: string
  platforms?: string[]; state?: { status?: string; previewPlatform?: string }
}

export function buildDashboardAttention(overview: DashboardOverview, items: AttentionItem[], contents: DashboardContent[]) {
  const alerts: AttentionAlert[] = []
  const byId = new Map(contents.map(content => [content.id, content]))
  let visibleFailures = 0
  for (const content of contents) {
    const failures = content.platforms.filter(platform => platform.status === 'FAILED')
    if (failures.length) {
      visibleFailures += failures.length
      alerts.push({ id: `failure-${content.id}`, kind: 'failure', title: 'Falha na publicação', description: content.title,
        clientName: content.client?.name, badge: `${failures.length} ${failures.length === 1 ? 'plataforma' : 'plataformas'}`,
        tone: 'error', action: 'Rever publicação', to: `/app/content/${content.id}`,
        platforms: failures.map(platform => platform.platform), state: { previewPlatform: failures[0].platform } })
    }
  }
  // The overview counts platform records, including those whose content is no longer in the directory.
  // Preserve the authoritative total instead of silently making these failures disappear.
  const unavailableFailures = Math.max(0, overview.failedPublications - visibleFailures)
  if (unavailableFailures) alerts.push({ id: 'failure-unavailable', kind: 'failure', title: 'Falhas no histórico de publicação',
    description: 'O conteúdo associado não está disponível nesta lista.', badge: `${unavailableFailures} ${unavailableFailures === 1 ? 'plataforma' : 'plataformas'}`,
    tone: 'error', action: 'Ver criativos', to: '/app/content' })

  const waiting = new Map(items.filter(item => item.type === 'APPROVAL_WAITING' && item.contentId).map(item => [item.contentId!, item]))
  const reviewing = contents.filter(content => content.status === 'CLIENT_REVIEW')
  for (const content of reviewing) {
    alerts.push({ id: `approval-${content.id}`, kind: 'approval', title: 'Aprovação pendente', description: content.title,
      clientName: content.client?.name, badge: waiting.has(content.id) ? 'Há mais de 3 dias' : 'Aguarda cliente',
      tone: 'warning', action: 'Rever aprovação', to: `/app/content/${content.id}` })
    waiting.delete(content.id)
  }
  if (overview.pendingApprovals > reviewing.length) alerts.push({ id: 'approval-summary', kind: 'approval', title: 'Aprovações pendentes',
    description: 'Consulte os conteúdos que aguardam resposta do cliente.', badge: String(overview.pendingApprovals - reviewing.length),
    tone: 'warning', action: 'Ver conteúdos', to: '/app/content', state: { status: 'CLIENT_REVIEW' } })
  for (const [id, item] of waiting) {
    alerts.push({ id: `approval-link-${id}`, kind: 'approval', title: 'Link de aprovação sem resposta',
      description: byId.get(id)?.title || quotedTitle(item.message), clientName: item.clientName, badge: 'Há mais de 3 dias',
      tone: 'warning', action: 'Rever link', to: `/app/content/${id}` })
  }

  const seen = new Set<string>()
  for (const item of items) {
    if (['APPROVAL_WAITING', 'NO_FUTURE_CONTENT'].includes(item.type)) continue
    const key = `${item.type}-${item.contentId || item.clientId}`
    if (seen.has(key)) continue
    seen.add(key)
    const overdue = item.type === 'OVERDUE'
    const changes = item.type === 'CHANGES_REQUESTED'
    alerts.push({ id: key, kind: overdue ? 'overdue' : changes ? 'changes' : 'other',
      title: overdue ? 'Prazo de conteúdo ultrapassado' : changes ? 'Alterações solicitadas' : 'Requer atenção',
      description: (item.contentId && byId.get(item.contentId)?.title) || quotedTitle(item.message),
      clientName: item.clientName, badge: overdue ? 'Em atraso' : changes ? 'Revisão' : 'Atenção', tone: 'warning',
      action: changes ? 'Rever alterações' : 'Abrir conteúdo',
      to: item.contentId ? `/app/content/${item.contentId}` : `/app/clients/${item.clientId}` })
  }
  const order = { failure: 0, approval: 1, overdue: 2, changes: 3, other: 4 }
  alerts.sort((a, b) => order[a.kind] - order[b.kind])
  const planning = Array.from(new Map(items.filter(item => item.type === 'NO_FUTURE_CONTENT').map(item => [item.clientId, item])).values())
  return { alerts, planning }
}

function quotedTitle(message: string) {
  return message.match(/"([\s\S]+)"/)?.[1] || message
}

export function getUpcomingPublications(contents: DashboardContent[], now: number) {
  return contents.filter(content => content.status === 'SCHEDULED' && content.scheduledAt && Date.parse(content.scheduledAt) >= now)
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!)).slice(0, 4)
}
