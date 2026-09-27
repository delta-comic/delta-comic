export const useGlobalVar = <T>(val: T, key: string): T => {
  const api = window.$api ?? (window.$api = { __core_lib__: {} })
  const store = api.__core_lib__ ?? (api.__core_lib__ = {})
  return (store[key] ??= val) as T
}