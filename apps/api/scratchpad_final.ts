import { prisma } from './src/database/prisma';
import { getAudienceInsights, analyzeAdAccount } from './src/modules/ads/ads.controller';

async function main() {
  const conn = await prisma.socialConnection.findFirst({ where: { platform: 'META_ADS', status: 'ACTIVE' } });

  const req1: any = { params: { id: conn!.id }, user: { agencyId: conn!.agencyId }, query: { range: '7d' } };
  const res1: any = { json(b: any) { console.log('AUDIENCE:', JSON.stringify(b, null, 2)) } };
  await getAudienceInsights(req1, res1, (e: any) => console.error('ERR1', e));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
