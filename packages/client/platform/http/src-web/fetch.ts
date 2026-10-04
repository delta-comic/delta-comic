import { AbortError, isString } from 'es-toolkit'

import { createTauRPCProxy, type ClientConfig, type ContentConfig } from './bindings'

let commands: ReturnType<typeof createTauRPCProxy>['http'] | undefined

function getCommands() {
  return (commands ??= createTauRPCProxy().http)
}

export interface CORSFetchConfig {
  include: (string | RegExp)[]
  exclude: (string | RegExp)[]
  request: ClientConfig
}

export type CORSFetchInit = RequestInit & Partial<CORSFetchConfig['request']>
type IpcContentConfig = ContentConfig

interface ReadStreamContext {
  signal?: AbortSignal | null
  chunkBuffer: Uint8Array[]
  totalBufferedBytes: { value: number }
  responseRid: number | null
  cleanup: () => void
}

const NULL_BODY_STATUS = [101, 103, 204, 205, 304]
const cancelError = new AbortError('User cancelled the request')

function fetchNative(input: Parameters<typeof fetch>[0], init?: CORSFetchInit) {
  return (window.fetchNative ?? window.fetch.bind(window))(input, init)
}

function combineChunks(chunks: Uint8Array[], totalSize: number): Uint8Array {
  const combined = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

function matchesPattern(url: string, patterns: (string | RegExp)[]) {
  return patterns.some(pattern => {
    if (isString(pattern)) return url.includes(pattern)
    if (pattern instanceof RegExp) return pattern.test(url)
    return false
  })
}

function shouldUseCORSProxy(url: string, config: CORSFetchConfig) {
  // Exclude Tauri internal protocols (ipc:// or asset://)
  // https://github.com/tauri-apps/tauri/blob/b5c549d1898ecdb712822c02dc665cc6771fbd07/crates/tauri/scripts/core.js#L16
  const isTauriProtocol =
    /^(ipc|asset):\/\/localhost\//i.test(url) || /^http:\/\/(ipc|asset)\.localhost\//i.test(url)
  if (isTauriProtocol) return false

  const { include, exclude } = config

  // Priority: exclusion list
  if (exclude.length > 0 && matchesPattern(url, exclude)) {
    return false
  }

  // If there is an inclusion list, only proxy URLs in that list
  if (include.length > 0) {
    return matchesPattern(url, include)
  }

  // Default: proxy all http(s) requests
  return /^https?:\/\//i.test(url)
}

async function readStream(
  { totalBufferedBytes, signal, chunkBuffer, cleanup, responseRid }: ReadStreamContext,
  controller: ReadableStreamDefaultController,
  streamConfig: { bufferSize: number; maxBufferBytes: number },
) {
  if (signal?.aborted) {
    controller.error(cancelError)
    return
  }

  try {
    while (
      chunkBuffer.length < streamConfig.bufferSize &&
      totalBufferedBytes.value < streamConfig.maxBufferBytes
    ) {
      const data = await getCommands().fetch_read_body(responseRid!)
      const actualData = new Uint8Array(data.bytes)

      if (data.done) {
        if (chunkBuffer.length > 0) {
          const combined = combineChunks(chunkBuffer, totalBufferedBytes.value)
          controller.enqueue(combined)
        }
        cleanup()
        controller.close()
        return
      }

      if (actualData.byteLength > 0) {
        chunkBuffer.push(actualData)
        totalBufferedBytes.value += actualData.byteLength
      }

      if (signal?.aborted) {
        controller.error(cancelError)
        return
      }
    }

    if (chunkBuffer.length > 0) {
      const combined = combineChunks(chunkBuffer, totalBufferedBytes.value)
      controller.enqueue(combined)

      chunkBuffer.length = 0
      totalBufferedBytes.value = 0
    }
  } catch (e) {
    controller.error(e)
    cleanup()
  }
}

export function createCORSFetch(getConfig: () => CORSFetchConfig) {
  const streamConfig = { bufferSize: 5, maxBufferBytes: 256 * 1024 }

  return async function corsFetch(
    input: Parameters<typeof fetch>[0],
    init?: CORSFetchInit,
    force = false,
  ): Promise<Response> {
    const urlStr = input instanceof Request ? input.url : String(input)
    const config = getConfig()

    if (!force && urlStr.startsWith('data:')) {
      return fetchNative(input, init)
    }
    if (!force && !shouldUseCORSProxy(urlStr, config)) {
      return fetchNative(input, init)
    }

    const signal = isString(input)
      ? init?.signal
      : input instanceof URL
        ? init?.signal
        : (init?.signal ?? input.signal)
    if (signal?.aborted) throw cancelError

    let rid: number | null = null
    let responseRid: number | null = null

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)

      if (responseRid !== null) {
        getCommands().fetch_cancel_body(responseRid).catch(() => {})
        responseRid = null
      }

      if (rid !== null) {
        getCommands().fetch_cancel(rid).catch(() => {})
        rid = null
      }
    }

    const onAbort = () => cleanup()
    signal?.addEventListener('abort', onAbort)

    const req = input instanceof Request ? input : new Request(input, init)
    const buffer = req.body === null ? null : await req.arrayBuffer()

    if (signal?.aborted) throw cancelError

    try {
      const contentConfig: IpcContentConfig = {
        method: req.method,
        url: urlStr,
        headers: Array.from(req.headers.entries()),
        data: buffer?.byteLength ? Array.from(new Uint8Array(buffer)) : null,
        client: config.request,
      }

      rid = await getCommands().fetch(contentConfig)

      if (signal?.aborted) throw cancelError

      const {
        status,
        statusText,
        url,
        headers: responseHeaders,
        rid: _rid,
      } = await getCommands().fetch_send(rid)
      responseRid = _rid

      if (signal?.aborted) throw cancelError

      const chunkBuffer: Uint8Array[] = []
      const totalBufferedBytes = { value: 0 }

      // no body for 101, 103, 204, 205 and 304
      // see https://fetch.spec.whatwg.org/#null-body-status
      const body = NULL_BODY_STATUS.includes(status)
        ? null
        : new ReadableStream({
            pull: c =>
              readStream(
                { chunkBuffer: chunkBuffer, cleanup, totalBufferedBytes, responseRid, signal },
                c,
                streamConfig,
              ),
            cancel: onAbort,
          })

      const res = new Response(body, { status, statusText })

      // Set `Response` properties that are ignored by the
      // constructor, like url and some headers.
      Object.defineProperty(res, 'url', { value: url })
      Object.defineProperty(res, 'headers', { value: new Headers(responseHeaders) })

      return res
    } catch (err) {
      cleanup()
      throw err
    }
  }
}
