const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/database/prisma');
const { encrypt } = require('../dist/common/crypto');
const { getCampaignCreatives } = require('../dist/modules/ads/ads.controller');

const req = { params: { id: 'connection-1', campaignId: '456' }, user: { agencyId: 'agency-1' } };
const response = value => ({ ok: true, json: async () => value });

async function run({ connection = true, owner = '123', pages = [[]], posterFailure = false } = {}) {
  const original = { find: prisma.socialConnection.findFirst, fetch: global.fetch, key: process.env.ENCRYPTION_KEY };
  process.env.ENCRYPTION_KEY = 'isolated-creative-test-key';
  const calls = [];
  let body, error, page = 0;
  prisma.socialConnection.findFirst = async ({ where }) => {
    assert.deepEqual(where, { id: 'connection-1', agencyId: 'agency-1', platform: 'META_ADS' });
    return connection ? { externalPageId: 'act_123', accessTokenEncrypted: encrypt('private-token') } : null;
  };
  global.fetch = async url => {
    const parsed = new URL(url); calls.push(parsed);
    assert.equal(parsed.hostname, 'graph.facebook.com');
    if (parsed.searchParams.get('fields') === 'account_id') return response({ account_id: owner });
    if (parsed.searchParams.has('thumbnail_width')) {
      assert.equal(parsed.searchParams.get('thumbnail_width'), '800');
      return posterFailure ? { ok: false } : response({ thumbnail_url: 'https://cdn.example/large.jpg' });
    }
    const current = page++;
    assert(current < pages.length, 'Unexpected Meta call');
    return response({ data: pages[current], ...(current + 1 < pages.length ? { paging: { next: 'https://graph.facebook.com/456/ads?after=next' } } : {}) });
  };
  try {
    await getCampaignCreatives(req, { setHeader: (name, value) => { assert.equal(name, 'Cache-Control'); assert.equal(value, 'private, no-store'); }, json: value => { body = value; } }, value => { error = value; });
    return { body, error, calls };
  } finally {
    prisma.socialConnection.findFirst = original.find; global.fetch = original.fetch;
    if (original.key === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = original.key;
  }
}

test('returns real creative associations, video posters and missing-image states across pages', async () => {
  const result = await run({ pages: [
    [{ id: '1', name: 'Imagem', creative: { image_url: 'https://cdn.example/image.jpg', thumbnail_url: 'https://cdn.example/thumb.jpg' }, effective_status: 'ACTIVE' }],
    [{ id: '2', name: 'Vídeo', creative: { thumbnail_url: 'https://cdn.example/video.jpg', video_id: 'video-1' } }, { id: '3', name: 'Sem imagem' }],
  ] });
  assert.ifError(result.error); assert.equal(result.body.campaignId, '456');
  assert.equal(result.body.ads.length, 3);
  assert.equal(result.body.ads[0].imageUrl, 'https://cdn.example/image.jpg');
  assert.equal(result.body.ads[1].isVideo, true); assert.equal(result.body.ads[1].imageUrl, null);
  assert.equal(result.body.ads[2].thumbnailUrl, null);
  assert(!JSON.stringify(result.body).includes('private-token'));
});

test('an unknown or other-agency connection cannot access Meta creatives', async () => {
  const result = await run({ connection: false }); assert(result.error); assert.equal(result.calls.length, 0);
});

test('a campaign from another account is rejected before its ads are read', async () => {
  const result = await run({ owner: '999' }); assert(result.error); assert.equal(result.calls.length, 1); assert.equal(result.body, undefined);
});

test('rejects unsafe image URLs and URLs containing access tokens', async () => {
  const result = await run({ pages: [[{ id: '1', creative: { image_url: 'javascript:alert(1)', thumbnail_url: 'https://cdn.example/image?access_token=secret' } }]] });
  assert.ifError(result.error); assert.equal(result.body.ads[0].imageUrl, null); assert.equal(result.body.ads[0].thumbnailUrl, null);
});

test('empty campaigns return an explicit empty list', async () => {
  const result = await run(); assert.ifError(result.error); assert.deepEqual(result.body, { campaignId: '456', ads: [] });
});

test('requests a larger poster for boosted posts, with a fallback if Meta refuses', async () => {
  const pages = [[{ id: '1', creative: { id: '777', thumbnail_url: 'https://cdn.example/small.jpg' } }]];
  const enlarged = await run({ pages }); assert.ifError(enlarged.error);
  assert.equal(enlarged.body.ads[0].thumbnailUrl, 'https://cdn.example/large.jpg');
  const fallback = await run({ pages: [[{ id: '1', creative: { id: '777', thumbnail_url: 'https://cdn.example/small.jpg' } }]], posterFailure: true });
  assert.ifError(fallback.error); assert.equal(fallback.body.ads[0].thumbnailUrl, 'https://cdn.example/small.jpg');
});
