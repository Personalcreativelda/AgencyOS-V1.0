const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/database/prisma');
const { encrypt } = require('../dist/common/crypto');
const { getAdPreview, extractPreviewFrame } = require('../dist/modules/ads/adsPreview.controller');

const frame = '<iframe src="https://www.facebook.com/ads/api/preview_iframe.php?d=preview&amp;v=1" height="760"></iframe>';
const response = value => ({ ok: true, json: async () => value });
async function run(options = {}) {
  const original = { find: prisma.socialConnection.findFirst, fetch: global.fetch, key: process.env.ENCRYPTION_KEY };
  process.env.ENCRYPTION_KEY = 'isolated-preview-test-key';
  const calls = [];
  let body, error;
  prisma.socialConnection.findFirst = async ({ where }) => {
    assert.deepEqual(where, { id: 'connection-1', agencyId: 'agency-1', platform: 'META_ADS' });
    return options.connection === false ? null : { externalPageId: 'act_123', accessTokenEncrypted: encrypt('private-token') };
  };
  global.fetch = async url => {
    const parsed = new URL(url); calls.push(parsed);
    assert.equal(parsed.hostname, 'graph.facebook.com');
    if (parsed.pathname.endsWith('/888')) return response({ media_type: 'VIDEO', media_url: 'https://cdn.example/instagram.mp4' });
    if (parsed.pathname.endsWith('/456/previews')) {
      assert.equal(parsed.searchParams.get('ad_format'), 'MOBILE_FEED_STANDARD');
      if (options.previewFailure) throw new Error('Preview unavailable');
      return response({ data: [{ body: options.frame ?? frame }] });
    }
    if (parsed.pathname.endsWith('/789')) {
      assert.equal(parsed.searchParams.get('fields'), 'source');
      if (options.videoFailure) throw new Error('Video unavailable');
      return response({ source: options.source ?? 'https://cdn.example/video.mp4' });
    }
    assert(parsed.pathname.endsWith('/456'), 'Unexpected request');
    return response({ account_id: options.owner ?? '123', preview_shareable_link: options.postUrl,
      creative: options.creative ?? { body: 'Texto completo', title: 'Título', video_id: '789', effective_object_story_id: '111_222' } });
  };
  try {
    await getAdPreview({ params: { id: 'connection-1', adId: options.adId ?? '456' }, query: { width: options.width ?? '390' }, user: { agencyId: 'agency-1' } }, {
      setHeader: (name, value) => { assert.equal(name, 'Cache-Control'); assert.equal(value, 'private, no-store'); }, json: value => { body = value; },
    }, value => { error = value; });
    return { body, error, calls };
  } finally {
    prisma.socialConnection.findFirst = original.find; global.fetch = original.fetch;
    if (original.key === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = original.key;
  }
}

test('extracts only trusted official frames, decodes attributes and bounds dimensions', () => {
  assert.deepEqual(extractPreviewFrame(frame), { url: 'https://www.facebook.com/ads/api/preview_iframe.php?d=preview&v=1', height: 760 });
  assert(extractPreviewFrame(frame.replace('www.facebook.com', 'business.facebook.com')));
  assert.equal(extractPreviewFrame("<iframe src='//facebook.com/ads/api/preview_iframe.php?d=x&#38;v=1' height='9000'>").height, 1200);
  for (const src of ['javascript:alert(1)', 'http://facebook.com/ads/api/preview_iframe.php', 'https://facebook.com.evil.example/ads/api/preview_iframe.php', 'https://facebook.com/other', 'https://facebook.com/ads/api/preview_iframe.php?access_token=secret']) {
    assert.equal(extractPreviewFrame(`<iframe src="${src}">`), null);
  }
  assert.equal(extractPreviewFrame('<script>unsafe()</script>'), null);
});

test('returns full ad metadata, official preview and playable video without leaking credentials or HTML', async () => {
  const result = await run(); assert.ifError(result.error);
  assert.equal(result.body.width, 390); assert.equal(result.body.iframeHeight, 760);
  assert.equal(result.body.videoUrl, 'https://cdn.example/video.mp4'); assert.equal(result.body.isVideo, true);
  assert.equal(result.body.text, 'Texto completo'); assert.equal(result.body.postUrl, 'https://www.facebook.com/111/posts/222');
  assert(!JSON.stringify(result.body).includes('private-token')); assert(!JSON.stringify(result.body).includes('<iframe'));
});

test('guards tenant ownership and rejects foreign ads before preview or video requests', async () => {
  const missing = await run({ connection: false }); assert(missing.error); assert.equal(missing.calls.length, 0);
  const foreign = await run({ owner: '999' }); assert(foreign.error); assert.equal(foreign.calls.length, 1); assert.equal(foreign.body, undefined);
});

test('validates ad IDs and sizes and clamps supported mobile preview widths', async () => {
  for (const options of [{ adId: '../456' }, { width: 'invalid' }]) {
    const result = await run(options); assert(result.error); assert.equal(result.calls.length, 0);
  }
  const small = await run({ width: '100' }); assert.equal(small.body.width, 240);
  const large = await run({ width: '900' }); assert.equal(large.body.width, 500);
});

test('preview and video failures degrade independently', async () => {
  const preview = await run({ previewFailure: true }); assert.ifError(preview.error);
  assert.equal(preview.body.iframeUrl, null); assert.equal(preview.body.videoUrl, 'https://cdn.example/video.mp4');
  const video = await run({ videoFailure: true }); assert.ifError(video.error);
  assert(video.body.iframeUrl); assert.equal(video.body.videoUrl, null);
});

test('rejects unsafe media and external post URLs while retaining useful creative text', async () => {
  const result = await run({ source: 'https://cdn.example/video?access_token=secret', postUrl: 'https://evil.example/post', creative: {
    object_story_spec: { video_data: { video_id: '789', message: 'Mensagem do vídeo', call_to_action: { type: 'LEARN_MORE' } } },
  } });
  assert.ifError(result.error); assert.equal(result.body.videoUrl, null); assert.equal(result.body.postUrl, null);
  assert.equal(result.body.text, 'Mensagem do vídeo'); assert.equal(result.body.callToAction, 'LEARN_MORE');
});

test('image ads do not request video sources', async () => {
  const result = await run({ creative: { body: 'Foto' } }); assert.ifError(result.error);
  assert.equal(result.body.isVideo, false); assert.equal(result.body.videoUrl, null); assert.equal(result.calls.length, 2);
});

test('plays boosted Instagram videos when Facebook omits the original source', async () => {
  const result = await run({ videoFailure: true, creative: { video_id: '789', effective_instagram_media_id: '888' } });
  assert.ifError(result.error); assert.equal(result.body.videoUrl, 'https://cdn.example/instagram.mp4');
  assert.equal(result.body.isVideo, true);
});
