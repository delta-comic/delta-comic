import type { PluginArchiveDB } from '@delta-comic/db'
import type { ContentRefreshContext } from '@delta-comic/downloader'
import type { uni } from '@delta-comic/model'

import { fingerprintContentDownloadProvider, fingerprintContentPage } from './contentPlan'

export interface ContentRefreshPluginIdentity {
  pluginVersion?: string
  pluginIntegrity?: string
}

export type RefreshableContentDownloadProvider = uni.download.ContentDownloadProvider & {
  refreshSource: NonNullable<uni.download.ContentDownloadProvider['refreshSource']>
}

export interface ContentSourceRefreshCandidate {
  context: ContentRefreshContext
  contentPageClass: uni.content.ContentPageLike
  page: uni.content.ContentPage
  provider: RefreshableContentDownloadProvider
  pluginIdentity: ContentRefreshPluginIdentity
  contentPageFingerprint: string
  providerFingerprint: string
}

export type ContentSourceRefreshChange =
  | { code: 'plugin-version-changed'; recorded?: string; current?: string }
  | { code: 'plugin-integrity-changed'; recorded?: string; current?: string }
  | { code: 'content-page-fingerprint-changed'; recorded?: string; current: string }
  | { code: 'provider-fingerprint-changed'; recorded: string; current: string }

export type ContentSourceRefreshResult =
  | { status: 'refresh-context-identity-mismatch'; plugin: string; contentType: [string, string] }
  | { status: 'plugin-not-loaded'; plugin: string }
  | { status: 'content-page-missing'; contentType: [string, string] }
  | { status: 'download-provider-missing'; contentType: [string, string] }
  | { status: 'source-refresh-unsupported'; contentType: [string, string] }
  | { status: 'content-page-construction-failed'; contentType: [string, string]; error: unknown }
  | {
      status: 'content-page-identity-mismatch'
      expected: { plugin: string; contentType: [string, string] }
      current: { plugin: string; contentType: uni.content.ContentType }
    }
  | { status: 'plugin-metadata-missing'; plugin: string }
  | { status: 'plugin-metadata-unavailable'; plugin: string; error: unknown }
  | {
      status: 'content-page-fingerprint-unavailable'
      contentType: [string, string]
      error: unknown
    }
  | { status: 'provider-fingerprint-unavailable'; contentType: [string, string]; error: unknown }
  | {
      status: 'confirmation-required'
      changes: ContentSourceRefreshChange[]
      candidate: ContentSourceRefreshCandidate
    }
  | { status: 'compatible'; candidate: ContentSourceRefreshCandidate }

type MaybePromise<T> = Promise<T> | T

export interface ContentSourceRefreshRuntime {
  /** Returns true only after the plugin's complete boot pipeline has settled successfully. */
  isPluginLoaded(plugin: string): boolean
  getContentPage(contentType: [string, string]): uni.content.ContentPageLike | undefined
  getDownloadProvider(
    contentType: [string, string],
  ): uni.download.ContentDownloadProvider | undefined
  getPluginIdentity(plugin: string): MaybePromise<ContentRefreshPluginIdentity | undefined>
  fingerprintProvider?: (
    provider: uni.download.ContentDownloadProvider,
    ContentPage: uni.content.ContentPageLike,
  ) => MaybePromise<string>
  fingerprintContentPage?: (ContentPage: uni.content.ContentPageLike) => MaybePromise<string>
}

export function isContentSourceRefreshCandidateCurrent(
  candidate: ContentSourceRefreshCandidate,
  runtime: ContentSourceRefreshRuntime,
) {
  return (
    runtime.isPluginLoaded(candidate.context.plugin) &&
    runtime.getContentPage(candidate.context.contentType) === candidate.contentPageClass &&
    runtime.getDownloadProvider(candidate.context.contentType) === candidate.provider
  )
}

export function pluginArchiveToContentRefreshIdentity(
  archive: Pick<PluginArchiveDB.Archive, 'meta'>,
): ContentRefreshPluginIdentity {
  const integrity = archive.meta.integrity
  return {
    pluginVersion: archive.meta.version.plugin,
    pluginIntegrity: integrity ? `${integrity.algorithm}:${integrity.digest}` : undefined,
  }
}

function isRefreshableProvider(
  provider: uni.download.ContentDownloadProvider,
): provider is RefreshableContentDownloadProvider {
  return typeof provider.refreshSource === 'function'
}

function sameContentType(left: uni.content.ContentType, right: [string, string]) {
  return left[0] === right[0] && left[1] === right[1]
}

