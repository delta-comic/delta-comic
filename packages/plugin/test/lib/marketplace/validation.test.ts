import { describe, expect, it } from 'vite-plus/test'

import type { AwesomePluginListing, AwesomeRegistryPage } from '../../../lib/marketplace/types'
import {
  assertAwesomeRegistryPagePath,
  AwesomeRegistryValidationError,
  AwesomeRegistryVersionError,
  parseAwesomePluginListing,
  parseAwesomeRegistryIndex,
  parseAwesomeRegistryPage,
} from '../../../lib/marketplace/validation'

const listing: AwesomePluginListing = {
  schemaVersion: 1,
  id: 'reader_plugin-1',
  authors: ['delta-comic', 'wenxig'],
  download: { type: 'github', repository: 'delta-comic/reader-plugin' },
  repository: {
    owner: 'delta-comic',
    name: 'reader-plugin',
    url: 'https://github.com/delta-comic/reader-plugin',
    defaultBranch: 'main',
    lastCommitAt: '2026-07-14T08:00:00Z',
    readmeUrl: 'https://raw.githubusercontent.com/delta-comic/reader-plugin/main/README.md',
  },
  release: {
    version: '1.2.3',
    url: 'https://github.com/delta-comic/reader-plugin/releases/tag/1.2.3',
    publishedAt: '2026-07-14T09:00:00Z',
    manifestUrl: null,
  },
}

const page: AwesomeRegistryPage = {
  schemaVersion: 1,
  pagination: {
    page: 2,
    pageSize: 10,
    totalItems: 21,
    totalPages: 3,
    previous: 'registry/pages/1.json',
    next: 'registry/pages/3.json',
  },
  items: [listing],
}

const clone = <T>(value: T): T => structuredClone(value)

describe('awesome registry index validation', () => {
  it('parses ordered page references whose counts match the index totals', () => {
    const index = {
      schemaVersion: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
      pages: [
        { page: 1, items: 2, path: 'registry/pages/1.json' },
        { page: 2, items: 1, path: 'registry/pages/2.json' },
      ],
    }

    expect(parseAwesomeRegistryIndex(index)).toEqual(index)
    expect(
      parseAwesomeRegistryIndex({
        schemaVersion: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        pages: [],
      }),
    ).toMatchObject({ totalItems: 0, pages: [] })
  })

  it.each([
    ['non-object index', null, 'index must be an object'],
    [
      'unknown fields',
      { schemaVersion: 1, pageSize: 10, totalItems: 0, totalPages: 0, pages: [], extra: true },
      'index has unknown fields: extra',
    ],
    [
      'non-array pages',
      { schemaVersion: 1, pageSize: 10, totalItems: 0, totalPages: 0, pages: {} },
      'index.pages must be an array',
    ],
    [
      'unsupported schema',
      { schemaVersion: 2, pageSize: 10, totalItems: 0, totalPages: 0, pages: [] },
      'unsupported schemaVersion 2',
    ],
    [
      'page size over the contract maximum',
      { schemaVersion: 1, pageSize: 101, totalItems: 0, totalPages: 0, pages: [] },
      'index.pageSize must be an integer between 1 and 100',
    ],
    [
      'fractional total',
      { schemaVersion: 1, pageSize: 10, totalItems: 1.5, totalPages: 0, pages: [] },
      'index.totalItems must be an integer',
    ],
    [
      'page-count mismatch',
      { schemaVersion: 1, pageSize: 10, totalItems: 0, totalPages: 1, pages: [] },
      'index.pages length must equal index.totalPages',
    ],
    [
      'item-count mismatch',
      {
        schemaVersion: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
        pages: [{ page: 1, items: 1, path: 'registry/pages/1.json' }],
      },
      'index page item counts must equal index.totalItems',
    ],
    [
      'out-of-order pages',
      {
        schemaVersion: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        pages: [{ page: 2, items: 1, path: 'registry/pages/2.json' }],
      },
      'index pages must be ordered',
    ],
    [
      'page count above size',
      {
        schemaVersion: 1,
        pageSize: 1,
        totalItems: 2,
        totalPages: 1,
        pages: [{ page: 1, items: 2, path: 'registry/pages/1.json' }],
      },
      'respect pageSize',
    ],
    [
      'unsafe page path',
      {
        schemaVersion: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        pages: [{ page: 1, items: 1, path: '../1.json' }],
      },
      'must be a registry page path',
    ],
  ])('rejects %s', (_case, value, message) => {
    expect(() => parseAwesomeRegistryIndex(value)).toThrow(message as string)
  })

  it('uses a dedicated error for schema migrations', () => {
    try {
      parseAwesomeRegistryIndex({
        schemaVersion: 'next',
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        pages: [],
      })
      throw new Error('expected parser to reject')
    } catch (error) {
      expect(error).toBeInstanceOf(AwesomeRegistryVersionError)
      expect(error).toMatchObject({ received: 'next', name: 'AwesomeRegistryVersionError' })
    }
  })
})

