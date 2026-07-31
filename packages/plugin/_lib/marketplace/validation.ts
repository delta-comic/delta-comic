import {
  AWESOME_REGISTRY_SCHEMA_VERSION,
  type AwesomePluginDownload,
  type AwesomePluginListing,
  type AwesomePluginRelease,
  type AwesomePluginRepository,
  type AwesomeRegistryIndex,
  type AwesomeRegistryPage,
  type AwesomeRegistryPagination,
  type AwesomeRegistryPageReference,
} from './types'

const PAGE_PATH_PATTERN = /^registry\/pages\/[1-9][0-9]*\.json$/
const PLUGIN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const record = (value: unknown, path: string) => {
  if (!isRecord(value)) throw new AwesomeRegistryValidationError(`${path} must be an object`)
  return value
}

const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], path: string) => {
  const extras = Object.keys(value).filter(key => !allowed.includes(key))
  if (extras.length > 0) {
    throw new AwesomeRegistryValidationError(`${path} has unknown fields: ${extras.join(', ')}`)
  }
}

const string = (value: unknown, path: string) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AwesomeRegistryValidationError(`${path} must be a non-empty string`)
  }
  return value
}

const integer = (value: unknown, path: string, minimum: number, maximum = Infinity) => {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new AwesomeRegistryValidationError(
      `${path} must be an integer between ${minimum} and ${maximum}`,
    )
  }
  return value as number
}

const schemaVersion = (value: unknown, path: string) => {
  if (value !== AWESOME_REGISTRY_SCHEMA_VERSION) {
    throw new AwesomeRegistryVersionError(value, path)
  }
  return AWESOME_REGISTRY_SCHEMA_VERSION
}

const path = (value: unknown, field: string) => {
  const result = string(value, field)
  if (!PAGE_PATH_PATTERN.test(result)) {
    throw new AwesomeRegistryValidationError(`${field} must be a registry page path`)
  }
  return result
}

const httpUrl = (value: unknown, field: string) => {
  const result = string(value, field)
  let parsed: URL
  try {
    parsed = new URL(result)
  } catch {
    throw new AwesomeRegistryValidationError(`${field} must be an absolute URL`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new AwesomeRegistryValidationError(`${field} must be a credential-free HTTP(S) URL`)
  }
  return result
}

const dateTime = (value: unknown, field: string) => {
  const result = string(value, field)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new AwesomeRegistryValidationError(`${field} must be an ISO date-time`)
  }
  return result
}

const parsePageReference = (value: unknown, field: string): AwesomeRegistryPageReference => {
  const item = record(value, field)
  exactKeys(item, ['page', 'items', 'path'], field)
  return {
    page: integer(item.page, `${field}.page`, 1),
    items: integer(item.items, `${field}.items`, 1),
    path: path(item.path, `${field}.path`),
  }
}

const parseDownload = (value: unknown, field: string): AwesomePluginDownload => {
  const download = record(value, field)
  if (download.type === 'github') {
    exactKeys(download, ['type', 'repository'], field)
    const repository = string(download.repository, `${field}.repository`)
    if (!GITHUB_REPOSITORY_PATTERN.test(repository)) {
      throw new AwesomeRegistryValidationError(`${field}.repository is invalid`)
    }
    return { type: 'github', repository }
  }
  if (download.type === 'url') {
    exactKeys(download, ['type', 'url'], field)
    return { type: 'url', url: httpUrl(download.url, `${field}.url`) }
  }
  throw new AwesomeRegistryValidationError(`${field}.type is unsupported`)
}

const parseRepository = (value: unknown, field: string): AwesomePluginRepository => {
  const repository = record(value, field)
  exactKeys(
    repository,
    ['owner', 'name', 'url', 'defaultBranch', 'lastCommitAt', 'readmeUrl'],
    field,
  )
  return {
    owner: string(repository.owner, `${field}.owner`),
    name: string(repository.name, `${field}.name`),
    url: httpUrl(repository.url, `${field}.url`),
    defaultBranch: string(repository.defaultBranch, `${field}.defaultBranch`),
    lastCommitAt: dateTime(repository.lastCommitAt, `${field}.lastCommitAt`),
    ...(repository.readmeUrl === undefined
      ? {}
      : { readmeUrl: httpUrl(repository.readmeUrl, `${field}.readmeUrl`) }),
  }
}

const parseRelease = (value: unknown, field: string): AwesomePluginRelease => {
  const release = record(value, field)
  exactKeys(release, ['version', 'url', 'publishedAt', 'manifestUrl'], field)
  return {
    version: string(release.version, `${field}.version`),
    url: httpUrl(release.url, `${field}.url`),
    publishedAt: dateTime(release.publishedAt, `${field}.publishedAt`),
    manifestUrl:
      release.manifestUrl === null ? null : httpUrl(release.manifestUrl, `${field}.manifestUrl`),
  }
}

export class AwesomeRegistryValidationError extends Error {
  public constructor(message: string) {
    super(`Invalid awesome-plugins registry: ${message}`)
    this.name = 'AwesomeRegistryValidationError'
  }
}

