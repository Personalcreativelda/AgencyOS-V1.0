const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/database/prisma');
const { encrypt } = require('../dist/common/crypto');
const google = require('../dist/modules/google/google.controller');

test('Google Ads totals, manager header, and manual campaign status', async () => {
  const originalFind = prisma.socialConnection.findFirst;
  const originalFetch = global.fetch;
  const requests = [];
  prisma.socialConnection.findFirst = async () => ({
    id: 'connection-1', agencyId: 'agency-1', clientId: 'client-1', platform: 'GOOGLE_ADS',
    externalPageId: '1234567890', accessTokenEncrypted: encrypt('fake-access-token'),
    tokenExpiresAt: new Date(Date.now() + 3600000), metadata: JSON.stringify({ currency: 'ZAR', loginCustomerId: '9998887776' }),
  });
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).includes(':searchStream')) {
      const query = JSON.parse(init.body).query;
      if (query.includes('LIMIT 1')) return Response.json([{ results: [{ campaign: { id: '42', status: 'ENABLED' } }] }]);
      return Response.json([{ results: [
        { campaign: { id: '42', name: 'Campanha A', status: 'ENABLED' }, metrics: { impressions: '1000', clicks: '50', costMicros: '50000000', conversions: '5', ctr: '5' } },
        { campaign: { id: '43', name: 'Campanha B', status: 'PAUSED' }, metrics: { impressions: '500', clicks: '10', costMicros: '10000000', conversions: '1', ctr: '2' } },
      ] }]);
    }
    return Response.json({ results: [{ resourceName: 'customers/1234567890/campaigns/42' }] });
  };
  try {
    let report;
    await google.insights({ user: { agencyId: 'agency-1' }, params: { id: 'connection-1' }, query: { range: '7d' } },
      { json: value => { report = value; } }, error => { throw error; });
    assert.equal(report.totals.spend, 60);
    assert.equal(report.totals.conversions, 6);
    assert.equal(report.totals.ctr, 4);
    assert.equal(report.totals.costPerConversion, 10);
    assert.equal(requests[0].init.headers['login-customer-id'], '9998887776');
    assert.match(JSON.parse(requests[0].init.body).query, /LAST_7_DAYS/);

    let changed;
    await google.campaignStatus({ user: { agencyId: 'agency-1' }, params: { id: 'connection-1', campaignId: '42' }, body: { status: 'PAUSED' } },
      { json: value => { changed = value; } }, error => { throw error; });
    assert.equal(changed.status, 'PAUSED');
    const mutation = requests.find(request => request.url.includes('campaigns:mutate'));
    assert.equal(JSON.parse(mutation.init.body).operations[0].update.resourceName, 'customers/1234567890/campaigns/42');
    assert.equal(mutation.init.headers['login-customer-id'], '9998887776');
  } finally {
    prisma.socialConnection.findFirst = originalFind;
    global.fetch = originalFetch;
  }
});

test('GA4 returns web metrics and website breakdowns', async () => {
  const originalFind = prisma.socialConnection.findFirst;
  const originalFetch = global.fetch;
  prisma.socialConnection.findFirst = async () => ({
    id: 'connection-2', agencyId: 'agency-1', clientId: 'client-1', platform: 'GOOGLE_ANALYTICS',
    externalPageId: '12345', accessTokenEncrypted: encrypt('fake-access-token'),
    tokenExpiresAt: new Date(Date.now() + 3600000), metadata: '{}',
  });
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.dimensionFilter.filter.stringFilter.value, 'web');
    const dimension = body.dimensions[0]?.name;
    if (!dimension) return Response.json({ rows: [{ metricValues: ['100', '140', '250', '80', '0.5714', '8'].map(value => ({ value })) }] });
    if (dimension === 'pagePath') return Response.json({ rows: [{ dimensionValues: [{ value: '/contacto' }], metricValues: [{ value: '40' }, { value: '25' }] }] });
    if (dimension === 'sessionDefaultChannelGroup') return Response.json({ rows: [{ dimensionValues: [{ value: 'Organic Search' }], metricValues: [{ value: '50' }, { value: '4' }] }] });
    return Response.json({ rows: [{ dimensionValues: [{ value: 'Mozambique' }], metricValues: [{ value: '70' }, { value: '55' }] }] });
  };
  try {
    let report;
    await google.insights({ user: { agencyId: 'agency-1' }, params: { id: 'connection-2' }, query: { range: 'today' } },
      { json: value => { report = value; } }, error => { throw error; });
    assert.equal(report.totals.users, 100);
    assert.equal(report.totals.engagementRate, 0.5714);
    assert.equal(report.pages[0].label, '/contacto');
    assert.equal(report.channels[0].sessions, 50);
    assert.equal(report.countries[0].label, 'Mozambique');
  } finally {
    prisma.socialConnection.findFirst = originalFind;
    global.fetch = originalFetch;
  }
});

