import { twMerge } from 'tailwind-merge'
import type { StyleValue } from 'vue'

export type StyleProps = { style?: StyleValue; class?: any }
export function cn(...args: any[]): string {
  return twMerge(...args)
}