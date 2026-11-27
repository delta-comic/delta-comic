import type { UniUser } from '@delta-comic/platform/model'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activatedUser = shallowRef<UniUser>()

  return { activatedUser }
})