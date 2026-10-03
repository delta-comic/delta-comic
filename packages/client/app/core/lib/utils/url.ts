export const decodeURIDeep = (url: string) => {
  do {
    url = window.decodeURI(url)
  } while (url.includes('%'))
  return url
}
export const decodeURIComponentDeep = (url: string) => {
  do {
    url = window.decodeURIComponent(url)
  } while (url.includes('%'))
  return url
}