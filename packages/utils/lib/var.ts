export const useGlobalVar = <T>(val: T, key: string): T => {
  const store = (window.$api.__core_lib__ ??= {})
  return (store[key] ??= val) as T
}