import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { readReferenceImage, parseMarketingResult, safeImageUrl, marketingCaption } = await server.ssrLoadModule('/src/services/marketing.ts')

test('reference image stays local and produces matching MIME, base64 and preview', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
  const result = await readReferenceImage(new File([png], 'reference.png', { type: 'image/png' }))
  assert.equal(result.mediaType, 'image/png')
  assert.equal(result.base64, png.toString('base64'))
  assert.equal(result.previewUrl, `data:image/png;base64,${result.base64}`)
  assert.equal(result.name, 'reference.png')
})

test('invalid, empty and oversized reference files are rejected', async () => {
  await assert.rejects(readReferenceImage(new File(['<svg></svg>'], 'fake.png', { type: 'image/png' })), /JPG, PNG, WEBP/)
  await assert.rejects(readReferenceImage(new File([], 'empty.jpg')), /5MB/)
  await assert.rejects(readReferenceImage({ size: 5 * 1024 * 1024 + 1, arrayBuffer() { throw new Error('must not read oversized input') } }), /5MB/)
})

test('missing output image remains missing and unsafe URLs cannot become generated results', () => {
  const copy = { headline: '봄 신메뉴', body: '딸기 라떼를 만나보세요.', hashtags: ['#신메뉴'] }
  assert.equal(parseMarketingResult({ ...copy, imageUrl: null }).imageUrl, null)
  assert.equal(parseMarketingResult({ ...copy, imageUrl: '' }).imageUrl, null)
  assert.equal(parseMarketingResult({ ...copy, imageUrl: 'https://example.com/card.png' }).imageUrl, 'https://example.com/card.png')
  for (const imageUrl of ['javascript:alert(1)', 'data:image/svg+xml,foo', 'https://user:secret@example.com/card.png']) {
    assert.equal(safeImageUrl(imageUrl), null)
    assert.throws(() => parseMarketingResult({ ...copy, imageUrl }), /주소/)
  }
  assert.equal(marketingCaption({ ...copy, imageUrl: null }), '봄 신메뉴\n\n딸기 라떼를 만나보세요.\n\n#신메뉴')
})

test('marketing UI presents reference upload, copy input and an explicitly unconnected generator', async () => {
  const { default: MarketingPage } = await server.ssrLoadModule('/src/pages/MarketingPage.tsx')
  const noop = () => {}
  const html = renderToStaticMarkup(createElement(MarketingPage, { profile: { name: '우리 가게' }, onBack: noop, onSave: noop, onToast: noop }))
  assert.match(html, /type="file" accept="image\/jpeg,image\/png,image\/webp"/)
  assert.match(html, /카드뉴스에 넣을 글귀/)
  assert.match(html, /완성된 카드뉴스/)
  assert.match(html, /연결 준비 중/)
  assert.match(html, /class="marketing-create" disabled=""/)
  assert.doesNotMatch(html, /숏폼|체험 결과 만들기/)
})


test('product bytes, reference style and zero price are mapped without browser-only fields', async () => {
  const { marketingPayload } = await server.ssrLoadModule('/src/services/marketing.ts')
  const photo = { base64: 'cGhvdG8=', mediaType: 'image/png', name: 'product.png', previewUrl: 'data:image/png;base64,cGhvdG8=' }
  const payload = marketingPayload({ product: ' 커피 ', message: ' 신메뉴 ', tone: '담백하게', referenceImage: photo,
    styleReference: { ...photo, base64: 'c3R5bGU=' }, price: 0, originalPrice: 4000, hideFooter: true, backgroundMode: 'keep' })
  assert.deepEqual(payload.productImage, { base64: 'cGhvdG8=', mediaType: 'image/png' })
  assert.equal(payload.styleReference.base64, 'c3R5bGU=')
  assert.equal(payload.price, 0)
  assert.equal(payload.hideFooter, true)
  assert.equal(payload.product, '커피')
  assert.equal(payload.backgroundMode, 'keep')
  assert.ok(!JSON.stringify(payload).includes('previewUrl'))
  assert.ok(!JSON.stringify(payload).includes('storeId'))
})

test('three drafts preserve versions, processing warnings and reject partial or unsafe output', async () => {
  const { parseMarketingDrafts } = await server.ssrLoadModule('/src/services/marketing.ts')
  const draft = { id: 'poster-1', version: 2, width: 1080, height: 1350, mode: 'clova',
    result: { headline: '커피', body: '새로운 한 잔', hashtags: [], imageUrl: 'http://localhost:8081/images/photo.png' },
    design: { template_id: 'editorial', hide_footer: true }, imageProcessing: { background: 'kept', warning: '원본 사진 사용' } }
  const parsed = parseMarketingDrafts({ drafts: [draft, { ...draft, id: 'poster-2' }, { ...draft, id: 'poster-3' }], mode: 'clova' })
  assert.equal(parsed.drafts[0].version, 2)
  assert.equal(parsed.drafts[0].design.hide_footer, true)
  assert.equal(parsed.drafts[0].imageProcessing.warning, '원본 사진 사용')
  assert.throws(() => parseMarketingDrafts({ drafts: [draft], mode: 'clova' }))
  assert.throws(() => parseMarketingDrafts({ drafts: [draft, draft, { ...draft, result: { ...draft.result, imageUrl: 'javascript:alert(1)' } }], mode: 'clova' }))
})

test('revision sends selected version and a conflict never becomes a successful result', async () => {
  const { reviseMarketing, MarketingConflict } = await server.ssrLoadModule('/src/services/marketing.ts')
  const original = globalThis.fetch
  let sent
  globalThis.fetch = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return new Response('{}', { status: 409 }) }
  try {
    await assert.rejects(reviseMarketing({ id: 'draft-123', version: 4 }, '초록색으로', { id: 42 }, new AbortController().signal), MarketingConflict)
    assert.equal(sent.url, '/api/stores/42/ai/promotion/drafts/draft-123/revisions')
    assert.deepEqual(sent.body, { instruction: '초록색으로', expectedVersion: 4 })
  } finally { globalThis.fetch = original }
})
