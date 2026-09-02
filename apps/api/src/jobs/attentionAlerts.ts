import { prisma } from '../database/prisma';
import { notify } from '../modules/notifications/notifications.controller';

// Turns the two genuinely time-based conditions already shown on the dashboard's "Precisa da
// sua Atenção" panel (overdue content, approvals stuck 3+ days) into real notifications in the
// bell too — they were previously only ever computed live for that one panel and never actually
// reached a user's notification list. "Changes requested" isn't handled here: it's a discrete
// event, already notified the moment it happens (see approvals.controller.ts's requestChanges).
//
// Same setInterval + one-shot-per-condition shape as scheduledPublisher.ts/adsSync.ts. "Once per
// condition" means each overdue content / stuck approval only ever notifies its owner one time
// (checked via an existing Notification with the same type+entityId) — this is a slow poller for
// slow-moving conditions, not a repeat alarm.

const CHECK_INTERVAL_MS = 30 * 60_000; // 30 min — these conditions take days to become true, no need for tight polling.
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

async function notifyOwnersOnce(
  agencyId: string,
  owners: { createdById: string; assignedToId: string | null },
  opts: { type: string; title: string; message: string; entityId: string }
) {
  const recipients = new Set([owners.createdById, owners.assignedToId].filter(Boolean) as string[]);
  for (const userId of recipients) {
    const existing = await prisma.notification.findFirst({
      where: { agencyId, userId, type: opts.type, data: { contains: opts.entityId } },
      select: { id: true },
    });
    if (!existing) await notify({ agencyId, userId, ...opts });
  }
}

export async function runAttentionAlerts() {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - THREE_DAYS_MS);

    const overdue = await prisma.content.findMany({
      where: { deletedAt: null, dueAt: { lt: now }, status: { notIn: ['APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] } },
      select: { id: true, agencyId: true, title: true, dueAt: true, createdById: true, assignedToId: true },
    });
    for (const c of overdue) {
      await notifyOwnersOnce(c.agencyId, c, {
        type: 'CONTENT_OVERDUE',
        title: 'Conteúdo atrasado',
        message: `"${c.title}" está atrasado (prazo: ${c.dueAt?.toLocaleDateString('pt-BR')}).`,
        entityId: c.id,
      });
    }

    // Same dedup-by-content and deleted-content guard as the dashboard's attention panel.
    const longPending = await prisma.approvalRequest.findMany({
      where: { status: { in: ['PENDING', 'VIEWED'] }, sentAt: { lt: threeDaysAgo }, content: { deletedAt: null } },
      include: { content: { select: { id: true, title: true, createdById: true, assignedToId: true } } },
      distinct: ['contentId'],
      orderBy: { sentAt: 'desc' },
    });
    for (const a of longPending) {
      if (!a.content) continue;
      await notifyOwnersOnce(a.agencyId, a.content, {
        type: 'APPROVAL_WAITING',
        title: 'Aprovação pendente há mais de 3 dias',
        message: `Aprovação de "${a.content.title}" aguarda resposta do cliente há mais de 3 dias.`,
        entityId: a.content.id,
      });
    }
  } catch (err) {
    console.error('[attentionAlerts] run failed:', err);
  }
}

export function startAttentionAlerts() {
  console.log(`🔔 Attention alerts: checking every ${CHECK_INTERVAL_MS / 60_000}min for overdue/stale items...`);
  setInterval(() => { runAttentionAlerts().catch((err) => console.error('[attentionAlerts]', err)); }, CHECK_INTERVAL_MS);
  setTimeout(() => { runAttentionAlerts().catch((err) => console.error('[attentionAlerts]', err)); }, 15_000);
}
