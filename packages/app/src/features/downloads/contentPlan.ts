import { db, type PluginArchiveDB } from '@delta-comic/db'
import type { ContentRefreshContext, EnqueuePlanInput } from '@delta-comic/downloader'
import { uni } from '@delta-comic/model'

const textEncoder = new TextEncoder()

const SHA256_INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotateRight = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount))

/**
 * Browser-only SHA-256 fallback for contexts where WebCrypto is temporarily unavailable.
 * It deliberately produces exactly the same digest as SubtleCrypto so persisted fingerprints do
 * not depend on the WebView implementation used to create them.
 */
const sha256Fallback = (input: Uint8Array): Uint8Array => {
  const bitLength = input.byteLength * 8
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(input)
  padded[input.byteLength] = 0x80

  const paddedView = new DataView(padded.buffer)
  paddedView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false)
  paddedView.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const state = Uint32Array.from(SHA256_INITIAL_STATE)
  const words = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = paddedView.getUint32(offset + index * 4, false)
    }
    for (let index = 16; index < words.length; index += 1) {
      const previous15 = words[index - 15] ?? 0
      const previous2 = words[index - 2] ?? 0
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10)
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0
    }

    let a = state[0] ?? 0
    let b = state[1] ?? 0
    let c = state[2] ?? 0
    let d = state[3] ?? 0
    let e = state[4] ?? 0
    let f = state[5] ?? 0
    let g = state[6] ?? 0
    let h = state[7] ?? 0

    for (let index = 0; index < words.length; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 =
        (h + sum1 + choice + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (words[index] ?? 0)) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0

      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }

    state[0] = ((state[0] ?? 0) + a) >>> 0
    state[1] = ((state[1] ?? 0) + b) >>> 0
    state[2] = ((state[2] ?? 0) + c) >>> 0
    state[3] = ((state[3] ?? 0) + d) >>> 0
    state[4] = ((state[4] ?? 0) + e) >>> 0
    state[5] = ((state[5] ?? 0) + f) >>> 0
    state[6] = ((state[6] ?? 0) + g) >>> 0
    state[7] = ((state[7] ?? 0) + h) >>> 0
  }

  const output = new Uint8Array(32)
  const outputView = new DataView(output.buffer)
  state.forEach((value, index) => outputView.setUint32(index * 4, value, false))
  return output
}

const toHex = (bytes: Uint8Array) =>
  [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')

/** Exposed to keep the non-WebCrypto path directly testable without Node-only dependencies. */
export async function sha256Hex(
  value: string,
  subtle: Pick<SubtleCrypto, 'digest'> | null = globalThis.crypto?.subtle ?? null,
): Promise<string> {
  const bytes = textEncoder.encode(value)
  if (subtle) {
    try {
      return toHex(new Uint8Array(await subtle.digest('SHA-256', bytes)))
    } catch {
      // Some embedded WebViews expose SubtleCrypto before its digest implementation is usable.
    }
  }
  return toHex(sha256Fallback(bytes))
}

const encodeFingerprintPart = (name: string, source: string) =>
  `${name.length}:${name}:${source.length}:${source}`

const functionSource = (value: object) => Function.prototype.toString.call(value)

const canonicalProviderSource = (provider: uni.download.ContentDownloadProvider) =>
  [
    encodeFingerprintPart('resolve', functionSource(provider.resolve)),
    encodeFingerprintPart(
      'refreshSource',
      provider.refreshSource ? functionSource(provider.refreshSource) : '',
    ),
  ].join('|')

/**
 * Hashes only function source, never provider inputs, resolved URLs, headers, or closure values.
 * Fixed field order and length-prefixing make the fingerprint independent of object insertion order.
 */
export async function fingerprintContentDownloadProvider(
  provider: uni.download.ContentDownloadProvider,
): Promise<string> {
  const canonicalSource = canonicalProviderSource(provider)
  return `sha256:${await sha256Hex(`content-download-provider:v1|${canonicalSource}`)}`
}

/** Fingerprints the exact registered page class used to reconstruct runtime-only page state. */
export async function fingerprintContentPage(
  ContentPage: uni.content.ContentPageLike,
): Promise<string> {
  return `sha256:${await sha256Hex(`content-page:v1|${functionSource(ContentPage)}`)}`
}

export class ContentDownloadRuntimeChangedError extends Error {
  public constructor(contentType: uni.content.ContentType) {
    super(
      `content download runtime changed for ${uni.content.ContentPage.downloadProviders.key.toString(contentType)}`,
    )
    this.name = 'ContentDownloadRuntimeChangedError'
  }
}

export interface PluginDownloadIdentity {
  pluginVersion?: string
  pluginIntegrity?: string
}

const formatPluginIntegrity = (integrity: PluginArchiveDB.Meta['integrity']) =>
  integrity ? `${integrity.algorithm}:${integrity.digest}` : undefined

/** Reads the installed archive rather than trusting runtime classes to describe plugin identity. */
export async function getPluginDownloadIdentity(plugin: string): Promise<PluginDownloadIdentity> {
  const archive = await db
    .selectFrom('plugin')
    .select('meta')
    .where('pluginName', '=', plugin)
    .executeTakeFirst()
  return {
    pluginVersion: archive?.meta.version.plugin,
    pluginIntegrity: formatPluginIntegrity(archive?.meta.integrity),
  }
}

const createRefreshContext = async (
  page: uni.content.ContentPage,
  expectedProvider?: uni.download.ContentDownloadProvider,
): Promise<ContentRefreshContext> => {
  const contentType = page.contentType
  const provider = uni.content.ContentPage.downloadProviders.get(contentType)
  const ContentPage = uni.content.ContentPage.contentPages.get(contentType)
  if (!provider || !ContentPage || (expectedProvider && provider !== expectedProvider)) {
    throw new ContentDownloadRuntimeChangedError(contentType)
  }
  if (Object.getPrototypeOf(page)?.constructor !== ContentPage) {
    throw new ContentDownloadRuntimeChangedError(contentType)
  }

  const [identity, providerFingerprint, contentPageFingerprint] = await Promise.all([
    getPluginDownloadIdentity(page.plugin),
    fingerprintContentDownloadProvider(provider),
    fingerprintContentPage(ContentPage),
  ])
  if (
    uni.content.ContentPage.contentPages.get(contentType) !== ContentPage ||
    uni.content.ContentPage.downloadProviders.get(contentType) !== provider
  ) {
    throw new ContentDownloadRuntimeChangedError(page.contentType)
  }
  return {
    plugin: page.plugin,
    contentType: [...contentType],
    contentId: page.id,
    episodeId: page.ep,
    contentPageFingerprint,
    providerFingerprint,
    ...identity,
  }
}

/**
 * The model protocol is deliberately the downloader wire format. Keep this adapter explicit so
 * later protocol versions have one migration point, while preserving every source field today.
 */
export async function contentPlanToEnqueueInput(
  plan: uni.download.DownloadPlan,
  page: uni.content.ContentPage,
  destinationId?: string,
  provider?: uni.download.ContentDownloadProvider,
): Promise<EnqueuePlanInput> {
  return {
    assets: plan.assets,
    destinationId,
    key: plan.key,
    refreshContext: await createRefreshContext(page, provider),
    title: plan.title,
  }
}