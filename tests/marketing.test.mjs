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
