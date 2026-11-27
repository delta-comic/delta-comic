import { db } from '@delta-comic/platform/db'
import type { ContentRefreshContext, EnqueuePlanInput } from '@delta-comic/platform/downloader'
import {
  type UniContentDownloadProvider,
  UniContentPage,
  type UniContentPageLike,
  type UniContentType,
  type UniDownloadPlan,
} from '@delta-comic/platform/model'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

const encodeFingerprintPart = (name: string, source: string) =>
  `${name.length}:${name}:${source.length}:${source}`

const functionSource = (value: object) => Function.prototype.toString.call(value)

const canonicalProviderSource = (provider: UniContentDownloadProvider) =>
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
  provider: UniContentDownloadProvider,
): Promise<string> {
  const canonicalSource = canonicalProviderSource(provider)
  return `sha256:${await sha256Hex(`content-download-provider:v1|${canonicalSource}`)}`
}

/** Fingerprints the exact registered page class used to reconstruct runtime-only page state. */
export async function fingerprintContentPage(ContentPage: UniContentPageLike): Promise<string> {
  return `sha256:${await sha256Hex(`content-page:v1|${functionSource(ContentPage)}`)}`
}

export class ContentDownloadRuntimeChangedError extends Error {
  public constructor(contentType: UniContentType) {
    super(
      `content download runtime changed for ${UniContentPage.downloadProviders.key.toString(contentType)}`,
    )
    this.name = 'ContentDownloadRuntimeChangedError'
  }
}

export interface PluginDownloadIdentity {
  pluginVersion?: string
  pluginIntegrity?: string
}

/** Reads the installed archive rather than trusting runtime classes to describe plugin identity. */
export async function getPluginDownloadIdentity(plugin: string): Promise<PluginDownloadIdentity> {
  const archive = await db
    .selectFrom('plugin')
    .select('meta')
    .where('pluginName', '=', plugin)
    .executeTakeFirst()
  return {
    pluginVersion: archive?.meta.version,
    pluginIntegrity: archive?.meta.resources.find(
      resource => resource.path === archive.meta.entryModulePath,
    )?.integrity,
  }
}

const createRefreshContext = async (
  page: UniContentPage,
  expectedProvider?: UniContentDownloadProvider,
): Promise<ContentRefreshContext> => {
  const contentType = page.contentType
  const provider = UniContentPage.downloadProviders.get(contentType)
  const ContentPage = UniContentPage.contentPages.get(contentType)
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
    UniContentPage.contentPages.get(contentType) !== ContentPage ||
    UniContentPage.downloadProviders.get(contentType) !== provider
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

export async function contentPlanToEnqueueInput(
  plan: UniDownloadPlan,
  page: UniContentPage,
  destinationId?: string,
  provider?: UniContentDownloadProvider,
): Promise<EnqueuePlanInput> {
  return {
    assets: plan.assets,
    destinationId,
    key: plan.key,
    refreshContext: await createRefreshContext(page, provider),
    title: plan.title,
  }
}