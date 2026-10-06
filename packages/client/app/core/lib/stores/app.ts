import type { UniUser } from '@delta-comic/client-core-model'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activatedUser = shallowRef<UniUser>()

  return { activatedUser }
})