export class AwesomeRegistryVersionError extends AwesomeRegistryValidationError {
  public constructor(
    public readonly received: unknown,
    path: string,
  ) {
    super(`${path} has unsupported schemaVersion ${String(received)}`)
    this.name = 'AwesomeRegistryVersionError'
  }
}

export const parseAwesomeRegistryIndex = (value: unknown): AwesomeRegistryIndex => {
  const index = record(value, 'index')
  exactKeys(index, ['schemaVersion', 'pageSize', 'totalItems', 'totalPages', 'pages'], 'index')
  if (!Array.isArray(index.pages)) {
    throw new AwesomeRegistryValidationError('index.pages must be an array')
  }
  const result: AwesomeRegistryIndex = {
    schemaVersion: schemaVersion(index.schemaVersion, 'index'),
    pageSize: integer(index.pageSize, 'index.pageSize', 1, 100),
    totalItems: integer(index.totalItems, 'index.totalItems', 0),
    totalPages: integer(index.totalPages, 'index.totalPages', 0),
    pages: index.pages.map((item, itemIndex) =>
      parsePageReference(item, `index.pages[${itemIndex}]`),
    ),
  }
  if (result.pages.length !== result.totalPages) {
    throw new AwesomeRegistryValidationError('index.pages length must equal index.totalPages')
  }
  if (result.pages.reduce((total, page) => total + page.items, 0) !== result.totalItems) {
    throw new AwesomeRegistryValidationError('index page item counts must equal index.totalItems')
  }
  result.pages.forEach((page, itemIndex) => {
    if (page.page !== itemIndex + 1 || page.items > result.pageSize) {
      throw new AwesomeRegistryValidationError('index pages must be ordered and respect pageSize')
    }
  })
  return result
}

export const parseAwesomePluginListing = (
  value: unknown,
  field = 'listing',
): AwesomePluginListing => {
  const listing = record(value, field)
  exactKeys(listing, ['schemaVersion', 'id', 'authors', 'download', 'repository', 'release'], field)
  const id = string(listing.id, `${field}.id`)
  if (!PLUGIN_ID_PATTERN.test(id)) {
    throw new AwesomeRegistryValidationError(`${field}.id is invalid`)
  }
  if (!Array.isArray(listing.authors) || listing.authors.length === 0) {
    throw new AwesomeRegistryValidationError(`${field}.authors must be a non-empty array`)
  }
  const authors = listing.authors.map((author, index) => {
    const login = string(author, `${field}.authors[${index}]`)
    if (!GITHUB_LOGIN_PATTERN.test(login)) {
      throw new AwesomeRegistryValidationError(`${field}.authors[${index}] is invalid`)
    }
    return login
  })
  if (new Set(authors).size !== authors.length) {
    throw new AwesomeRegistryValidationError(`${field}.authors must be unique`)
  }
  return {
    schemaVersion: schemaVersion(listing.schemaVersion, field),
    id,
    authors,
    download: parseDownload(listing.download, `${field}.download`),
    ...(listing.repository === undefined
      ? {}
      : { repository: parseRepository(listing.repository, `${field}.repository`) }),
    ...(listing.release === undefined
      ? {}
      : { release: parseRelease(listing.release, `${field}.release`) }),
  }
}

const parsePagination = (value: unknown, field: string): AwesomeRegistryPagination => {
  const pagination = record(value, field)
  exactKeys(pagination, ['page', 'pageSize', 'totalItems', 'totalPages', 'previous', 'next'], field)
  return {
    page: integer(pagination.page, `${field}.page`, 1),
    pageSize: integer(pagination.pageSize, `${field}.pageSize`, 1, 100),
    totalItems: integer(pagination.totalItems, `${field}.totalItems`, 0),
    totalPages: integer(pagination.totalPages, `${field}.totalPages`, 1),
    previous: pagination.previous === null ? null : path(pagination.previous, `${field}.previous`),
    next: pagination.next === null ? null : path(pagination.next, `${field}.next`),
  }
}

export const parseAwesomeRegistryPage = (value: unknown): AwesomeRegistryPage => {
  const page = record(value, 'page')
  exactKeys(page, ['schemaVersion', 'pagination', 'items'], 'page')
  if (!Array.isArray(page.items)) {
    throw new AwesomeRegistryValidationError('page.items must be an array')
  }
  const result: AwesomeRegistryPage = {
    schemaVersion: schemaVersion(page.schemaVersion, 'page'),
    pagination: parsePagination(page.pagination, 'page.pagination'),
    items: page.items.map((item, index) => parseAwesomePluginListing(item, `page.items[${index}]`)),
  }
  if (result.items.length > result.pagination.pageSize) {
    throw new AwesomeRegistryValidationError('page.items exceeds pageSize')
  }
  const expectedPrevious = result.pagination.page === 1 ? null : result.pagination.page - 1
  const expectedNext =
    result.pagination.page === result.pagination.totalPages ? null : result.pagination.page + 1
  if (
    (expectedPrevious === null) !== (result.pagination.previous === null) ||
    (expectedNext === null) !== (result.pagination.next === null)
  ) {
    throw new AwesomeRegistryValidationError('page pagination links are inconsistent')
  }
  return result
}

export const assertAwesomeRegistryPagePath = (value: string) => path(value, 'page path')