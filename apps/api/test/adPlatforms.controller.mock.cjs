const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/database/prisma');
const { encrypt } = require('../dist/common/crypto');
const ads = require('../dist/modules/adPlatforms/adPlatforms.controller');

const json = body => ({ ok: true, json: async () => body });
const connection = (platform, account) => ({
  platform, externalPageId: account, accessTokenEncrypted: encrypt('test-token'),
  tokenExpiresAt: null, metadata: JSON.stringify({ currency: 'USD' }),
});

test('TikTok Ads OAuth connects only an authorized advertiser to the selected client', async () => {
  const original = {
    fetch: global.fetch, client: prisma.client.findFirst,
    find: prisma.socialConnection.findFirst, create: prisma.socialConnection.create,
    appId: process.env.TIKTOK_ADS_APP_ID, appSecret: process.env.TIKTOK_ADS_APP_SECRET,
    key: process.env.ENCRYPTION_KEY,
  };
  process.env.TIKTOK_ADS_APP_ID = 'test-app';
  process.env.TIKTOK_ADS_APP_SECRET = 'test-secret';
  process.env.ENCRYPTION_KEY = 'test-encryption-key';
  prisma.client.findFirst = async ({ where }) => {
    assert.equal(where.agencyId, 'agency-1');
    assert.equal(where.id, 'client-1');
    return { id: 'client-1' };
  };
  prisma.socialConnection.findFirst = async () => null;
  prisma.socialConnection.create = async ({ data }) => {
    assert.equal(data.agencyId, 'agency-1');
    assert.equal(data.clientId, 'client-1');
    assert.equal(data.platform, 'TIKTOK_ADS');
    assert.equal(data.externalPageId, '123');
    assert.notEqual(data.accessTokenEncrypted, 'test-token');
    return { ...data, id: 'connection-1' };
  };
  global.fetch = async (url, init) => {
    const value = String(url);
    if (value.includes('/oauth2/access_token/')) {
      assert.equal(JSON.parse(init.body).auth_code, 'test-code');
      return json({ code: 0, data: { access_token: 'test-token' } });
    }
    if (value.includes('/oauth2/advertiser/get/')) return json({ code: 0, data: { list: ['123'] } });
    if (value.includes('/advertiser/info/')) return json({ code: 0, data: { list: [{ advertiser_id: '123', name: 'Cliente Ads', currency: 'USD' }] } });
    throw new Error(`Unexpected TikTok call: ${value}`);
  };
  try {
    let authUrl;
    await ads.connect({ params: { platform: 'tiktok' }, query: { clientId: 'client-1' }, user: { id: 'user-1', agencyId: 'agency-1' } },
      { json: value => { authUrl = value.authUrl; } }, error => { throw error; });
    const state = new URL(authUrl).searchParams.get('state');
    assert.equal(new URL(authUrl).hostname, 'ads.tiktok.com');
    let redirect;
    await ads.callback({ params: { platform: 'tiktok' }, query: { state, auth_code: 'test-code' } },
      { redirect: value => { redirect = value; } });
    const token = new URL(redirect, 'http://localhost').searchParams.get('ads_pending');
    assert.ok(token, redirect);
    let options;
    await ads.pendingOptions({ params: { platform: 'tiktok', token }, user: { id: 'user-1', agencyId: 'agency-1' } },
      { json: value => { options = value; } }, error => { throw error; });
    assert.deepEqual(options.options.map(item => item.id), ['123']);
    let isolationError;
    await ads.pendingOptions({ params: { platform: 'tiktok', token }, user: { id: 'other', agencyId: 'agency-2' } },
      { json: () => { throw new Error('Unexpected access'); } }, error => { isolationError = error; });
    assert.ok(isolationError);
    let created;
    await ads.confirm({ params: { platform: 'tiktok', token }, body: { optionId: '123' }, user: { id: 'user-1', agencyId: 'agency-1' } },
      { json: value => { created = value; } }, error => { throw error; });
    assert.equal(created.id, 'connection-1');
  } finally {
    global.fetch = original.fetch;
    prisma.client.findFirst = original.client;
    prisma.socialConnection.findFirst = original.find;
    prisma.socialConnection.create = original.create;
    if (original.appId === undefined) delete process.env.TIKTOK_ADS_APP_ID; else process.env.TIKTOK_ADS_APP_ID = original.appId;
    if (original.appSecret === undefined) delete process.env.TIKTOK_ADS_APP_SECRET; else process.env.TIKTOK_ADS_APP_SECRET = original.appSecret;
    if (original.key === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = original.key;
  }
});

test('TikTok Ads report reads campaign metrics and calculates totals from actual rows', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => {
    const value = String(url);
    if (value.includes('/report/integrated/get/')) {
      const query = new URL(value).searchParams;
      assert.deepEqual(JSON.parse(query.get('metrics')), ['spend', 'impressions', 'clicks', 'conversion']);
      assert.equal(query.get('report_type'), 'BASIC');
      return json({ code: 0, data: { list: [
        { dimensions: { campaign_id: '1' }, metrics: { spend: '12.50', impressions: '100', clicks: '8', conversion: '2' } },
        { dimensions: { campaign_id: '2' }, metrics: { spend: '7.50', impressions: '50', clicks: '2', conversion: '1' } },
      ], page_info: { total_page: 1 } } });
    }
    if (value.includes('/campaign/get/')) return json({ code: 0, data: { list: [
      { campaign_id: '1', campaign_name: 'Campanha real', operation_status: 'ENABLE' },
    ], page_info: { total_page: 1 } } });
    throw new Error(`Unexpected TikTok call: ${value}`);
  };
  try {
    const report = await ads.getAdPlatformReport(connection('TIKTOK_ADS', '123'), '7d');
    assert.deepEqual([report.totals.spend, report.totals.impressions, report.totals.clicks, report.totals.conversions], [20, 150, 10, 3]);
    assert.equal(report.campaigns[0].name, 'Campanha real');
    assert.equal(report.currency, 'USD');
  } finally { global.fetch = originalFetch; }
});