function collectChanges(
  context: ContentRefreshContext,
  identity: ContentRefreshPluginIdentity,
  contentPageFingerprint: string,
  providerFingerprint: string,
): ContentSourceRefreshChange[] {
  const changes: ContentSourceRefreshChange[] = []
  if (context.pluginVersion !== identity.pluginVersion) {
    changes.push({
      code: 'plugin-version-changed',
      recorded: context.pluginVersion,
      current: identity.pluginVersion,
    })
  }
  if (context.pluginIntegrity !== identity.pluginIntegrity) {
    changes.push({
      code: 'plugin-integrity-changed',
      recorded: context.pluginIntegrity,
      current: identity.pluginIntegrity,
    })
  }
  if (context.contentPageFingerprint !== contentPageFingerprint) {
    changes.push({
      code: 'content-page-fingerprint-changed',
      recorded: context.contentPageFingerprint,
      current: contentPageFingerprint,
    })
  }
  if (context.providerFingerprint !== providerFingerprint) {
    changes.push({
      code: 'provider-fingerprint-changed',
      recorded: context.providerFingerprint,
      current: providerFingerprint,
    })
  }
  return changes
}

/**
 * Rebuilds the runtime-only content page only after its owning plugin has finished loading.
 *
 * This function never refreshes a source. A caller must explicitly handle
 * `confirmation-required` before using its candidate, so changed plugin code cannot run as an
 * automatic background recovery step.
 */
export async function prepareContentSourceRefresh(
  context: ContentRefreshContext,
  runtime: ContentSourceRefreshRuntime,
): Promise<ContentSourceRefreshResult> {
  if (context.contentType[0] !== context.plugin) {
    return {
      status: 'refresh-context-identity-mismatch',
      plugin: context.plugin,
      contentType: context.contentType,
    }
  }

  if (!runtime.isPluginLoaded(context.plugin)) {
    return { status: 'plugin-not-loaded', plugin: context.plugin }
  }

  const ContentPage = runtime.getContentPage(context.contentType)
  if (!ContentPage) return { status: 'content-page-missing', contentType: context.contentType }

  const provider = runtime.getDownloadProvider(context.contentType)
  if (!provider) return { status: 'download-provider-missing', contentType: context.contentType }
  if (!isRefreshableProvider(provider)) {
    return { status: 'source-refresh-unsupported', contentType: context.contentType }
  }

  let page: uni.content.ContentPage
  try {
    page = new ContentPage(undefined, context.contentId, context.episodeId)
  } catch (error) {
    return { status: 'content-page-construction-failed', contentType: context.contentType, error }
  }

  if (page.plugin !== context.plugin || !sameContentType(page.contentType, context.contentType)) {
    return {
      status: 'content-page-identity-mismatch',
      expected: { plugin: context.plugin, contentType: context.contentType },
      current: { plugin: page.plugin, contentType: page.contentType },
    }
  }

  let pluginIdentity: ContentRefreshPluginIdentity | undefined
  try {
    pluginIdentity = await runtime.getPluginIdentity(context.plugin)
  } catch (error) {
    return { status: 'plugin-metadata-unavailable', plugin: context.plugin, error }
  }
  if (!pluginIdentity?.pluginVersion) {
    return { status: 'plugin-metadata-missing', plugin: context.plugin }
  }

  let providerFingerprint: string
  try {
    providerFingerprint = await (
      runtime.fingerprintProvider ??
      (currentProvider => fingerprintContentDownloadProvider(currentProvider))
    )(provider, ContentPage)
  } catch (error) {
    return { status: 'provider-fingerprint-unavailable', contentType: context.contentType, error }
  }

  let contentPageFingerprint: string
  try {
    contentPageFingerprint = await (runtime.fingerprintContentPage ?? fingerprintContentPage)(
      ContentPage,
    )
  } catch (error) {
    return {
      status: 'content-page-fingerprint-unavailable',
      contentType: context.contentType,
      error,
    }
  }

  const candidate: ContentSourceRefreshCandidate = {
    context,
    contentPageClass: ContentPage,
    page,
    provider,
    pluginIdentity,
    contentPageFingerprint,
    providerFingerprint,
  }
  const changes = collectChanges(
    context,
    pluginIdentity,
    contentPageFingerprint,
    providerFingerprint,
  )
  return changes.length > 0
    ? { status: 'confirmation-required', changes, candidate }
    : { status: 'compatible', candidate }
}