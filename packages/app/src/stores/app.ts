import { uni } from '@delta-comic/model'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useAppStore = defineStore('app', () => {
  const activatedUser = shallowRef<uni.user.User>()

  return { activatedUser }
})