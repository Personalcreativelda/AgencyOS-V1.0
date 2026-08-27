import { prisma } from '../database/prisma';
import { publishToMeta } from '../modules/social/social.controller';
import { notify } from '../modules/notifications/notifications.controller';

// Publishes content automatically once it's SCHEDULED and its scheduledAt has arrived.
//
// Trigger condition: Content.status === 'SCHEDULED' AND Content.scheduledAt <= now.
// (Setting SCHEDULED + a date is a deliberate, explicit action already taken by the agency
// user — either via the status dropdown or by dragging a card onto a day in the Planner —
// so no additional confirmation happens here; this job just carries out what was scheduled.)
//
// For each such content, every enabled FACEBOOK/INSTAGRAM ContentPlatform with status
// 'PENDING' is attempted via publishToMeta. A platform that fails is marked 'FAILED' by
// publishToMeta itself, which keeps it out of `PENDING` on the next run — so a broken
// connection is retried once, not forever. Once no PENDING platforms remain for a content
// piece, it's finalized: PUBLISHED if at least one platform succeeded, otherwise FAILED.
// Content with no eligible platforms at all (e.g. WhatsApp-only) is left alone.

const CHECK_INTERVAL_MS = 60_000;
const PUBLISHABLE_PLATFORMS = ['FACEBOOK', 'INSTAGRAM'];

let running = false;

async function finalizeContent(content: { id: string; agencyId: string; createdById: string; assignedToId: string | null; title: string }, published: boolean) {
  await prisma.content.update({
    where: { id: content.id },
    data: { status: published ? 'PUBLISHED' : 'FAILED', publishedAt: published ? new Date() : undefined },
  });

  const recipients = new Set([content.createdById, content.assignedToId].filter(Boolean) as string[]);
  for (const userId of recipients) {
    notify({
      agencyId: content.agencyId,
      userId,
      type: published ? 'CONTENT_PUBLISHED' : 'PUBLISH_FAILED',
      title: published ? 'Publicação automática concluída' : 'Falha na publicação automática',
      message: published
        ? `"${content.title}" foi publicado automaticamente conforme agendado.`
        : `"${content.title}" estava agendado mas a publicação automática falhou. Verifique a conexão da rede social em Configurações.`,
      entityId: content.id,
    });
  }
}

export async function runScheduledPublishes() {
  if (running) return; // don't overlap runs if one is still working through a large batch
  running = true;
  try {
    const due = await prisma.content.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() }, deletedAt: null },
      include: { platforms: true },
    });

    for (const content of due) {
      const attempted = content.platforms.filter((p) => p.enabled && PUBLISHABLE_PLATFORMS.includes(p.platform));
      if (attempted.length === 0) continue; // nothing publishable attached (e.g. WhatsApp-only) — leave it scheduled

      const pending = attempted.filter((p) => p.status === 'PENDING');
      let anySuccess = attempted.some((p) => p.status === 'PUBLISHED');

      // publishToMeta always resolves a PENDING platform to PUBLISHED or FAILED (never leaves
      // it PENDING), so after this loop every attempted platform has a terminal status.
      for (const target of pending) {
        const result = await publishToMeta({
          agencyId: content.agencyId,
          contentId: content.id,
          platform: target.platform as 'FACEBOOK' | 'INSTAGRAM',
        });
        if (result.success) anySuccess = true;
      }

      await finalizeContent(content, anySuccess);
    }
  } catch (err) {
    console.error('[scheduledPublisher] run failed:', err);
  } finally {
    running = false;
  }
}

export function startScheduledPublisher() {
  console.log(`🕐 Scheduled publisher: checking every ${CHECK_INTERVAL_MS / 1000}s for content due to publish...`);
  setInterval(() => { runScheduledPublishes().catch((err) => console.error('[scheduledPublisher]', err)); }, CHECK_INTERVAL_MS);
  // Run once shortly after boot too, so a server restart doesn't wait a full interval to catch up.
  setTimeout(() => { runScheduledPublishes().catch((err) => console.error('[scheduledPublisher]', err)); }, 5_000);
}
