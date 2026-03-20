import type { uni } from '@delta-comic/model'

export interface Content {
  process?: Record<string, uni.resource.ProcessInstance>
  types?: uni.resource.ResourceType[]
}