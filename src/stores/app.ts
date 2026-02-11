import { defineStore } from 'pinia'
import { type Component, type VNode } from 'vue'
import { shallowReactive } from 'vue'
export const useAppStore = defineStore('app', () => {
  const renderRootNodes = shallowReactive<(VNode | Component)[]>([])
  return { renderRootNodes }
})