test('LinkedIn Ads report uses the advertiser account and separates account totals from campaign rows', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    const value = String(url);
    assert.equal(init.headers['LinkedIn-Version'], process.env.LINKEDIN_ADS_API_VERSION || '202608');
    if (value.includes('/adAnalytics?')) {
      const query = new URL(value).searchParams;
      assert.equal(query.get('accounts'), 'List(urn:li:sponsoredAccount:456)');
      assert.match(query.get('fields'), /externalWebsiteConversions/);
      if (query.get('pivot') === 'ACCOUNT') return json({ elements: [
        { costInLocalCurrency: '45.25', impressions: 500, clicks: 25, externalWebsiteConversions: 3 },
      ] });
      return json({ elements: [
        { pivotValues: ['urn:li:sponsoredCampaign:789'], costInLocalCurrency: '45.25', impressions: 500, clicks: 25, externalWebsiteConversions: 3 },
      ] });
    }
    if (value.includes('/adCampaigns/789')) return json({ name: 'Campanha LinkedIn', status: 'ACTIVE' });
    throw new Error(`Unexpected LinkedIn call: ${value}`);
  };
  try {
    const report = await ads.getAdPlatformReport(connection('LINKEDIN_ADS', '456'), '30d');
    assert.equal(report.totals.spend, 45.25);
    assert.equal(report.totals.ctr, 5);
    assert.equal(report.campaigns[0].name, 'Campanha LinkedIn');
    assert.equal(report.campaigns[0].conversions, 3);
  } finally { global.fetch = originalFetch; }
});

test('Ad insights refuse a connection belonging to another agency', async () => {
  const originalFind = prisma.socialConnection.findFirst;
  prisma.socialConnection.findFirst = async ({ where }) => {
    assert.equal(where.id, 'connection-2');
    assert.equal(where.agencyId, 'agency-1');
    assert.equal(where.platform, 'LINKEDIN_ADS');
    return null;
  };
  try {
    let responseError;
    await ads.insights({ params: { platform: 'linkedin', id: 'connection-2' }, query: { range: '7d' }, user: { agencyId: 'agency-1' } },
      { json: () => { throw new Error('Unexpected access'); } }, error => { responseError = error; });
    assert.ok(responseError);
    assert.match(responseError.message, /Conta não encontrada/);
  } finally { prisma.socialConnection.findFirst = originalFind; }
});
