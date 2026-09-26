import { withDiagnostic, type DiagnosticRecorder } from '@delta-comic/both'

export interface ClientNetworkRequest {
  readonly url: string | URL
  readonly init?: RequestInit
}

export interface ClientNetworkTransport {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export interface ClientNetwork {
  request(request: ClientNetworkRequest): Promise<Response>
  get(url: string | URL, init?: RequestInit): Promise<Response>
  post(url: string | URL, body?: BodyInit | null, init?: RequestInit): Promise<Response>
}

export interface ClientNetworkOptions {
  readonly transport?: ClientNetworkTransport
}

const defaultTransport: ClientNetworkTransport = {
  fetch: (input, init) => globalThis.fetch(input, init),
}

export const createClientNetwork = (
  diagnostics: DiagnosticRecorder,
  pluginId: string,
  options: ClientNetworkOptions = {},
): ClientNetwork => {
  const transport = options.transport ?? defaultTransport
  const request = (request: ClientNetworkRequest) =>
    withDiagnostic(
      diagnostics,
      'client network request',
      () => transport.fetch(request.url, request.init),
      { pluginId, method: request.init?.method ?? 'GET', url: String(request.url) },
    )

  return {
    request,
    get: (url, init) => request({ url, init: { ...init, method: 'GET' } }),
    post: (url, body, init) => request({ url, init: { ...init, body, method: 'POST' } }),
  }
}