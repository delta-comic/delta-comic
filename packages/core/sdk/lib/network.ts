import { withDiagnostic, type DiagnosticRecorder } from '@delta-comic/both'

export interface ClientNetworkRequest {
  readonly url: RequestInfo | URL
  readonly init?: RequestInit
}

export interface ClientNetwork {
  request(request: ClientNetworkRequest): Promise<Response>
  get(url: string | URL, init?: RequestInit): Promise<Response>
  post(url: string | URL, body?: BodyInit | null, init?: RequestInit): Promise<Response>
}

export const createClientNetwork = (
  diagnostics: DiagnosticRecorder,
  pluginId: string,
): ClientNetwork => {
  const request = ({ url, init }: ClientNetworkRequest) =>
    withDiagnostic(diagnostics, 'client network request', () => fetch(url, init), {
      pluginId,
      method: init?.method ?? 'GET',
      url: String(url),
    })

  return {
    request,
    get: (url, init) => request({ url, init: { ...init, method: 'GET' } }),
    post: (url, body, init) => request({ url, init: { ...init, body, method: 'POST' } }),
  }
}