// Existing frontend adapter -> Vite -> authenticated Spring -> Promotion-AI -> CLOVA.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
const base = process.env.PROMOTION_APP_URL || 'http://127.0.0.1:7001'
const nativeFetch = globalThis.fetch
const storage = new Map()
globalThis.fetch = (input, init) => nativeFetch(typeof input === 'string' ? new URL(input, base) : input, init)
globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) }
globalThis.window = { location: new URL(base), dispatchEvent() {} }
const token = process.env.PROMOTION_SMOKE_TOKEN
assert.ok(token, 'Set PROMOTION_SMOKE_TOKEN for an existing verified test account; store data will be changed')
const server = await createServer({ configFile:false, server:{ middlewareMode:true, hmr:false, ws:false }, optimizeDeps:{noDiscovery:true,include:[]}, appType:'custom' })
try {
  const session = { accessToken: token, expiresIn: 3600 }
  sessionStorage.setItem('gage-auth-session',JSON.stringify({accessToken:session.accessToken,expiresAt:Date.now()+session.expiresIn*1000}))
  const auth = await server.ssrLoadModule('/src/services/auth.ts')
  assert.ok((await auth.initializeAuth()).user?.id)
  const { saveStoreProfile } = await server.ssrLoadModule('/src/services/account-settings.ts')
  const settings = await saveStoreProfile({name:'오후의 커피',owner:'연동 테스트',category:'카페',region:'서울'},AbortSignal.timeout(15000))
  assert.ok(settings.store?.id)
  const marketing = await server.ssrLoadModule('/src/services/marketing.ts')
  const photoPath = process.env.PROMOTION_TEST_PHOTO || '../Promotion-AI/examples/assets/coffee.jpg'
  const photo = await marketing.readReferenceImage(new File([await readFile(photoPath)],'product.png'))
  const result = await marketing.generateMarketing({product:'에스프레소',message:'커피 한 잔의 여유를 만나보세요',tone:'따뜻하고 친근하게',referenceImage:photo,price:3500,originalPrice:4000,backgroundMode:'auto'},settings.store,AbortSignal.timeout(120000))
  assert.equal(result.mode,'clova')
  assert.equal(result.drafts.length,3)
  assert.equal(new Set(result.drafts.map(d=>d.design.template_id)).size,3)
  const revised = await marketing.reviseMarketing(result.drafts[1],'배경을 초록색으로 바꿔줘',settings.store,AbortSignal.timeout(120000))
  assert.equal(revised.version,2)
  assert.notEqual(revised.result.imageUrl,result.drafts[1].result.imageUrl)
  await assert.rejects(marketing.reviseMarketing(result.drafts[1],'가격을 더 강조해줘',settings.store,AbortSignal.timeout(120000)),marketing.MarketingConflict)
  const restored = await marketing.getMarketingDraft(revised.id,settings.store,AbortSignal.timeout(15000))
  assert.equal(restored.version,2)
  const output = process.env.PROMOTION_SMOKE_OUTPUT || '/private/tmp/promotion-live-check'
  await mkdir(output,{recursive:true})
  for (const [i,draft] of [...result.drafts,revised].entries()) {
    const image = await nativeFetch(draft.result.imageUrl)
    assert.equal(image.status,200)
    assert.equal(image.headers.get('content-type'),'image/png')
    assert.equal(image.headers.get('access-control-allow-origin'),'*')
    const bytes = Buffer.from(await image.arrayBuffer())
    assert.equal(bytes.readUInt32BE(16),1080); assert.equal(bytes.readUInt32BE(20),1350)
    await writeFile(`${output}/poster-${i+1}.png`,bytes)
  }
  const report={status:'passed',mode:result.mode,drafts:result.drafts,revised,
    checks:{existingFrontendAdapter:true,backendAuthentication:true,threeDistinctTemplates:true,versionedRevision:true,staleRevisionRejected:true,latestDraftRestored:true,pngDownload:true}}
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify({status:'passed',mode:result.mode,templates:result.drafts.map(d=>d.design.template_id),processing:result.drafts[0].imageProcessing,checks:report.checks,output},null,2))
} finally { storage.clear(); await server.close() }