describe('awesome plugin listing validation', () => {
  it('parses GitHub and direct URL downloads with optional repository and release data', () => {
    expect(parseAwesomePluginListing(listing)).toEqual(listing)

    const minimal = {
      schemaVersion: 1,
      id: 'minimal',
      authors: ['author'],
      download: { type: 'url', url: 'https://example.com/plugin.zip' },
    }
    expect(parseAwesomePluginListing(minimal, 'entry')).toEqual(minimal)

    const releaseManifest = clone(listing)
    releaseManifest.release!.manifestUrl = 'https://example.com/manifest.json'
    delete releaseManifest.repository?.readmeUrl
    expect(parseAwesomePluginListing(releaseManifest)).toEqual(releaseManifest)
  })

  it.each([
    ['empty id', { id: '' }, 'listing.id must be a non-empty string'],
    ['invalid id', { id: '../plugin' }, 'listing.id is invalid'],
    ['missing authors', { authors: [] }, 'listing.authors must be a non-empty array'],
    ['non-array authors', { authors: 'author' }, 'listing.authors must be a non-empty array'],
    ['invalid author', { authors: ['-author'] }, 'listing.authors[0] is invalid'],
    ['duplicate authors', { authors: ['author', 'author'] }, 'listing.authors must be unique'],
    [
      'unknown download type',
      { download: { type: 'npm' } },
      'listing.download.type is unsupported',
    ],
    [
      'invalid GitHub repository',
      { download: { type: 'github', repository: 'missing-owner' } },
      'listing.download.repository is invalid',
    ],
    [
      'credentialed URL',
      { download: { type: 'url', url: 'https://token@example.com/plugin.zip' } },
      'credential-free HTTP(S) URL',
    ],
    [
      'non-HTTP URL',
      { download: { type: 'url', url: 'file:///tmp/plugin.zip' } },
      'credential-free HTTP(S) URL',
    ],
    ['relative URL', { download: { type: 'url', url: '/plugin.zip' } }, 'must be an absolute URL'],
    [
      'invalid repository timestamp',
      { repository: { ...listing.repository, lastCommitAt: 'today' } },
      'listing.repository.lastCommitAt must be an ISO date-time',
    ],
    [
      'invalid calendar date',
      { release: { ...listing.release, publishedAt: '2026-99-99T00:00:00Z' } },
      'listing.release.publishedAt must be an ISO date-time',
    ],
    ['unknown listing field', { unexpected: true }, 'listing has unknown fields: unexpected'],
  ])('rejects %s', (_case, patch, message) => {
    expect(() => parseAwesomePluginListing({ ...clone(listing), ...patch })).toThrow(
      message as string,
    )
  })

  it('reports object-shape and nested unknown-field errors consistently', () => {
    expect(() => parseAwesomePluginListing([])).toThrow(AwesomeRegistryValidationError)
    expect(() =>
      parseAwesomePluginListing({
        ...listing,
        download: { ...listing.download, mirror: 'https://example.com' },
      }),
    ).toThrow('listing.download has unknown fields: mirror')
    expect(() =>
      parseAwesomePluginListing({
        ...listing,
        repository: { ...listing.repository, private: false },
      }),
    ).toThrow('listing.repository has unknown fields: private')
    expect(() =>
      parseAwesomePluginListing({ ...listing, release: { ...listing.release, prerelease: false } }),
    ).toThrow('listing.release has unknown fields: prerelease')
  })
})

describe('awesome registry page validation', () => {
  it('parses middle and boundary pagination states', () => {
    expect(parseAwesomeRegistryPage(page)).toEqual(page)

    const first = clone(page)
    first.pagination.page = 1
    first.pagination.previous = null
    expect(parseAwesomeRegistryPage(first).pagination.previous).toBeNull()

    const last = clone(page)
    last.pagination.page = 3
    last.pagination.next = null
    expect(parseAwesomeRegistryPage(last).pagination.next).toBeNull()
  })

  it('rejects malformed item collections, overflow and inconsistent links', () => {
    expect(() => parseAwesomeRegistryPage({ ...page, items: {} })).toThrow(
      'page.items must be an array',
    )

    const overflow = clone(page)
    overflow.pagination.pageSize = 1
    overflow.items.push(clone(listing))
    expect(() => parseAwesomeRegistryPage(overflow)).toThrow('page.items exceeds pageSize')

    const missingPrevious = clone(page)
    missingPrevious.pagination.previous = null
    expect(() => parseAwesomeRegistryPage(missingPrevious)).toThrow(
      'page pagination links are inconsistent',
    )

    const unexpectedNext = clone(page)
    unexpectedNext.pagination.page = 3
    expect(() => parseAwesomeRegistryPage(unexpectedNext)).toThrow(
      'page pagination links are inconsistent',
    )
  })

  it('accepts only canonical registry page paths', () => {
    expect(assertAwesomeRegistryPagePath('registry/pages/12.json')).toBe('registry/pages/12.json')
    expect(() => assertAwesomeRegistryPagePath('registry/pages/0.json')).toThrow(
      'must be a registry page path',
    )
  })
})