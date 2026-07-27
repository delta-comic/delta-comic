import type { UniResourceProcessInstance, UniResourceType } from '@delta-comic/model'

export interface Content {
  process?: Record<string, UniResourceProcessInstance>
  types?: UniResourceType[]
}