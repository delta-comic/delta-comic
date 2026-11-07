import { isString } from 'es-toolkit'

import type { CORSFetchInit } from './fetch'

export type CORSFetchFunction = (
  input: Parameters<typeof fetch>[0],
  init?: CORSFetchInit,
  force?: boolean,
) => Promise<Response>

const XHR_UNSENT = 0
const XHR_OPENED = 1
const XHR_HEADERS_RECEIVED = 2
const XHR_LOADING = 3
const XHR_DONE = 4
const XHR_FORBIDDEN_METHODS = new Set(['CONNECT', 'TRACE', 'TRACK'])
const XHR_RESPONSE_TYPES = new Set(['', 'arraybuffer', 'blob', 'document', 'json', 'text'])

type XHRBody = Document | XMLHttpRequestBodyInit | null | undefined
type XHRProgressHandler = ((this: XMLHttpRequestEventTarget, ev: ProgressEvent) => unknown) | null
type XHRReadyStateHandler = ((this: XMLHttpRequest, ev: Event) => unknown) | null

function createDOMException(name: string, message: string): DOMException {
  if (typeof DOMException !== 'undefined') return new DOMException(message, name)

  const error = new Error(message) as DOMException
  Object.defineProperty(error, 'name', { value: name })
  return error
}

function createProgressEvent(type: string, init: ProgressEventInit = {}): ProgressEvent {
  if (typeof ProgressEvent !== 'undefined') return new ProgressEvent(type, init)

  const event = new Event(type) as ProgressEvent
  Object.defineProperties(event, {
    lengthComputable: { value: Boolean(init.lengthComputable) },
    loaded: { value: init.loaded ?? 0 },
    total: { value: init.total ?? 0 },
  })
  return event
}

function callEventHandler<TEvent extends Event>(
  handler: ((this: XMLHttpRequestEventTarget, ev: TEvent) => unknown) | null,
  target: XMLHttpRequestEventTarget,
  event: TEvent,
) {
  handler?.call(target, event)
}

function combineUint8Arrays(chunks: Uint8Array[], totalSize: number): Uint8Array {
  const combined = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength &&
    bytes.buffer instanceof ArrayBuffer
  ) {
    return bytes.buffer
  }

  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function resolveRequestURL(url: string | URL): URL {
  const baseURL = typeof document === 'undefined' ? window.location.href : document.baseURI
  return new URL(String(url), baseURL)
}

function normalizeXHRBody(body: XHRBody): BodyInit | null {
  if (body == null) return null
  if (typeof Document !== 'undefined' && body instanceof Document) {
    return new XMLSerializer().serializeToString(body)
  }
  return body as XMLHttpRequestBodyInit
}

function getBodyByteLength(body: BodyInit | null): number | null {
  if (body == null) return 0
  if (isString(body)) return new TextEncoder().encode(body).byteLength
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return new TextEncoder().encode(body.toString()).byteLength
  }
  return null
}

function encodeBasicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function getHeaderText(headers: Headers): string {
  return Array.from(headers.entries())
    .map(([name, value]) => `${name}: ${value}\r\n`)
    .join('')
}

