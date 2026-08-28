import { prisma } from '../database/prisma';
import { syncAdAccountInsights } from '../modules/ads/ads.controller';

// Periodically refreshes AdInsightDaily for every connected Meta Ads account, so the Ads page
// and AI analysis read fresh-ish data without hitting Meta's API on every page load. Same
// setInterval + `running` guard shape as scheduledPublisher.ts.

const SYNC_INTERVAL_MS = 30 * 60_000; // 30 min — ad performance doesn't change fast enough to need tighter polling, and it keeps Meta rate limits comfortable.

let running = false;

export async function runAdsSync() {
  if (running) return;
  running = true;
  try {
    const accounts = await prisma.socialConnection.findMany({
      where: { platform: 'META_ADS', status: 'ACTIVE' },
    });

    for (const account of accounts) {
      try {
        await syncAdAccountInsights(account);
      } catch (err) {
        // One account's Meta error (expired token, revoked ads_read, ...) shouldn't stop the
        // rest of the batch from syncing.
        console.error(`[adsSync] failed for connection ${account.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[adsSync] run failed:', err);
  } finally {
    running = false;
  }
}

export function startAdsSync() {
  console.log(`📊 Ads sync: checking every ${SYNC_INTERVAL_MS / 60_000}min for connected Meta Ads accounts...`);
  setInterval(() => { runAdsSync().catch((err) => console.error('[adsSync]', err)); }, SYNC_INTERVAL_MS);
  setTimeout(() => { runAdsSync().catch((err) => console.error('[adsSync]', err)); }, 10_000);
}
