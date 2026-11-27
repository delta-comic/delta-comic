export { state } from './state'
export let count = 0
export function increment() {
  count++
}
export default function parse(title: string) {
  return { title }
}