function parseContentLength(headers: Headers): number | null {
  const contentLength = headers.get('content-length')
  if (!contentLength) return null

  const parsed = Number(contentLength)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

class CORSXMLHttpRequestUpload extends EventTarget implements XMLHttpRequestUpload {
  public readonly impl: XMLHttpRequestUpload = this

  public onabort: XHRProgressHandler = null
  public onerror: XHRProgressHandler = null
  public onload: XHRProgressHandler = null
  public onloadend: XHRProgressHandler = null
  public onloadstart: XHRProgressHandler = null
  public onprogress: XHRProgressHandler = null
  public ontimeout: XHRProgressHandler = null

  public emit(type: string, init: ProgressEventInit = {}) {
    const event = createProgressEvent(type, init)
    const dispatched = super.dispatchEvent(event)
    callEventHandler(this.getEventHandler(type), this.impl, event)
    return dispatched
  }

  private getEventHandler(type: string): XHRProgressHandler {
    switch (type) {
      case 'abort':
        return this.onabort
      case 'error':
        return this.onerror
      case 'load':
        return this.onload
      case 'loadend':
        return this.onloadend
      case 'loadstart':
        return this.onloadstart
      case 'progress':
        return this.onprogress
      case 'timeout':
        return this.ontimeout
      default:
        return null
    }
  }
}

export function createCORSXMLHttpRequestConstructor(
  corsFetch: CORSFetchFunction,
  force = false,
): typeof XMLHttpRequest {
  class CORSXMLHttpRequest extends EventTarget implements XMLHttpRequest {
    public static readonly UNSENT = XHR_UNSENT
    public static readonly OPENED = XHR_OPENED
    public static readonly HEADERS_RECEIVED = XHR_HEADERS_RECEIVED
    public static readonly LOADING = XHR_LOADING
    public static readonly DONE = XHR_DONE

    public readonly UNSENT = XHR_UNSENT
    public readonly OPENED = XHR_OPENED
    public readonly HEADERS_RECEIVED = XHR_HEADERS_RECEIVED
    public readonly LOADING = XHR_LOADING
    public readonly DONE = XHR_DONE

    public onabort: XHRProgressHandler = null
    public onerror: XHRProgressHandler = null
    public onload: XHRProgressHandler = null
    public onloadend: XHRProgressHandler = null
    public onloadstart: XHRProgressHandler = null
    public onprogress: XHRProgressHandler = null
    public onreadystatechange: XHRReadyStateHandler = null
    public ontimeout: XHRProgressHandler = null
    public readonly impl: XMLHttpRequest = this
    public readonly upload: XMLHttpRequestUpload

    private readonly uploadImpl = new CORSXMLHttpRequestUpload()

    private _abortController: AbortController | null = null
    private _activeRequestId = 0
    private _async = true
    private _loaded = 0
    private _method = 'GET'
    private _overrideMimeType: string | null = null
    private _password: string | null = null
    private _readyState = XHR_UNSENT
    private _requestHeaders = new Map<string, { name: string; values: string[] }>()
    private _response: XMLHttpRequest['response'] = null
    private _responseHeaders = new Headers()
    private _responseHeaderText = ''
    private _responseText = ''
    private _responseType: XMLHttpRequestResponseType = ''
    private _responseURL = ''
    private _responseXML: Document | null = null
    private _sent = false
    private _status = 0
    private _statusText = ''
    private _terminal = false
    private _timeout = 0
    private _timeoutId: ReturnType<typeof setTimeout> | null = null
    private _total: number | null = null
    private _uploadComplete = false
    private _url = ''
    private _username: string | null = null
    private _withCredentials = false

    public constructor() {
      super()
      this.upload = this.uploadImpl.impl
    }

    public get readyState() {
      return this._readyState
    }

    public get response() {
      return this._response
    }

    public get responseText() {
      if (this._responseType !== '' && this._responseType !== 'text') {
        throw createDOMException(
          'InvalidStateError',
          'responseText is only available when responseType is empty or "text".',
        )
      }
      return this._responseText
    }

    public get responseType() {
      return this._responseType
    }

    public set responseType(value: XMLHttpRequestResponseType) {
      if (this._readyState === XHR_LOADING || this._readyState === XHR_DONE) {
        throw createDOMException('InvalidStateError', 'Cannot change responseType while loading.')
      }
      if (!XHR_RESPONSE_TYPES.has(value)) return
      this._responseType = value
    }

    public get responseURL() {
      return this._responseURL
    }

    public get responseXML() {
      if (this._responseType !== '' && this._responseType !== 'document') {
        throw createDOMException(
          'InvalidStateError',
          'responseXML is only available when responseType is empty or "document".',
        )
      }
      return this._responseXML
    }

    public get status() {
      return this._status
    }

    public get statusText() {
      return this._statusText
    }

    public get timeout() {
      return this._timeout
    }

    public set timeout(value: number) {
      const timeout = Number(value)
      this._timeout = Number.isFinite(timeout) && timeout > 0 ? timeout : 0
    }

    public get withCredentials() {
      return this._withCredentials
    }

    public set withCredentials(value: boolean) {
      if (this._sent) {
        throw createDOMException(
          'InvalidStateError',
          'Cannot change withCredentials after send() has been called.',
        )
      }
      this._withCredentials = Boolean(value)
    }

    public abort() {
      if (!this._sent && (this._readyState === XHR_UNSENT || this._readyState === XHR_OPENED)) {
        this.resetResponse()
        this._readyState = XHR_UNSENT
        return
      }

      this._activeRequestId += 1
      this._abortController?.abort()
      this.finishRequestError('abort')
      this._readyState = XHR_UNSENT
    }

    public getAllResponseHeaders() {
      if (this._readyState < XHR_HEADERS_RECEIVED) return ''
      return this._responseHeaderText
    }

    public getResponseHeader(name: string) {
      if (this._readyState < XHR_HEADERS_RECEIVED) return null
      try {
        return this._responseHeaders.get(name)
      } catch {
        return null
      }
    }

    public open(
      method: string,
      url: string | URL,
      async = true,
      username: string | null = null,
      password: string | null = null,
    ) {
      if (this._sent) this.abort()

      const normalizedMethod = method.toUpperCase()
      if (XHR_FORBIDDEN_METHODS.has(normalizedMethod)) {
        throw createDOMException('SecurityError', `${normalizedMethod} is not allowed by XHR.`)
      }

      const requestUrl = resolveRequestURL(url)
      this._activeRequestId += 1
      this._abortController = null
      this._async = async !== false
      this._method = normalizedMethod
      this._password = password
      this._requestHeaders.clear()
      this._terminal = false
      this._uploadComplete = false
      this._url = requestUrl.toString()
      this._username = username
      this.resetResponse()
      this.setReadyState(XHR_OPENED)
    }

    public overrideMimeType(mime: string) {
      if (this._readyState === XHR_LOADING || this._readyState === XHR_DONE) {
        throw createDOMException('InvalidStateError', 'Cannot override MIME type while loading.')
      }
      this._overrideMimeType = mime
    }

    public send(body?: XHRBody) {
      if (this._readyState !== XHR_OPENED || this._sent) {
        throw createDOMException('InvalidStateError', 'XHR must be opened before send().')
      }
      if (!this._async) {
        throw createDOMException(
          'NotSupportedError',
          'Synchronous XMLHttpRequest is not supported by the CORS adapter.',
        )
      }

      this._activeRequestId += 1
      const requestId = this._activeRequestId
      this._abortController = new AbortController()
      this._sent = true
      this._terminal = false
      this._uploadComplete = false
      this.resetResponse()
      this.startTimeout(requestId)
      this.emitProgress('loadstart')
      void this.sendAsync(requestId, body)
    }

    public setRequestHeader(name: string, value: string) {
      if (this._readyState !== XHR_OPENED || this._sent) {
        throw createDOMException(
          'InvalidStateError',
          'setRequestHeader() must be called after open() and before send().',
        )
      }

      const lowerName = name.toLowerCase()
      const existing = this._requestHeaders.get(lowerName)
      if (existing) {
        existing.values.push(value)
      } else {
        this._requestHeaders.set(lowerName, { name, values: [value] })
      }
    }

    private async sendAsync(requestId: number, body?: XHRBody) {
      try {
        const requestBody = this.getRequestBody(body)
        this.emitUploadEvents(requestBody)

        const { headers, url } = this.createRequestHeadersAndURL()
        const response = await corsFetch(
          url,
          {
            body: requestBody,
            credentials: this._withCredentials ? 'include' : 'same-origin',
            headers,
            method: this._method,
            signal: this._abortController?.signal,
          },
          force,
        )

        if (!this.isActiveRequest(requestId)) return

        this._status = response.status
        this._statusText = response.statusText
        this._responseURL = response.url
        this._responseHeaders = response.headers
        this._responseHeaderText = getHeaderText(response.headers)
        this._total = parseContentLength(response.headers)
        this.setReadyState(XHR_HEADERS_RECEIVED)

        const bytes = await this.readResponseBody(requestId, response)
        if (!this.isActiveRequest(requestId)) return

        this.setFinalResponse(bytes)
        this.clearTimeout()
        this._sent = false
        this._terminal = true
        this.setReadyState(XHR_DONE)
        this.emitProgress('load')
        this.emitProgress('loadend')
      } catch {
        if (!this.isActiveRequest(requestId) || this._terminal) return
        this.finishRequestError('error')
      }
    }

    private createRequestHeadersAndURL() {
      const headers = new Headers()
      for (const { name, values } of this._requestHeaders.values()) {
        for (const value of values) headers.append(name, value)
      }

      const url = new URL(this._url)
      const username = this._username ?? decodeURIComponent(url.username)
      const password = this._password ?? decodeURIComponent(url.password)
      url.username = ''
      url.password = ''

      if ((username || password) && !headers.has('authorization')) {
        headers.set('authorization', `Basic ${encodeBasicAuth(username, password)}`)
      }

      return { headers, url: url.toString() }
    }

    private createTextDecoder() {
      if (!this.shouldDecodeText()) return null

      const charset = this.getCharset()
      try {
        return new TextDecoder(charset)
      } catch {
        return new TextDecoder()
      }
    }

    private emitProgress(type: string, loaded = this._loaded) {
      const event = createProgressEvent(type, this.getProgressInit(loaded))
      const dispatched = super.dispatchEvent(event)
      callEventHandler(this.getProgressEventHandler(type), this.impl, event)
      return dispatched
    }

    private emitReadyStateChange() {
      const event = new Event('readystatechange')
      const dispatched = super.dispatchEvent(event)
      this.onreadystatechange?.call(this.impl, event)
      return dispatched
    }

    private emitUploadEvents(body: BodyInit | null) {
      if (body == null || this._uploadComplete) return

      const loaded = getBodyByteLength(body)
      const init: ProgressEventInit = {
        lengthComputable: loaded !== null,
        loaded: loaded ?? 0,
        total: loaded ?? 0,
      }

      this.uploadImpl.emit('loadstart', init)
      this.uploadImpl.emit('progress', init)
      this.uploadImpl.emit('load', init)
      this.uploadImpl.emit('loadend', init)
      this._uploadComplete = true
    }

    private finishRequestError(type: 'abort' | 'error' | 'timeout') {
      if (this._terminal) return

      this.clearTimeout()
      this._abortController = null
      this._sent = false
      this._terminal = true
      this.resetResponse()
      this.setReadyState(XHR_DONE)
      this.emitProgress(type)
      this.emitProgress('loadend')
    }

    private getCharset() {
      const mimeType = this._overrideMimeType ?? this._responseHeaders.get('content-type') ?? ''
      const match = /charset\s*=\s*([^;]+)/i.exec(mimeType)
      return match?.[1]?.trim() || 'utf-8'
    }

    private getProgressEventHandler(type: string): XHRProgressHandler {
      switch (type) {
        case 'abort':
          return this.onabort
        case 'error':
          return this.onerror
        case 'load':
          return this.onload
        case 'loadend':
          return this.onloadend
        case 'loadstart':
          return this.onloadstart
        case 'progress':
          return this.onprogress
        case 'timeout':
          return this.ontimeout
        default:
          return null
      }
    }

    private getProgressInit(loaded: number): ProgressEventInit {
      return { lengthComputable: this._total !== null, loaded, total: this._total ?? 0 }
    }

    private getRequestBody(body?: XHRBody): BodyInit | null {
      if (this._method === 'GET' || this._method === 'HEAD') return null
      return normalizeXHRBody(body)
    }

    private getResponseMimeType() {
      return this._overrideMimeType ?? this._responseHeaders.get('content-type') ?? ''
    }

    private isActiveRequest(requestId: number) {
      return this._activeRequestId === requestId && this._sent
    }

    private parseResponseDocument(text: string) {
      if (!text || typeof DOMParser === 'undefined') return null

      const mimeType = this.getResponseMimeType()
      const parserMimeType = /html/i.test(mimeType) ? 'text/html' : 'application/xml'
      return new DOMParser().parseFromString(text, parserMimeType)
    }

    private async readResponseBody(requestId: number, response: Response) {
      const decoder = this.createTextDecoder()
      const chunks: Uint8Array[] | null = decoder ? null : []
      const reader = response.body?.getReader()

      if (!reader) return null

      while (this.isActiveRequest(requestId)) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue

        chunks?.push(value)
        this._loaded += value.byteLength
        if (decoder) this._responseText += decoder.decode(value, { stream: true })
        this.setReadyState(XHR_LOADING)
        this.emitProgress('progress')
      }

      if (decoder) this._responseText += decoder.decode()
      return chunks ? combineUint8Arrays(chunks, this._loaded) : null
    }

    private resetResponse() {
      this._loaded = 0
      this._response = null
      this._responseHeaders = new Headers()
      this._responseHeaderText = ''
      this._responseText = ''
      this._responseURL = ''
      this._responseXML = null
      this._status = 0
      this._statusText = ''
      this._total = null
    }

    private setFinalResponse(bytes: Uint8Array | null) {
      if (!this.shouldDecodeText()) {
        const body = bytes ?? new Uint8Array()
        if (this._responseType === 'arraybuffer') {
          this._response = toArrayBuffer(body)
          return
        }
        this._response = new Blob([toArrayBuffer(body)], { type: this.getResponseMimeType() })
        return
      }

      if (this._responseType === 'json') {
        try {
          this._response = this._responseText ? JSON.parse(this._responseText) : null
        } catch {
          this._response = null
        }
        return
      }

      if (this._responseType === 'document') {
        this._responseXML = this.parseResponseDocument(this._responseText)
        this._response = this._responseXML
        return
      }

      if (this._responseType === '' && /(?:xml|html)/i.test(this.getResponseMimeType())) {
        this._responseXML = this.parseResponseDocument(this._responseText)
      }

      this._response = this._responseText
    }

    private setReadyState(readyState: number) {
      this._readyState = readyState
      this.emitReadyStateChange()
    }

    private shouldDecodeText() {
      return (
        this._responseType === '' ||
        this._responseType === 'text' ||
        this._responseType === 'json' ||
        this._responseType === 'document'
      )
    }

    private startTimeout(requestId: number) {
      this.clearTimeout()
      if (this._timeout <= 0) return

      this._timeoutId = setTimeout(() => {
        if (!this.isActiveRequest(requestId)) return
        this._abortController?.abort()
        this.finishRequestError('timeout')
      }, this._timeout)
    }

    private clearTimeout() {
      if (this._timeoutId === null) return
      clearTimeout(this._timeoutId)
      this._timeoutId = null
    }
  }

  return CORSXMLHttpRequest
}