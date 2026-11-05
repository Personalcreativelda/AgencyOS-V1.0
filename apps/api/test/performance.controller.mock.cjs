const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/database/prisma');
const ads = require('../dist/modules/ads/ads.controller');
const google = require('../dist/modules/google/google.controller');
const adPlatforms = require('../dist/modules/adPlatforms/adPlatforms.controller');
const { overview } = require('../dist/modules/performance/performance.controller');

test('Performance scopes clients and connections to the agency and isolates account errors', async () => {
  const originalClients = prisma.client.findMany;
  const originalConnections = prisma.socialConnection.findMany;
  const originalPosts = prisma.contentPlatform.findMany;
  const originalMeta = ads.getMetaPerformanceInsights;
  const originalGoogle = google.getGooglePerformanceInsights;
  const originalAdPlatform = adPlatforms.getAdPlatformReport;
  const calls = [];
  prisma.client.findMany = async query => {
    assert.equal(query.where.agencyId, 'agency-1');
    return [{ id: 'client-1', name: 'Cliente real', status: 'ACTIVE', website: null }];
  };
  prisma.socialConnection.findMany = async query => {
    assert.equal(query.where.agencyId, 'agency-1');
    assert.deepEqual(query.where.clientId.in, ['client-1']);
    return [
      { id: 'meta-1', agencyId: 'agency-1', clientId: 'client-1', platform: 'META_ADS', status: 'ACTIVE', accountName: 'Meta' },
      { id: 'ga4-1', agencyId: 'agency-1', clientId: 'client-1', platform: 'GOOGLE_ANALYTICS', status: 'ACTIVE', accountName: 'GA4' },
      { id: 'tiktok-1', agencyId: 'agency-1', clientId: 'client-1', platform: 'TIKTOK_ADS', status: 'ACTIVE', accountName: 'TikTok Ads' },
      { id: 'linkedin-1', agencyId: 'agency-1', clientId: 'client-1', platform: 'LINKEDIN_ADS', status: 'ACTIVE', accountName: 'LinkedIn Ads' },
    ];
  };
  prisma.contentPlatform.findMany = async query => {
    assert.equal(query.where.agencyId, 'agency-1');
    assert.deepEqual(query.where.content.clientId.in, ['client-1']);
    return [{ id: 'post-1', platform: 'INSTAGRAM_STORY', publishedAt: new Date(), externalPostUrl: null,
      content: { clientId: 'client-1', title: 'Publicação real' } }];
  };
  ads.getMetaPerformanceInsights = async (_connection, days, refresh) => {
    calls.push({ days, refresh });
    throw new Error('Meta: permissão expirada');
  };
  google.getGooglePerformanceInsights = async (_connection, days) => {
    calls.push({ days });
    return { kind: 'analytics', totals: { sessions: 42 }, daily: [{ date: '2026-09-17', sessions: 42 }], channels: [] };
  };
  adPlatforms.getAdPlatformReport = async (connection, range) => {
    calls.push({ platform: connection.platform, range });
    return { currency: 'USD', totals: { spend: 10, impressions: 100, clicks: 5, conversions: 1 }, campaigns: [] };
  };
  try {
    let response;
    await overview({ user: { agencyId: 'agency-1' }, query: { clientId: 'client-1', range: '7d', refresh: '1' } },
      { json: value => { response = value; } }, error => { throw error; });
    assert.equal(response.clients.length, 1);
    assert.equal(response.reports.length, 4);
    assert.match(response.reports[0].error, /permissão expirada/);
    assert.equal(response.reports[1].data.totals.sessions, 42);
    assert.equal(response.reports[2].data.totals.spend, 10);
    assert.deepEqual(response.reports[2].data.daily, []);
    assert.equal(response.reports[3].platform, 'LINKEDIN_ADS');
    assert.equal(response.posts[0].platform, 'INSTAGRAM');
    assert.deepEqual(calls, [{ days: 7, refresh: true }, { days: 7 },
      { platform: 'TIKTOK_ADS', range: '7d' }, { platform: 'LINKEDIN_ADS', range: '7d' }]);
    assert.equal('accessTokenEncrypted' in response.connections[0], false);
  } finally {
    prisma.client.findMany = originalClients;
    prisma.socialConnection.findMany = originalConnections;
    prisma.contentPlatform.findMany = originalPosts;
    ads.getMetaPerformanceInsights = originalMeta;
    google.getGooglePerformanceInsights = originalGoogle;
    adPlatforms.getAdPlatformReport = originalAdPlatform;
  }
});
