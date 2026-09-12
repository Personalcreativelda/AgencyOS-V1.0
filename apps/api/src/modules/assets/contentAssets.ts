import { prisma } from '../../database/prisma';

// Defines "what's currently attached to this content" — used by every place that sets a
// content's creative(s): single-file upload, multi-file carousel upload, and AI image
// generation. Always REPLACES the prior set rather than adding to it: existing `PRIMARY` rows
// are demoted to `REPLACED` (kept for history/audit, never read by anything else) and the new
// ids become `PRIMARY` with `sortOrder` reflecting the order they were given in — that order is
// what every publishTo* function and the preview carousel use as the slide sequence.
export async function setContentPrimaryAssets(agencyId: string, contentId: string, assetIds: string[]) {
  // Deduped defensively — a caller building this array from client-held state (add/remove on
  // the carousel strip) can end up repeating an id if two edits race, and a duplicate here would
  // create two PRIMARY rows for the same asset (breaks the preview's React key and silently
  // desyncs the visible set from what's actually stored).
  const uniqueIds = Array.from(new Set(assetIds));
  await prisma.$transaction([
    prisma.contentAsset.updateMany({
      where: { contentId, role: 'PRIMARY' },
      data: { role: 'REPLACED' },
    }),
    prisma.contentAsset.createMany({
      data: uniqueIds.map((assetId, index) => ({
        agencyId, contentId, assetId, role: 'PRIMARY', sortOrder: index,
      })),
    }),
  ]);
}