test('Performance Google Ads uses inclusive dates and aggregates daily account totals', async () => {
  const originalFetch = global.fetch;
  let query = '';
  global.fetch = async (_url, init) => {
    assert.equal(init.headers['login-customer-id'], '9998887776');
    query = JSON.parse(init.body).query;
    return Response.json([{ results: [
      { segments: { date: '2026-09-16' }, metrics: { impressions: '100', clicks: '4', costMicros: '12500000', conversions: '2' } },
      { segments: { date: '2026-09-17' }, metrics: { impressions: '200', clicks: '9', costMicros: '7500000', conversions: '1' } },
    ] }]);
  };
  try {
    const result = await google.getGooglePerformanceInsights({
      id: 'connection-3', agencyId: 'agency-1', platform: 'GOOGLE_ADS', externalPageId: '1234567890',
      accessTokenEncrypted: encrypt('fake-access-token'), refreshTokenEncrypted: null,
      tokenExpiresAt: new Date(Date.now() + 3600000),
      metadata: JSON.stringify({ currency: 'ZAR', loginCustomerId: '9998887776' }),
    }, 7);
    assert.match(query, /FROM customer WHERE segments\.date BETWEEN/);
    assert.equal(result.totals.impressions, 300);
    assert.equal(result.totals.clicks, 13);
    assert.equal(result.totals.spend, 20);
    assert.equal(result.totals.conversions, 3);
    assert.equal(result.daily.length, 2);
    assert.equal(result.currency, 'ZAR');
  } finally { global.fetch = originalFetch; }
});

test('Performance GA4 uses web filter and maps date rows', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.dimensionFilter.filter.stringFilter.value, 'web');
    assert.equal(body.dateRanges[0].startDate, '29daysAgo');
    const dimension = body.dimensions[0]?.name;
    if (!dimension) return Response.json({ rows: [{ metricValues: ['80', '120', '220', '5'].map(value => ({ value })) }] });
    if (dimension === 'date') return Response.json({ rows: [{ dimensionValues: [{ value: '20260917' }], metricValues: [{ value: '120' }, { value: '220' }] }] });
    return Response.json({ rows: [{ dimensionValues: [{ value: 'Organic Search' }], metricValues: [{ value: '70' }] }] });
  };
  try {
    const result = await google.getGooglePerformanceInsights({
      id: 'connection-4', agencyId: 'agency-1', platform: 'GOOGLE_ANALYTICS', externalPageId: '12345',
      accessTokenEncrypted: encrypt('fake-access-token'), refreshTokenEncrypted: null,
      tokenExpiresAt: new Date(Date.now() + 3600000), metadata: '{}',
    }, 30);
    assert.equal(result.totals.sessions, 120);
    assert.equal(result.totals.keyEvents, 5);
    assert.equal(result.channels[0].sessions, 70);
    assert.equal(result.daily[0].date, '2026-09-17');
  } finally { global.fetch = originalFetch; }
});
