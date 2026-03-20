import axios, {
  type AxiosError,
  isCancel,
  isAxiosError,
  type AxiosResponse,
  type AxiosInstance,
  type CreateAxiosDefaults,
  type AxiosRequestConfig
} from 'axios'
import { delay } from 'es-toolkit'

export const checkType = {
  isPost: (v: { config: { method?: string } }) => /^post$/i.test(v.config.method ?? ''),
  isPut: (v: { config: { method?: string } }) => /^put$/i.test(v.config.method ?? ''),
  isGet: (v: { config: { method?: string } }) => /^get$/i.test(v.config.method ?? '')
}
export const interceptors = {
  checkIsAxiosError<T extends object>(err: any): err is AxiosError<T, any> {
    if ('__isAxiosError' in err) return <boolean>err.__isAxiosError
    return (err.__isAxiosError = !isCancel(err) && isAxiosError(err))
  },
  async useUnreadableRetry<T extends () => Promise<AxiosResponse>>(
    fn: T,
    times = 0
  ): Promise<Awaited<ReturnType<T>>['data']> {
    try {
      return (await fn()).data
    } catch (error) {
      if (error instanceof Error && error.message.includes('Illegal invocation')) {
        if (times > 20) {
          throw error
        }
        return await this.useUnreadableRetry(fn, times + 1)
      }
      throw error
    }
  },
  async useForceRetry<T extends () => Promise<AxiosResponse>>(
    fn: T,
    times = 0
  ): Promise<Awaited<ReturnType<T>>['data']> {
    try {
      return (await fn()).data
    } catch (error) {
      if (error instanceof Error) {
        if (times > 20) {
          throw error
        }
        return await this.useForceRetry(fn, times + 1)
      }
      throw error
    }
  },
  createAutoRetry(api: AxiosInstance, times = 3) {
    return async (err: any) => {
      if (!err.config || err.config.disretry || (err.config.__retryCount ?? 0) >= times)
        throw Promise.reject(err)
      err.config.__retryCount = (err.config.__retryCount ?? 0) + 1
      await delay(500 * err.config.__retryCount)
      return api(err.config)
    }
  },
  isClientError(err: any) {
    if (err?.response?.status?.toString().startsWith('4')) throw Promise.reject(err)
    return Promise.reject(err)
  },
  passCorsError(err: any) {
    if (!this.checkIsAxiosError(err)) return Promise.reject(err)
    if (err.code === 'ERR_NETWORK' && !err.response) throw Promise.reject(err)
    return Promise.reject(err)
  }
}

export type Requester = ReturnType<typeof createAxios>
export const createAxios = (
  fork: () => Promise<string> | string,
  config: CreateAxiosDefaults & Partial<{ noPassClientError: boolean }> = {},
  middle?: (axios: AxiosInstance) => AxiosInstance
) => {
  const api = axios.create(config)
  middle?.(api)

  api.interceptors.request.use(async requestConfig => {
    requestConfig.baseURL ??= await fork()
    return requestConfig
  })
  if (!config.noPassClientError)
    api.interceptors.response.use(undefined, interceptors.isClientError)
  api.interceptors.response.use(undefined, interceptors.createAutoRetry(api, 10))
  return {
    get: async <T>(url: string, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.get<T>(url, config)),
    post: async <T>(url: string, data?: any, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.post<T>(url, data, config)),
    postForm: async <T>(url: string, data?: any, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.postForm<T>(url, data, config)),
    put: async <T>(url: string, data?: any, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.put<T>(url, data, config)),
    putForm: async <T>(url: string, data?: any, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.putForm<T>(url, data, config)),
    delete: async <T>(url: string, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.delete<T>(url, config)),
    patch: async <T>(url: string, data?: any, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.patch<T>(url, data, config)),
    patchForm: async <T>(url: string, data?: any, config: AxiosRequestConfig = {}) =>
      interceptors.useUnreadableRetry(() => api.patchForm<T>(url, data, config))
  }
}